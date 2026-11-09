# Errors and statuses

## HTTP status codes

| HTTP | `code` | Meaning | What to do |
|---|---|---|---|
| `200` | — | Success. | — |
| `400` | `INVALID_PARAMETER` | One or more parameters are missing or invalid. `details` names the parameter. | Fix the request. Do not retry unchanged. |
| `401` | `UNAUTHORIZED` | Bearer token is missing, invalid or expired. | Call `/auth` again and retry once. |
| `404` | `NOT_FOUND_RECORD` | No payment/record for the given ID. | Check the ID (`paymentId` vs your `Order`). |
| `500` | `TECHNICAL_ERROR` | Error on Paynet side, **or** a repeated `Order` that cannot be reused (see below). | Check with `GET /api/order/merchant/{Order}` whether the order exists; if it is a real technical error, retry later with backoff. |
| `500` | `AUTHENTICATION_FAILED` | `/auth` with wrong username or password. | Check credentials. |

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

> **Note:** `401` responses use capitalised keys (`Status`, `Message`, `Code`, `TraceId`). Read error fields case-insensitively. `/auth` may return the error object inside an array.

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

> **Draft:** the description of all `status` values will be published later. Until then, treat a payment as paid when you received a verified `PAID` notification, or when `paidDate` is set.

A failed payment does not produce a notification: the customer is redirected to `LinkUrlCancel`, and the order stays unpaid until it expires (`ExpiryDate`).

## Dates and formats

| Where | Format | Example |
|---|---|---|
| `ExpiryDate` in requests | `YYYY-MM-DDTHH:mm:ss`, **Chișinău local time** | `2026-12-31T23:59:59` |
| Dates in payment responses | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
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

- `RefundType`: `full` or `partial`.
- `Amount` in minor units; for `partial` it is the amount to return.
- Only payments that were paid can be refunded.
