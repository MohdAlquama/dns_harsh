# Offer codes and checkout integration

This feature lets administrators create discount policies and lets an authenticated website user enter an offer code before Cashfree checkout. The backend is the source of truth for eligibility and price.

## Admin page

Open `GET /offer-codes` after admin login. Create a policy with a code, discount type/value, optional course scope, optional specific-user phone, validity window, minimum order, discount cap, total-use limit, and per-user limit. Codes can be activated or deactivated from the same page. When a specific phone is supplied, the backend resolves it to a registered user ID and rejects every other authenticated account.

## Checkout UI flow

1. User logs in and selects a published Current Affairs course.
2. User enters an offer code on your checkout page.
3. Frontend calls `POST /api/v1/payments/offers/validate` with the access token.
4. Frontend displays the returned `priceBreakdown`.
5. Frontend calls `POST /api/v1/payments/orders` with the same course ID and offer code.
6. Frontend opens Cashfree checkout using the returned `paymentSessionId`.
7. Content unlocks only after the backend verifies Cashfree payment status.

### Frontend example

```html
<input id="offerCode" placeholder="Offer code">
<button id="applyOffer">Apply</button>
<button id="payNow">Pay now</button>
<div id="price"></div>

<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
<script>
  const accessToken = getAccessTokenFromYourAuthState();
  const currentAffairsId = 12;
  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };

  document.querySelector("#applyOffer").onclick = async () => {
    const offerCode = document.querySelector("#offerCode").value;
    const response = await fetch("/api/v1/payments/offers/validate", {
      method: "POST",
      headers,
      body: JSON.stringify({ currentAffairsId, offerCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    document.querySelector("#price").textContent = `Pay ₹${result.priceBreakdown.total}`;
  };

  document.querySelector("#payNow").onclick = async () => {
    const offerCode = document.querySelector("#offerCode").value;
    const response = await fetch("/api/v1/payments/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({ currentAffairsId, offerCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    const cashfree = Cashfree({ mode: result.cashfree.environment.toLowerCase() });
    await cashfree.checkout({
      paymentSessionId: result.cashfree.paymentSessionId,
      redirectTarget: "_self"
    });
  };
</script>
```

## Security and policy behavior

- The browser never supplies an amount or discount value.
- Validation requires a logged-in active user.
- A policy can be assigned to one registered user; unassigned policies apply to all eligible users.
- Order creation rechecks the code inside a database transaction.
- The offer row is locked while global/per-user limits are checked and a use is reserved.
- Failed, expired, or dropped orders release the reservation; paid orders redeem it.
- Cashfree amount and currency must match the local verified order before access is granted.
- By default a code replaces the course automatic offer. Enable stacking explicitly in the admin policy when both discounts should apply.

## Error response

```json
{
  "success": false,
  "code": "OFFER_USER_LIMIT_REACHED",
  "message": "You have already used this offer code"
}
```
