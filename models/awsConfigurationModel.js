import db from "../config/db.js";

export const createAwsConfigurationTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS aws_configurations (
                id TINYINT UNSIGNED NOT NULL DEFAULT 1,
                storage_type ENUM('s3', 's3_cdn') NOT NULL DEFAULT 's3',
                access_key_id VARCHAR(255) NULL,
                secret_access_key TEXT NULL,
                region VARCHAR(100) NOT NULL DEFAULT 'ap-south-1',
                bucket_name VARCHAR(255) NULL,
                cdn_url VARCHAR(500) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log("✅ AWS configuration table ready");
    } catch (error) {
        console.error("❌ AWS configuration table creation failed:", error.message);
        throw error;
    }
};

export const getAwsConfiguration = async () => {
    const [rows] = await db.execute(`
        SELECT id, storage_type, access_key_id, secret_access_key, region, bucket_name, cdn_url, is_active 
        FROM aws_configurations WHERE id = 1 LIMIT 1
    `);
    return rows[0] || null;
};

export const saveAwsConfiguration = async (config) => {
    await db.execute(`
        INSERT INTO aws_configurations (id, storage_type, access_key_id, secret_access_key, region, bucket_name, cdn_url, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            storage_type = VALUES(storage_type),
            access_key_id = VALUES(access_key_id),
            secret_access_key = VALUES(secret_access_key),
            region = VALUES(region),
            bucket_name = VALUES(bucket_name),
            cdn_url = VALUES(cdn_url),
            is_active = VALUES(is_active)
    `, [
        1, config.storage_type, config.access_key_id, config.secret_access_key, 
        config.region, config.bucket_name, config.cdn_url, config.is_active || 1
    ]);
    return getAwsConfiguration();
};