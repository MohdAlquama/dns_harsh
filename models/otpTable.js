import db from "../config/db.js";

const createOtpTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS otp_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(15) NOT NULL,
                session_id VARCHAR(255) NOT NULL,
                purpose ENUM(
                    'REGISTER',
                    'FORGOT_PASSWORD'
                ) NOT NULL,
                expires_at DATETIME NOT NULL,
                attempts INT NOT NULL DEFAULT 0,
                verified_at DATETIME NULL,
                action_token_hash VARCHAR(64) NULL,
                action_token_expires_at DATETIME NULL,
                consumed_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_phone_number (phone_number),
                INDEX idx_session_id (session_id),
                INDEX idx_action_token_hash (action_token_hash)
            )
        `);

        // Upgrade installations created by an older version without deleting data.
        const requiredColumns = [
            ["action_token_hash", "VARCHAR(64) NULL"],
            ["action_token_expires_at", "DATETIME NULL"],
            ["consumed_at", "DATETIME NULL"]
        ];

        for (const [columnName, definition] of requiredColumns) {
            const [rows] = await db.execute(
                `SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'otp_verifications'
                   AND COLUMN_NAME = ?`,
                [columnName]
            );

            if (rows.length === 0) {
                await db.execute(
                    `ALTER TABLE otp_verifications ADD COLUMN ${columnName} ${definition}`
                );
            }
        }

        const [actionTokenIndexes] = await db.execute(
            `SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'otp_verifications'
               AND INDEX_NAME = 'idx_action_token_hash'`
        );
        if (actionTokenIndexes.length === 0) {
            await db.execute(
                `CREATE INDEX idx_action_token_hash
                 ON otp_verifications (action_token_hash)`
            );
        }

        console.log("✅ OTP table ready");

    } catch (error) {
        console.error("❌ OTP table creation failed");
        console.error(error.message);
        throw error;
    }
};

export default createOtpTable;
