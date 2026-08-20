# Admin password and OTP authentication

The complete admin panel is protected by a separate administrator login at:

```text
http://localhost:5000/admin/login
```

On the first startup with an empty `admin_users` table, the application creates one owner account:

```text
Name: Mohd Alquama
Phone: 9026226199
Role: SUPER_ADMIN
```

The requested initial password is stored only as a bcrypt hash. Change it through a controlled database migration or a future password-management screen after the first deployment; never store plaintext passwords in configuration files.

## First login when OTP is not configured

1. Enter the super-admin phone and password.
2. Credentials are validated before any setup access is issued.
3. The admin is sent to `/admin/otp-setup` and can access only that page.
4. Enter the 2Factor API key.
5. The key is validated by successfully sending the first OTP. Invalid keys remain editable and are not locked in.
6. The validated key is inserted only if no `2FACTOR` configuration exists. It cannot be configured a second time through the application.
7. After successful OTP verification, an eight-hour admin session is created.

## Every later login

```text
phone + password -> OTP sent -> OTP verified -> dashboard
```

OTP challenges expire after five minutes and allow no more than five incorrect attempts. Session and challenge tokens are random, stored as SHA-256 hashes in MySQL, and sent through `HttpOnly`, `SameSite=Strict` cookies. Production cookies also require HTTPS.

## Protected areas

- Dashboard
- Current Affairs create, edit, and delete
- OTP status page and API
- Cashfree configuration
- Orders and refunds
- Administrator management

Public customer authentication, catalog, advertising, Cashfree webhook, payment return, and authenticated customer-purchase APIs remain separate.

## Creating other administrators

Only a logged-in `SUPER_ADMIN` can open `/admins`. New administrators receive the `ADMIN` role and use the same password-plus-OTP login flow. The first owner account is created only when there are no administrators; restarting the app never duplicates or overwrites it.

## Production requirements

- Serve the admin panel only over HTTPS.
- Set strong `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `PAYMENT_CONFIG_ENCRYPTION_KEY` values.
- Restrict admin access at the firewall or reverse proxy when possible.
- Configure trusted-proxy handling before relying on forwarded client IP addresses.
- Add password reset/change, administrator disable, and audit-log workflows before delegating access broadly.
