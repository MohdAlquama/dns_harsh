const requireSameOrigin = (req, res, next) => {
    const origin = req.get("origin");
    if (!origin) return next();
    try {
        if (new URL(origin).host === req.get("host")) return next();
    } catch {}
    return res.status(403).send("Cross-origin admin request rejected");
};

export default requireSameOrigin;
