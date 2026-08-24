import db from "../config/db.js";

// A user can register several browsers/devices. A token is globally unique so it
// cannot accidentally remain associated with a previous account on a shared device.
const createFcmTokenTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS fcm_tokens (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(512) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_fcm_tokens_token (token),
                KEY idx_fcm_tokens_user_id (user_id),
                CONSTRAINT fk_fcm_tokens_user
                    FOREIGN KEY (user_id) REFERENCES auth_users(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log("✅ FCM tokens table ready");
    } catch (error) {
        console.error("❌ FCM tokens table creation failed");
        console.error(error.message);
        throw error;
    }
};

export default createFcmTokenTable;
