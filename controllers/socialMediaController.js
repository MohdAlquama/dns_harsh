import { listSocialMedia, saveSocialMedia } from "../models/socialMediaModel.js";

const PLATFORMS = ["YOUTUBE", "INSTAGRAM", "FACEBOOK", "X"];
const ALLOWED_HOSTS = {
    YOUTUBE: ["youtube.com", "youtu.be"],
    INSTAGRAM: ["instagram.com"],
    FACEBOOK: ["facebook.com", "fb.com"],
    X: ["x.com", "twitter.com"]
};

const hostIsAllowed = (hostname, allowedHosts) => allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
);

const validateAccount = (input, platform) => {
    const label = typeof input?.label === "string" ? input.label.trim() : "";
    const profileUrl = typeof input?.profileUrl === "string" ? input.profileUrl.trim() : "";
    const isActive = input?.isActive === true || input?.isActive === 1 || input?.isActive === "1";

    if (label.length > 100) return `${platform}: label must be 100 characters or fewer`;
    if (profileUrl.length > 500) return `${platform}: link must be 500 characters or fewer`;
    if (isActive && !label) return `${platform}: enter an account label before enabling it`;
    if (isActive && !profileUrl) return `${platform}: enter a profile link before enabling it`;

    if (profileUrl) {
        try {
            const url = new URL(profileUrl);
            if (url.protocol !== "https:" && url.protocol !== "http:") {
                return `${platform}: link must start with http:// or https://`;
            }
            if (!hostIsAllowed(url.hostname.toLowerCase(), ALLOWED_HOSTS[platform])) {
                return `${platform}: enter a valid ${platform === "X" ? "X or Twitter" : platform.toLowerCase()} link`;
            }
        } catch {
            return `${platform}: enter a valid profile link`;
        }
    }

    return { platform, label, profileUrl, isActive };
};

const showSocialMediaSettings = (_req, res) => res.render("layouts/layout", {
    title: "Social Media | DNS Admin",
    page: "../social_media/index"
});

const getAdminSocialMedia = async (_req, res) => {
    try {
        const accounts = await listSocialMedia();
        return res.json({ success: true, accounts: accounts.map(formatAccount) });
    } catch (error) {
        console.error("Get social media settings error:", error);
        return res.status(500).json({ success: false, message: "Unable to load social media settings" });
    }
};

const getPublicSocialMedia = async (_req, res) => {
    try {
        const accounts = await listSocialMedia({ activeOnly: true });
        return res.json({ success: true, accounts: accounts.map(formatAccount) });
    } catch (error) {
        console.error("Get public social media links error:", error);
        return res.status(500).json({ success: false, message: "Unable to load social media links" });
    }
};

const formatAccount = (account) => ({
    platform: account.platform,
    label: account.label || "",
    profileUrl: account.profileUrl ?? account.profile_url ?? "",
    isActive: Boolean(account.isActive ?? account.is_active),
    status: (account.isActive ?? account.is_active) ? "ACTIVE" : "INACTIVE",
    updatedAt: account.updated_at || null
});

const updateSocialMedia = async (req, res) => {
    try {
        if (!Array.isArray(req.body?.accounts)) {
            return res.status(400).json({ success: false, message: "Accounts must be an array" });
        }

        const submitted = new Map(req.body.accounts.map((account) => [account?.platform, account]));
        if (submitted.size !== PLATFORMS.length || PLATFORMS.some((platform) => !submitted.has(platform))) {
            return res.status(400).json({ success: false, message: "Submit one configuration for every supported platform" });
        }

        const accounts = [];
        for (const platform of PLATFORMS) {
            const validated = validateAccount(submitted.get(platform), platform);
            if (typeof validated === "string") {
                return res.status(400).json({ success: false, message: validated });
            }
            accounts.push(validated);
        }

        await saveSocialMedia(accounts);
        return res.json({
            success: true,
            message: "Social media settings saved successfully",
            accounts: accounts.map(formatAccount)
        });
    } catch (error) {
        console.error("Update social media settings error:", error);
        return res.status(500).json({ success: false, message: "Unable to save social media settings" });
    }
};

export { getAdminSocialMedia, getPublicSocialMedia, showSocialMediaSettings, updateSocialMedia };
