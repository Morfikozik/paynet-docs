# Paynet e-commerce: example shop (Node.js)

A complete, minimal server-to-server integration with no dependencies (Node.js 18+). It is run against the Paynet **test** environment by the documentation's end-to-end check, so it is known to work.

| File | What it does |
|---|---|
| `server.mjs` | Shop: product page, create order, redirect to Paynet, return pages with status check, notification endpoint, refunds |
| `paynet-client.mjs` | API client: token caching, create order with a safe retry, payment lookup, refund |
| `paynet-notifications.mjs` | Notification handler: signature check, idempotency, answer `200`, confirmation with the API (same code as in the documentation) |
| `store.mjs` | JSON-file storage — replace with your database |
| `tools/send-test-notification.mjs` | Sends a signed `PAID` notification for a paid test payment to your endpoint |

## Run

```bash
node server.mjs
# open http://localhost:3000, click Buy, pay with 4111 1111 1111 1111, 12/27, CVV 777
```

Paynet sends real notifications to the callback URL registered for your merchant, which cannot reach `localhost`. While developing, send the notification yourself:

```bash
node tools/send-test-notification.mjs <Order>
```

Then open http://localhost:3000/orders: the order is `paid`, and you can try a refund.

## Configuration

| Variable | Default (test environment) |
|---|---|
| `PORT` | `3000` |
| `PUBLIC_URL` | `http://localhost:3000` (used for `LinkUrlSuccess` / `LinkUrlCancel`) |
| `PAYNET_API_URL` | `https://ecom-api-test.paynet.md` (production: `https://ecom-api.paynet.md`) |
| `PAYNET_USERNAME`, `PAYNET_PASSWORD` | test credentials |
| `PAYNET_SALE_AREA` | `onlidocumentation_md` |
| `PAYNET_NOTIFICATION_SECRET` | test notification key |
| `STORE_FILE` | `./shop-data.json` |

For production, set all values from your Paynet access (production keys differ from test ones) and keep them out of the code.

## What the example demonstrates

- One shop order = one unique `Order`; the exact request body is stored, so a retry resends it unchanged.
- `ExpiryDate` in Chișinău time.
- The return to `LinkUrlSuccess` is not treated as payment: the page checks `status` with the API.
- After a decline (`status` 5) a new order with a new `Order` is created; while `status` is 1 the same payment link is reused; while 3 the shop waits.
- Notifications: signature check (9 fields, fixed order), stored once per `Payment.Id`, answer `200` first, then `PaidAmount` / customer / `CardLinkHash` confirmed with the API; mismatches go to manual review.
- Refunds: only for `status` 4, at most `PaidAmount`, one refund per payment.
- Saved cards: `CardLinkHash` from a confirmed notification is stored per customer and can be used for the next order (if card saving is enabled for your sale area).
