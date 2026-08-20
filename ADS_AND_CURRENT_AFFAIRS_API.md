# Ads and Current Affairs API

Both the website and mobile apps use the same HTTP/JSON endpoints at:

```text
http://localhost:5000/api/v1
```

Open `http://localhost:5000/ad-demo.html` for a working browser client.

Native apps can call the API directly. For a website hosted on another origin,
set an exact comma-separated allow-list before starting the server:

```bash
API_ALLOWED_ORIGINS=https://www.example.com,https://admin.example.com npm start
```

Same-origin browser requests work without this setting. An unlisted cross-origin
browser preflight receives `403`.

## How an ad is selected

```text
Admin campaign + creative
          |
          v
active dates, device, country, keywords, daily budget filter
          |
          v
score = bid × estimated click rate × quality × relevance
          |
          v
winning creative -> impression/click/conversion events -> new click rate
```

The estimated click rate uses `(clicks + 1) / (impressions + 20)`. The extra
values are Bayesian smoothing: new campaigns get a fair start and one early
click cannot overwhelm established campaigns.

When personalization consent is false, the server ignores keywords and country.
It can still use non-personal placement and device context. Do not send contact
details, an exact GPS location, raw IP address, or a browser fingerprint.

## Add a demo campaign

Campaign mutation is intentionally not exposed publicly until the project has
an administrator authorization role. Add this development fixture in MySQL:

```sql
INSERT INTO ad_campaigns
  (advertiser_name, campaign_name, status, bid_amount, daily_budget,
   quality_score, target_keywords, target_countries, target_devices,
   start_at, end_at)
VALUES
  ('DNS Learning', 'Current Affairs Launch', 'ACTIVE', 12.50, 5000.00,
   0.850, JSON_ARRAY('current affairs', 'exam', 'education'),
   JSON_ARRAY(), JSON_ARRAY('web', 'mobile'),
   NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY));

INSERT INTO ad_creatives
  (campaign_id, title, body, image_url, landing_url, call_to_action)
VALUES
  (LAST_INSERT_ID(), 'Prepare for your next exam',
   'Daily current-affairs lessons and practice questions.',
   'https://placehold.co/600x400?text=DNS+Learning',
   'https://example.com/courses/current-affairs', 'View course');
```

## 1. Request an ad

```http
POST /api/v1/ads/decision
Content-Type: application/json
```

```json
{
  "placement": "current-affairs-top",
  "sessionId": "client-generated-random-id",
  "consent": { "personalizedAds": true },
  "context": { "keywords": ["current affairs", "exam", "education"] },
  "device": { "type": "mobile" },
  "geo": { "country": "IN" }
}
```

Success is `200`. No eligible campaign is `204 No Content` and is not an error.

```json
{
  "success": true,
  "requestId": "3de4274e-1674-4cce-a037-453634094b54",
  "placement": "current-affairs-top",
  "ad": {
    "campaignId": 1,
    "creativeId": 1,
    "title": "Prepare for your next exam",
    "body": "Daily current-affairs lessons and practice questions.",
    "imageUrl": "https://placehold.co/600x400?text=DNS+Learning",
    "landingUrl": "https://example.com/courses/current-affairs",
    "callToAction": "View course",
    "disclosure": "Ad"
  },
  "tracking": { "eventUrl": "/api/v1/ads/events" }
}
```

The server stores only a SHA-256 hash of `sessionId`. Generate it once per app
installation or browser session; do not use a phone number or email address.

## 2. Report delivery and actions

Send `IMPRESSION` only after the creative is visibly rendered. Send `CLICK`
when the user opens it. Send `CONVERSION` from a trusted purchase backend where
possible, because browser-only conversions are easy to forge.

```http
POST /api/v1/ads/events
Content-Type: application/json
```

```json
{
  "requestId": "3de4274e-1674-4cce-a037-453634094b54",
  "type": "IMPRESSION"
}
```

Allowed event types are `IMPRESSION`, `CLICK`, `CONVERSION`, and `HIDE`.
For a conversion, an optional non-negative `value` can be supplied. Duplicate
events for the same request and type are safely ignored.

## 3. Get current-affairs courses

```http
GET /api/v1/current-affairs?page=1&limit=20
```

Only `PUBLISHED` or `COMING_SOON` courses that have not ended are returned.
The response contains nested pricing, offers, active notifications, and active
documents. Paid document URLs stay locked in this public response. Login and use
the purchase flow in [CASHFREE_PAYMENT_API.md](./CASHFREE_PAYMENT_API.md) to buy
an item and retrieve its unlocked documents.

## Mobile example (React Native)

```js
const response = await fetch(`${API_URL}/api/v1/ads/decision`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    placement: "home-feed-card",
    sessionId: await getOrCreateRandomInstallId(),
    consent: { personalizedAds: consent.personalizedAds },
    context: { keywords: ["current affairs", "exam"] },
    device: { type: "mobile" },
    geo: consent.personalizedAds ? { country: "IN" } : undefined
  })
});

const decision = response.status === 204 ? null : await response.json();
```

Production hardening still required: authenticated admin campaign APIs, rate
limiting, signed/server-side conversion events, HTTPS, URL allow-listing,
campaign pacing, cache-backed candidate retrieval, and a background reporting
pipeline. At high traffic, keep MySQL as the source of truth and move decision
candidates/counters to Redis or another low-latency store.
