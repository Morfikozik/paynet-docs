# Errors and statuses

## Cheat sheet: what to do on an error

Checked on the test environment on 10.11.2026. Details on each format are in the sections below.

| HTTP | What the response contains | When it happens | What to do | Retry the request? |
|---|---|---|---|---|
| `400` | `INVALID_PARAMETER`, `details` names the field | Invalid parameter value | Fix the field named in `details` | Only after fixing |
| `400` | `errorInfo`, `errors` lists the fields | Unreadable JSON, missing required fields, wrong type (for example, letters instead of a number in `paymentId` in the URL) | Fix the request | Only after fixing |
| `401` | `UNAUTHORIZED` (capitalised keys: `Status`, `Code`…) | No token, or it is invalid or expired | Get a new token from `/auth` | Yes, once with the new token |
| `401` | `AUTHENTICATION_FAILED` | `/auth`: wrong username or password | Check the credentials (test and production ones differ) | No |
| `404` | `NOT_FOUND_RECORD` | No payment with this ID; refund of an unpaid payment; search: no payments in the period (an empty result) | Check `paymentId` / `Order` and the payment status; for search, treat it as an empty result | No |
| `404` | Empty body | Wrong address (path) | Check the URL and API address | No |
| `405` | Empty body | Wrong HTTP method (for example, `GET` instead of `POST`) | Check the method | Only after fixing |
| `415` | Empty body | No `Content-Type: application/json` header, or the body is not JSON (including `/auth`) | Add the header, send JSON | Only after fixing |
| `500` | `TECHNICAL_ERROR` | `Order` repeated with different data or after payment; or a failure on Paynet's side | First check `GET /api/order/merchant/{Order}`. If it is a repeated `Order`, create an order with a new `Order` | Only after checking |
| — | No response (timeout, network) | Connection problem | Look the order up by `Order`; if it does not exist, repeat **the same** request unchanged | Yes, with the same body |

- No `403`, `429` or `503` responses were seen on the test environment. No rate limiting was observed: 100 parallel requests returned `200`. Paynet does not publish official limits, so do not send requests in a loop without a pause.
- In `errorInfo`, `ppResponseCodeDescription` may say "We are sorry, this service is temporarily unavailable" even for an ordinary validation error. Rely on `errors`, not on this text, and do not show it to the customer.
- If you get `401` for the token: get a new token and repeat the request **once**. If it is `401` again, check the credentials.

## HTTP status codes

| HTTP | `code` | Meaning | What to do |
|---|---|---|---|
| `200` | — | Success. | — |
| `400` | `INVALID_PARAMETER` | One or more parameters are missing or invalid. `details` names the parameter. | Fix the request. Do not retry unchanged. |
| `401` | `UNAUTHORIZED` | Bearer token is missing, invalid or expired. | Call `/auth` again and retry once. |
| `404` | `NOT_FOUND_RECORD` | No payment/record for the given ID. | Check the ID (`paymentId` vs your `Order`). |
| `500` | `TECHNICAL_ERROR` | Error on Paynet side, **or** a repeated `Order` that cannot be reused (see below). | Check with `GET /api/order/merchant/{Order}` whether the order exists; if it is a real technical error, retry later with backoff. |
| `401` | `AUTHENTICATION_FAILED` | `/auth` with wrong username or password. | Check credentials. |

## Error body

```json
{
  "status": 400,
  "message": "One or more entered parameters are incorrect.",
  "code": "INVALID_PARAMETER",
  "traceId": "9b9346f9-f83a-465d-ac8d-dc382c460c22",
  "details": "The invalid parameter is: XXXX"
}
```

| Field | Description |
|---|---|
| `status` | HTTP status. |
| `message` | Human-readable message. |
| `code` | Machine-readable error code (table above). |
| `traceId` | Request ID. Send it to Paynet support when you report a problem. |
| `details` | Extra information, e.g. the invalid parameter. |

> **Note:** a `401` for a missing, invalid or expired token uses capitalised keys (`Status`, `Message`, `Code`, `TraceId`), while the `401` from `/auth` for a wrong password uses the usual ones (`status`, `message`…). Read error fields case-insensitively.

### Invalid JSON or missing required fields

