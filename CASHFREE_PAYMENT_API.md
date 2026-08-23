# Cashfree purchases, orders, and refunds

This module lets an authenticated DNS user buy a published Current Affairs item, unlock its documents after server-side payment verification, view purchase history, and receive full or partial refunds from the admin panel.

## 1. Required configuration

After completing the administrator password-and-OTP login, open `http://localhost:5000/payment-settings`. In production, configure encryption before opening that page:

```bash
NODE_ENV=production
PAYMENT_CONFIG_ENCRYPTION_KEY=use-a-separate-long-random-encryption-key
ACCESS_TOKEN_SECRET=use-a-long-random-access-token-secret
REFRESH_TOKEN_SECRET=use-a-long-random-refresh-token-secret
```

Enter the Cashfree Payment Gateway App ID and secret, choose `SANDBOX` first, and enable payments. Environment variables can be used instead and take precedence:

```bash
CASHFREE_ENABLED=true
CASHFREE_ENVIRONMENT=SANDBOX
CASHFREE_CLIENT_ID=your-app-id
CASHFREE_CLIENT_SECRET=your-secret-key
CASHFREE_API_VERSION=2025-01-01
CASHFREE_RETURN_URL=https://example.com/payment/return?order_id={order_id}
CASHFREE_NOTIFY_URL=https://example.com/api/v1/payments/webhook
```

Use HTTPS for both callback URLs in production. Add the notify URL in Cashfree Dashboard → Payment Gateway → Developers → Webhooks and enable payment and refund events. Never send the Cashfree client secret to a browser or mobile app.

## 2. Price calculation

The server always calculates price from the database; client-supplied amounts are ignored:

```text
discounted price = base price - active offer
GST              = GST percentage of discounted price
total            = discounted price + GST + platform charge
```

Money is rounded to two decimal places. Cashfree requires an order amount of at least ₹1. Paid documents are locked in the public catalog and are returned only from the authenticated purchase-history endpoint after a successful payment.

Offer codes are also calculated only by the server. An offer policy can be global or course-specific and can enforce active dates, a minimum order amount, a maximum discount, a global usage limit, and a per-user usage limit. By default an offer code replaces the course's automatic offer; an administrator can explicitly allow stacking.

## 3. Validate an offer code

The checkout UI can preview a code before creating a Cashfree order:

```http
POST /api/v1/payments/offers/validate
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "currentAffairsId": 12,
  "offerCode": "WELCOME20"
}
```

Successful response:

```json
{
  "success": true,
  "offer": { "code": "WELCOME20", "name": "New user welcome offer" },
  "priceBreakdown": {
    "base": 100,
    "courseDiscount": 0,
    "offerCodeDiscount": 20,
    "discount": 20,
    "gst": 14.4,
    "platform": 0,
    "total": 94.4,
    "offerCode": "WELCOME20"
  }
}
```

Validation is only a preview. Eligibility and usage limits are checked again atomically while the order is created. Typical error codes are `OFFER_INVALID`, `OFFER_EXPIRED`, `OFFER_LIMIT_REACHED`, and `OFFER_USER_LIMIT_REACHED`.

## 4. Create a payment order

Login first with `POST /api/v1/auth/login`, then send its access token:

```http
POST /api/v1/payments/orders
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{"currentAffairsId": 12, "offerCode": "WELCOME20"}
```

Response:

```json
{
  "success": true,
  "order": {
    "orderId": "dns_1787200000000_1a2b3c4d5e",
    "amount": 118,
    "currency": "INR",
    "priceBreakdown": {
      "base": 100,
      "discount": 0,
      "gst": 18,
      "platform": 0,
      "total": 118
    }
  },
  "cashfree": {
    "paymentSessionId": "session_...",
    "environment": "SANDBOX"
  }
}
```

Only `PUBLISHED` items can be purchased. A user cannot buy the same currently-owned item twice.

Omit `offerCode` for a normal checkout. Never send a client-calculated amount. The server verifies the policy again, reserves one use, stores the verified discount, and sends only the final server-calculated amount to Cashfree.

## 5. Open Cashfree checkout

Use the returned session ID with Cashfree's client SDK. Example for a website:

