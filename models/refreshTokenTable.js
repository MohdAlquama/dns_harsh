import db from "../config/db.js";

const createRefreshTokenTable = async () => {
    try {

        await db.execute(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token_hash VARCHAR(64) NOT NULL,
                device_type VARCHAR(30) NULL,
                device_name VARCHAR(100) NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                revoked_at DATETIME NULL,
                INDEX idx_user_id (user_id),
                UNIQUE INDEX idx_token_hash (token_hash),
                CONSTRAINT fk_refresh_user
                    FOREIGN KEY (user_id)
                    REFERENCES auth_users(id)
                    ON DELETE CASCADE
            )
        `);

        const [tokenIndexes] = await db.execute(
            `SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'refresh_tokens'
               AND INDEX_NAME = 'idx_token_hash'`
        );
        if (tokenIndexes.length === 0) {
            await db.execute(
                `CREATE UNIQUE INDEX idx_token_hash ON refresh_tokens (token_hash)`
            );
        }

        console.log("✅ Refresh token table ready");

    } catch (error) {
        console.error("❌ Refresh token table creation failed");
        console.error(error.message);
        throw error;
    }
};

export default createRefreshTokenTable;
