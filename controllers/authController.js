import { findUserByPhone , createUser,updatePassword} from "../models/authModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { createOtp, findOtpByPhone, markOtpVerified ,findVerifiedOtp} from "../models/otpModel.js";
import { sendOtp ,  
        verifyOtp
} from "../services/twoFactorService.js";
import {
    createAccessToken,
    createRefreshToken, verifyRefreshToken
} from "../services/tokenService.js";

import {
    saveRefreshToken,
    findRefreshToken,
    revokeRefreshToken
} from "../models/refreshTokenModel.js";


const startAuth = async (req, res) => {
    try {

        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }


        // Check user
        const user = await findUserByPhone(phoneNumber);


        // Existing user
        if (user) {

            return res.status(200).json({
                success: true,
                exists: true,
                next: "PASSWORD"
            });

        }


        // New user
        const otpResponse = await sendOtp(phoneNumber);


        // OTP session ID save
        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );


        await createOtp(
            phoneNumber,
            otpResponse.sessionId,
            "REGISTER",
            expiresAt
        );


        return res.status(200).json({
            success: true,
            exists: false,
            next: "OTP"
        });


    } catch (error) {

        console.error("Start Auth Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


const register = async (req, res) => {
    try {

        const {
            phoneNumber,
            name,
            password,
            confirmPassword
        } = req.body;


        if (
            !phoneNumber ||
            !name ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }


        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }


        // Check user already exists
        const existingUser = await findUserByPhone(
            phoneNumber
        );


        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }


        // Check OTP verification
        const verifiedOtp = await findVerifiedOtp(
            phoneNumber,
            "REGISTER"
        );


        if (!verifiedOtp) {
            return res.status(403).json({
                success: false,
                message: "Please verify OTP first"
            });
        }


        // Hash password
        const passwordHash = await bcrypt.hash(
            password,
            12
        );


        // Create user
        const userId = await createUser(
            phoneNumber,
            name,
            passwordHash
        );


        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            userId
        });


    } catch (error) {

        console.error(
            "Register Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};




const login = async (req, res) => {
    try {

        const {
            phoneNumber,
            password
        } = req.body;


        if (!phoneNumber || !password) {
            return res.status(400).json({
                success: false,
                message: "Phone number and password are required"
            });
        }


        // Find user
        const user = await findUserByPhone(
            phoneNumber
        );


        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password"
            });
        }


        // Check account status
        if (user.status !== 1) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive"
            });
        }


        // Check password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );


        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password"
            });
        }


        // Create access token
        const accessToken = createAccessToken(
            user.id
        );


        // Create refresh token
        const refreshToken = createRefreshToken(
            user.id
        );


        // Hash refresh token before saving
        const tokenHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");


        // Refresh token expiry
        const expiresAt = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
        );


        // Save refresh token
        await saveRefreshToken(
            user.id,
            tokenHash,
            req.headers["x-device-type"] || null,
            req.headers["x-device-name"] || null,
            expiresAt
        );


        return res.status(200).json({
            success: true,
            message: "Login successful",

            accessToken,

            refreshToken,

            expiresIn: 900,

            user: {
                id: user.id,
                name: user.name,
                phoneNumber: user.phone_number
            }
        });


    } catch (error) {

        console.error(
            "Login Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};  

const refreshToken = async (req, res) => {
    try {

        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }


        // Verify JWT
        let decoded;

        try {

            decoded = verifyRefreshToken(token);

        } catch (error) {

            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }


        // Find token in database
        const tokenRecord = await findRefreshToken(token);

        if (!tokenRecord) {
            return res.status(401).json({
                success: false,
                message: "Refresh token not found or revoked"
            });
        }


        // Check expiry
        if (
            new Date(tokenRecord.expires_at) < new Date()
        ) {
            return res.status(401).json({
                success: false,
                message: "Refresh token expired"
            });
        }


        // Create new access token
        const accessToken = createAccessToken(
            decoded.userId
        );


        return res.status(200).json({
            success: true,
            accessToken,
            expiresIn: 900
        });


    } catch (error) {

        console.error(
            "Refresh Token Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const logout = async (req, res) => {
    try {

        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }


        // Find token in database
        const tokenRecord = await findRefreshToken(token);


        // Token already revoked/not found
        if (!tokenRecord) {
            return res.status(200).json({
                success: true,
                message: "Already logged out"
            });
        }


        // Revoke token
        await revokeRefreshToken(
            tokenRecord.id
        );


        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });


    } catch (error) {

        console.error(
            "Logout Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


const forgotPassword = async (req, res) => {
    try {

        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }


        // Check user
        const user = await findUserByPhone(
            phoneNumber
        );


        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // Generate OTP
        const otpResponse = await sendOtp(
            phoneNumber
        );


        // OTP expiry - 5 minutes
        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000
        );


        // Save OTP
        await createOtp(
            phoneNumber,
            otpResponse.sessionId,
            "FORGOT_PASSWORD",
            expiresAt
        );


        return res.status(200).json({
            success: true,
            next: "OTP",
            message: "OTP sent successfully"
        });


    } catch (error) {

        console.error(
            "Forgot Password Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

const resetPassword = async (req, res) => {
    try {

        const {
            phoneNumber,
            password,
            confirmPassword
        } = req.body;


        if (
            !phoneNumber ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: "Phone number, password and confirm password are required"
            });
        }


        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }


        // Check user
        const user = await findUserByPhone(
            phoneNumber
        );


        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }


        // Check verified OTP
        const verifiedOtp = await findVerifiedOtp(
            phoneNumber,
            "FORGOT_PASSWORD"
        );


        if (!verifiedOtp) {
            return res.status(403).json({
                success: false,
                message: "Please verify OTP first"
            });
        }


        // Hash new password
        const passwordHash = await bcrypt.hash(
            password,
            12
        );


        // Update password
        const updated = await updatePassword(
            user.id,
            passwordHash
        );


        if (!updated) {
            return res.status(500).json({
                success: false,
                message: "Password update failed"
            });
        }


        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
            next: "LOGIN"
        });


    } catch (error) {

        console.error(
            "Reset Password Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


const verifyAuthOtp = async (req, res) => {
    try {

        const {
            phoneNumber,
            otp,
            purpose
        } = req.body;


        if (!phoneNumber || !otp || !purpose) {
            return res.status(400).json({
                success: false,
                message: "Phone number, OTP and purpose are required"
            });
        }


        // Only allowed purposes
        if (
            purpose !== "REGISTER" &&
            purpose !== "FORGOT_PASSWORD"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP purpose"
            });
        }


        // Find latest OTP
        const otpRecord = await findOtpByPhone(
            phoneNumber,
            purpose
        );


        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "OTP session not found or already verified"
            });
        }


        // Check expiry
        if (
            new Date(otpRecord.expires_at) < new Date()
        ) {
            return res.status(400).json({
                success: false,
                message: "OTP expired"
            });
        }


        // Verify OTP through 2Factor
        const result = await verifyOtp(
            otpRecord.session_id,
            otp
        );


        if (result.Status !== "Success") {

            return res.status(400).json({
                success: false,
                message: result.Details || "Invalid OTP"
            });

        }


        // Mark OTP verified
        await markOtpVerified(
            otpRecord.id
        );


        // Registration OTP
        if (purpose === "REGISTER") {

            return res.status(200).json({
                success: true,
                next: "DETAILS"
            });

        }


        // Forgot password OTP
        if (purpose === "FORGOT_PASSWORD") {

            return res.status(200).json({
                success: true,
                next: "NEW_PASSWORD"
            });

        }


    } catch (error) {

        console.error(
            "Verify OTP Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


export {
    startAuth,
    register,
    login,
    refreshToken,
    logout,
    forgotPassword,
    resetPassword,
    verifyAuthOtp,
};