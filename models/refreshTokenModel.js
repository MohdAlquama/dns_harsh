import db from "../config/db.js";


const saveRefreshToken = async (
    userId,
    tokenHash,
    deviceType,
    deviceName,
    expiresAt
) => {

    const [result] = await db.execute(
        `INSERT INTO refresh_tokens
        (
            user_id,
            token_hash,
            device_type,
            device_name,
            expires_at
        )
        VALUES (?, ?, ?, ?, ?)`,
        [
            userId,
            tokenHash,
            deviceType || null,
            deviceName || null,
            expiresAt
        ]
    );

    return result.insertId;
};


const findRefreshToken = async (tokenHash) => {

    const [rows] = await db.execute(
        `SELECT
            id,
            user_id,
            token_hash,
            device_type,
            device_name,
            expires_at,
            revoked_at
         FROM refresh_tokens
         WHERE token_hash = ?
         AND revoked_at IS NULL
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
};


const revokeRefreshToken = async (tokenId) => {

    const [result] = await db.execute(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [tokenId]
    );

    return result.affectedRows > 0;
};

const revokeAllRefreshTokensForUser = async (userId) => {
    const [result] = await db.execute(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND revoked_at IS NULL`,
        [userId]
    );

    return result.affectedRows;
};


export {
    saveRefreshToken,
    findRefreshToken,
    revokeRefreshToken,
    revokeAllRefreshTokensForUser
};
