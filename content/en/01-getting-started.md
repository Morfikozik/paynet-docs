# Getting started

Paynet e-commerce API lets your online store accept payments by card, Paynet wallet and other methods. Your customer pays on a Paynet-hosted payment page; you never handle card data.

This page takes you from zero to a successful test payment in about 10 minutes, using the shared test account and the "Try it" panels on this portal.

## What you need

| Item | Test environment | Production |
|---|---|---|
| API base URL | `https://ecom-api-test.paynet.md` | provided by Paynet when you go live |
| API user (`username` / `password`) | `771064` / `sLgMnGWJ` | issued to your company by Paynet |
| Merchant code (`Merchant`) | `265505` | issued by Paynet |
| Sale area code (`SaleAreaCode`) | `onlidocumentation_md` | issued by Paynet (one per website/shop) |
| Hosted checkout secret key | `F90D6485-9CCC-458B-96A3-8958AF9B4458` | issued by Paynet, keep it secret |
| Notification secret key | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` | issued by Paynet, keep it secret |
| Test card | Visa `4111 1111 1111 1111`, expiry `12/27`, CVV `777` | real cards |

> **Note:** the test credentials above are public on purpose and shared by everyone who tests on this portal. Never use them in production and never put production secrets in front-end code.

## Your first test payment (server-to-server)

### Step 1. Get an access token

Open **Server-Server model → Authentication and authorization** and press **Test API Request**. Leave the username and password as they are.

```http
POST https://ecom-api-test.paynet.md/auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

Expected result: HTTP `200` with an `access_token` (valid for about 4 hours, see `expires_in`). The portal remembers the token and adds it to the next requests as `Authorization: Bearer <token>`.

### Step 2. Create an order

Open **Server-Server model → Create an order** and press **Test API Request**.

The portal pre-fills a unique `Order` number and an `ExpiryDate` for tomorrow, so the sample works as is. If you edit the request yourself, remember:

- `Order` must be a new number for every payment;
- `ExpiryDate` must be in the future, format `YYYY-MM-DDTHH:mm:ss`;
- amounts are integers in minor units: `300` = 3.00 MDL.

Expected result: HTTP `200` with `paymentId`, `status` `1` and a `paymentLink` like `https://test.paynet.md/ecom/getecom/317184?s=…`.

### Step 3. Pay on the payment page

Open the `paymentLink` in your browser and pay with the test card `4111 1111 1111 1111`, `12/27`, CVV `777`.

### Step 4. Check the payment status

Open **Server-Server model → Get a payment info by merchant order id**, enter your `Order` number and run the request. You will see the payment details and its status.

### Step 5. Try the notification (webhook)

Open **Notifications (webhooks)** in the sidebar. Enter your callback URL, the notification secret key and your `Order` number, then press **Get** and **Send notification**. The portal sends a simulated, signed notification to your URL so you can test your handler. See [Notifications](#/guides/notifications) for details.

## Next steps

- Choose how to integrate: [Integration options](#/guides/integration-options).
- Read the full flow: [Server-to-server integration](#/guides/server-to-server) or [Hosted checkout](#/guides/hosted-checkout).
- Using an AI assistant to write the integration? Start with [Integrate with AI](#/guides/ai-assistants).
