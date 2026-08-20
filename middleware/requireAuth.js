import { verifyAccessToken } from "../services/tokenService.js";
import { findUserById } from "../models/authModel.js";

const requireAuth = async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ success: false, message: "Login is required to buy an item" });
    }

    try {
        const payload = verifyAccessToken(token);
        const user = await findUserById(payload.userId);
        if (!user || user.status !== 1) throw new Error("Inactive user");
        req.user = user;
        return next();
    } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired access token" });
    }
};

export default requireAuth;
