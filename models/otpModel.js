import db from "../config/db.js";


const createOtp = async (
    phoneNumber,
    sessionId,
    purpose,
    expiresAt
) => {

    const [result] = await db.execute(
        `INSERT INTO otp_verifications
        (
            phone_number,
            session_id,
            purpose,
            expires_at
        )
        VALUES (?, ?, ?, ?)`,
        [
            phoneNumber,
            sessionId,
            purpose,
            expiresAt
        ]
    );

    return result.insertId;
};


const findOtpByPhone = async (
    phoneNumber,
    purpose
) => {

    const [rows] = await db.execute(
        `SELECT
            id,
            phone_number,
            session_id,
            purpose,
            expires_at,
            attempts,
            verified_at
         FROM otp_verifications
         WHERE phone_number = ?
         AND purpose = ?
         AND verified_at IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [
            phoneNumber,
            purpose
        ]
    );

    return rows[0] || null;
};

// Increase wrong OTP attempts
const incrementOtpAttempts = async (otpId) => {

    await db.execute(
        `UPDATE otp_verifications
         SET attempts = attempts + 1
         WHERE id = ?`,
        [otpId]
    );
};


// Mark OTP verified
const markOtpVerified = async (otpId) => {

    await db.execute(
        `UPDATE otp_verifications
         SET verified_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [otpId]
    );
};

const findVerifiedOtp = async (
    phoneNumber,
    purpose
) => {

    const [rows] = await db.execute(
        `SELECT
            id,
            phone_number,
            purpose,
            verified_at
         FROM otp_verifications
         WHERE phone_number = ?
         AND purpose = ?
         AND verified_at IS NOT NULL
         ORDER BY verified_at DESC
         LIMIT 1`,
        [
            phoneNumber,
            purpose
        ]
    );

    return rows[0] || null;
};




export {
    createOtp,
    findOtpByPhone,
    incrementOtpAttempts,
    markOtpVerified,
    findVerifiedOtp
};  