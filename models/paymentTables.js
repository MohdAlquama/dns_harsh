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
