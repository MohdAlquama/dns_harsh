# Test Series and Books catalog

This module provides shared, production-oriented catalog infrastructure for two independently managed product types: `TEST_SERIES` and `BOOK`. Common product concerns live in `catalog_products`; type-specific data is normalized into `test_series_details` and `book_details`.

## Admin routes

All admin routes require a valid administrator session. Mutating requests also enforce same-origin protection.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/test-series` | List Test Series products |
| `GET` | `/test-series/new` | Create form |
| `POST` | `/test-series` | Create Test Series |
| `GET` | `/test-series/:id/edit` | Edit form |
| `POST` | `/test-series/:id/edit` | Update Test Series |
| `POST` | `/test-series/:id/delete` | Delete Test Series |
| `GET` | `/books` | List Books |
| `GET` | `/books/new` | Create form |
| `POST` | `/books` | Create Book |
| `GET` | `/books/:id/edit` | Edit form |
| `POST` | `/books/:id/edit` | Update Book |
| `POST` | `/books/:id/delete` | Delete Book |

Deleting a product cascades only into its own type-specific detail row. Slugs are unique within a product type. ISBN and SKU are unique when present.

## Public Test Series API

```http
GET /api/v1/test-series?page=1&limit=20&q=ssc&mode=MOCK
```

Supported filters:

- `page`: positive integer, default `1`
- `limit`: `1–50`, default `20`
- `q`: title/short-description search, maximum 80 characters
- `mode`: `PRACTICE`, `MOCK`, or `LIVE`

Detail:

```http
GET /api/v1/test-series/15
```

Example item:

```json
{
  "id": 15,
  "type": "TEST_SERIES",
  "title": "SSC CGL Full Mock Series",
  "slug": "ssc-cgl-full-mock-series",
  "status": "PUBLISHED",
  "pricing": {
    "currency": "INR",
    "base": 499,
    "gst": 89.82,
    "platform": 0,
    "total": 588.82
  },
  "testSeries": {
    "mode": "MOCK",
    "durationMinutes": 60,
    "totalQuestions": 100,
    "totalMarks": 200,
    "negativeMarks": 0.5,
    "attemptLimit": 3,
    "availability": { "start": null, "end": null },
    "languages": ["English", "Hindi"],
    "syllabus": ["Reasoning", "Mathematics"]
  }
}
```

## Public Books API

```http
GET /api/v1/books?page=1&limit=20&q=history&format=PHYSICAL
```

`format` accepts `PHYSICAL`, `DIGITAL`, or `BOTH`.

Detail:

```http
GET /api/v1/books/8
```

Book responses include author, publisher, ISBN, language, edition, page count, format, stock availability, and public sample URL. `digital_asset_url` is intentionally excluded from every public response. A protected delivery endpoint must verify purchase ownership before exposing a paid digital asset.

## Response envelope and pagination

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasMore": false
  },
  "filters": { "q": null, "mode": null }
}
```

Only `PUBLISHED` and `COMING_SOON` products appear publicly. Drafts remain admin-only. Detail responses use short-lived public cache headers.

## Validation and security

- Product type and table selection come from server-owned constants, never request input.
- Database values use prepared parameters; pagination is bounded before query formatting.
- Prices, percentages, inventory, duration, question counts, attempts, and marks are validated server-side.
- URLs accept only HTTP(S) or absolute site paths.
- Slugs are normalized to lowercase URL-safe values.
- Test languages and syllabus are stored as JSON arrays, not delimiter-dependent text.
- Book digital asset locations never appear in catalog API responses.
- Admin mutations require authentication and same-origin validation.

## Payment boundary

The catalog exposes stable product IDs and product types, but the current Cashfree order endpoint purchases Current Affairs items only. Do not unlock a Test Series or digital Book based on client state. When checkout support is added, extend the payment ownership model and verify Cashfree amount/status on the backend before granting attempts or downloads.
