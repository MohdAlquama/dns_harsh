import db from "../config/db.js";

const optionalValue = (value) => value === "" || value === undefined ? null : value;

const parseJson = (value) => {
    if (value === null || value === undefined) return {};
    if (typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return {}; }
};

const normalizeModules = (rows = []) => rows.map((row) => ({
    key: row.module_key,
    enabled: Boolean(row.is_enabled),
    sortOrder: Number(row.sort_order),
    content: parseJson(row.content_json)
}));

const insertRelatedSettings = async (connection, courseId, data) => {
    await connection.execute(
        `INSERT INTO current_affairs_pricing
            (course_id, base_price, gst_enabled, gst_percent,
             platform_charge_enabled, platform_charge)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            courseId,
            data.pricing.basePrice,
            data.pricing.gstEnabled,
            optionalValue(data.pricing.gstPercent),
            data.pricing.platformChargeEnabled,
            optionalValue(data.pricing.platformCharge)
        ]
    );

    if (data.ad) {
        await connection.execute(
            `INSERT INTO current_affairs_ads
                (course_id, is_enabled, start_date, end_date, image_path,
                 link_type, image_url, button_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [courseId, data.ad.isEnabled, optionalValue(data.ad.startDate),
                optionalValue(data.ad.endDate), optionalValue(data.ad.imagePath),
                optionalValue(data.ad.linkType), optionalValue(data.ad.imageUrl),
                optionalValue(data.ad.buttonUrl)]
        );
    }

    if (data.notification) {
        await connection.execute(
            `INSERT INTO current_affairs_notifications
                (course_id, is_enabled, title, description, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [courseId, data.notification.isEnabled, optionalValue(data.notification.title),
                optionalValue(data.notification.description),
                optionalValue(data.notification.startDate), optionalValue(data.notification.endDate)]
        );
    }

    if (data.document) {
        await connection.execute(
            `INSERT INTO current_affairs_documents
                (course_id, document_type, document_name, file_path)
             VALUES (?, ?, ?, ?)`,
            [courseId, data.document.type, optionalValue(data.document.name),
                optionalValue(data.document.filePath)]
        );
    }

    if (data.offer) {
        await connection.execute(
            `INSERT INTO current_affairs_offers
                (course_id, offer_name, discount_type, discount_value, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [courseId, data.offer.name, data.offer.type, data.offer.value]
        );
    }

    for (const module of data.modules || []) {
        await connection.execute(
            `INSERT INTO current_affairs_modules
                (course_id, module_key, is_enabled, sort_order, content_json)
             VALUES (?, ?, ?, ?, ?)`,
            [courseId, module.key, module.enabled, module.sortOrder, JSON.stringify(module.content)]
        );
    }
};

const createCurrentAffairsCourse = async (data) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [courseResult] = await connection.execute(
            `INSERT INTO current_affairs_courses
                (course_name, short_description, long_description, default_image_path,
                 start_date, end_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                data.courseName,
                optionalValue(data.shortDescription),
                optionalValue(data.longDescription),
                optionalValue(data.defaultImagePath),
                optionalValue(data.startDate),
                optionalValue(data.endDate),
                data.status
            ]
        );

        const courseId = courseResult.insertId;

        await insertRelatedSettings(connection, courseId, data);

        await connection.commit();
        return courseId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getCurrentAffairsCourseById = async (id) => {
    const [courses] = await db.execute(
        `SELECT c.*, p.base_price, p.gst_enabled, p.gst_percent,
                p.platform_charge_enabled, p.platform_charge
         FROM current_affairs_courses c
         INNER JOIN current_affairs_pricing p ON p.course_id = c.id
         WHERE c.id = ?`,
        [id]
    );
    if (!courses[0]) return null;

    const [[ads], [notifications], [documents], [offers], [modules]] = await Promise.all([
        db.execute(`SELECT * FROM current_affairs_ads WHERE course_id = ? ORDER BY id DESC LIMIT 1`, [id]),
        db.execute(`SELECT * FROM current_affairs_notifications WHERE course_id = ? ORDER BY id DESC LIMIT 1`, [id]),
        db.execute(`SELECT * FROM current_affairs_documents WHERE course_id = ? ORDER BY id DESC LIMIT 1`, [id]),
        db.execute(`SELECT * FROM current_affairs_offers WHERE course_id = ? ORDER BY id DESC LIMIT 1`, [id]),
        db.execute(`SELECT module_key, is_enabled, sort_order, content_json
                    FROM current_affairs_modules WHERE course_id = ? ORDER BY sort_order, id`, [id])
    ]);

    return {
        ...courses[0],
        ad: ads[0] || null,
        notification: notifications[0] || null,
        document: documents[0] || null,
        offer: offers[0] || null,
        modules: normalizeModules(modules)
    };
};

const updateCurrentAffairsCourse = async (id, data) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
            `UPDATE current_affairs_courses
             SET course_name = ?, short_description = ?, long_description = ?,
                 default_image_path = ?, start_date = ?, end_date = ?, status = ?
             WHERE id = ?`,
            [data.courseName, optionalValue(data.shortDescription), optionalValue(data.longDescription),
                optionalValue(data.defaultImagePath), optionalValue(data.startDate),
                optionalValue(data.endDate), data.status, id]
        );
        if (result.affectedRows === 0) {
            const error = new Error("Current Affairs course not found");
            error.code = "NOT_FOUND";
            throw error;
        }

        await connection.execute(`DELETE FROM current_affairs_pricing WHERE course_id = ?`, [id]);
        await connection.execute(`DELETE FROM current_affairs_ads WHERE course_id = ?`, [id]);
        await connection.execute(`DELETE FROM current_affairs_notifications WHERE course_id = ?`, [id]);
        await connection.execute(`DELETE FROM current_affairs_documents WHERE course_id = ?`, [id]);
        await connection.execute(`DELETE FROM current_affairs_offers WHERE course_id = ?`, [id]);
        await connection.execute(`DELETE FROM current_affairs_modules WHERE course_id = ?`, [id]);
        await insertRelatedSettings(connection, id, data);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const deleteCurrentAffairsCourse = async (id) => {
    const [result] = await db.execute(`DELETE FROM current_affairs_courses WHERE id = ?`, [id]);
    return result.affectedRows > 0;
};

const listCurrentAffairsCourses = async () => {
    const [rows] = await db.execute(
        `SELECT
            c.id,
            c.course_name,
            c.status,
            c.start_date,
            c.end_date,
            c.created_at,
            p.base_price,
            p.gst_enabled,
            p.gst_percent,
            p.platform_charge
         FROM current_affairs_courses c
         INNER JOIN current_affairs_pricing p ON p.course_id = c.id
         ORDER BY c.id DESC`
    );

    return rows;
};

const listPublicCurrentAffairs = async ({ limit, offset, search = "" }) => {
    // mysql2/MySQL combinations can reject native prepared placeholders in
    // LIMIT/OFFSET. Values are already bounded integers in the controller;
    // query() safely formats them as numeric literals.
    const searchClause = search ? "AND (c.course_name LIKE ? OR c.short_description LIKE ?)" : "";
    const searchValues = search ? [`%${search}%`, `%${search}%`] : [];
    const [courses] = await db.query(
        `SELECT
            c.id, c.course_name, c.short_description, c.long_description,
            c.default_image_path, c.start_date, c.end_date, c.status,
            p.base_price, p.gst_enabled, p.gst_percent,
            p.platform_charge_enabled, p.platform_charge
         FROM current_affairs_courses c
         INNER JOIN current_affairs_pricing p ON p.course_id = c.id
         WHERE c.status IN ('PUBLISHED', 'COMING_SOON')
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
           ${searchClause}
         ORDER BY c.start_date DESC, c.id DESC
         LIMIT ? OFFSET ?`,
        [...searchValues, limit, offset]
    );

    if (courses.length === 0) return [];
    const ids = courses.map((course) => course.id);
    const placeholders = ids.map(() => "?").join(",");
    const [offers] = await db.execute(
        `SELECT course_id, id, offer_name, discount_type, discount_value
         FROM current_affairs_offers
         WHERE is_active = 1 AND course_id IN (${placeholders})`,
        ids
    );
    const [notifications] = await db.execute(
        `SELECT course_id, id, title, description, start_date, end_date
         FROM current_affairs_notifications
         WHERE is_enabled = 1
           AND (start_date IS NULL OR start_date <= CURRENT_DATE)
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
           AND course_id IN (${placeholders})`,
        ids
    );
    const [documents] = await db.execute(
        `SELECT course_id, id, document_type, document_name, file_path
         FROM current_affairs_documents
         WHERE status = 'ACTIVE' AND course_id IN (${placeholders})`,
        ids
    );
    const [modules] = await db.execute(
        `SELECT course_id, module_key, is_enabled, sort_order, content_json
         FROM current_affairs_modules
         WHERE is_enabled = 1 AND course_id IN (${placeholders})
         ORDER BY sort_order, id`,
        ids
    );

    return courses.map((course) => ({
        ...course,
        offers: offers.filter((item) => item.course_id === course.id),
        notifications: notifications.filter((item) => item.course_id === course.id),
        documents: documents.filter((item) => item.course_id === course.id),
        modules: normalizeModules(modules.filter((item) => item.course_id === course.id))
    }));
};

const countPublicCurrentAffairs = async ({ search = "" } = {}) => {
    const searchClause = search ? "AND (c.course_name LIKE ? OR c.short_description LIKE ?)" : "";
    const values = search ? [`%${search}%`, `%${search}%`] : [];
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS total
         FROM current_affairs_courses c
         WHERE c.status IN ('PUBLISHED', 'COMING_SOON')
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
           ${searchClause}`,
        values
    );
    return Number(rows[0]?.total || 0);
};

