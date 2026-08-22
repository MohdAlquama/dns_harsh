import db from "../config/db.js";

const createCurrentAffairsTables = async () => {
    const connection = await db.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_courses (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_name VARCHAR(200) NOT NULL UNIQUE,
                short_description VARCHAR(500) NULL,
                long_description TEXT NULL,
                default_image_path VARCHAR(500) NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                status ENUM('DRAFT', 'PUBLISHED', 'COMING_SOON') NOT NULL DEFAULT 'DRAFT',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ca_course_status (status),
                INDEX idx_ca_course_dates (start_date, end_date)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_pricing (
                course_id INT UNSIGNED PRIMARY KEY,
                base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                gst_enabled TINYINT(1) NOT NULL DEFAULT 0,
                gst_percent DECIMAL(5,2) NULL,
                platform_charge_enabled TINYINT(1) NOT NULL DEFAULT 0,
                platform_charge DECIMAL(12,2) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_ca_pricing_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_ads (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id INT UNSIGNED NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                start_date DATE NULL,
                end_date DATE NULL,
                image_path VARCHAR(500) NULL,
                link_type ENUM('IMAGE', 'BUTTON', 'BOTH') NULL,
                image_url VARCHAR(1000) NULL,
                button_url VARCHAR(1000) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ca_ads_course (course_id),
                INDEX idx_ca_ads_active (is_enabled, start_date, end_date),
                CONSTRAINT fk_ca_ads_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_notifications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id INT UNSIGNED NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                title VARCHAR(200) NULL,
                description VARCHAR(1000) NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ca_notification_course (course_id),
                INDEX idx_ca_notification_active (is_enabled, start_date, end_date),
                CONSTRAINT fk_ca_notification_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_documents (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id INT UNSIGNED NOT NULL,
                document_type ENUM('MASTER_PDF', 'NORMAL_PDF') NOT NULL,
                document_name VARCHAR(200) NULL,
                file_path VARCHAR(500) NULL,
                status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ca_document_course (course_id),
                CONSTRAINT fk_ca_document_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_offers (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id INT UNSIGNED NOT NULL,
                offer_name VARCHAR(200) NOT NULL,
                discount_type ENUM('PERCENT', 'FIXED') NOT NULL,
                discount_value DECIMAL(12,2) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ca_offer_course (course_id),
                INDEX idx_ca_offer_active (is_active),
                CONSTRAINT fk_ca_offer_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        // Flexible sales/detail-page blocks. Keeping content in a validated JSON
        // payload lets web and mobile clients share one contract without adding a
        // new table every time a merchandising block is introduced.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS current_affairs_modules (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id INT UNSIGNED NOT NULL,
                module_key VARCHAR(50) NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                content_json JSON NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_ca_module_course_key (course_id, module_key),
                INDEX idx_ca_module_delivery (course_id, is_enabled, sort_order),
                CONSTRAINT fk_ca_module_course
                    FOREIGN KEY (course_id) REFERENCES current_affairs_courses(id)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log("✅ Current Affairs relational tables ready");
    } catch (error) {
        console.error("❌ Current Affairs table creation failed");
        console.error(error.message);
        throw error;
    } finally {
        connection.release();
    }
};

export default createCurrentAffairsTables;
