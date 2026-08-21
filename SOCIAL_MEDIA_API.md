# Social Media Configuration
{main started here }
Admin page: /social-media-settings
Public API: GET /api/v1/social-media
Admin API: GET/PUT /api/v1/admin/social-media
{main end}
The admin page at `/social-media-settings` manages YouTube, Instagram, Facebook, and X accounts.
Each account has a display label, profile URL, and `ACTIVE`/`INACTIVE` status.

## Public endpoint

`GET /api/v1/social-media`

Only fully configured active accounts are returned.

```json
{
  "success": true,
  "accounts": [
    {
      "platform": "YOUTUBE",
      "label": "DNS Education",
      "profileUrl": "https://www.youtube.com/@dnseducation",
      "isActive": true,
      "status": "ACTIVE",
      "updatedAt": "2026-08-21T10:00:00.000Z"
    }
  ]
}
```

## Admin endpoints

- `GET /api/v1/admin/social-media` returns all four account configurations.
- `PUT /api/v1/admin/social-media` saves all four configurations in one transaction.

The admin endpoints require an authenticated admin session. The update body is:

```json
{
  "accounts": [
    {
      "platform": "YOUTUBE",
      "label": "DNS Education",
      "profileUrl": "https://www.youtube.com/@dnseducation",
      "isActive": true
    },
    {
      "platform": "INSTAGRAM",
      "label": "",
      "profileUrl": "",
      "isActive": false
    },
    {
      "platform": "FACEBOOK",
      "label": "",
      "profileUrl": "",
      "isActive": false
    },
    {
      "platform": "X",
      "label": "",
      "profileUrl": "",
      "isActive": false
    }
  ]
}
```

An active account must have both a label and a valid URL for its platform.
