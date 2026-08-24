# Firebase Cloud Messaging Setup

This project includes a complete FCM push notification flow for browser clients, authenticated users, and admin-triggered notifications.

## Files Added

- `models/fcmTokenTable.js` creates the `fcm_tokens` table at server startup.
- `models/fcmTokenModel.js` saves, fetches, and deletes FCM tokens.
- `config/firebaseAdmin.js` initializes the Firebase Admin SDK on the server.
- `services/fcmNotificationService.js` sends notifications and removes stale Firebase tokens.
- `controllers/notificationController.js` handles token registration and admin sends.
- `routes/notificationRoutes.js` exposes notification API routes.
- `public/fcm-registration.html` shows the plain HTML and JavaScript browser registration flow.
- `public/firebase-messaging-sw.js` handles background browser messages.
- `database/fcm_schema.sql` contains raw SQL for manual database setup.

## Database Schema

The app uses the existing `auth_users` table as the user table. Each user can have multiple FCM device tokens.

The `fcm_tokens.token` column is unique globally. This prevents one browser or device token from staying attached to an old account after a different user logs in on the same browser.

Manual SQL is available in:

```text
database/fcm_schema.sql
```

The server also creates the table automatically on startup through:

```js
await createFcmTokenTable();
```

## Backend Environment Config

Install dependencies:

```bash
npm install
```

Add the Firebase service account JSON to your server environment:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"YOUR_PROJECT_ID","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@YOUR_PROJECT_ID.iam.gserviceaccount.com","client_id":"..."}'
```

Important:

- Keep `FIREBASE_SERVICE_ACCOUNT_JSON` only on the backend.
- Never place the service account JSON in HTML or public JavaScript.
- The Firebase Admin SDK is initialized lazily, so the server can start before the first notification is sent.

## Firebase Console Config

In Firebase Console:

1. Create or open your Firebase project.
2. Go to Project settings.
3. Add a Web app if you do not already have one.
4. Copy the Web app config into `public/fcm-registration.html`.
5. Go to Cloud Messaging.
6. Create or copy the Web Push certificate key pair.
7. Put that public VAPID key into `public/fcm-registration.html`.
8. Generate a Firebase Admin service account key for the backend environment variable.

## Frontend Browser Token Registration

Edit the placeholders in:

```text
public/fcm-registration.html
public/firebase-messaging-sw.js
```

Use the same Firebase Web app config in both files.

The browser flow does this:

1. Initializes the Firebase Client SDK.
2. Requests notification permission from the user.
3. Registers `/firebase-messaging-sw.js`.
4. Gets the FCM device token.
5. Sends the token to the backend with the logged-in user's bearer token.

Registration endpoint:

```http
POST /api/notifications/register-token
Authorization: Bearer USER_ACCESS_TOKEN
Content-Type: application/json

{
  "userId": 12,
  "fcmToken": "FCM_DEVICE_TOKEN"
}
```

The backend rejects attempts to register a token for a different user than the authenticated bearer token user.

## Admin Send Config

Admins can send a notification to all registered devices for one user from:

```text
http://localhost:5000/notification-settings
```

The admin screen shows registered token counts, Firebase Admin config status, searchable users, and a form for title, body, and optional JSON data.

The same action is also available through the API.

Admin endpoint:

```http
POST /api/notifications/send-to-user
Content-Type: application/json

{
  "userId": 12,
  "title": "New update",
  "body": "Your admin portal notification is working.",
  "data": {
    "module": "admin",
    "type": "status_update"
  }
}
```

This route uses the existing `requireAdmin` middleware, so the request must come from a valid admin session.

Example admin-side browser call:

```js
async function sendAdminNotification() {
  const response = await fetch("/api/notifications/send-to-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      userId: 12,
      title: "New update",
      body: "Your admin portal notification is working.",
      data: {
        module: "admin",
        type: "status_update"
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.message || "Unable to send notification");
  }

  return result;
}
```

Successful response example:

```json
{
  "success": true,
  "message": "Notification sent",
  "successCount": 2,
  "failureCount": 0,
  "staleTokenCount": 0
}
```

If the user has no registered devices, the API still returns `200` with `successCount: 0`.

## Stale Token Cleanup

`services/fcmNotificationService.js` removes invalid tokens automatically when Firebase returns:

- `messaging/invalid-registration-token`
- `messaging/registration-token-not-registered`

The service sends in batches of 500 tokens because Firebase multicast requests accept a maximum of 500 registration tokens per call.

## Quick Test Checklist

1. Start the server:

```bash
npm start
```

2. Log in as a normal user and store the app's auth values in the browser:

```js
sessionStorage.setItem("accessToken", "USER_ACCESS_TOKEN");
sessionStorage.setItem("userId", "12");
```

3. Open:

```text
http://localhost:5000/fcm-registration.html
```

4. Click Enable notifications.
5. Confirm a row exists in `fcm_tokens`.
6. Log in to the admin portal.
7. Send a notification through `POST /api/notifications/send-to-user`.

## Troubleshooting

- `FIREBASE_SERVICE_ACCOUNT_JSON is not configured`: add the backend service account environment variable.
- `Firebase did not return a device token`: check the Firebase Web config, VAPID key, and browser notification permission.
- `Cannot register a token for another user`: make sure `userId` matches the logged-in bearer token user.
- No background notification appears: confirm `public/firebase-messaging-sw.js` is available at `/firebase-messaging-sw.js`.
- Browser blocks notification permission: test on `localhost` or HTTPS. Web Push does not work on insecure origins.