const getPublicCurrentAffairsById = async (id) => {
    const [courses] = await db.execute(
        `SELECT
            c.id, c.course_name, c.short_description, c.long_description,
            c.default_image_path, c.start_date, c.end_date, c.status,
            p.base_price, p.gst_enabled, p.gst_percent,
            p.platform_charge_enabled, p.platform_charge
         FROM current_affairs_courses c
         INNER JOIN current_affairs_pricing p ON p.course_id = c.id
         WHERE c.id = ? AND c.status IN ('PUBLISHED', 'COMING_SOON')
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
         LIMIT 1`,
        [id]
    );
    if (!courses[0]) return null;

    const [[offers], [notifications], [documents], [modules]] = await Promise.all([
        db.execute(`SELECT course_id, id, offer_name, discount_type, discount_value
                    FROM current_affairs_offers WHERE course_id = ? AND is_active = 1`, [id]),
        db.execute(`SELECT course_id, id, title, description, start_date, end_date
                    FROM current_affairs_notifications
                    WHERE course_id = ? AND is_enabled = 1
                      AND (start_date IS NULL OR start_date <= CURRENT_DATE)
                      AND (end_date IS NULL OR end_date >= CURRENT_DATE)`, [id]),
        db.execute(`SELECT course_id, id, document_type, document_name, file_path
                    FROM current_affairs_documents WHERE course_id = ? AND status = 'ACTIVE'`, [id]),
        db.execute(`SELECT course_id, module_key, is_enabled, sort_order, content_json
                    FROM current_affairs_modules
                    WHERE course_id = ? AND is_enabled = 1 ORDER BY sort_order, id`, [id])
    ]);

    return {
        ...courses[0], offers, notifications, documents,
        modules: normalizeModules(modules)
    };
};

export {
    createCurrentAffairsCourse,
    countPublicCurrentAffairs,
    deleteCurrentAffairsCourse,
    getCurrentAffairsCourseById,
    getPublicCurrentAffairsById,
    listCurrentAffairsCourses,
    listPublicCurrentAffairs,
    updateCurrentAffairsCourse
};
