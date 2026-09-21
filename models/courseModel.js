import db from "../config/db.js";

const optionalValue = (value) =>
    value === "" || value === undefined ? null : value;

const parseJson = (value) => {
    if (value === null || value === undefined || value === "") return {};
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

const normalizeModules = (rows = []) =>
    rows.map((row) => ({
        key: row.module_key,
        enabled: Boolean(row.is_enabled),
        sortOrder: Number(row.sort_order),
        content: parseJson(row.content_json)
    }));

const insertRelatedSettings = async (connection, courseId, data) => {
    const pricing = data.pricing || {};

    await connection.execute(
        `INSERT INTO course_pricing
            (course_id, base_price, gst_enabled, gst_percent,
             platform_charge_enabled, platform_charge)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            courseId,
            Number(pricing.base_price || 0),
            Number(pricing.gst_enabled) ? 1 : 0,
            optionalValue(pricing.gst_percent),
            Number(pricing.platform_charge_enabled) ? 1 : 0,
            optionalValue(pricing.platform_charge)
        ]
    );

    if (data.ads) {
        await connection.execute(
            `INSERT INTO course_ads
                (course_id, is_enabled, start_date, end_date, image_path,
                 link_type, image_url, button_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                courseId,
                Number(data.ads.is_enabled) ? 1 : 0,
                optionalValue(data.ads.start_date),
                optionalValue(data.ads.end_date),
                optionalValue(data.ads.image_path),
                optionalValue(data.ads.link_type),
                optionalValue(data.ads.image_url),
                optionalValue(data.ads.button_url)
            ]
        );
    }

    if (data.notification) {
        await connection.execute(
            `INSERT INTO course_notifications
                (course_id, is_enabled, title, description, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                courseId,
                Number(data.notification.is_enabled) ? 1 : 0,
                optionalValue(data.notification.title),
                optionalValue(data.notification.description),
                optionalValue(data.notification.start_date),
                optionalValue(data.notification.end_date)
            ]
        );
    }

    if (data.offer && Number(data.offer.is_active) === 1) {
        const offerName = String(data.offer.offer_name || "").trim();

        if (offerName) {
            await connection.execute(
                `INSERT INTO course_offers
                    (course_id, offer_name, discount_type, discount_value, is_active)
                 VALUES (?, ?, ?, ?, 1)`,
                [
                    courseId,
                    offerName,
                    data.offer.discount_type === "FIXED" ? "FIXED" : "PERCENT",
                    Number(data.offer.discount_value || 0)
                ]
            );
        }
    }

    for (const module of data.modules || []) {
        await connection.execute(
            `INSERT INTO course_modules
                (course_id, module_key, is_enabled, sort_order, content_json)
             VALUES (?, ?, ?, ?, ?)`,
            [
                courseId,
                module.module_key,
                Number(module.is_enabled) ? 1 : 0,
                Number(module.sort_order || 0),
                JSON.stringify(
                    module.content_json && typeof module.content_json === "object"
                        ? module.content_json
                        : {}
                )
            ]
        );
    }
};

const normalizeCourseId = (courseId) => {
    const id = Number(courseId);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Invalid course ID.");
    }

    return id;
};

export const createCourse = async (data) => {
    const subjectId = Number(data.subject_folder_id);
    const courseName = String(data.course_name || "").trim();
    const slug = String(data.slug || "").trim();
    const price = Number(data.price ?? data.pricing?.base_price ?? 0);

    if (!Number.isInteger(subjectId) || subjectId <= 0) {
        throw new Error("Please select a valid subject.");
    }

    if (!courseName) throw new Error("Course name is required.");
    if (!slug) throw new Error("Course slug is required.");
    if (!Number.isFinite(price) || price < 0) {
        throw new Error("Invalid course price.");
    }

    const [subjectRows] = await db.execute(
        `SELECT id FROM course_organizations WHERE id = ? LIMIT 1`,
        [subjectId]
    );

    if (!subjectRows.length) {
        throw new Error("Invalid subject selected.");
    }

    const [slugRows] = await db.execute(
        `SELECT id FROM courses WHERE slug = ? LIMIT 1`,
        [slug]
    );

    if (slugRows.length) {
        throw new Error("A course with this slug already exists.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO courses
                (name, subject_folder_id, slug, short_description,
                 long_description, cover_image_url, price,
                 start_date, end_date, coming_soon, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                courseName,
                subjectId,
                slug,
                optionalValue(data.short_description),
                optionalValue(data.long_description),
                optionalValue(data.cover_image_url),
                price,
                optionalValue(data.course_start_date),
                optionalValue(data.course_end_date),
                Number(data.coming_soon) ? 1 : 0,
                data.status === "PUBLISHED" && !Number(data.coming_soon)
                    ? "PUBLISHED"
                    : "DRAFT"
            ]
        );

        await insertRelatedSettings(connection, result.insertId, data);
        await connection.commit();

        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

export const updateCourse = async (courseId, data) => {
    const id = normalizeCourseId(courseId);
    const subjectId = Number(data.subject_folder_id);
    const courseName = String(data.course_name || "").trim();
    const slug = String(data.slug || "").trim();
    const price = Number(data.price ?? data.pricing?.base_price ?? 0);

    if (!Number.isInteger(subjectId) || subjectId <= 0) {
        throw new Error("Please select a valid subject.");
    }

    if (!courseName) throw new Error("Course name is required.");
    if (!slug) throw new Error("Course slug is required.");
    if (!Number.isFinite(price) || price < 0) {
        throw new Error("Invalid course price.");
    }

    const [subjectRows] = await db.execute(
        `SELECT id FROM course_organizations WHERE id = ? LIMIT 1`,
        [subjectId]
    );

    if (!subjectRows.length) throw new Error("Invalid subject selected.");

    const [slugRows] = await db.execute(
        `SELECT id FROM courses WHERE slug = ? AND id <> ? LIMIT 1`,
        [slug, id]
    );

    if (slugRows.length) {
        throw new Error("A course with this slug already exists.");
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `UPDATE courses
             SET name = ?, subject_folder_id = ?, slug = ?,
                 short_description = ?, long_description = ?,
                 cover_image_url = ?, price = ?, start_date = ?,
                 end_date = ?, coming_soon = ?, status = ?
             WHERE id = ?`,
            [
                courseName,
                subjectId,
                slug,
                optionalValue(data.short_description),
                optionalValue(data.long_description),
                optionalValue(data.cover_image_url),
                price,
                optionalValue(data.course_start_date),
                optionalValue(data.course_end_date),
                Number(data.coming_soon) ? 1 : 0,
                data.status === "PUBLISHED" && !Number(data.coming_soon)
                    ? "PUBLISHED"
                    : "DRAFT",
                id
            ]
        );

        if (!result.affectedRows) throw new Error("Course not found.");

        for (const table of [
            "course_pricing",
            "course_ads",
            "course_notifications",
            "course_offers",
            "course_modules"
        ]) {
            await connection.execute(
                `DELETE FROM ${table} WHERE course_id = ?`,
                [id]
            );
        }

        await insertRelatedSettings(connection, id, data);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getCoursePricing = async (courseId, connection = db) => {
    const [rows] = await connection.execute(
        `SELECT course_id, base_price, gst_enabled, gst_percent,
                platform_charge_enabled, platform_charge
         FROM course_pricing WHERE course_id = ? LIMIT 1`,
        [courseId]
    );

    return rows[0] || null;
};

const getCourseAds = async (courseId, connection = db) => {
    const [rows] = await connection.execute(
        `SELECT * FROM course_ads WHERE course_id = ? ORDER BY id DESC LIMIT 1`,
        [courseId]
    );

    return rows[0] || null;
};

const getCourseNotification = async (courseId, connection = db) => {
    const [rows] = await connection.execute(
        `SELECT * FROM course_notifications WHERE course_id = ? ORDER BY id DESC LIMIT 1`,
        [courseId]
    );

    return rows[0] || null;
};

const getCourseOffer = async (courseId, connection = db) => {
    const [rows] = await connection.execute(
        `SELECT * FROM course_offers WHERE course_id = ? ORDER BY id DESC LIMIT 1`,
        [courseId]
    );

    return rows[0] || null;
};

const getCourseModules = async (courseId, connection = db) => {
    const [rows] = await connection.execute(
        `SELECT module_key, is_enabled, sort_order, content_json
         FROM course_modules WHERE course_id = ? ORDER BY sort_order, id`,
        [courseId]
    );

    return normalizeModules(rows);
};

export const getCourseById = async (courseId) => {
    const id = normalizeCourseId(courseId);

    const [rows] = await db.execute(
        `SELECT c.id, c.name AS course_name, c.subject_folder_id,
                o.folder_name AS subject_name, c.slug,
                c.short_description, c.long_description,
                c.cover_image_url, c.price, c.start_date,
                c.end_date, c.coming_soon, c.status,
                c.created_at, c.updated_at
         FROM courses c
         LEFT JOIN course_organizations o ON o.id = c.subject_folder_id
         WHERE c.id = ? LIMIT 1`,
        [id]
    );

    if (!rows[0]) return null;

    const course = rows[0];
    course.pricing = await getCoursePricing(id);
    course.ads = await getCourseAds(id);
    course.notification = await getCourseNotification(id);
    course.offer = await getCourseOffer(id);
    course.modules = await getCourseModules(id);

    return course;
};

export const getAllCourses = async () => {
    const [rows] = await db.execute(
        `SELECT c.id, c.name AS course_name, c.slug,
                c.subject_folder_id, o.folder_name AS subject_name,
                c.short_description, c.long_description,
                c.cover_image_url, c.price, c.start_date,
                c.end_date, c.coming_soon, c.status,
                c.created_at, c.updated_at
         FROM courses c
         LEFT JOIN course_organizations o ON o.id = c.subject_folder_id
         ORDER BY c.id DESC`
    );

    return rows;
};

export const getCourseSubjects = async () => {
    const [rows] = await db.execute(
        `SELECT id, folder_name, course_name
         FROM course_organizations
         WHERE parent_id IS NULL
         ORDER BY folder_name ASC, id ASC`
    );

    return rows;
};

export const publishCourse = async (courseId) => {
    const id = normalizeCourseId(courseId);

    const [result] = await db.execute(
        `UPDATE courses SET status = 'PUBLISHED', coming_soon = 0 WHERE id = ?`,
        [id]
    );

    if (!result.affectedRows) throw new Error("Course not found.");
    return result;
};

export const deleteCourse = async (courseId) => {
    const id = normalizeCourseId(courseId);

    const [activeRows] = await db.execute(
        `SELECT id FROM course_enrollments
         WHERE course_id = ? AND status = 'ACTIVE' LIMIT 1`,
        [id]
    );

    if (activeRows.length) {
        throw new Error("This course has active students and cannot be deleted.");
    }

    const [result] = await db.execute(
        `DELETE FROM courses WHERE id = ?`,
        [id]
    );

    if (!result.affectedRows) throw new Error("Course not found.");
    return result;
};

export const getPublishedCourses = async () => {
    const [rows] = await db.execute(
        `SELECT c.id, c.name AS course_name, c.slug,
                c.short_description, c.long_description,
                c.cover_image_url, c.price, c.status,
                c.subject_folder_id, o.folder_name AS subject_name,
                c.start_date, c.end_date, c.coming_soon
         FROM courses c
         LEFT JOIN course_organizations o ON o.id = c.subject_folder_id
         WHERE c.status = 'PUBLISHED'
         ORDER BY c.id DESC`
    );

    return rows;
};

export const getPublishedCourseById = async (courseId) => {
    const id = normalizeCourseId(courseId);

    const [rows] = await db.execute(
        `SELECT c.id, c.name AS course_name, c.slug,
                c.short_description, c.long_description,
                c.cover_image_url, c.price, c.status,
                c.subject_folder_id, o.folder_name AS subject_name,
                c.start_date, c.end_date, c.coming_soon
         FROM courses c
         LEFT JOIN course_organizations o ON o.id = c.subject_folder_id
         WHERE c.id = ? AND c.status = 'PUBLISHED' LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};