If the request body cannot be read (invalid JSON, wrong types, a required field missing), the API answers `400` in a different format, with the error inside `errorInfo`:

```json
{
  "errorInfo": {
    "title": "One or more validation errors occurred.",
    "status": 400,
    "ppResponseCodeEnum": "TECHNICAL_ERROR",
    "ppResponseCode": 1,
    "ppResponseCodeText": "TECHNICAL_ERROR",
    "errors": {
      "$": ["JSON deserialization for type '…DeleteLinkedCardRequest' was missing required properties including: 'cardLinkHash', 'saleAreaCode', 'customerCode'."]
    },
    "traceId": "00-7c209d88f31e3e5cd2f7bd88ae2f23c2-ad167338e418068c-00"
  }
}
```

`errors` lists the problem fields. Handle both error formats: check for `errorInfo` first, then read `status` / `code` / `message`.

Request field names are not case-sensitive: `CardLinkHash` and `cardLinkHash` are both accepted (checked on the test API). Use the spelling from the examples.

## Repeated order number (Order)

| Situation | Result |
|---|---|
| New `Order` | A new payment is created. |
| Same `Order`, **same data**, payment not paid yet | The same `paymentId` and `paymentLink` are returned. Safe to repeat, e.g. after a timeout. |
| Same `Order`, **different data** (amount, products, …) | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. |
| Same `Order`, payment already paid or being processed by the card issuer | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. Hosted checkout: the customer sees the Paynet page "Plata a fost respinsă" (this invoice is already paid or being processed). |

Error body in these cases:

```json
{
  "status": 500,
  "message": "One or more errors occurred.",
  "code": "TECHNICAL_ERROR",
  "traceId": "11de6054-87ef-484d-a368-7cfae0b452ff",
  "details": "Please verify the transmitted data and try again, or contact support."
}
```

**Rule:** one order in your shop = one `Order`. If the customer changes the cart, create a new order with a new `Order`.

## Payment status

The payment object (`POST /api/order`, `GET /api/order/{id}`, `GET /api/order/merchant/{id}`, `GET /api/order/search`) has a numeric `status` and the dates `registered`, `paidDate`, `expiryDate`.

A newly created order has `status` = `1` and `paidDate` = `null`.

| `status` | Meaning | What to do |
|---|---|---|
| `1` | Registered: the order exists, no payment yet | Wait for payment. If the customer left the page, you can send them to the same `paymentLink` again. |
| `3` | Pending: the customer pressed "Pay", the bank has not answered yet | Do not create the order again and do not cancel it. Check the status later. |
| `4` | Paid | Fulfil the order. |
| `5` | Cancelled: declined by the bank, cancelled by antifraud, or fully refunded | Final. A new payment attempt needs an order with a new `Order`. |
| `6` | Partially refunded | Final. |

```
1 ──► 3 ──► 4 ──► 5  (full refund / полный возврат / rambursare totală)
      │      └──► 6  (partial refund / частичный возврат / rambursare parțială)
      └──► 5  (declined, antifraud / отказ, антифрод / refuz, antifraudă)
```

- `5` and `6` are final: nothing changes after them. The value `2` is not used.
- There is no separate "expired" status: if `ExpiryDate` has passed without payment, the order stays `1`, but it can no longer be paid.
- Antifraud acts before the payment is confirmed. Once you have received a verified `PAID` notification, antifraud will not cancel that payment; status `5` on a paid order means a full refund only.
- Treat a payment as paid when you received a verified `PAID` notification or `status` = `4`.
- If the customer fails 3-D Secure, the payment gets status `5` and the customer returns to `LinkUrlCancel` — the same as a bank decline.
- The reason for a decline (bank decline, antifraud, 3-D Secure) is not available through the API: status `5` only means this order is closed and a new attempt needs a new `Order`.

### Failed payment and another attempt

A failed payment does not produce a notification: the customer returns to `LinkUrlCancel`. Check the status with `GET /api/order/merchant/{Order}`:

| `status` | What happened | How to let the customer pay again |
|---|---|---|
| `1` | The customer did not pay (for example, closed the page) | Send them to the same `paymentLink`. |
| `3` | The payment is still being processed | Wait and check the status again. Do not create a new order. |
| `5` | The bank declined the payment | The order is closed. Create a new order with a **new** `Order` and send the customer to the new `paymentLink`. |

