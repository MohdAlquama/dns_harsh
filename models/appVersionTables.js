import db from "../config/db.js";

const createAppVersionTables = async () => {
    const connection = await db.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_versions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

                platform ENUM('ANDROID', 'IOS', 'BOTH')
                    NOT NULL DEFAULT 'ANDROID',

                version_name VARCHAR(50) NOT NULL,

                version_code INT UNSIGNED NOT NULL,

                minimum_version_code INT UNSIGNED NOT NULL,

                title VARCHAR(200) NOT NULL,

                description TEXT NULL,

                skip_allowed TINYINT(1) NOT NULL DEFAULT 1,

                schedule_date DATETIME NULL,

                screen VARCHAR(50) NOT NULL DEFAULT 'ALL',

                image_path VARCHAR(500) NULL,

                logo_path VARCHAR(500) NULL,

                button_type ENUM(
                    'UPDATE',
                    'DOWNLOAD',
                    'LINK',
                    'CLOSE',
                    'OTHER'
                ) NOT NULL DEFAULT 'UPDATE',

                button_name VARCHAR(100) NOT NULL DEFAULT 'Update Now',

                button_url VARCHAR(1000) NULL,

                is_active TINYINT(1) NOT NULL DEFAULT 0,

                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                INDEX idx_app_version_active (
                    is_active,
                    platform,
                    schedule_date
                ),

                INDEX idx_app_version_code (
                    platform,
                    version_code
                )
            ) ENGINE=InnoDB
        `);

        console.log("✅ App version table ready");
    } catch (error) {
        console.error("❌ App version table creation failed");
        console.error(error.message);

        throw error;
    } finally {
        connection.release();
    }
};

export default createAppVersionTables;