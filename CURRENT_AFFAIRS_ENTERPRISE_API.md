# Enterprise Current Affairs Detail Page and API

This module supports a two-step customer journey:

```text
Home/catalog card -> current-affairs detail page -> login -> payment -> owned documents
```

The catalog and detail page use the same API data. The admin controls optional
sales sections with toggles, and disabled sections are not returned to clients.
This lets a web app, Android/iOS app, or another approved frontend render the
same offer without hard-coded marketing copy.

## What the detail page should show

Keep the first screen simple: title, short promise, image, final price, one
primary action, and a free-preview action. Below it, render the enabled API
sections in `sortOrder` order:

| API section | Customer benefit | Admin inputs |
|---|---|---|
| `HIGHLIGHTS` | Understand the main value in seconds | Heading and one benefit per line |
| `EXAM_COVERAGE` | Confirm exam, subject, language, and update frequency fit | Exams, subjects, languages, frequency |
| `DELIVERABLES` | Know exactly what is included and how often | `Title | Description | Frequency` per line |
| `SAMPLE_PREVIEW` | Inspect quality before paying | Heading, description, HTTPS preview URL, CTA |
| `SMART_REVISION` | See a repeatable learning routine instead of “only PDFs” | Minutes/day, workflow, quiz/revision features |
| `PRACTICE` | Compare MCQ/mock volume and learning tools | Counts, answer writing, analytics, description |
| `TRUST` | Know who reviews facts and how often content is updated | Expert, source policy, freshness promise, honest guarantee |
| `MENTOR_SUPPORT` | Understand genuine faculty and doubt support | Faculty, experience, mode, support scope |
| `FAQ` | Resolve objections before checkout | Up to 20 repeatable Question/Answer rows |
| `PURCHASE_CTA` | Present a consistent final action | Button label, subtext, genuine urgency text |

The existing admin settings continue to control publishing, schedule, image,
pricing, GST, platform fee, offer, notification, advertising, and PDF access.
An enabled section must have its minimum required fields, otherwise the admin
form rejects the save. Never add fake countdowns, unverifiable success numbers,
or a refund promise the business does not honour.

## Why these features were selected

