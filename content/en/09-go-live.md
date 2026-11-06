# Go-live checklist

## Before you switch to production

**Credentials and configuration**

- [ ] You received production API user, merchant code, sale area code and secret keys from Paynet.
- [ ] You received the production API base URL from Paynet.
- [ ] Secrets are stored in server configuration (environment variables, vault), not in code or front-end.
- [ ] Your callback URL (HTTPS) is registered with Paynet.
- [ ] `LinkUrlSuccess` and `LinkUrlCancel` point to production pages.

**Payments**

- [ ] Every order gets a unique `Order` number, also after restarts and in parallel requests.
- [ ] `ExpiryDate` is computed (for example now + 1 day), not hard-coded.
- [ ] Amounts are sent in minor units and match the cart total.
- [ ] Hosted checkout: the signature is computed on the server and passes the [test vectors](#/guides/signatures).

**Notifications**

- [ ] The handler verifies the `Hash` header with the notification secret key.
- [ ] The handler is idempotent (one `Payment.ID` = one fulfilment).
- [ ] The handler answers `200` only after the order is saved.
- [ ] A fallback job checks unpaid orders with `GET /api/order/{paymentId}` if no notification arrived.

**Operations**

- [ ] The token is cached and refreshed on `401`.
- [ ] Errors are logged with `traceId`.
- [ ] You do not mark orders as paid just because the customer returned to `LinkUrlSuccess`.
- [ ] Refund and statement flows are tested if you use them.

## After launch

- Make one real low-value payment and refund it.
- Compare the first day's payments with the statement (`GET /api/statement`).
