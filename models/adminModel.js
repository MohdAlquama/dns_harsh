import db from "../config/db.js";

const findAdminByPhone = async (phone) => {
    const [rows] = await db.execute(`SELECT * FROM admin_users WHERE phone_number = ? LIMIT 1`, [phone]);
    return rows[0] || null;
};

const findAdminById = async (id) => {
    const [rows] = await db.execute(
        `SELECT id, name, phone_number, role, status, created_at FROM admin_users WHERE id = ? LIMIT 1`, [id]
    );
    return rows[0] || null;
};

const listAdmins = async () => {
    const [rows] = await db.execute(
        `SELECT id, name, phone_number, role, status, created_at FROM admin_users ORDER BY id ASC`
    );
    return rows;
};

const createAdmin = async ({ name, phone, passwordHash, role }) => {
    const [result] = await db.execute(
        `INSERT INTO admin_users (name, phone_number, password_hash, role) VALUES (?, ?, ?, ?)`,
        [name, phone, passwordHash, role]
    );
    return result.insertId;
};

const createAdminSession = async ({ adminId, tokenHash, purpose, expiresAt, ipAddress, userAgent }) => {
    await db.execute(
        `INSERT INTO admin_sessions (admin_id, token_hash, purpose, expires_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminId, tokenHash, purpose, expiresAt, ipAddress || null, String(userAgent || "").slice(0, 500) || null]
    );
};

const findAdminSession = async (tokenHash, purpose) => {
    const [rows] = await db.execute(
        `SELECT s.id AS session_id, s.admin_id, s.purpose, s.expires_at,
                a.name, a.phone_number, a.role, a.status
         FROM admin_sessions s INNER JOIN admin_users a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.purpose = ? AND s.revoked_at IS NULL
           AND s.expires_at > CURRENT_TIMESTAMP AND a.status = 1 LIMIT 1`,
        [tokenHash, purpose]
    );
    return rows[0] || null;
};

const revokeAdminSession = (tokenHash) => db.execute(
    `UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL`, [tokenHash]
);

const revokeAllAdminSessions = (adminId) => db.execute(
    `UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = ? AND revoked_at IS NULL`, [adminId]
);

const invalidateAdminChallenges = (adminId) => db.execute(
    `UPDATE admin_login_challenges SET consumed_at = CURRENT_TIMESTAMP
     WHERE admin_id = ? AND consumed_at IS NULL`, [adminId]
);

const createAdminChallenge = async ({ adminId, tokenHash, gatewaySessionId, expiresAt }) => {
    await db.execute(
        `INSERT INTO admin_login_challenges (admin_id, token_hash, gateway_session_id, expires_at)
         VALUES (?, ?, ?, ?)`, [adminId, tokenHash, gatewaySessionId, expiresAt]
    );
};

const findAdminChallenge = async (tokenHash) => {
    const [rows] = await db.execute(
        `SELECT c.*, a.name, a.phone_number, a.role, a.status
         FROM admin_login_challenges c INNER JOIN admin_users a ON a.id = c.admin_id
         WHERE c.token_hash = ? AND c.consumed_at IS NULL AND c.expires_at > CURRENT_TIMESTAMP
           AND a.status = 1 LIMIT 1`, [tokenHash]
    );
    return rows[0] || null;
};

const incrementAdminChallengeAttempts = (id) => db.execute(
    `UPDATE admin_login_challenges SET attempts = attempts + 1 WHERE id = ?`, [id]
);

const consumeAdminChallenge = (id) => db.execute(
    `UPDATE admin_login_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]
);

export {
    consumeAdminChallenge, createAdmin, createAdminChallenge, createAdminSession, findAdminById,
    findAdminByPhone, findAdminChallenge, findAdminSession, incrementAdminChallengeAttempts,
    invalidateAdminChallenges, listAdmins, revokeAdminSession, revokeAllAdminSessions
};
