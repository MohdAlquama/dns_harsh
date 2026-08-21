import db from "../config/db.js";

const createSocialMediaTables = async () => {
    await db.query(`
        CREATE TABLE IF NOT EXISTS social_media_config (
            id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            platform ENUM('YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'X') NOT NULL UNIQUE,
            label VARCHAR(100) NULL,
            profile_url VARCHAR(500) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 0,
            sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);

    await db.query(`
        INSERT IGNORE INTO social_media_config (platform, sort_order) VALUES
            ('YOUTUBE', 1),
            ('INSTAGRAM', 2),
            ('FACEBOOK', 3),
            ('X', 4)
    `);

    console.log("✅ Social media configuration table ready");
};

export default createSocialMediaTables;
