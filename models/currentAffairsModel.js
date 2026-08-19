import db from "../config/db.js";

const optionalValue = (value) => value === "" || value === undefined ? null : value;

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
                [
                    courseId,
                    data.ad.isEnabled,
                    optionalValue(data.ad.startDate),
                    optionalValue(data.ad.endDate),
                    optionalValue(data.ad.imagePath),
                    optionalValue(data.ad.linkType),
                    optionalValue(data.ad.imageUrl),
                    optionalValue(data.ad.buttonUrl)
                ]
            );
        }

        if (data.notification) {
            await connection.execute(
                `INSERT INTO current_affairs_notifications
                    (course_id, is_enabled, title, description, start_date, end_date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    courseId,
                    data.notification.isEnabled,
                    optionalValue(data.notification.title),
                    optionalValue(data.notification.description),
                    optionalValue(data.notification.startDate),
                    optionalValue(data.notification.endDate)
                ]
            );
        }

        if (data.document) {
            await connection.execute(
                `INSERT INTO current_affairs_documents
                    (course_id, document_type, document_name, file_path)
                 VALUES (?, ?, ?, ?)`,
                [
                    courseId,
                    data.document.type,
                    optionalValue(data.document.name),
                    optionalValue(data.document.filePath)
                ]
            );
        }

        if (data.offer) {
            await connection.execute(
                `INSERT INTO current_affairs_offers
                    (course_id, offer_name, discount_type, discount_value, is_active)
                 VALUES (?, ?, ?, ?, 1)`,
                [
                    courseId,
                    data.offer.name,
                    data.offer.type,
                    data.offer.value
                ]
            );
        }

        await connection.commit();
        return courseId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
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

const listPublicCurrentAffairs = async ({ limit, offset }) => {
    const [courses] = await db.execute(
        `SELECT
            c.id, c.course_name, c.short_description, c.long_description,
            c.default_image_path, c.start_date, c.end_date, c.status,
            p.base_price, p.gst_enabled, p.gst_percent,
            p.platform_charge_enabled, p.platform_charge
         FROM current_affairs_courses c
         INNER JOIN current_affairs_pricing p ON p.course_id = c.id
         WHERE c.status IN ('PUBLISHED', 'COMING_SOON')
           AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
         ORDER BY c.start_date DESC, c.id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
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

    return courses.map((course) => ({
        ...course,
        offers: offers.filter((item) => item.course_id === course.id),
        notifications: notifications.filter((item) => item.course_id === course.id),
        documents: documents.filter((item) => item.course_id === course.id)
    }));
};

export { createCurrentAffairsCourse, listCurrentAffairsCourses, listPublicCurrentAffairs };
