# Example shop (Node.js)

A ready, minimal server-to-server integration: one Node.js 18+ server with no dependencies. Source code: [examples/node-shop](https://github.com/Morfikozik/paynet-docs/tree/main/examples/node-shop).

> **Important:** this example is checked by an end-to-end test on the Paynet test environment: a robot buys a product in the example, pays with the test card, sends the notification and makes a refund. So the example code is known to work.

## Run

```bash
git clone https://github.com/Morfikozik/paynet-docs.git
cd paynet-docs/examples/node-shop
node server.mjs
```

Open `http://localhost:3000`, click **Buy** and pay with the test card `4111 1111 1111 1111`, `12/27`, CVV `777`. By default the example uses the test environment and test credentials.

Paynet sends real notifications to your merchant's callback URL, and they cannot reach `localhost`. While developing, send the notification yourself — the script builds and signs it from a paid test payment the same way Paynet does:

```bash
node tools/send-test-notification.mjs <Order>
```

After that, `http://localhost:3000/orders` shows the order as `paid`, and you can make a refund from there.

## What is inside

| File | What it does |
|---|---|
| `server.mjs` | Shop: product, create order, redirect to payment, return pages, notification endpoint, refunds |
| `paynet-client.mjs` | API client: token caching, create order with a safe retry, payment lookup, refund |
| `paynet-notifications.mjs` | Notification handler — the same code as in [Notifications](#/guides/notifications) |
| `store.mjs` | JSON-file storage — replace with your database |
| `tools/send-test-notification.mjs` | Sends a signed `PAID` notification to your endpoint |

## Rules the example demonstrates

| Step | How the example does it | Rule |
|---|---|---|
| Create order | Unique `Order`; the request body is stored before calling Paynet | Retry only with the same body ([Repeated order number](#/guides/errors-and-statuses)) |
| Payment deadline | `ExpiryDate` = now + 1 day in Chișinău time | `Europe/Chisinau` |
| Customer returns | The page checks `status` with the API instead of trusting the redirect | The redirect to `LinkUrlSuccess` is not proof of payment |
| `status` = `1` | "Continue to payment" with the same link | The customer did not pay |
| `status` = `3` | The page waits and refreshes | The bank is still answering; do not create a new order |
| `status` = `5` | "Try again" creates a new order with a new `Order` | The order is closed after a decline |
| Notification | Signature, once per `Payment.Id`, `200` first, then API confirmation | [What the signature protects](#/guides/notifications) |
| Refund | Only for `status` = `4`, at most `PaidAmount`, once | [Refunds](#/guides/errors-and-statuses) |
| Saved card | `CardLinkHash` from a confirmed notification is stored for the customer | [Saved cards](#/guides/saved-cards) |

## Going live

Set the environment variables to production values — they differ from the test ones — and keep them out of the code:

| Variable | Value |
|---|---|
| `PAYNET_API_URL` | `https://ecom-api.paynet.md` |
| `PAYNET_USERNAME`, `PAYNET_PASSWORD` | production API credentials |
| `PAYNET_SALE_AREA` | your sale area code |
| `PAYNET_NOTIFICATION_SECRET` | production notification key |
| `PUBLIC_URL` | your shop address (for `LinkUrlSuccess` / `LinkUrlCancel`) |

Replace `store.mjs` with your database and go through the [go-live checklist](#/guides/go-live).
