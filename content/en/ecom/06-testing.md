# Testing

## Test environment

| Item | Value |
|---|---|
| API base URL | `https://ecom-api-test.paynet.md` |
| Hosted checkout form URL | `https://test.paynet.md/ecom/checkout` |
| API username / password | `771064` / `sLgMnGWJ` |
| Merchant code | `265505` |
| Sale area code | `onlidocumentation_md` |
| Secret key for the hosted checkout signature | `F90D6485-9CCC-458B-96A3-8958AF9B4458` |
| Secret key for notifications | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` |

These credentials are shared by everyone testing on this portal: other people's test payments are visible in searches and statements. Ask Paynet for your own test merchant if you need an isolated environment.

## Test card

| Card | Expiry | CVV | Result |
|---|---|---|---|
| Visa `4111 1111 1111 1111` | `12/27` | `777` | successful payment |

Test cards can only reproduce a successful payment: there are no cards for declined or 3-D Secure payments. You still need to implement decline handling and test it with mocked API responses: `status` = `5` and the customer returning to `LinkUrlCancel` (see [Failed payment](#/guides/errors-and-statuses)). When a real payment fails, the customer is simply redirected to `LinkUrlCancel` and no notification is sent.

## Rules that make tests fail

- **Reused `Order`.** The same `Order` with different data, or an `Order` that is already paid, fails with `500 TECHNICAL_ERROR`. The portal generates a new `Order` for you (current time in milliseconds).
- **`ExpiryDate` in the past.** Use a future date in Chișinău local time. The portal sets it to the end of tomorrow.
- **Amounts in MDL instead of minor units.** `100` means 1.00 MDL.
- **Expired token.** Tokens live about 4 hours; call `/auth` again after `401`.
- **Products don't add up.** If you send `Products`, send all product fields and keep `Amount` values consistent with the service `Amount`.

## Test scenarios

| # | Scenario | How | Expected |
|---|---|---|---|
| 1 | Authenticate | `POST /auth` with test credentials | `200`, `access_token` |
| 2 | Wrong password | `POST /auth` with a wrong password | `401`, `AUTHENTICATION_FAILED` |
| 3 | Create order | `POST /api/order` | `200`, `paymentId`, `paymentLink`, `status` `1` |
| 4 | Repeat the same request | send scenario 3 again unchanged | same `paymentId` and `paymentLink` |
| 5 | Same `Order`, other amount | change `Amount`, keep `Order` | `500`, `TECHNICAL_ERROR` |
| 6 | Invalid request | `POST /api/order` without `Services` | `400` with an `errorInfo` object (the missing field in `errors`) |
| 7 | No token | `POST /api/order` without `Authorization` | `401`, `UNAUTHORIZED` |
| 8 | Pay | open `paymentLink`, pay with the test card | redirect to `LinkUrlSuccess` |
| 9 | Status | `GET /api/order/merchant/{Order}` | payment with `paidDate` set |
| 10 | Unknown order | `GET /api/order/{id}` with a random ID | `404`, `NOT_FOUND_RECORD` |
| 11 | Notification | **Notification simulator** → your URL | your handler verifies `Hash`, returns `200` |
| 12 | Wrong hash | send a notification with a changed `Amount` | your handler rejects it |
| 13 | Duplicate notification | send the same notification twice | your handler processes it once |
| 14 | Hosted checkout | **Checkout form (try it)** | Paynet test payment page opens |
| 15 | Refund | `POST /api/order/refund` for a paid payment | `200`; `status` becomes `5` (full) or `6` (partial) |
| 16 | Refund above the paid amount | `RefundType` `partial`, `Amount` above `PaidAmount` | `400 INVALID_PARAMETER` |
| 17 | Save a card (if enabled for your `SaleAreaCode`) | `POST /api/order` with `Customer`, pay keeping the "save card" checkbox | the `PAID` notification contains `CardLinkHash` |
| 18 | Pay with a saved card (if enabled) | `POST /api/order` with `CardLinkHash` and the same `Customer` | the Paynet page shows the saved card |
| 19 | Customer left without paying | open `paymentLink`, close the page, open the link again | `status` stays `1`, payment is still possible |

## Mock responses for failure tests

A bank decline, refund errors and damaged notifications cannot be reproduced with the test card. For automated tests of your integration use these ready responses — they are taken from real test-environment responses, and the notifications are signed with the test key. Full list: [mocks/index.json](mocks/index.json).

| File | What it mocks | What your code must do |
|---|---|---|
| [payment-status-3.json](mocks/payment-status-3.json) | Payment still processing | Wait, do not create a new order |
| [payment-status-5-declined.json](mocks/payment-status-5-declined.json) | Declined by the bank | Offer a new attempt with a new `Order` |
| [payment-status-5-refunded.json](mocks/payment-status-5-refunded.json), [payment-status-6.json](mocks/payment-status-6.json) | Full and partial refund | Do not fulfil the order again |
| [refund-400-amount-or-second.json](mocks/refund-400-amount-or-second.json), [refund-404-unpaid.json](mocks/refund-404-unpaid.json) | Refund errors | Show a clear error, do not retry automatically |
| [order-500-repeated-order.json](mocks/order-500-repeated-order.json), [order-400-errorinfo.json](mocks/order-400-errorinfo.json) | Repeated `Order`, unreadable request | Handle both error formats |
| [error-401-token.json](mocks/error-401-token.json) | Expired token | Get a new token and retry once |
| [notification-paid.json](mocks/notification-paid.json) | Valid `PAID` notification | Answer `200`, fulfil once |
| [notification-paid-wrong-hash.json](mocks/notification-paid-wrong-hash.json) | Wrong `Hash` | Answer `400`, change nothing |
| [notification-paid-tampered-paidamount.json](mocks/notification-paid-tampered-paidamount.json) | Valid `Hash`, but the unsigned `PaidAmount` changed | The API confirmation must send the order to review |

`payment-status-5-declined.json` is constructed: the `status` value is real, the other fields are those of an unpaid payment.

## Testing from this portal

The "Test API Request" buttons call the test API directly from your browser. This works on the official portal domain. If you open a copy of the portal from another address, the browser may block the calls (CORS); use cURL or Postman instead. A Postman collection can be downloaded from the sidebar.
