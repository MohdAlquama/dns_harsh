import test from "node:test";
import assert from "node:assert/strict";
import { rankCampaigns } from "../services/adRankingService.js";

const campaign = (overrides) => ({
    id: 1,
    bid_amount: "10",
    quality_score: "0.8",
    target_keywords: JSON.stringify(["exam"]),
    target_countries: JSON.stringify(["in"]),
    target_devices: JSON.stringify(["mobile"]),
    impressions: 80,
    clicks: 9,
    ...overrides
});

test("ranks a relevant campaign above an irrelevant campaign", () => {
    const ranked = rankCampaigns(
        [campaign({ id: 1 }), campaign({ id: 2, target_keywords: '["sports"]' })],
        { personalized: true, keywords: ["exam"], country: "in", deviceType: "mobile" }
    );
    assert.equal(ranked[0].id, 1);
});

test("ignores personal keywords and country without consent", () => {
    const [result] = rankCampaigns(
        [campaign({ target_keywords: "[]", target_countries: "[]" })],
        { personalized: false, keywords: ["exam"], country: "in", deviceType: "mobile" }
    );
    assert.equal(result.relevance, 0.7);
});

test("reduces relevance when device targeting does not match", () => {
    const ranked = rankCampaigns(
        [campaign({ target_keywords: "[]", target_countries: "[]" })],
        { personalized: false, keywords: [], country: "", deviceType: "web" }
    );
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].relevance, 0.5);
});
