import { findAdminSession } from "../models/adminModel.js";
import { ADMIN_COOKIE, SETUP_COOKIE, hashAdminToken, parseCookies } from "../services/adminSessionService.js";

const loadSession = async (req, purpose, cookieName) => {
    const token = parseCookies(req)[cookieName];
    if (!token) return null;
    const session = await findAdminSession(hashAdminToken(token), purpose);
    if (session) req.adminSessionToken = token;
    return session;
};

const requireAdmin = async (req, res, next) => {
    try {
        const admin = await loadSession(req, "AUTHENTICATED", ADMIN_COOKIE);
        if (!admin) return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
        req.admin = admin;
        res.locals.admin = admin;
        return next();
    } catch (error) {
        console.error("Admin session error:", error);
        return res.status(500).send("Unable to verify admin session");
    }
};

const requireSetupSession = async (req, res, next) => {
    try {
        const admin = await loadSession(req, "OTP_SETUP", SETUP_COOKIE);
        if (!admin) return res.redirect("/admin/login");
        req.admin = admin;
        return next();
    } catch {
        return res.redirect("/admin/login");
    }
};

const requireSuperAdmin = (req, res, next) => req.admin?.role === "SUPER_ADMIN"
    ? next()
    : res.status(403).send("Super admin access required");

export { requireAdmin, requireSetupSession, requireSuperAdmin };
