# Go-live checklist

## Before you switch to production

**Credentials and configuration**

- [ ] You received from Paynet: production API user, merchant code, sale area code and **two** secret keys (hosted checkout signature and notifications).
- [ ] Your code uses the production URLs: API `https://ecom-api.paynet.md`, hosted checkout form `https://paynet.md/ecom/checkout`.
- [ ] Secrets are stored in server configuration (environment variables, vault), not in code or front-end.
- [ ] Your callback URL (HTTPS) is registered with Paynet.
- [ ] `LinkUrlSuccess` and `LinkUrlCancel` point to production pages.

**Payments**

- [ ] Every shop order gets its own unique `Order` number, also after restarts and in parallel requests.
- [ ] `ExpiryDate` is computed in Chișinău local time (`Europe/Chisinau`), for example now + 1 day, not hard-coded.
- [ ] Amounts are sent in minor units and match the cart total.
- [ ] Hosted checkout: the signature is computed on the server and passes the [test vectors](#/guides/signatures).

**Notifications**

- [ ] The handler verifies the `Hash` header with the notification secret key.
- [ ] The handler reads `Payment.Id` and `Payment.ExternalId` (exact spelling).
- [ ] The handler is idempotent (one `Payment.Id` = one fulfilment).
- [ ] The handler checks that `PaidAmount` equals `Amount` (unless you have an agreed promotion with Paynet).
- [ ] The handler answers `200` only after the order is saved.
- [ ] A fallback job checks unpaid orders with `GET /api/order/{paymentId}` if no notification arrived. Failed payments are not notified.

**Operations**

- [ ] The token is cached and refreshed on `401`.
- [ ] Errors are logged with `traceId`.
- [ ] You do not mark orders as paid just because the customer returned to `LinkUrlSuccess`.
- [ ] Refund and statement flows are tested if you use them.

## After launch

- Make one real low-value payment and refund it.
- Reconcile the first day's payments with the statement (`GET /api/statement`): you receive `PaidAmount` minus the Paynet commission.
