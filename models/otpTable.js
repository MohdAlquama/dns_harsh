import db from "../config/db.js";

const createOtpTable = async () => {
    try {

        // OTP table is recreated because OTP is managed by 2Factor
        await db.execute(`
            DROP TABLE IF EXISTS otp_verifications
        `);

        await db.execute(`
            CREATE TABLE otp_verifications (
                id INT AUTO_INCREMENT PRIMARY KEY,

                phone_number VARCHAR(15) NOT NULL,

                session_id VARCHAR(255) NOT NULL,

                purpose ENUM(
                    'REGISTER',
                    'FORGOT_PASSWORD'
                ) NOT NULL,

                expires_at DATETIME NOT NULL,

                attempts INT NOT NULL DEFAULT 0,

                verified_at DATETIME NULL,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                INDEX idx_phone_number (phone_number),

                INDEX idx_session_id (session_id)
            )
        `);

        console.log("✅ OTP table ready");

    } catch (error) {
        console.error("❌ OTP table creation failed");
        console.error(error.message);
    }
};

export default createOtpTable;