const configuredOrigins = () => new Set(
    (process.env.API_ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
);

const apiCors = (req, res, next) => {
    const origin = req.get("origin");
    const allowedOrigins = configuredOrigins();

    // Native mobile clients do not send an Origin header. Browsers are allowed
    // only when their exact origin is configured; never combine credentials
    // with a wildcard origin.
    if (origin && allowedOrigins.has(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
        res.set("Vary", "Origin");
        res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
        res.set("Access-Control-Max-Age", "600");
    }

    if (req.method === "OPTIONS") {
        return origin && allowedOrigins.has(origin)
            ? res.sendStatus(204)
            : res.sendStatus(403);
    }

    return next();
};

export default apiCors;
