import crypto from "crypto";
import {
    findDecision,
    findEligibleCampaigns,
    saveDecision,
    saveEvent
} from "../models/adModel.js";
import { rankCampaigns } from "../services/adRankingService.js";

const DEVICE_TYPES = new Set(["web", "mobile", "tablet", "tv", "other"]);
const EVENT_TYPES = new Set(["IMPRESSION", "CLICK", "CONVERSION", "HIDE"]);
const cleanText = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const hash = (value) => value
    ? crypto.createHash("sha256").update(value).digest("hex")
    : null;

const decideAd = async (req, res) => {
    try {
        const placement = cleanText(req.body.placement, 100);
        if (!placement) {
            return res.status(400).json({ success: false, message: "placement is required" });
        }

        const requestedDevice = cleanText(req.body.device?.type, 20).toLowerCase();
        const deviceType = DEVICE_TYPES.has(requestedDevice) ? requestedDevice : "other";
        const personalized = req.body.consent?.personalizedAds === true;
        const rawKeywords = Array.isArray(req.body.context?.keywords)
            ? req.body.context.keywords.slice(0, 20)
            : [];
        const context = {
            personalized,
            keywords: rawKeywords.map((item) => cleanText(item, 50).toLowerCase()).filter(Boolean),
            country: personalized ? cleanText(req.body.geo?.country, 2).toLowerCase() : "",
            deviceType
        };

        const ranked = rankCampaigns(await findEligibleCampaigns(), context);
        if (ranked.length === 0) return res.status(204).send();

        const winner = ranked[0];
        const requestId = crypto.randomUUID();
        await saveDecision({
            requestId,
            campaignId: winner.id,
            creativeId: winner.creative_id,
            placement,
            sessionHash: hash(cleanText(req.body.sessionId, 200)),
            score: winner.score
        });

        const eventBase = `/api/v1/ads/events`;
        return res.status(200).json({
            success: true,
            requestId,
            placement,
            ad: {
                campaignId: winner.id,
                creativeId: winner.creative_id,
                title: winner.title,
                body: winner.body,
                imageUrl: winner.image_url,
                landingUrl: winner.landing_url,
                callToAction: winner.call_to_action,
                disclosure: "Ad"
            },
            tracking: { eventUrl: eventBase },
            debug: process.env.NODE_ENV === "development" ? {
                score: Number(winner.score.toFixed(6)),
                relevance: Number(winner.relevance.toFixed(3)),
                estimatedActionRate: Number(winner.estimatedActionRate.toFixed(4))
            } : undefined
        });
    } catch (error) {
        console.error("Ad Decision Error:", error);
        return res.status(500).json({ success: false, message: "Unable to select an ad" });
    }
};

const trackAdEvent = async (req, res) => {
    try {
        const requestId = cleanText(req.body.requestId, 36);
        const eventType = cleanText(req.body.type, 20).toUpperCase();
        if (!requestId || !EVENT_TYPES.has(eventType)) {
            return res.status(400).json({ success: false, message: "Valid requestId and type are required" });
        }

        const decision = await findDecision(requestId);
        if (!decision) {
            return res.status(404).json({ success: false, message: "Ad decision not found or expired" });
        }

        const numericValue = Number(req.body.value);
        const value = eventType === "CONVERSION" && Number.isFinite(numericValue) && numericValue >= 0
            ? numericValue
            : null;
        await saveEvent({
            requestId,
            campaignId: decision.campaign_id,
            creativeId: decision.creative_id,
            eventType,
            value
        });

        return res.status(202).json({ success: true, accepted: true });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(200).json({ success: true, accepted: false, duplicate: true });
        }
        console.error("Ad Event Error:", error);
        return res.status(500).json({ success: false, message: "Unable to record event" });
    }
};

export { decideAd, trackAdEvent };
