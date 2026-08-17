import db from "../config/db.js";


// Get 2Factor configuration
const getTwoFactorConfig = async () => {

    const [rows] = await db.execute(
        `SELECT
            id,
            provider,
            api_key,
            status
         FROM auth_config
         WHERE provider = ?
         AND status = 1
         LIMIT 1`,
        ["2FACTOR"]
    );

    return rows[0] || null;
};

const getTwoFactorConfigStatus = async () => {
    const [rows] = await db.execute(
        `SELECT provider, status, updated_at
         FROM auth_config
         WHERE provider = ?
         LIMIT 1`,
        ["2FACTOR"]
    );

    return rows[0] || null;
};


// Save 2Factor API key
const saveTwoFactorConfig = async (apiKey) => {

    const [result] = await db.execute(
        `INSERT INTO auth_config
            (provider, api_key, status)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
            api_key = VALUES(api_key),
            status = 1,
            updated_at = CURRENT_TIMESTAMP`,
        ["2FACTOR", apiKey]
    );

    return result;
};


export {
    getTwoFactorConfig,
    getTwoFactorConfigStatus,
    saveTwoFactorConfig
};
