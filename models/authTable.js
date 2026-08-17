import db from "../config/db.js";

const createAuthTables = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS auth_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(15) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                status TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        console.log("✅ Auth users table ready");

    } catch (error) {
        console.error("❌ Auth users table creation failed");
        console.error(error.message);
        throw error;
    }
};

export default createAuthTables;
