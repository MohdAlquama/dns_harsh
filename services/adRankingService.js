const normalizeList = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).toLowerCase());
    if (typeof value !== "string") return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item).toLowerCase()) : [];
    } catch {
        return [];
    }
};

const overlapRatio = (targets, signals) => {
    if (targets.length === 0) return 0.5;
    if (signals.length === 0) return 0;
    const signalSet = new Set(signals.map((value) => String(value).toLowerCase()));
    return targets.filter((target) => signalSet.has(target)).length / targets.length;
};

const matchesOrOpen = (targets, value) =>
    targets.length === 0 || (value && targets.includes(String(value).toLowerCase()));

// A transparent starter ranker. It can later be replaced by an ML prediction
// service without changing the public API contract.
const rankCampaigns = (campaigns, context) => campaigns
    .map((campaign) => {
        const targetKeywords = normalizeList(campaign.target_keywords);
        const targetCountries = normalizeList(campaign.target_countries);
        const targetDevices = normalizeList(campaign.target_devices);
        const keywords = context.personalized ? context.keywords : [];

        const keywordMatch = overlapRatio(targetKeywords, keywords);
        const countryMatch = matchesOrOpen(targetCountries, context.country) ? 1 : 0;
        const deviceMatch = matchesOrOpen(targetDevices, context.deviceType) ? 1 : 0;
        const relevance = (keywordMatch * 0.6) + (countryMatch * 0.2) + (deviceMatch * 0.2);

        // Bayesian smoothing prevents a new campaign with one click from dominating.
        const impressions = Number(campaign.impressions || 0);
        const clicks = Number(campaign.clicks || 0);
        const estimatedActionRate = (clicks + 1) / (impressions + 20);
        const quality = Math.max(0.1, Math.min(1, Number(campaign.quality_score || 0.5)));
        const score = Number(campaign.bid_amount) * estimatedActionRate * quality * relevance;

        return { ...campaign, score, relevance, estimatedActionRate };
    })
    .filter((campaign) => campaign.relevance > 0)
    .sort((left, right) => right.score - left.score);

export { normalizeList, rankCampaigns };
