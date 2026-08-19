import db from "../config/db.js";

const findEligibleCampaigns = async () => {
    const [rows] = await db.execute(`
        SELECT
            c.*, cr.id AS creative_id, cr.title, cr.body, cr.image_url,
            cr.landing_url, cr.call_to_action,
            COUNT(CASE WHEN e.event_type = 'IMPRESSION' THEN 1 END) AS impressions,
            COUNT(CASE WHEN e.event_type = 'CLICK' THEN 1 END) AS clicks,
            COALESCE(SUM(CASE WHEN DATE(e.created_at) = CURRENT_DATE
                AND e.event_type = 'CLICK' THEN c.bid_amount ELSE 0 END), 0) AS spent_today
        FROM ad_campaigns c
        INNER JOIN ad_creatives cr ON cr.campaign_id = c.id AND cr.is_active = 1
        LEFT JOIN ad_events e ON e.campaign_id = c.id
        WHERE c.status = 'ACTIVE'
          AND NOW() BETWEEN c.start_at AND c.end_at
        GROUP BY c.id, cr.id
        HAVING spent_today < c.daily_budget
    `);
    return rows;
};

const saveDecision = async ({ requestId, campaignId, creativeId, placement, sessionHash, score }) => {
    await db.execute(
        `INSERT INTO ad_decisions
            (request_id, campaign_id, creative_id, placement, session_hash, score, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [requestId, campaignId, creativeId, placement, sessionHash, score]
    );
};

const findDecision = async (requestId) => {
    const [rows] = await db.execute(
        `SELECT d.*, cr.landing_url
         FROM ad_decisions d
         INNER JOIN ad_creatives cr ON cr.id = d.creative_id
         WHERE d.request_id = ? AND d.expires_at > NOW()
         LIMIT 1`,
        [requestId]
    );
    return rows[0] || null;
};

const saveEvent = async ({ requestId, campaignId, creativeId, eventType, value }) => {
    await db.execute(
        `INSERT INTO ad_events
            (request_id, campaign_id, creative_id, event_type, event_value)
         VALUES (?, ?, ?, ?, ?)`,
        [requestId, campaignId, creativeId, eventType, value]
    );
};

export { findDecision, findEligibleCampaigns, saveDecision, saveEvent };