They provide high visible value without requiring a complex recommendation or
AI system. Current products already make daily/monthly PDFs and quizzes normal
customer expectations: [Testbook exposes daily/monthly current affairs and
quizzes](https://testbook.com/current-affairs), [AffairsCloud groups daily,
weekly, and monthly PDF capsules](https://affairscloud.com/current-affairs-pdf-capsule/),
and [Vision IAS maintains a monthly magazine archive](https://visionias.in/current-affairs/monthly-magazine/archive).
DNS can differentiate with a transparent editorial policy, configurable free
sample, a 15-minute revision workflow, and the same structured experience on
every client.

## Public API

Base URL in development:

```text
http://localhost:5000/api/v1
```

### Step 1: load home/catalog cards

```http
GET /api/v1/current-affairs?page=1&limit=20
Accept: application/json
```

```bash
curl -sS "http://localhost:5000/api/v1/current-affairs?page=1&limit=20"
```

Use `data[].detailEndpoint` when the visitor selects a card. Catalog responses
stay lightweight and expose a small `preview`; the full ordered `sections`
array comes from the detail endpoint. `limit` is clamped to 1–50. Add `q=banking`
for name/short-description search. Only active `PUBLISHED` and `COMING_SOON`
records are visible, and pagination includes `total` and `totalPages`.

### Step 2: load one detail page

```http
GET /api/v1/current-affairs/12
Accept: application/json
```

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "Current Affairs 2026",
    "status": "PUBLISHED",
    "pricing": {
      "currency": "INR",
      "basePrice": 499,
      "gstPercent": 18,
      "platformCharge": 0,
      "breakdown": {
        "base": 499,
        "discount": 100,
        "gst": 71.82,
        "platform": 0,
        "total": 470.82,
        "currency": "INR"
      }
    },
    "purchase": {
      "type": "PAID",
      "available": true,
      "requiresLogin": true,
      "createOrderEndpoint": "/api/v1/payments/orders",
      "request": { "method": "POST", "body": { "currentAffairsId": 12 } }
    },
    "sections": [
      {
        "key": "HIGHLIGHTS",
        "enabled": true,
        "sortOrder": 10,
        "content": {
          "heading": "Why learners choose this pack",
          "items": ["Daily exam-ready analysis", "Weekly revision capsule"]
        }
      },
      {
        "key": "FAQ",
        "enabled": true,
        "sortOrder": 90,
        "content": {
          "heading": "Frequently asked questions",
          "items": [{ "question": "Can I use it on mobile?", "answer": "Yes, after login." }]
        }
      }
    ],
    "documents": [{ "id": 31, "name": "August Magazine", "locked": true, "downloadUrl": null }]
  }
}
```

Response codes are `200` for success, `400` for an invalid ID, `404` for a
missing/unpublished/expired item, and `500` for an unexpected server error. The
detail response can be cached for 60 seconds and served stale while it is
revalidated for up to five minutes.

### Step 3: render sections safely in a web frontend

Do not insert API strings with `innerHTML`. Treat section content as text.

```js
async function loadCurrentAffairsDetail(id) {
  const response = await fetch(`${API_URL}/api/v1/current-affairs/${id}`, {
    headers: { Accept: "application/json" }
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Detail request failed: ${response.status}`);

  const { data } = await response.json();
  return {
    ...data,
    sections: [...data.sections].sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

const course = await loadCurrentAffairsDetail(12);
const highlights = course.sections.find(section => section.key === "HIGHLIGHTS");
highlights?.content.items.forEach(item => {
  const li = document.createElement("li");
  li.textContent = item;
  document.querySelector("#benefits").append(li);
});
```

Clients should ignore unknown section keys. That forward-compatible behaviour
allows the server to introduce a new section without breaking an older app.

### Step 4: buy the item

Login and pass the access token. The client sends only the item ID; the server
calculates and stores the authoritative price.

```js
async function createCurrentAffairsOrder(courseId, accessToken) {
  const response = await fetch(`${API_URL}/api/v1/payments/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ currentAffairsId: courseId })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Could not create order");
  return payload; // use cashfree.paymentSessionId with Cashfree Checkout
}
```

Complete checkout, verification, purchase listing, and protected document
downloads are documented in [CASHFREE_PAYMENT_API.md](./CASHFREE_PAYMENT_API.md).
Never unlock a paid document from a client-side “payment succeeded” message.

## Admin workflow

1. Sign in with the protected admin password and OTP.
2. Open `/current-affairs/new`, add basic content, set a price and keep status
   `DRAFT` while preparing the offer.
3. Enable only the detail sections that have useful, truthful content. The
   dependent inputs appear immediately below each toggle.
4. Add a free sample that contains enough real material to demonstrate quality
   but does not expose the paid document URL.
5. Preview the public API with `GET /api/v1/current-affairs/{id}`.
6. Change status to `PUBLISHED`, test order creation in Cashfree sandbox, and
   verify that documents unlock only through authenticated purchases.

Saving edits replaces the course's section configuration in one database
transaction. Disabled section content remains admin data but is never returned
by the public API. Deleting a course cascades to all of its sections.

## Enterprise production plan

The current implementation establishes the content contract and admin control.
Before high-traffic production, add these in order:

1. Object storage plus signed, short-lived URLs for previews/documents; malware
   scanning and file-type inspection for every upload.
2. API gateway rate limits, HTTPS, exact CORS origins, request IDs, structured
   logs, uptime/error/payment alerts, and database backups with restore drills.
3. Draft preview URLs, maker-checker publishing approval, audit history, content
   versioning, and scheduled publish/unpublish jobs.
4. Analytics events for `DETAIL_VIEW`, `SAMPLE_OPEN`, `CHECKOUT_START`,
   `PURCHASE`, and `REFUND`; calculate the funnel by course and client without
   storing unnecessary personal data.
5. Multiple documents/content units, tags, exam/language filters, search, and
   cursor pagination when the catalog grows.
6. Quiz attempts, bookmarks, progress, reminders, weak-topic revision, and
   entitlement expiry as separate domain tables—not inside the marketing JSON.
7. Redis/CDN caching with explicit invalidation after publish, read replicas
   when needed, idempotent background jobs, and regular load/security testing.

Suggested conversion metrics are detail-view-to-sample-open,
sample-open-to-checkout, checkout-to-paid, 7/30-day active learners, quiz
completion, refund rate, and support contacts per 100 purchases. Measure these
instead of relying on decorative vanity numbers.
