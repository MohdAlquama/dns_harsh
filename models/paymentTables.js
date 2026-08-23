import db from "../config/db.js";

const createPaymentTables = async () => {
    const connection = await db.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_gateway_config (
                id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
                provider VARCHAR(30) NOT NULL DEFAULT 'CASHFREE',
                environment ENUM('SANDBOX', 'PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
                client_id VARCHAR(255) NULL,
                client_secret_encrypted TEXT NULL,
                api_version VARCHAR(20) NOT NULL DEFAULT '2025-01-01',
                return_url VARCHAR(1000) NULL,
                notify_url VARCHAR(1000) NULL,
                is_enabled TINYINT(1) NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);
        await connection.execute(`INSERT IGNORE INTO payment_gateway_config (id) VALUES (1)`);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_offer_codes (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(150) NOT NULL,
                course_id INT UNSIGNED NULL,
                discount_type ENUM('PERCENT','FIXED') NOT NULL,
                discount_value DECIMAL(12,2) NOT NULL,
                min_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                max_discount_amount DECIMAL(12,2) NULL,
                total_usage_limit INT UNSIGNED NULL,
                per_user_limit INT UNSIGNED NOT NULL DEFAULT 1,
                valid_from DATETIME NULL,
                valid_until DATETIME NULL,
                stack_with_course_offer TINYINT(1) NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_payment_offer_active_dates (is_active, valid_from, valid_until),
                INDEX idx_payment_offer_course (course_id),
                CONSTRAINT fk_payment_offer_course FOREIGN KEY (course_id)
                    REFERENCES current_affairs_courses(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_offer_user_assignments (
                offer_code_id BIGINT UNSIGNED NOT NULL,
                user_id INT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (offer_code_id, user_id),
                INDEX idx_offer_assignment_user (user_id),
                CONSTRAINT fk_offer_assignment_offer FOREIGN KEY (offer_code_id)
                    REFERENCES payment_offer_codes(id) ON DELETE CASCADE,
                CONSTRAINT fk_offer_assignment_user FOREIGN KEY (user_id)
                    REFERENCES auth_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_orders (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                merchant_order_id VARCHAR(45) NOT NULL UNIQUE,
                cashfree_order_id VARCHAR(100) NULL,
                user_id INT NOT NULL,
                item_type VARCHAR(50) NOT NULL,
                item_id INT UNSIGNED NOT NULL,
                item_name VARCHAR(255) NOT NULL,
                base_amount DECIMAL(12,2) NOT NULL,
                discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                platform_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                order_amount DECIMAL(12,2) NOT NULL,
                refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                currency CHAR(3) NOT NULL DEFAULT 'INR',
                status ENUM('CREATED','ACTIVE','PAID','FAILED','EXPIRED','USER_DROPPED','PARTIALLY_REFUNDED','REFUNDED') NOT NULL DEFAULT 'CREATED',
                payment_session_id TEXT NULL,
                cashfree_payment_id VARCHAR(100) NULL,
                payment_method VARCHAR(100) NULL,
                failure_message VARCHAR(1000) NULL,
                paid_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_payment_orders_user (user_id, created_at),
                INDEX idx_payment_orders_item (item_type, item_id),
                INDEX idx_payment_orders_status (status),
                CONSTRAINT fk_payment_order_user FOREIGN KEY (user_id) REFERENCES auth_users(id)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_refunds (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                order_id BIGINT UNSIGNED NOT NULL,
                merchant_refund_id VARCHAR(40) NOT NULL UNIQUE,
                cashfree_refund_id VARCHAR(100) NULL,
                amount DECIMAL(12,2) NOT NULL,
                note VARCHAR(100) NULL,
                speed ENUM('STANDARD','INSTANT') NOT NULL DEFAULT 'STANDARD',
                status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
                status_description VARCHAR(500) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_payment_refunds_order (order_id),
                CONSTRAINT fk_payment_refund_order FOREIGN KEY (order_id) REFERENCES payment_orders(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_offer_redemptions (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                offer_code_id BIGINT UNSIGNED NOT NULL,
                order_id BIGINT UNSIGNED NOT NULL UNIQUE,
                user_id INT NOT NULL,
                status ENUM('RESERVED','REDEEMED','RELEASED') NOT NULL DEFAULT 'RESERVED',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_offer_redemption_usage (offer_code_id, status),
                INDEX idx_offer_redemption_user (offer_code_id, user_id, status),
                CONSTRAINT fk_offer_redemption_offer FOREIGN KEY (offer_code_id)
                    REFERENCES payment_offer_codes(id) ON DELETE CASCADE,
                CONSTRAINT fk_offer_redemption_order FOREIGN KEY (order_id)
                    REFERENCES payment_orders(id) ON DELETE CASCADE,
                CONSTRAINT fk_offer_redemption_user FOREIGN KEY (user_id)
                    REFERENCES auth_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS payment_webhook_events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                idempotency_key VARCHAR(255) NOT NULL UNIQUE,
                event_type VARCHAR(100) NOT NULL,
                payload_hash CHAR(64) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        `);
        console.log("✅ Payment and Cashfree tables ready");
    } finally {
        connection.release();
    }
};

export default createPaymentTables;
