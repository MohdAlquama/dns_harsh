import db from "../config/db.js";

class OfferCodeError extends Error {
    constructor(message, status = 422, code = "OFFER_NOT_ELIGIBLE") {
        super(message);
        this.name = "OfferCodeError";
        this.status = status;
        this.code = code;
    }
}

const normalizeOfferCode = (value) => String(value || "").trim().toUpperCase();

const assertOfferShape = (offer, { courseId, subtotal }) => {
    if (!offer || !offer.is_active) throw new OfferCodeError("Offer code is invalid or inactive", 404, "OFFER_INVALID");
    const now = Date.now();
    if (offer.valid_from && new Date(offer.valid_from).getTime() > now) throw new OfferCodeError("Offer code is not active yet");
    if (offer.valid_until && new Date(offer.valid_until).getTime() < now) throw new OfferCodeError("Offer code has expired", 410, "OFFER_EXPIRED");
    if (offer.course_id && Number(offer.course_id) !== Number(courseId)) throw new OfferCodeError("Offer code is not valid for this course");
    if (Number(subtotal) < Number(offer.min_order_amount || 0)) {
        throw new OfferCodeError(`Minimum order amount is ₹${Number(offer.min_order_amount).toFixed(2)}`);
    }
};

const assertUsageAvailable = async (executor, offer, userId) => {
    const [assignments] = await executor.execute(
        `SELECT COUNT(*) AS total, COALESCE(SUM(user_id = ?), 0) AS matched
         FROM payment_offer_user_assignments WHERE offer_code_id = ?`, [userId, offer.id]
    );
    if (Number(assignments[0]?.total || 0) > 0 && Number(assignments[0]?.matched || 0) === 0) {
        throw new OfferCodeError("This offer code is not assigned to your account", 403, "OFFER_NOT_ASSIGNED");
    }
    const [rows] = await executor.execute(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(user_id = ?), 0) AS user_total
         FROM payment_offer_redemptions
         WHERE offer_code_id = ? AND status IN ('RESERVED','REDEEMED')`,
        [userId, offer.id]
    );
    const total = Number(rows[0]?.total || 0);
    const userTotal = Number(rows[0]?.user_total || 0);
    if (offer.total_usage_limit !== null && total >= Number(offer.total_usage_limit)) {
        throw new OfferCodeError("Offer code usage limit has been reached", 409, "OFFER_LIMIT_REACHED");
    }
    if (userTotal >= Number(offer.per_user_limit)) {
        throw new OfferCodeError("You have already used this offer code", 409, "OFFER_USER_LIMIT_REACHED");
    }
};

const findOfferByCode = async ({ code, userId, courseId, subtotal }) => {
    const normalized = normalizeOfferCode(code);
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new OfferCodeError("Enter a valid offer code", 400, "OFFER_CODE_INVALID");
    const [rows] = await db.execute(`SELECT * FROM payment_offer_codes WHERE code = ? LIMIT 1`, [normalized]);
    const offer = rows[0];
    assertOfferShape(offer, { courseId, subtotal });
    await assertUsageAvailable(db, offer, userId);
    return offer;
};

const lockOfferForRedemption = async (connection, { offerId, userId, courseId, subtotal }) => {
    const [rows] = await connection.execute(`SELECT * FROM payment_offer_codes WHERE id = ? FOR UPDATE`, [offerId]);
    const offer = rows[0];
    assertOfferShape(offer, { courseId, subtotal });
    await assertUsageAvailable(connection, offer, userId);
    return offer;
};

const listOfferCodes = async () => {
    const [rows] = await db.execute(
        `SELECT o.*, c.course_name,
                (SELECT COUNT(*) FROM payment_offer_redemptions r
                 WHERE r.offer_code_id = o.id AND r.status IN ('RESERVED','REDEEMED')) AS reserved_or_redeemed,
                (SELECT COUNT(*) FROM payment_offer_redemptions r
                 WHERE r.offer_code_id = o.id AND r.status = 'REDEEMED') AS redeemed,
                (SELECT GROUP_CONCAT(u.phone_number ORDER BY u.phone_number SEPARATOR ', ')
                 FROM payment_offer_user_assignments a
                 INNER JOIN auth_users u ON u.id = a.user_id
                 WHERE a.offer_code_id = o.id) AS assigned_phones
         FROM payment_offer_codes o
         LEFT JOIN current_affairs_courses c ON c.id = o.course_id
         ORDER BY o.id DESC`
    );
    return rows;
};

const createOfferCode = async (data) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
            `INSERT INTO payment_offer_codes
             (code, name, course_id, discount_type, discount_value, min_order_amount,
              max_discount_amount, total_usage_limit, per_user_limit, valid_from,
              valid_until, stack_with_course_offer, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.code, data.name, data.courseId, data.discountType, data.discountValue,
                data.minOrderAmount, data.maxDiscountAmount, data.totalUsageLimit,
                data.perUserLimit, data.validFrom, data.validUntil,
                data.stackWithCourseOffer, data.isActive]
        );
        if (data.eligibleUserId) await connection.execute(
            `INSERT INTO payment_offer_user_assignments (offer_code_id, user_id) VALUES (?, ?)`,
            [result.insertId, data.eligibleUserId]
        );
        await connection.commit();
        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const setOfferCodeStatus = async (id, isActive) => {
    const [result] = await db.execute(`UPDATE payment_offer_codes SET is_active = ? WHERE id = ?`, [isActive, id]);
    return result.affectedRows > 0;
};

export {
    OfferCodeError, createOfferCode, findOfferByCode, listOfferCodes, lockOfferForRedemption,
    normalizeOfferCode, setOfferCodeStatus
};