## Dates and formats

| Where | Format | Example |
|---|---|---|
| `ExpiryDate` in requests | `YYYY-MM-DDTHH:mm:ss`, **Chișinău local time** | `2026-12-31T23:59:59` |
| Dates in payment responses | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
| `eventDate` in the refund response | `DD.MM.YYYY HH:mm:ss` | `09.11.2026 18:17:54` |
| Dates in notifications | `YYYY-MM-DDTHH:mm:ss`, Chișinău local time | `2026-11-09T12:00:00` |
| `from` / `to` in `/api/order/search` | ISO 8601 date-time | `2026-03-09T06:40:05.010Z` |
| `dateStart` / `dateFinish` in statements | date | `2026-03-01` |
| Amounts | integer, minor units | `1201` = 12.01 MDL |
| Currency | ISO 4217 numeric | `498` = MDL |

Chișinău local time is the `Europe/Chisinau` time zone: UTC+2 in winter, UTC+3 in summer. If your server runs in UTC, convert before you build `ExpiryDate`, otherwise orders expire 2–3 hours earlier than intended.

## Refunds

`POST /api/order/refund`:

```json
{
  "PaymentId": 296901,
  "SaleAreaCode": "onlidocumentation_md",
  "RefundType": "full",
  "Amount": 50000,
  "Currency": 498,
  "Reason": "Customer request"
}
```

| Rule | Value |
|---|---|
| What can be refunded | Only a paid payment (`status` = `4`). |
| How many times | **One** refund per payment: full (`full`) or partial (`partial`). A second refund of the same payment is not possible. |
| Amount | `Amount` in minor units; at most the payment's `PaidAmount` (lower than the order amount when a promotion applied). |
| Deadline | 180 days after payment. |
| Payment methods | All except `CASH_INVOICE`. |
| Result | Immediately in the `POST /api/order/refund` response. No callback notification is sent for refunds. |
| Status afterwards | `5` after a full refund, `6` after a partial one. Both are final. |
| Merchant balance | If there is no money on the merchant's Paynet account, the refund does not go through. |

### Refund responses (checked on the test environment)

| Situation | Response |
|---|---|
| Refund done | `200`, body below |
| Payment not paid | `404 NOT_FOUND_RECORD` |
| Amount above the paid amount | `400 INVALID_PARAMETER`, `details`: "The invalid parameter is: RefundType". The field named in `details` is misleading: the cause is the amount |
| Another refund of the same payment (for example, full after partial) | `400 INVALID_PARAMETER`, `details`: "The invalid parameter is: RefundType" |

```json
{
  "paymentId": 328733,
  "saleAreaCode": "onlidocumentation_md",
  "customer": "464566161",
  "eventDate": "09.11.2026 18:17:54",
  "refundType": "full",
  "currency": 498,
  "amount": 400,
  "merchant": "265505",
  "cardMask": "411111******1111",
  "cardLinkHash": null,
  "moneyType": "CYBER_SOURCE"
}
```

- `eventDate` in the refund response uses the format `DD.MM.YYYY HH:mm:ss`.
- `moneyType` here is the processing code (for example `CYBER_SOURCE`), not the notification value (`CARD`…).
- After a refund the payment's `paidDate` stays filled.

## Contacting support

- **If a Paynet manager is onboarding you:** usually a shared Telegram chat is created with a Paynet developer and your developer. There you get credentials and links and can ask integration questions. Ask your manager to create such a chat.
- **If you have not talked to a manager yet:** write to [support@paynet.md](mailto:support@paynet.md).

To get a fast answer, send right away:

| What | Example |
|---|---|
| `traceId` from the error response | `9b9346f9-f83a-465d-ac8d-dc382c460c22` |
| Method and address | `POST https://ecom-api-test.paynet.md/api/order` |
| Date and time of the request (Chisinau time) | `10.11.2026 12:05` |
| `Order` and / or `paymentId` | `1762444800000`, `328731` |
| Sale area and merchant | `onlidocumentation_md`, `265505` |
| HTTP code and the full response body | `400`, `{ "errorInfo": … }` |
| Test or production | test |

Never send your password, secret keys or token.
