import bcrypt from "bcrypt";
import crypto from "crypto";
import { createTwoFactorConfigOnce, getTwoFactorConfig } from "../models/authConfigModel.js";
import {
    consumeAdminChallenge, createAdminChallenge, findAdminByPhone, findAdminChallenge,
    incrementAdminChallengeAttempts, invalidateAdminChallenges, revokeAdminSession, revokeAllAdminSessions
} from "../models/adminModel.js";
import { sendOtp, sendOtpWithApiKey, verifyOtp } from "../services/twoFactorService.js";
import {
    ADMIN_COOKIE, CHALLENGE_COOKIE, SETUP_COOKIE, clearAdminCookies, cookieOptions,
    hashAdminToken, issueAdminSession, parseCookies
} from "../services/adminSessionService.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const renderLogin = (res, error = null, status = 200) => res.status(status).render("admin_auth/login", { error });

const createOtpChallenge = async (res, admin, gatewaySessionId) => {
    await invalidateAdminChallenges(admin.id);
    const token = crypto.randomBytes(32).toString("hex");
    await createAdminChallenge({
        adminId: admin.id,
        tokenHash: hashAdminToken(token),
        gatewaySessionId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    res.cookie(CHALLENGE_COOKIE, token, cookieOptions(5 * 60 * 1000));
    return res.redirect("/admin/verify-otp");
};

const beginAdminOtp = async (_req, res, admin) => {
    const gateway = await sendOtp(admin.phone_number);
    return createOtpChallenge(res, admin, gateway.sessionId);
};

const showLogin = async (req, res) => renderLogin(res, req.query.expired ? "Your admin session expired. Please login again." : null);

const login = async (req, res) => {
    try {
        const phone = normalizePhone(req.body.phoneNumber);
        const admin = await findAdminByPhone(phone);
        if (!admin || admin.status !== 1 || !await bcrypt.compare(String(req.body.password || ""), admin.password_hash)) {
            return renderLogin(res, "Invalid phone number or password", 401);
        }
        const otpConfig = await getTwoFactorConfig();
        if (!otpConfig) {
            await issueAdminSession(req, res, admin.id, "OTP_SETUP");
            return res.redirect("/admin/otp-setup");
        }
        return await beginAdminOtp(req, res, admin);
    } catch (error) {
        console.error("Admin login error:", error);
        return renderLogin(res, error.message || "Unable to start admin login", 500);
    }
};

const showOtpSetup = async (req, res) => {
    if (await getTwoFactorConfig()) return res.redirect("/admin/login");
    return res.render("admin_auth/otp_setup", { admin: req.admin, error: null });
};

const setupOtp = async (req, res) => {
    try {
        if (await getTwoFactorConfig()) return res.status(409).render("admin_auth/otp_setup", { admin: req.admin, error: "OTP is already configured" });
        const apiKey = String(req.body.apiKey || "").trim();
        if (!apiKey) return res.status(400).render("admin_auth/otp_setup", { admin: req.admin, error: "2Factor API key is required" });
        // Validate the key and send the first OTP before permanently locking
        // the one-time provider configuration.
        const gateway = await sendOtpWithApiKey(req.admin.phone_number, apiKey);
        await createTwoFactorConfigOnce(apiKey);
        const setupToken = parseCookies(req)[SETUP_COOKIE];
        if (setupToken) await revokeAdminSession(hashAdminToken(setupToken));
        res.clearCookie(SETUP_COOKIE, { path: "/" });
        const admin = await findAdminByPhone(req.admin.phone_number);
        return await createOtpChallenge(res, admin, gateway.sessionId);
    } catch (error) {
        console.error("Initial OTP setup error:", error);
        return res.status(500).render("admin_auth/otp_setup", { admin: req.admin, error: error.message || "Unable to configure OTP" });
    }
};

const showVerifyOtp = async (req, res) => {
    const token = parseCookies(req)[CHALLENGE_COOKIE];
    const challenge = token ? await findAdminChallenge(hashAdminToken(token)) : null;
    if (!challenge) return res.redirect("/admin/login");
    return res.render("admin_auth/verify_otp", { phone: challenge.phone_number, error: null });
};

const verifyAdminOtp = async (req, res) => {
    const token = parseCookies(req)[CHALLENGE_COOKIE];
    try {
        const challenge = token ? await findAdminChallenge(hashAdminToken(token)) : null;
        if (!challenge) return res.redirect("/admin/login");
        if (challenge.attempts >= 5) {
            await consumeAdminChallenge(challenge.id);
            return res.status(429).render("admin_auth/verify_otp", { phone: challenge.phone_number, error: "Too many attempts. Login again." });
        }
        const otp = String(req.body.otp || "").trim();
        if (!/^\d{4,8}$/.test(otp)) return res.status(400).render("admin_auth/verify_otp", { phone: challenge.phone_number, error: "Enter a valid OTP" });
        const verification = await verifyOtp(challenge.gateway_session_id, otp);
        if (verification.Status !== "Success") {
            await incrementAdminChallengeAttempts(challenge.id);
            return res.status(400).render("admin_auth/verify_otp", { phone: challenge.phone_number, error: verification.Details || "Invalid OTP" });
        }
        await consumeAdminChallenge(challenge.id);
        await revokeAllAdminSessions(challenge.admin_id);
        await issueAdminSession(req, res, challenge.admin_id, "AUTHENTICATED");
        res.clearCookie(CHALLENGE_COOKIE, { path: "/" });
        return res.redirect("/dashboard");
    } catch (error) {
        console.error("Admin OTP verification error:", error);
        return res.status(500).render("admin_auth/verify_otp", { phone: "", error: error.message || "Unable to verify OTP" });
    }
};

const logout = async (req, res) => {
    const token = parseCookies(req)[ADMIN_COOKIE];
    if (token) await revokeAdminSession(hashAdminToken(token));
    clearAdminCookies(res);
    return res.redirect("/admin/login");
};

export { login, logout, setupOtp, showLogin, showOtpSetup, showVerifyOtp, verifyAdminOtp };
