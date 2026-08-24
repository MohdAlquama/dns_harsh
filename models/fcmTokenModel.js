import db from "../config/db.js";

const saveFcmToken = async (userId, token) => {
    // The unique token key makes this idempotent. It also reassigns a browser
    // token if the user explicitly signs in as a different account.
    await db.execute(
        `INSERT INTO fcm_tokens (user_id, token)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id),
            updated_at = CURRENT_TIMESTAMP`,
        [userId, token]
    );
};

const findFcmTokensByUserId = async (userId) => {
    const [rows] = await db.execute(
        "SELECT token FROM fcm_tokens WHERE user_id = ?",
        [userId]
    );

    return rows.map((row) => row.token);
};

const deleteFcmTokens = async (tokens) => {
    if (!tokens.length) return 0;

    const placeholders = tokens.map(() => "?").join(", ");
    const [result] = await db.execute(
        `DELETE FROM fcm_tokens WHERE token IN (${placeholders})`,
        tokens
    );

    return result.affectedRows;
};

const getFcmAdminSummary = async () => {
    const [[summaryRows], [recentRows]] = await Promise.all([
        db.execute(
            `SELECT COUNT(*) AS totalTokens,
                    COUNT(DISTINCT user_id) AS usersWithTokens
             FROM fcm_tokens`
        ),
        db.execute(
            `SELECT MAX(updated_at) AS lastTokenAt
             FROM fcm_tokens`
        )
    ]);

    return {
        totalTokens: Number(summaryRows[0]?.totalTokens || 0),
        usersWithTokens: Number(summaryRows[0]?.usersWithTokens || 0),
        lastTokenAt: recentRows[0]?.lastTokenAt || null,
        firebaseAdminConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    };
};

const listFcmRecipients = async ({ search = "", limit = 50 } = {}) => {
    const safeLimit = [10, 25, 50, 100].includes(Number(limit)) ? Number(limit) : 50;
    const params = [];
    let whereSql = "";

    if (search) {
        whereSql = "WHERE u.name LIKE ? OR u.phone_number LIKE ? OR CAST(u.id AS CHAR) = ?";
        params.push(`%${search}%`, `%${search}%`, search);
    }

    const [rows] = await db.execute(
        `SELECT u.id,
                u.name,
                u.phone_number,
                u.status,
                COUNT(t.id) AS tokenCount,
                MAX(t.updated_at) AS lastTokenAt
         FROM auth_users u
         LEFT JOIN fcm_tokens t ON t.user_id = u.id
         ${whereSql}
         GROUP BY u.id, u.name, u.phone_number, u.status
         ORDER BY tokenCount DESC, lastTokenAt DESC, u.created_at DESC
         LIMIT ${safeLimit}`,
        params
    );

    return rows.map((row) => ({
        ...row,
        tokenCount: Number(row.tokenCount || 0)
    }));
};

export {
    deleteFcmTokens,
    findFcmTokensByUserId,
    getFcmAdminSummary,
    listFcmRecipients,
    saveFcmToken
};
