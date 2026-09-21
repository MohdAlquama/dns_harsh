import db from "../config/db.js";

const columnType = async (connection, table, column) => {
    const [rows] = await connection.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
         LIMIT 1`,
        [table, column]
    );
    return rows[0]?.COLUMN_TYPE || "int unsigned";
};

const addColumnIfMissing = async (connection, table, column, definition) => {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );

    if (!Number(rows[0]?.count)) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
};

const createCourseTables = async () => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                subject_folder_id INT UNSIGNED NULL,
                slug VARCHAR(220) NOT NULL,
                short_description VARCHAR(500) NULL,
                long_description TEXT NULL,
                cover_image_url VARCHAR(1000) NULL,
                price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                start_date DATE NULL,
                end_date DATE NULL,
                coming_soon TINYINT(1) NOT NULL DEFAULT 0,
                status ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await addColumnIfMissing(connection, "courses", "name", "VARCHAR(200) NOT NULL DEFAULT ''");
        await addColumnIfMissing(connection, "courses", "subject_folder_id", "INT UNSIGNED NULL");
        await addColumnIfMissing(connection, "courses", "slug", "VARCHAR(220) NOT NULL DEFAULT ''");
        await addColumnIfMissing(connection, "courses", "short_description", "VARCHAR(500) NULL");
        await addColumnIfMissing(connection, "courses", "long_description", "TEXT NULL");
        await addColumnIfMissing(connection, "courses", "cover_image_url", "VARCHAR(1000) NULL");
        await addColumnIfMissing(connection, "courses", "price", "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
        await addColumnIfMissing(connection, "courses", "start_date", "DATE NULL");
        await addColumnIfMissing(connection, "courses", "end_date", "DATE NULL");
        await addColumnIfMissing(connection, "courses", "coming_soon", "TINYINT(1) NOT NULL DEFAULT 0");
        await addColumnIfMissing(connection, "courses", "status", "ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT'");

        const courseIdType = await columnType(connection, "courses", "id");
        const courseFk = courseIdType;

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_pricing (
                course_id ${courseFk} PRIMARY KEY,
                base_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                gst_enabled TINYINT(1) NOT NULL DEFAULT 0,
                gst_percent DECIMAL(5,2) NULL,
                platform_charge_enabled TINYINT(1) NOT NULL DEFAULT 0,
                platform_charge DECIMAL(12,2) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_course_pricing_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_ads (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id ${courseFk} NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                start_date DATE NULL,
                end_date DATE NULL,
                image_path VARCHAR(500) NULL,
                link_type ENUM('IMAGE','BUTTON','BOTH') NULL,
                image_url VARCHAR(1000) NULL,
                button_url VARCHAR(1000) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_course_ads_course (course_id),
                CONSTRAINT fk_course_ads_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_notifications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id ${courseFk} NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                title VARCHAR(200) NULL,
                description VARCHAR(1000) NULL,
                start_date DATE NULL,
                end_date DATE NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_course_notifications_course (course_id),
                CONSTRAINT fk_course_notifications_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_offers (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id ${courseFk} NOT NULL,
                offer_name VARCHAR(200) NOT NULL,
                discount_type ENUM('PERCENT','FIXED') NOT NULL,
                discount_value DECIMAL(12,2) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_course_offers_course (course_id),
                CONSTRAINT fk_course_offers_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_modules (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id ${courseFk} NOT NULL,
                module_key VARCHAR(50) NOT NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
                content_json JSON NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_course_module_course_key (course_id, module_key),
                INDEX idx_course_module_delivery (course_id, is_enabled, sort_order),
                CONSTRAINT fk_course_modules_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_contents (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                course_id ${courseFk} NOT NULL,
                video_id INT UNSIGNED NOT NULL,
                sort_order INT UNSIGNED NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_course_video (course_id, video_id),
                INDEX idx_course_content_course (course_id),
                INDEX idx_course_content_video (video_id)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_enrollments (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                course_id ${courseFk} NOT NULL,
                order_id BIGINT UNSIGNED NOT NULL,
                status ENUM('ACTIVE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
                enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_course (user_id, course_id),
                INDEX idx_enrollment_user (user_id),
                INDEX idx_enrollment_course (course_id),
                INDEX idx_enrollment_order (order_id)
            ) ENGINE=InnoDB
        `);

        await connection.commit();
        console.log("✅ COURSE TABLES READY");
    } catch (error) {
        await connection.rollback();
        console.error("❌ COURSE TABLE ERROR:", error.message);
        throw error;
    } finally {
        connection.release();
    }
};

export default createCourseTables;
