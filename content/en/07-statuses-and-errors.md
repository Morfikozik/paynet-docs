# Statuses and errors

## HTTP status codes

| HTTP | `code` | Meaning | What to do |
|---|---|---|---|
| `200` | — | Success. | — |
| `400` | `INVALID_PARAMETER` | One or more parameters are missing or invalid. `details` names the parameter. | Fix the request. Do not retry unchanged. |
| `401` | `UNAUTHORIZED` | Bearer token is missing, invalid or expired. | Call `/auth` again and retry once. |
| `404` | `NOT_FOUND_RECORD` | No payment/record for the given ID. | Check the ID (`paymentId` vs your `Order`). |
| `500` | `TECHNICAL_ERROR` | Error on Paynet side. | Retry later with backoff. For `POST /api/order`, first check with `GET /api/order/merchant/{Order}` whether the order was created. |
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

> **Note:** some `401` responses use capitalised keys (`Status`, `Message`, `Code`, `TraceId`). Read error fields case-insensitively. `/auth` may return the error object inside an array.

## Payment status

The payment object (`POST /api/order`, `GET /api/order/{id}`, `GET /api/order/merchant/{id}`, `GET /api/order/search`) has a numeric `status` and the dates `registered`, `paidDate`, `expiryDate`.

A newly created order has `status` = `1` and `paidDate` = `null`.

> **Draft:** the meaning of all `status` values in API v1 is not yet confirmed by Paynet. The v0.5 specification defines: `1` Registered, `2` Customer verified, `3` Initialized to be paid, `4` Paid. Until confirmed, treat a payment as paid when you received a verified `PAID` notification, or when `paidDate` is set.

## Dates and formats

| Where | Format | Example |
|---|---|---|
| `ExpiryDate` in requests | `YYYY-MM-DDTHH:mm:ss` | `2026-12-31T23:59:59` |
| Dates in payment responses | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
| `from` / `to` in `/api/order/search` | ISO 8601 date-time | `2026-03-09T06:40:05.010Z` |
| `dateStart` / `dateFinish` in statements | date | `2026-03-01` |
| Amounts | integer, minor units | `1201` = 12.01 MDL |
| Currency | ISO 4217 numeric | `498` = MDL |

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
