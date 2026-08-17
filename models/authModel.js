import db from "../config/db.js";


// Find user by phone number
const findUserByPhone = async (phoneNumber) => {

    const [rows] = await db.execute(
        `SELECT
            id,
            phone_number,
            name,
            password_hash,
            status
         FROM auth_users
         WHERE phone_number = ?
         LIMIT 1`,
        [phoneNumber]
    );

    return rows[0] || null;
};


// Create new user
const createUser = async (
    phoneNumber,
    name,
    passwordHash
) => {

    const [result] = await db.execute(
        `INSERT INTO auth_users
            (phone_number, name, password_hash, status)
         VALUES (?, ?, ?, ?)`,
        [
            phoneNumber,
            name,
            passwordHash,
            1
        ]
    );

    return result.insertId;
};


// Find user by ID
const findUserById = async (userId) => {

    const [rows] = await db.execute(
        `SELECT
            id,
            phone_number,
            name,
            password_hash,
            status
         FROM auth_users
         WHERE id = ?
         LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
};


// Update password
const updatePassword = async (
    userId,
    passwordHash
) => {

    const [result] = await db.execute(
        `UPDATE auth_users
         SET password_hash = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
            passwordHash,
            userId
        ]
    );

    return result.affectedRows > 0;
};


export {
    findUserByPhone,
    createUser,
    findUserById,
    updatePassword
};