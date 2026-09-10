import db from "../config/db.js";


// ========================================
// HELPERS
// ========================================

const toBoolean = (value) => {
    return (
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true"
    );
};

const nullableValue = (value) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    return value;
};


// ========================================
// ACTIVE VERSION HANDLING
// ========================================

const deactivateConflictingVersions = async (
    connection,
    id,
    platform
) => {
    if (platform === "BOTH") {
        await connection.execute(
            `UPDATE app_versions
             SET is_active = 0
             WHERE id != ?
               AND platform IN ('ANDROID', 'IOS', 'BOTH')`,
            [id]
        );

        return;
    }

    await connection.execute(
        `UPDATE app_versions
         SET is_active = 0
         WHERE id != ?
           AND platform IN (?, 'BOTH')`,
        [id, platform]
    );
};


// ========================================
// CREATE
// ========================================

const createAppVersion = async (data) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const isActive = toBoolean(data.isActive);

        const [result] = await connection.execute(
            `INSERT INTO app_versions (
                platform,
                version_name,
                version_code,
                minimum_version_code,
                title,
                description,
                skip_allowed,
                schedule_date,
                screen,
                image_path,
                logo_path,
                button_type,
                button_name,
                button_url,
                is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.platform,
                data.versionName,
                data.versionCode,
                data.minimumVersionCode,
                data.title,
                nullableValue(data.description),
                toBoolean(data.skipAllowed) ? 1 : 0,
                nullableValue(data.scheduleDate),
                data.screen || "ALL",
                nullableValue(data.imagePath),
                nullableValue(data.logoPath),
                data.buttonType || "UPDATE",
                data.buttonName || "Update Now",
                nullableValue(data.buttonUrl),
                isActive ? 1 : 0
            ]
        );

        if (isActive) {
            await deactivateConflictingVersions(
                connection,
                result.insertId,
                data.platform
            );
        }

        await connection.commit();

        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};


// ========================================
// GET BY ID
// ========================================

const getAppVersionById = async (id) => {
    const [rows] = await db.execute(
        `SELECT *
         FROM app_versions
         WHERE id = ?
         LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};


// ========================================
// GET ALL
// ========================================

const getAllAppVersions = async () => {
    const [rows] = await db.execute(
        `SELECT *
         FROM app_versions
         ORDER BY id DESC`
    );

    return rows;
};


// ========================================
// GET ACTIVE VERSION
// ========================================

const getActiveAppVersion = async (platform) => {
    const [rows] = await db.execute(
        `SELECT *
         FROM app_versions
         WHERE is_active = 1
           AND platform IN (?, 'BOTH')
           AND (
               schedule_date IS NULL
               OR schedule_date <= NOW()
           )
         ORDER BY
             CASE
                 WHEN platform = ? THEN 0
                 ELSE 1
             END,
             version_code DESC,
             id DESC
         LIMIT 1`,
        [platform, platform]
    );

    return rows[0] || null;
};


// ========================================
// UPDATE
// ========================================

const updateAppVersion = async (id, data) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const isActive = toBoolean(data.isActive);

        const [result] = await connection.execute(
            `UPDATE app_versions
             SET
                platform = ?,
                version_name = ?,
                version_code = ?,
                minimum_version_code = ?,
                title = ?,
                description = ?,
                skip_allowed = ?,
                schedule_date = ?,
                screen = ?,
                image_path = ?,
                logo_path = ?,
                button_type = ?,
                button_name = ?,
                button_url = ?,
                is_active = ?
             WHERE id = ?`,
            [
                data.platform,
                data.versionName,
                data.versionCode,
                data.minimumVersionCode,
                data.title,
                nullableValue(data.description),
                toBoolean(data.skipAllowed) ? 1 : 0,
                nullableValue(data.scheduleDate),
                data.screen || "ALL",
                nullableValue(data.imagePath),
                nullableValue(data.logoPath),
                data.buttonType || "UPDATE",
                data.buttonName || "Update Now",
                nullableValue(data.buttonUrl),
                isActive ? 1 : 0,
                id
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return false;
        }

        if (isActive) {
            await deactivateConflictingVersions(
                connection,
                id,
                data.platform
            );
        }

        await connection.commit();

        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};


// ========================================
// DELETE
// ========================================

const deleteAppVersion = async (id) => {
    const [result] = await db.execute(
        `DELETE FROM app_versions
         WHERE id = ?`,
        [id]
    );

    return result.affectedRows > 0;
};


// ========================================
// ACTIVATE / DEACTIVATE
// ========================================

const setAppVersionActive = async (id, isActive) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
            `SELECT platform
             FROM app_versions
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            await connection.rollback();
            return false;
        }

        const platform = rows[0].platform;
        const active = toBoolean(isActive);

        if (active) {
            await deactivateConflictingVersions(
                connection,
                id,
                platform
            );
        }

        const [result] = await connection.execute(
            `UPDATE app_versions
             SET is_active = ?
             WHERE id = ?`,
            [
                active ? 1 : 0,
                id
            ]
        );

        await connection.commit();

        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};


// ========================================
// EXPORTS
// ========================================

export {
    createAppVersion,
    getAppVersionById,
    getAllAppVersions,
    getActiveAppVersion,
    updateAppVersion,
    deleteAppVersion,
    setAppVersionActive
};