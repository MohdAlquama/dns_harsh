import db from "../config/db.js";

const INITIAL_SUPER_ADMIN = {
    name: "Mohd Alquama",
    phone: "9026226199",
    // bcrypt hash of the requested initial password; plaintext is never stored.
    passwordHash: "$2b$12$6iqZ0tJjvv1ELdVd7RwLAOVPB6RuKp7ovfGAAjKSeiaLPDw03QxKS"
};

const createAdminTables = async () => {
    const connection = await db.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                phone_number VARCHAR(15) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('SUPER_ADMIN','ADMIN') NOT NULL DEFAULT 'ADMIN',
                status TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_sessions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                admin_id INT UNSIGNED NOT NULL,
                token_hash CHAR(64) NOT NULL UNIQUE,
                purpose ENUM('OTP_SETUP','AUTHENTICATED') NOT NULL,
                expires_at DATETIME NOT NULL,
                revoked_at DATETIME NULL,
                ip_address VARCHAR(64) NULL,
                user_agent VARCHAR(500) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_session_expiry (expires_at),
                CONSTRAINT fk_admin_session_user FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_login_challenges (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                admin_id INT UNSIGNED NOT NULL,
                token_hash CHAR(64) NOT NULL UNIQUE,
                gateway_session_id VARCHAR(255) NOT NULL,
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                expires_at DATETIME NOT NULL,
                consumed_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_challenge_expiry (expires_at),
                CONSTRAINT fk_admin_challenge_user FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        const [seedResult] = await connection.execute(
            `INSERT IGNORE INTO admin_users (name, phone_number, password_hash, role)
             SELECT ?, ?, ?, 'SUPER_ADMIN' FROM DUAL
             WHERE NOT EXISTS (SELECT 1 FROM admin_users LIMIT 1)`,
            [INITIAL_SUPER_ADMIN.name, INITIAL_SUPER_ADMIN.phone, INITIAL_SUPER_ADMIN.passwordHash]
        );
        if (seedResult.affectedRows === 1) {
            console.log("✅ Initial super admin created");
        }
        console.log("✅ Admin authentication tables ready");
    } finally {
        connection.release();
    }
};

export default createAdminTables;