```html
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
<script>
  const cashfree = Cashfree({ mode: "sandbox" }); // use "production" for live
  await cashfree.checkout({
    paymentSessionId: response.cashfree.paymentSessionId,
    redirectTarget: "_self"
  });
</script>
```

Do not unlock content from the checkout's client response. The server validates the signed webhook and also checks the order directly with Cashfree when an active order is fetched.

## 6. Verify an order and show purchases

```http
GET /api/v1/payments/orders/dns_1787200000000_1a2b3c4d5e
Authorization: Bearer ACCESS_TOKEN
```

The endpoint checks ownership. For an active order it fetches Cashfree's order status and validates currency and amount before marking it paid.

```http
GET /api/v1/payments/purchases
Authorization: Bearer ACCESS_TOKEN
```

This returns the signed-in user's successfully purchased items, status, amount, image, and ownership-checked document API URLs. Send the same Bearer token when downloading a document. Direct static access to a paid PDF is blocked. Fully refunded items are removed from this list; partially refunded items remain available.

## 7. Webhook security

Cashfree sends events to:

```http
POST /api/v1/payments/webhook
```

The implementation captures the exact raw body, calculates Base64-encoded HMAC-SHA256 over `x-webhook-timestamp + rawBody` with the Cashfree client secret, uses a timing-safe signature comparison, rejects invalid signatures, and deduplicates `x-idempotency-key`. Payment amount and currency must match the local order before access is enabled.

## 8. Admin offer-code policies

Open `http://localhost:5000/offer-codes` after administrator login. An administrator can configure:

- Code and display name
- Optional assignment to one registered user by phone number
- All courses or one Current Affairs course
- Percentage or fixed-rupee discount
- Minimum order and optional maximum discount
- Global and per-user usage limits
- Start and expiry timestamps
- Whether the code stacks with the course's automatic offer
- Active/inactive status

An order initially reserves a use. A verified `PAID` event marks it redeemed. `FAILED`, `EXPIRED`, and `USER_DROPPED` orders release the reservation so the user can retry.

## 9. Admin order history and refunds

Open `http://localhost:5000/orders`. The page shows order ID, item, purchaser, phone, amount, payment/refund status, and time.

For a paid order, enter an amount up to the remaining refundable amount, a note, and `STANDARD` or `INSTANT`, then submit. The server calls:

```text
POST /pg/orders/{order_id}/refunds
```

The initial response is stored immediately. Final `SUCCESS`, failure, or cancellation state is updated asynchronously by the signed refund webhook. Multiple partial refunds are supported but their total cannot exceed the paid amount.

## 10. Admin-managed parts

- Current Affairs: add, edit, delete, pricing, GST, platform fee, offers, publishing, PDF upload.
- Cashfree Settings: sandbox/live mode, credentials, API version, return URL, webhook URL, enabled state.
- Orders & Refunds: purchaser and item history, paid/refunded amounts, gateway status, full/partial refund.
- Offer Codes: policy creation, course targeting, eligibility windows, usage limits, stacking, and activation.

## 11. Production checklist

- Test the complete success, failed, dropped, expired, partial-refund, and full-refund flows in Cashfree sandbox.
- Use HTTPS, production Cashfree keys, strong application secrets, and the protected administrator password-plus-OTP login.
- Back up the database and keep `PAYMENT_CONFIG_ENCRYPTION_KEY` stable; changing it makes stored Cashfree secrets unreadable.
- Set an exact `API_ALLOWED_ORIGINS` list for browser clients.
- Apply application-level rate limiting at the reverse proxy or API gateway.
- Monitor webhook failures and reconcile pending orders/refunds with Cashfree periodically.

## Official references used

- [Cashfree Create Order API](https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order)
- [Cashfree Payment Gateway API overview](https://www.cashfree.com/docs/api-reference/payments/latest/overview)
- [Cashfree webhook signature verification](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification)
- [Cashfree payment webhooks](https://www.cashfree.com/docs/api-reference/payments/latest/payments/webhooks)
- [Cashfree refunds overview](https://www.cashfree.com/docs/payments/manage/refunds/overview)
- [Cashfree Create Refund API](https://www.cashfree.com/docs/api-reference/payments/latest/refunds/create-refund)
