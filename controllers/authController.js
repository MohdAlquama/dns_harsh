import bcrypt from "bcrypt";
import crypto from "crypto";

import {
    activateUser,
    createPendingUser,
    findUserByPhone,
    updatePassword
} from "../models/authModel.js";
import {
    consumeOtp,
    createOtp,
    findOtpByPhone,
    findOtpByResetToken,
    incrementOtpAttempts,
    invalidateOtps,
    markOtpVerified
} from "../models/otpModel.js";
import {
    findRefreshToken,
    revokeAllRefreshTokensForUser,
    revokeRefreshToken,
    saveRefreshToken
} from "../models/refreshTokenModel.js";
import { sendOtp, verifyOtp } from "../services/twoFactorService.js";
import {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken
} from "../services/tokenService.js";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const normalizePhoneNumber = (value) =>
    typeof value === "string" ? value.replace(/[\s()-]/g, "") : "";

const isValidPhoneNumber = (value) => /^\+?[1-9]\d{9,14}$/.test(value);
const isValidPassword = (value) => typeof value === "string" && value.length >= 8;
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");

const issueTokens = async (user, req) => {
    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);

    await saveRefreshToken(
        user.id,
        hashToken(refreshToken),
        req.headers["x-device-type"] || null,
        req.headers["x-device-name"] || null,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    return { accessToken, refreshToken, expiresIn: 900 };
};

