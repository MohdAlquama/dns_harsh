import db from "../config/db.js";

const createCatalogProductTables = async () => {
    const connection = await db.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS catalog_products (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                product_type ENUM('TEST_SERIES','BOOK') NOT NULL,
                title VARCHAR(200) NOT NULL,
                slug VARCHAR(220) NOT NULL,
                short_description VARCHAR(500) NULL,
                long_description TEXT NULL,
                cover_image_url VARCHAR(1000) NULL,
                status ENUM('DRAFT','PUBLISHED','COMING_SOON') NOT NULL DEFAULT 'DRAFT',
                base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
                gst_enabled TINYINT(1) NOT NULL DEFAULT 0,
                gst_percent DECIMAL(5,2) NULL,
                platform_charge_enabled TINYINT(1) NOT NULL DEFAULT 0,
                platform_charge DECIMAL(12,2) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_catalog_product_type_slug (product_type, slug),
                INDEX idx_catalog_product_delivery (product_type, status, created_at),
                INDEX idx_catalog_product_title (title)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS test_series_details (
                product_id INT UNSIGNED PRIMARY KEY,
                test_mode ENUM('PRACTICE','MOCK','LIVE') NOT NULL DEFAULT 'MOCK',
                duration_minutes SMALLINT UNSIGNED NOT NULL,
                total_questions SMALLINT UNSIGNED NOT NULL,
                total_marks DECIMAL(8,2) NOT NULL,
                negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0,
                attempt_limit SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                availability_start DATETIME NULL,
                availability_end DATETIME NULL,
                languages_json JSON NOT NULL,
                syllabus_json JSON NOT NULL,
                instructions TEXT NULL,
                CONSTRAINT fk_test_series_product FOREIGN KEY (product_id)
                    REFERENCES catalog_products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS book_details (
                product_id INT UNSIGNED PRIMARY KEY,
                author VARCHAR(200) NOT NULL,
                publisher VARCHAR(200) NULL,
                isbn VARCHAR(20) NULL UNIQUE,
                sku VARCHAR(80) NULL UNIQUE,
                language VARCHAR(80) NOT NULL,
                edition VARCHAR(100) NULL,
                page_count INT UNSIGNED NULL,
                book_format ENUM('PHYSICAL','DIGITAL','BOTH') NOT NULL DEFAULT 'PHYSICAL',
                stock_quantity INT UNSIGNED NOT NULL DEFAULT 0,
                sample_url VARCHAR(1000) NULL,
                digital_asset_url VARCHAR(1000) NULL,
                CONSTRAINT fk_book_product FOREIGN KEY (product_id)
                    REFERENCES catalog_products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);
        console.log("✅ Test Series and Books catalog tables ready");
    } catch (error) {
        console.error("❌ Catalog table creation failed");
        console.error(error.message);
        throw error;
    } finally {
        connection.release();
    }
};

export default createCatalogProductTables;
