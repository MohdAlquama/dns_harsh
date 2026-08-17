# Authentication API Guide

This document explains how to use the DNS authentication APIs, what data to
send, and the success/error responses to expect.

## Base URL

Local development:

```text
http://localhost:5000/api/v1/auth
```

All request bodies use JSON:

```http
Content-Type: application/json
```

## Authentication flow

### Registration

```text
Register details -> OTP sent -> Verify OTP -> Account activated + tokens returned
```

1. Call `POST /register` with the phone number, name, and password.
2. Call `POST /verify-otp` with `purpose: "REGISTER"`.
3. Save the returned access and refresh tokens.

### Login

```text
Phone number + password -> Access token + refresh token
```

### Forgot password

```text
Phone number -> OTP sent -> Verify OTP -> Reset token -> Set new password
```

1. Call `POST /forgot-password`.
2. Call `POST /verify-otp` with `purpose: "FORGOT_PASSWORD"`.
3. Copy the `resetToken` returned by OTP verification.
4. Call `POST /reset-password` with the new password and `resetToken`.

## Phone number and password rules

- Phone numbers must contain 10 to 15 digits.
- An optional leading `+` is supported, for example `+919026226199`.
- Spaces, brackets, and hyphens are automatically removed.
- Passwords must contain at least 8 characters.
- `confirmPassword` is optional. When supplied, it must match `password`.
- OTPs expire after 5 minutes.
- A maximum of 5 invalid OTP attempts is allowed.
- Password reset tokens expire after 10 minutes and can only be used once.

---

## 1. Register

Creates a disabled/pending account and sends an OTP to the phone number.

```http
POST /api/v1/auth/register
```

### Request body

```json
{
  "phoneNumber": "+919026226199",
  "name": "Harsh Kumar",
  "password": "password123",
  "confirmPassword": "password123"
}
```

### Success response — `202 Accepted`

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "next": "VERIFY_OTP",
  "purpose": "REGISTER"
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Valid phone number, name and password are required` | A required field is missing or the phone number is invalid. |
| `400` | `Passwords do not match` | `password` and `confirmPassword` differ. |
| `400` | `Password must be at least 8 characters` | Password is too short. |
| `409` | `User already exists` | An active account already uses the phone number. |
| `500` | `Server error` | Database, OTP provider, or internal server failure. |

### JavaScript example

```js
const response = await fetch("http://localhost:5000/api/v1/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phoneNumber: "+919026226199",
    name: "Harsh Kumar",
    password: "password123",
    confirmPassword: "password123"
  })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);
console.log(data);
```

---

## 2. Verify OTP

Verifies either a registration OTP or a forgot-password OTP.

```http
POST /api/v1/auth/verify-otp
```

### Registration request

```json
{
  "phoneNumber": "+919026226199",
  "otp": "123456",
  "purpose": "REGISTER"
}
```

### Registration success — `201 Created`

The account is activated and the user is logged in automatically.

```json
{
  "success": true,
  "message": "Phone verified and account created",
  "next": "HOME",
  "accessToken": "ACCESS_TOKEN",
  "refreshToken": "REFRESH_TOKEN",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "name": "Harsh Kumar",
    "phoneNumber": "+919026226199"
  }
}
```

### Forgot-password request

```json
{
  "phoneNumber": "+919026226199",
  "otp": "123456",
  "purpose": "FORGOT_PASSWORD"
}
```

### Forgot-password success — `200 OK`

Use the returned `resetToken` in the reset-password request. Do not use the
literal example value shown below.

```json
{
  "success": true,
  "message": "OTP verified",
  "next": "NEW_PASSWORD",
  "resetToken": "ACTUAL_ONE_TIME_RESET_TOKEN",
  "resetTokenExpiresIn": 600
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Valid phone number, OTP and purpose are required` | A required field is missing or invalid. |
| `400` | `Invalid OTP purpose` | Purpose is not `REGISTER` or `FORGOT_PASSWORD`. |
| `400` | `OTP session not found` | No active OTP request exists. |
| `400` | `OTP expired` | The OTP is older than 5 minutes. |
| `400` | Provider message or `Invalid OTP` | The entered OTP is incorrect. |
| `409` | `Registration is no longer pending` | The account is already active or pending data no longer exists. |
| `429` | `Too many invalid OTP attempts` | Five invalid attempts have been used. Request a new OTP. |
| `500` | `Server error` | Database, OTP provider, or internal server failure. |

### JavaScript example

```js
const response = await fetch("http://localhost:5000/api/v1/auth/verify-otp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phoneNumber: "+919026226199",
    otp: "123456",
    purpose: "REGISTER"
  })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);

// Registration response only:
localStorage.setItem("accessToken", data.accessToken);
localStorage.setItem("refreshToken", data.refreshToken);
```

---

## 3. Login

Logs in an active user using their phone number and password.

```http
POST /api/v1/auth/login
```

### Request body

```json
{
  "phoneNumber": "+919026226199",
  "password": "password123"
}
```

Optional device headers:

```http
X-Device-Type: mobile
X-Device-Name: Samsung Galaxy S24
```

### Success response — `200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "ACCESS_TOKEN",
  "refreshToken": "REFRESH_TOKEN",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "name": "Harsh Kumar",
    "phoneNumber": "+919026226199"
  }
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Valid phone number and password are required` | Phone number or password is missing/invalid. |
| `401` | `Invalid phone number or password` | User does not exist, is not verified, or password is incorrect. |
| `500` | `Server error` | Database or internal server failure. |

### JavaScript example

```js
const response = await fetch("http://localhost:5000/api/v1/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Device-Type": "web",
    "X-Device-Name": navigator.userAgent
  },
  body: JSON.stringify({
    phoneNumber: "+919026226199",
    password: "password123"
  })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);

