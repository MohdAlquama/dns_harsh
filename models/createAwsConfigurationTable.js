import db from "../config/db.js";
const createAwsConfigurationTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS aws_configurations (
                id TINYINT UNSIGNED NOT NULL DEFAULT 1,

                storage_type ENUM('s3', 's3_cdn')
                    NOT NULL DEFAULT 's3',

                access_key_id VARCHAR(255) NULL,

                secret_access_key TEXT NULL,

                region VARCHAR(100)
                    NOT NULL DEFAULT 'ap-south-1',

                bucket_name VARCHAR(255) NULL,

                cdn_url VARCHAR(500) NULL,

                is_active TINYINT(1)
                    NOT NULL DEFAULT 1,

                created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                PRIMARY KEY (id)

            ) ENGINE=InnoDB
            DEFAULT CHARSET=utf8mb4
            COLLATE=utf8mb4_unicode_ci
        `);

        console.log("✅ AWS configuration table ready");

    } catch (error) {

        console.error(
            "❌ AWS configuration table creation failed"
        );

        console.error(error.message);

        throw error;
    }
};

export default createAwsConfigurationTable;