# Quick start

This page takes you from zero to a successful test payment in about 10 minutes, using the shared test account and the "Test API Request" panels on this portal. The customer pays on a Paynet-hosted payment page, so you never handle card data.

## Environments

| Item | Test | Production |
|---|---|---|
| API base URL | `https://ecom-api-test.paynet.md` | `https://ecom-api.paynet.md` |
| Hosted checkout form URL | `https://test.paynet.md/ecom/checkout` | `https://paynet.md/ecom/checkout` |

Both environments use the same paths (`/auth`, `/api/...`).

## Credentials

| Item | Test (shared) | Production |
|---|---|---|
| API user (`username` / `password`) | `771064` / `sLgMnGWJ` | issued to your company by Paynet |
| Merchant code (`Merchant`) | `265505` | issued by Paynet |
| Sale area code (`SaleAreaCode`) | `onlidocumentation_md` | issued by Paynet (one per website/shop) |
| Secret key for the hosted checkout signature | `F90D6485-9CCC-458B-96A3-8958AF9B4458` | issued by Paynet, keep it secret |
| Secret key for notifications | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` | issued by Paynet, keep it secret |
| Test card | Visa `4111 1111 1111 1111`, expiry `12/27`, CVV `777` | real cards |

Paynet gives you **two different secret keys**: one signs the hosted checkout form, the other signs notifications. Do not mix them up.

> **Note:** the test credentials above are public on purpose and shared by everyone who tests on this portal. Never use them in production and never put production secrets in front-end code.

## Your first test payment (server-to-server)

### Step 1. Get an access token

In the sidebar open **E-commerce → API methods → Authentication and authorization** and press **Test API Request**. Leave the username and password as they are.

```http
POST https://ecom-api-test.paynet.md/auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

Expected result: HTTP `200` with an `access_token` (valid for about 4 hours, see `expires_in`). The portal remembers the token and adds it to the next requests as `Authorization: Bearer <token>`.

### Step 2. Create an order

Open **E-commerce → API methods → Create an order** and press **Test API Request**.

The portal pre-fills a unique `Order` number and an `ExpiryDate` for tomorrow, so the sample works as is. If you edit the request yourself, remember:

- one order = one new `Order` number;
- `ExpiryDate` must be in the future, format `YYYY-MM-DDTHH:mm:ss`, Chișinău local time;
- amounts are integers in minor units: `300` = 3.00 MDL.

Expected result: HTTP `200` with `paymentId`, `status` `1` and a `paymentLink` like `https://test.paynet.md/ecom/getecom/317184?s=…`.

### Step 3. Pay on the payment page

Open the `paymentLink` in your browser and pay with the test card `4111 1111 1111 1111`, `12/27`, CVV `777`. After payment you are redirected to `LinkUrlSuccess`.

### Step 4. Check the payment status

Open **E-commerce → API methods → Get a payment info by merchant order id**, enter your `Order` number and run the request. You will see the payment details; `paidDate` is set for a paid payment.

### Step 5. Try the notification (webhook)

Open **General → Notifications → Notification simulator**. Enter your callback URL, the notification secret key and your `Order` number, then press **Get** and **Send notification**. The portal sends a simulated, signed `PAID` notification to your URL so you can test your handler. See [Notifications](#/guides/notifications).

## Next steps

- Choose how to integrate: [Integration options](#/guides/integration-options).
- Read the full flow: [Server-to-server integration](#/guides/server-to-server) or [Hosted checkout](#/guides/hosted-checkout).
- Using an AI assistant to write the integration? Start with [Integrate with an AI assistant](#/guides/ai-assistants).