localStorage.setItem("accessToken", data.accessToken);
localStorage.setItem("refreshToken", data.refreshToken);
```

---

## 4. Forgot password

Sends a password-reset OTP to an active user's phone number.

```http
POST /api/v1/auth/forgot-password
```

### Request body

```json
{
  "phoneNumber": "+919026226199"
}
```

### Success response — `200 OK`

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "next": "VERIFY_OTP",
  "purpose": "FORGOT_PASSWORD"
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Valid phone number is required` | Phone number is missing or invalid. |
| `404` | `User not found` | No active user exists with the phone number. |
| `500` | `Server error` | Database, OTP provider, or internal server failure. |

### JavaScript example

```js
const response = await fetch("http://localhost:5000/api/v1/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phoneNumber: "+919026226199" })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);
console.log(data);
```

---

## 5. Reset password

Sets a new password using the real one-time `resetToken` returned by the
forgot-password OTP verification response.

```http
POST /api/v1/auth/reset-password
```

### Request body

```json
{
  "phoneNumber": "+919026226199",
  "password": "newPassword123",
  "confirmPassword": "newPassword123",
  "resetToken": "ACTUAL_TOKEN_FROM_VERIFY_OTP_RESPONSE"
}
```

> `token-from-verify-otp` and `ACTUAL_TOKEN_FROM_VERIFY_OTP_RESPONSE` are
> placeholders. Always send the real token returned by `/verify-otp`.

### Success response — `200 OK`

```json
{
  "success": true,
  "message": "Password reset successfully",
  "next": "LOGIN"
}
```

All existing login sessions are revoked after a successful password reset.

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Phone number, new password and reset token are required` | Required data is missing or phone number is invalid. |
| `400` | `Passwords do not match` | Password confirmation differs. |
| `400` | `Password must be at least 8 characters` | Password is too short. |
| `403` | `Invalid or expired reset token` | Token is wrong, expired, already used, or belongs to another number. |
| `500` | `Server error` | Database or internal server failure. |

### JavaScript example

```js
const response = await fetch("http://localhost:5000/api/v1/auth/reset-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phoneNumber: "+919026226199",
    password: "newPassword123",
    confirmPassword: "newPassword123",
    resetToken // Real token saved from the verify-otp response
  })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);
console.log(data);
```

---

## 6. Refresh access token

Creates a new access token using a valid refresh token.

```http
POST /api/v1/auth/refresh
```

### Request body

```json
{
  "refreshToken": "REFRESH_TOKEN_FROM_LOGIN_OR_REGISTRATION"
}
```

### Success response — `200 OK`

```json
{
  "success": true,
  "accessToken": "NEW_ACCESS_TOKEN",
  "expiresIn": 900
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Refresh token is required` | Request body does not contain a token. |
| `401` | `Invalid or expired refresh token` | JWT signature is invalid or the JWT expired. |
| `401` | `Refresh token not found, revoked or expired` | Token is missing from SQL, revoked, or database expiry passed. |
| `500` | `Server error` | Database or internal server failure. |

### JavaScript example

```js
const refreshToken = localStorage.getItem("refreshToken");

const response = await fetch("http://localhost:5000/api/v1/auth/refresh", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);
localStorage.setItem("accessToken", data.accessToken);
```

---

## 7. Logout

Revokes the supplied refresh token. Calling logout again with the same validly
formatted token is safe and still returns success.

```http
POST /api/v1/auth/logout
```

### Request body

```json
{
  "refreshToken": "REFRESH_TOKEN_FROM_LOGIN_OR_REGISTRATION"
}
```

### Success response — `200 OK`

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### Possible errors

| Status | Message | Reason |
| --- | --- | --- |
| `400` | `Refresh token is required` | Request body does not contain a token. |
| `500` | `Server error` | Database or internal server failure. |

### JavaScript example

```js
const refreshToken = localStorage.getItem("refreshToken");

const response = await fetch("http://localhost:5000/api/v1/auth/logout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken })
});

const data = await response.json();
if (!response.ok) throw new Error(data.message);

localStorage.removeItem("accessToken");
localStorage.removeItem("refreshToken");
```

---

## Calling protected APIs

Send the access token returned by registration/login in the authorization
header when calling an API protected by authentication middleware:

```http
Authorization: Bearer ACCESS_TOKEN
```

Example helper:

```js
async function apiRequest(path, options = {}) {
  const accessToken = localStorage.getItem("accessToken");

  const response = await fetch(`http://localhost:5000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }
  return data;
}
```

> Note: the authentication APIs documented above issue tokens, but this project
> does not currently include access-token middleware on the dashboard/content
> routes. Add that middleware before treating those routes as protected.

## Standard frontend error handling

Always check `response.ok`. A JSON response can contain `success: false` even
though `fetch()` itself did not throw a network error.

```js
async function postJson(url, body) {
  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error("Unable to connect to the server");
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: "Invalid response from server"
  }));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
```

## 2Factor provider configuration

Before sending OTPs, add the 2Factor API key from the admin UI:

```text
http://localhost:5000/auth-settings
```

The UI uses:

```http
GET  /api/v1/auth-config/2factor
POST /api/v1/auth-config/2factor
```

Never commit or share the real 2Factor API key, access token, refresh token,
OTP, or password.
