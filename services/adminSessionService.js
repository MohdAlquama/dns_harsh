import crypto from "crypto";
import { createAdminSession } from "../models/adminModel.js";

const ADMIN_COOKIE = "dns_admin_session";
const SETUP_COOKIE = "dns_admin_setup";
const CHALLENGE_COOKIE = "dns_admin_challenge";
const hashAdminToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const parseCookies = (req) => Object.fromEntries(
    String(req.get("cookie") || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
        const separator = part.indexOf("=");
        return separator === -1 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    })
);

const cookieOptions = (maxAge) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge
});

const issueAdminSession = async (req, res, adminId, purpose) => {
    const token = crypto.randomBytes(32).toString("hex");
    const maxAge = purpose === "AUTHENTICATED" ? 8 * 60 * 60 * 1000 : 15 * 60 * 1000;
    await createAdminSession({
        adminId, tokenHash: hashAdminToken(token), purpose,
        expiresAt: new Date(Date.now() + maxAge), ipAddress: req.ip, userAgent: req.get("user-agent")
    });
    res.cookie(purpose === "AUTHENTICATED" ? ADMIN_COOKIE : SETUP_COOKIE, token, cookieOptions(maxAge));
    return token;
};

const clearAdminCookies = (res) => {
    for (const name of [ADMIN_COOKIE, SETUP_COOKIE, CHALLENGE_COOKIE]) {
        res.clearCookie(name, { path: "/", httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
    }
};

export {
    ADMIN_COOKIE, CHALLENGE_COOKIE, SETUP_COOKIE, clearAdminCookies, cookieOptions,
    hashAdminToken, issueAdminSession, parseCookies
};
