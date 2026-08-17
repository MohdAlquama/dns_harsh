import db from "../config/db.js";

const createRefreshTokenTable = async () => {
    try {

        // Existing empty table remove
        await db.execute(`
            DROP TABLE IF EXISTS refresh_tokens
        `);

        // Create refresh token table with correct auth_users relation
        await db.execute(`
            CREATE TABLE refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,

                user_id INT NOT NULL,

                token_hash VARCHAR(255) NOT NULL,

                device_type VARCHAR(30) NULL,

                device_name VARCHAR(100) NULL,

                expires_at DATETIME NOT NULL,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                revoked_at DATETIME NULL,

                INDEX idx_user_id (user_id),

                CONSTRAINT fk_refresh_user
                    FOREIGN KEY (user_id)
                    REFERENCES auth_users(id)
                    ON DELETE CASCADE
            )
        `);

        console.log("✅ Refresh token table ready");

    } catch (error) {
        console.error("❌ Refresh token table creation failed");
        console.error(error.message);
    }
};

export default createRefreshTokenTable;