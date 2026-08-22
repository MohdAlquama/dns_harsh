# Enterprise Current Affairs Product and API

This module supports two separate customer experiences:

1. The home/catalog page shows compact product cards from the listing API.
2. Selecting a card opens a conversion-focused detail page from the detail API.

The detail page is assembled from admin-controlled modules. A disabled module is
not returned to clients, so web, Android, iOS, or another frontend can render the
same course without hard-coded marketing content.

## Why these product sections exist

Current exam-preparation products commonly make these benefits explicit:

- daily, weekly, and monthly delivery;
- exam, subject, and language coverage;
- PDFs, classes, quizzes, mocks, and answer-writing practice;
- a short revision routine rather than an unstructured content dump;
- editorial/source credibility and freshness;
- a sample before purchase and clear doubt support.

The implementation keeps these capabilities in one validated JSON-backed module
table instead of creating many narrowly coupled tables. It is flexible for
frontends but still restricts administrators to known, validated module types.

Market references used for the product design:

- [Vision IAS Monthly Current Affairs Revision](https://www.visionias.in/mcar/)
- [Vision IAS Sandhan current-affairs practice](https://visionias.in/upsc-testseries-sandhan/)
- [Drishti IAS Current Affairs](https://www.drishtiias.com/current-affairs-news-analysis-editorials)
- [Testbook monthly Current Affairs eBooks](https://testbook.com/current-affairs-2026-monthly-ebook-subscription-coaching)
- [Adda247 monthly Current Affairs classes](https://www.adda247.com/product-onlineliveclasses/85766/monthly-current-affairs-for-2025-bank-exams-online-live-classes-by-adda-247)

## Admin workflow

Open:

```text
GET /current-affairs/new
```

For an existing product:

```text
GET /current-affairs/{id}/edit
```

The **Detail Page Sections** builder provides these independently enabled modules:

| Module key | What the admin controls | Recommended frontend block |
|---|---|---|
| `HIGHLIGHTS` | Heading and benefit bullets | Hero benefit checklist |
| `EXAM_COVERAGE` | Exams, subjects, languages, release frequency | Tags and coverage grid |
| `DELIVERABLES` | Title, description, and frequency of every deliverable | “What you get” cards |
| `SAMPLE_PREVIEW` | Sample URL and CTA copy | Free-preview banner |
| `SMART_REVISION` | Minutes per day, workflow, revision features | Study-routine timeline |
| `PRACTICE` | Daily MCQs, mock count, answer writing, analytics | Assessment metrics |
| `TRUST` | Editor, source policy, update promise, truthful assurance | Editorial trust panel |
| `MENTOR_SUPPORT` | Faculty, experience, support mode, description | Faculty/support card |
| `FAQ` | Up to 20 repeatable question-and-answer rows | Accordion |
| `PURCHASE_CTA` | Button, subtext, and genuine urgency text | Sticky checkout card |

When a toggle is enabled, the required fields must be completed. The server
validates lengths, URLs, structured rows, and numeric limits. Never enter an
unverifiable learner count, result claim, testimonial, guarantee, or fake
countdown.

Structured deliverable textarea format:

```text
Deliverable title | Description | Frequency
```

FAQ entries use separate Question and Answer fields with **Add another FAQ** and
Remove controls. Example deliverables:

```text
Daily News Brief | Exam-ready news explained in simple language | Daily
Current Affairs Quiz | MCQs with solutions and context | Daily
Weekly Revision Capsule | Important events consolidated for revision | Weekly
Monthly Magazine | Complete subject-wise revision PDF | Monthly
```

## 1. Catalog/home-page API

```http
GET /api/v1/current-affairs?page=1&limit=12&q=UPSC
```

Query parameters:

| Name | Default | Limit | Meaning |
|---|---:|---:|---|
| `page` | `1` | minimum `1` | Page number |
| `limit` | `20` | maximum `50` | Products per page |
| `q` | empty | 80 characters | Name/short-description search |

Only active `PUBLISHED` and `COMING_SOON` products are returned. The listing
does not return all detail sections. It returns a compact `preview` and a
`detailEndpoint`, which keeps home-page responses small.

Example:

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "name": "Current Affairs 2026 Complete Pack",
      "description": {
        "short": "Daily analysis, quizzes and monthly revision",
        "long": "Complete exam-oriented Current Affairs preparation."
      },
      "imageUrl": "https://api.example.com/uploads/current-affairs/cover.webp",
      "status": "PUBLISHED",
      "pricing": {
        "currency": "INR",
        "basePrice": 999,
        "gstPercent": 18,
        "platformCharge": 0,
        "breakdown": {
          "base": 999,
          "discount": 200,
          "gst": 143.82,
          "platform": 0,
          "total": 942.82,
          "currency": "INR"
        }
      },
      "purchase": {
        "type": "PAID",
        "available": true,
        "requiresLogin": true,
        "createOrderEndpoint": "/api/v1/payments/orders",
        "request": {
          "method": "POST",
          "body": { "currentAffairsId": 12 }
        }
      },
      "detailEndpoint": "/api/v1/current-affairs/12",
      "preview": {
        "highlights": ["Daily exam-ready analysis", "Monthly PDF magazine"],
        "examTags": ["UPSC", "SSC CGL", "Banking"],
        "languages": ["Hindi", "English"],
        "updateFrequency": "Daily + weekly + monthly",
        "freeSampleAvailable": true
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 1,
    "totalPages": 1,
    "hasMore": false
  },
  "filters": { "q": "UPSC" }
}
```

Browser/React call:

```js
async function loadCurrentAffairs({ page = 1, query = "" } = {}) {
  const params = new URLSearchParams({ page, limit: 12 });
  if (query.trim()) params.set("q", query.trim());

  const response = await fetch(
    `${API_URL}/api/v1/current-affairs?${params.toString()}`
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  return payload;
}
```

## 2. Product-detail API

When the user selects a catalog card, call its `detailEndpoint`:

```http
GET /api/v1/current-affairs/12
```

Successful responses include all enabled sections in admin-defined order:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "Current Affairs 2026 Complete Pack",
    "detailEndpoint": "/api/v1/current-affairs/12",
    "sections": [
      {
        "key": "DELIVERABLES",
        "enabled": true,
        "sortOrder": 30,
        "content": {
          "heading": "Everything included",
          "items": [
            {
              "title": "Daily News Brief",
              "description": "Exam-ready news in simple language",
              "frequency": "Daily"
            }
          ]
        }
      },
      {
        "key": "PRACTICE",
        "enabled": true,
        "sortOrder": 60,
        "content": {
          "heading": "Practice and assessment",
          "dailyMcqs": 10,
          "mockTests": 24,
          "answerWriting": true,
          "performanceAnalytics": true,
          "description": "Solutions explain why every option is right or wrong."
        }
      }
    ]
  }
}
```

The detail response is cacheable for 60 seconds and permits stale reuse for five
minutes while clients refresh it.

Frontend renderer example:

```js
function renderSection(section) {
  switch (section.key) {
    case "HIGHLIGHTS":
      return <BenefitList {...section.content} />;
    case "EXAM_COVERAGE":
      return <CoverageGrid {...section.content} />;
    case "DELIVERABLES":
      return <DeliverableCards {...section.content} />;
    case "SAMPLE_PREVIEW":
      return <FreeSampleBanner {...section.content} />;
    case "SMART_REVISION":
      return <RevisionPlan {...section.content} />;
    case "PRACTICE":
      return <PracticeMetrics {...section.content} />;
    case "TRUST":
      return <EditorialTrust {...section.content} />;
    case "MENTOR_SUPPORT":
      return <MentorSupport {...section.content} />;
    case "FAQ":
      return <FaqAccordion {...section.content} />;
    case "PURCHASE_CTA":
      return <PurchasePanel {...section.content} />;
    default:
      return null; // Forward-compatible with future modules.
  }
}

const product = await fetch(`${API_URL}${card.detailEndpoint}`).then((r) => r.json());
product.data.sections
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map(renderSection);
```

Always render server text as text, not raw HTML. Open sample URLs with
`rel="noopener noreferrer"` when using a new tab.

## 3. Purchase and unlock flow

```text
Catalog API
    -> Detail API
    -> Login (if required)
    -> Create payment order
    -> Cashfree checkout
    -> Verify order status
    -> Purchases API returns unlocked document URLs
```

Create order:

```js
async function buyCurrentAffairs(productId, accessToken) {
  const response = await fetch(`${API_URL}/api/v1/payments/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ currentAffairsId: productId })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  return payload;
}
```

Open checkout using `payload.cashfree.paymentSessionId`, then verify using:

```http
GET /api/v1/payments/orders/{orderId}
Authorization: Bearer ACCESS_TOKEN
```

After status becomes `PAID`, load owned content:

```http
GET /api/v1/payments/purchases
Authorization: Bearer ACCESS_TOKEN
```

Never unlock paid documents from a browser-side checkout callback. Only the
server-verified order/purchases API is authoritative. See
[CASHFREE_PAYMENT_API.md](./CASHFREE_PAYMENT_API.md) for the complete payment and
webhook contract.

## Recommended detail-page order

For a clear and high-conversion page without visual overload:

1. Hero: title, short outcome, image, price, offer, CTA.
2. Highlights: four to six concrete benefits.
3. Exam/subject/language coverage.
4. Deliverables with cadence.
5. Free sample.
6. Smart revision and practice system.
7. Editorial trust and mentor support.
8. FAQ.
9. Sticky final purchase CTA.

## Enterprise next phases

The current implementation handles merchandising, purchase, and protected PDF
delivery. Add these as separate bounded projects when actual content operations
need them:

- multiple scheduled content releases and document version history;
- native quiz/test attempts, explanations, and learner analytics;
- bookmarks, revision queues, and weak-topic recommendations;
- entitlement expiry and subscription renewal;
- coupons with start/end dates and redemption limits;
- product impression, detail-view, sample-open, checkout-start, and purchase
  conversion analytics;
- editorial approval workflow with draft, reviewer, approval, and audit history;
- Redis caching and search indexing when catalog traffic requires them.

Keeping these out of the initial module table prevents marketing configuration
from becoming a learning-management system before that complexity is needed.
