import db from "../config/db.js";

const createAuthConfigTable = async () => {
    try {

        await db.execute(`
            CREATE TABLE IF NOT EXISTS auth_config (
                id INT AUTO_INCREMENT PRIMARY KEY,

                provider VARCHAR(50) NOT NULL UNIQUE,

                api_key TEXT NOT NULL,

                status TINYINT(1) NOT NULL DEFAULT 1,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log("✅ Auth config table ready");

    } catch (error) {
        console.error("❌ Auth config table creation failed");
        console.error(error.message);
    }
};

export default createAuthConfigTable;