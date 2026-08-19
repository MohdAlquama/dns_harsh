import db from "../config/db.js";

const createAdTables = async () => {
    const connection = await db.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ad_campaigns (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                advertiser_name VARCHAR(200) NOT NULL,
                campaign_name VARCHAR(200) NOT NULL,
                status ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED') NOT NULL DEFAULT 'DRAFT',
                bid_amount DECIMAL(12,4) NOT NULL,
                daily_budget DECIMAL(12,2) NOT NULL,
                quality_score DECIMAL(4,3) NOT NULL DEFAULT 0.500,
                target_keywords JSON NULL,
                target_countries JSON NULL,
                target_devices JSON NULL,
                start_at DATETIME NOT NULL,
                end_at DATETIME NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ad_campaign_delivery (status, start_at, end_at)
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ad_creatives (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                campaign_id INT UNSIGNED NOT NULL,
                title VARCHAR(150) NOT NULL,
                body VARCHAR(500) NOT NULL,
                image_url VARCHAR(1000) NULL,
                landing_url VARCHAR(1000) NOT NULL,
                call_to_action VARCHAR(50) NOT NULL DEFAULT 'Learn more',
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ad_creative_campaign (campaign_id, is_active),
                CONSTRAINT fk_ad_creative_campaign FOREIGN KEY (campaign_id)
                    REFERENCES ad_campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ad_decisions (
                request_id CHAR(36) PRIMARY KEY,
                campaign_id INT UNSIGNED NOT NULL,
                creative_id INT UNSIGNED NOT NULL,
                placement VARCHAR(100) NOT NULL,
                session_hash CHAR(64) NULL,
                score DECIMAL(18,8) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                INDEX idx_ad_decision_expiry (expires_at),
                CONSTRAINT fk_ad_decision_campaign FOREIGN KEY (campaign_id)
                    REFERENCES ad_campaigns(id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT fk_ad_decision_creative FOREIGN KEY (creative_id)
                    REFERENCES ad_creatives(id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS ad_events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                request_id CHAR(36) NOT NULL,
                campaign_id INT UNSIGNED NOT NULL,
                creative_id INT UNSIGNED NOT NULL,
                event_type ENUM('IMPRESSION', 'CLICK', 'CONVERSION', 'HIDE') NOT NULL,
                event_value DECIMAL(12,2) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_ad_event_once (request_id, event_type),
                INDEX idx_ad_event_campaign_date (campaign_id, created_at),
                CONSTRAINT fk_ad_event_decision FOREIGN KEY (request_id)
                    REFERENCES ad_decisions(request_id) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB
        `);

        console.log("✅ Advertising tables ready");
    } finally {
        connection.release();
    }
};

export default createAdTables;