// Optional first screen: only tells the client whether to show login or register.
const startAuth = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        if (!isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ success: false, message: "Valid phone number is required" });
        }

        const user = await findUserByPhone(phoneNumber);
        return res.status(200).json({
            success: true,
            exists: Boolean(user?.status === 1),
            next: user?.status === 1 ? "PASSWORD" : "REGISTER"
        });
    } catch (error) {
        console.error("Start Auth Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Registration step 1: save pending details and send the OTP.
const register = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const { password, confirmPassword } = req.body;

        if (!isValidPhoneNumber(phoneNumber) || !name || !password) {
            return res.status(400).json({
                success: false,
                message: "Valid phone number, name and password are required"
            });
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const existingUser = await findUserByPhone(phoneNumber);
        if (existingUser?.status === 1) {
            return res.status(409).json({ success: false, message: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await createPendingUser(phoneNumber, name, passwordHash);
        await invalidateOtps(phoneNumber, "REGISTER");

        const otpResponse = await sendOtp(phoneNumber);
        await createOtp(
            phoneNumber,
            otpResponse.sessionId,
            "REGISTER",
            new Date(Date.now() + OTP_EXPIRY_MS)
        );

        return res.status(202).json({
            success: true,
            message: "OTP sent successfully",
            next: "VERIFY_OTP",
            purpose: "REGISTER"
        });
    } catch (error) {
        console.error("Register Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const login = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        const { password } = req.body;
        if (!isValidPhoneNumber(phoneNumber) || !password) {
            return res.status(400).json({
                success: false,
                message: "Valid phone number and password are required"
            });
        }

        const user = await findUserByPhone(phoneNumber);
        if (!user || user.status !== 1 || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({
                success: false,
                message: "Invalid phone number or password"
            });
        }

        const tokens = await issueTokens(user, req);
        return res.status(200).json({
            success: true,
            message: "Login successful",
            ...tokens,
            user: { id: user.id, name: user.name, phoneNumber: user.phone_number }
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const refreshToken = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Refresh token is required" });
        }

        let decoded;
        try {
            decoded = verifyRefreshToken(token);
        } catch {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        const tokenRecord = await findRefreshToken(hashToken(token));
        if (
            !tokenRecord ||
            tokenRecord.user_id !== decoded.userId ||
            new Date(tokenRecord.expires_at) <= new Date()
        ) {
            return res.status(401).json({
                success: false,
                message: "Refresh token not found, revoked or expired"
            });
        }

        return res.status(200).json({
            success: true,
            accessToken: createAccessToken(decoded.userId),
            expiresIn: 900
        });
    } catch (error) {
        console.error("Refresh Token Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const logout = async (req, res) => {
    try {
        const { refreshToken: token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Refresh token is required" });
        }

        const tokenRecord = await findRefreshToken(hashToken(token));
        if (tokenRecord) await revokeRefreshToken(tokenRecord.id);

        return res.status(200).json({ success: true, message: "Logout successful" });
    } catch (error) {
        console.error("Logout Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Forgot-password step 1: send an OTP to an active account.
const forgotPassword = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        if (!isValidPhoneNumber(phoneNumber)) {
            return res.status(400).json({ success: false, message: "Valid phone number is required" });
        }

        const user = await findUserByPhone(phoneNumber);
        if (!user || user.status !== 1) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        await invalidateOtps(phoneNumber, "FORGOT_PASSWORD");
        const otpResponse = await sendOtp(phoneNumber);
        await createOtp(
            phoneNumber,
            otpResponse.sessionId,
            "FORGOT_PASSWORD",
            new Date(Date.now() + OTP_EXPIRY_MS)
        );

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            next: "VERIFY_OTP",
            purpose: "FORGOT_PASSWORD"
        });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// Forgot-password step 3: use the short-lived token returned after OTP verification.
const resetPassword = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        const { password, confirmPassword, resetToken } = req.body;

        if (!isValidPhoneNumber(phoneNumber) || !password || !resetToken) {
            return res.status(400).json({
                success: false,
                message: "Phone number, new password and reset token are required"
            });
        }
        if (confirmPassword !== undefined && password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const user = await findUserByPhone(phoneNumber);
        const otpRecord = await findOtpByResetToken(phoneNumber, hashToken(resetToken));
        if (!user || user.status !== 1 || !otpRecord) {
            return res.status(403).json({ success: false, message: "Invalid or expired reset token" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await updatePassword(user.id, passwordHash);
        await consumeOtp(otpRecord.id);
        await revokeAllRefreshTokensForUser(user.id);

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
            next: "LOGIN"
        });
    } catch (error) {
        console.error("Reset Password Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const verifyAuthOtp = async (req, res) => {
    try {
        const phoneNumber = normalizePhoneNumber(req.body.phoneNumber);
        const { otp, purpose } = req.body;

        if (!isValidPhoneNumber(phoneNumber) || !otp || !purpose) {
            return res.status(400).json({
                success: false,
                message: "Valid phone number, OTP and purpose are required"
            });
        }
        if (!["REGISTER", "FORGOT_PASSWORD"].includes(purpose)) {
            return res.status(400).json({ success: false, message: "Invalid OTP purpose" });
        }

        const otpRecord = await findOtpByPhone(phoneNumber, purpose);
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "OTP session not found" });
        }
        if (new Date(otpRecord.expires_at) <= new Date()) {
            await consumeOtp(otpRecord.id);
            return res.status(400).json({ success: false, message: "OTP expired" });
        }
        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            await consumeOtp(otpRecord.id);
            return res.status(429).json({ success: false, message: "Too many invalid OTP attempts" });
        }

        const result = await verifyOtp(otpRecord.session_id, String(otp));
        if (result.Status !== "Success") {
            await incrementOtpAttempts(otpRecord.id);
            return res.status(400).json({
                success: false,
                message: result.Details || "Invalid OTP"
            });
        }

        if (purpose === "REGISTER") {
            const user = await findUserByPhone(phoneNumber);
            if (!user || user.status === 1) {
                await consumeOtp(otpRecord.id);
                return res.status(409).json({ success: false, message: "Registration is no longer pending" });
            }

            await activateUser(user.id);
            await markOtpVerified(otpRecord.id);
            await consumeOtp(otpRecord.id);
            const tokens = await issueTokens({ ...user, status: 1 }, req);

            return res.status(201).json({
                success: true,
                message: "Phone verified and account created",
                next: "HOME",
                ...tokens,
                user: { id: user.id, name: user.name, phoneNumber: user.phone_number }
            });
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        await markOtpVerified(
            otpRecord.id,
            hashToken(resetToken),
            new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)
        );

        return res.status(200).json({
            success: true,
            message: "OTP verified",
            next: "NEW_PASSWORD",
            resetToken,
            resetTokenExpiresIn: RESET_TOKEN_EXPIRY_MS / 1000
        });
    } catch (error) {
        console.error("Verify OTP Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export {
    forgotPassword,
    login,
    logout,
    refreshToken,
    register,
    resetPassword,
    startAuth,
    verifyAuthOtp
};
