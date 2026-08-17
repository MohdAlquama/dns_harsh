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
         AND consumed_at IS NULL
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
const markOtpVerified = async (
    otpId,
    actionTokenHash = null,
    actionTokenExpiresAt = null
) => {

    await db.execute(
        `UPDATE otp_verifications
         SET verified_at = CURRENT_TIMESTAMP,
             action_token_hash = ?,
             action_token_expires_at = ?
         WHERE id = ?`,
        [actionTokenHash, actionTokenExpiresAt, otpId]
    );
};

const invalidateOtps = async (phoneNumber, purpose) => {
    await db.execute(
        `UPDATE otp_verifications
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE phone_number = ? AND purpose = ? AND consumed_at IS NULL`,
        [phoneNumber, purpose]
    );
};

const consumeOtp = async (otpId) => {
    await db.execute(
        `UPDATE otp_verifications
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND consumed_at IS NULL`,
        [otpId]
    );
};

const findOtpByResetToken = async (phoneNumber, actionTokenHash) => {
    const [rows] = await db.execute(
        `SELECT id
         FROM otp_verifications
         WHERE phone_number = ?
           AND purpose = 'FORGOT_PASSWORD'
           AND verified_at IS NOT NULL
           AND consumed_at IS NULL
           AND action_token_hash = ?
           AND action_token_expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [phoneNumber, actionTokenHash]
    );

    return rows[0] || null;
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
    findVerifiedOtp,
    invalidateOtps,
    consumeOtp,
    findOtpByResetToken
};
