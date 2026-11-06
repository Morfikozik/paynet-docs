# Notifications (webhooks)

Paynet notifies your system when a payment is paid. The notification is an HTTP `POST` with a JSON body, sent to the callback URL you gave Paynet. It works the same for server-to-server and hosted checkout integrations.

## Request

```http
POST https://shop.example/paynet/notification
Content-Type: application/json
Hash: U2LhpObu5hnAshxejSovkQ==
```

```json
{
  "Eventid": 20160622010101,
  "EventType": "PAID",
  "EventDate": "2016-01-01T00:00:00",
  "Payment": {
    "ID": 1234567,
    "ExternalID": 7676766,
    "Merchant": "123123",
    "Customer": "37369XXX111",
    "StatusDate": "2016-01-01T00:00:00",
    "Amount": 123
  }
}
```

## Fields

| Field | Type | Description |
|---|---|---|
| `Eventid` | long | Notification ID. |
| `EventType` | string | Event type, `PAID` for a paid payment. Compare case-insensitively (older documents write `Paid`). |
| `EventDate` | datetime | When the notification was created (ISO 8601). |
| `Payment.ID` | long | Paynet payment ID (`paymentId`). Use it as the idempotency key. |
| `Payment.ExternalID` | long | Your order number (`Order`). |
| `Payment.Merchant` | string | Your merchant code. |
| `Payment.Customer` | string | Customer reference (may be masked). |
| `Payment.StatusDate` | datetime | When the payment reached this status. |
| `Payment.Amount` | long | Amount in minor units. |
| `Payment.SaleAreaCode` | string | Sale area code (optional). |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer`, `CardLinkHash` | string | Card details, for card payments (optional). |
| `Payment.MoneyType` | string | Payment method (optional). |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP`, `RRN` | string | Payer details and retrieval reference number (optional). |
| `Hash` (HTTP header) | string | Signature of the notification. |

Ignore fields you do not know: new optional fields may be added.

## Verify the signature

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalID + Payment.ID + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( PreparedString + NotificationSecretKey ) )
```

- Use the values exactly as received (as strings). A missing or `null` value is an empty string.
- The order is fixed: fields sorted alphabetically by full name.
- Compare `ExpectedHash` with the `Hash` header. If they differ, reject the request (for example HTTP `400`) and do not change the order.

Worked example with expected output: [Signatures](#/guides/signatures).

### Node.js (Express)

```javascript
import crypto from 'node:crypto';
import express from 'express';

const SECRET = process.env.PAYNET_NOTIFICATION_SECRET;
const s = (v) => (v === null || v === undefined ? '' : String(v));

function expectedHash(n) {
  const p = n.Payment || {};
  const prepared = s(n.EventDate) + s(n.Eventid) + s(n.EventType) + s(p.Amount) + s(p.Customer) +
    s(p.ExternalID) + s(p.ID) + s(p.Merchant) + s(p.StatusDate);
  return crypto.createHash('md5').update(prepared + SECRET, 'utf8').digest('base64');
}

const app = express();
app.post('/paynet/notification', express.json(), async (req, res) => {
  const received = req.get('Hash') || '';
  const expected = expectedHash(req.body);
  const ok = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(400).send('Invalid hash');

  // Idempotency: process each Payment.ID only once.
  // await markOrderPaidOnce(req.body.Payment.ID, req.body.Payment.ExternalID, req.body.Payment.Amount);
  res.status(200).json({ ResultCode: 'SUCCESS' });
});
```

### PHP

```php
<?php
$secret = getenv('PAYNET_NOTIFICATION_SECRET');
$body   = file_get_contents('php://input');
$n      = json_decode($body, true);
$p      = $n['Payment'] ?? [];
$s      = fn($v) => $v === null ? '' : (string) $v;

$prepared = $s($n['EventDate'] ?? null) . $s($n['Eventid'] ?? null) . $s($n['EventType'] ?? null)
          . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalID'] ?? null)
          . $s($p['ID'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
$expected = base64_encode(md5($prepared . $secret, true));

if (!hash_equals($expected, $_SERVER['HTTP_HASH'] ?? '')) {
    http_response_code(400);
    exit('Invalid hash');
}
// Process once per Payment.ID, then:
http_response_code(200);
echo json_encode(['ResultCode' => 'SUCCESS']);
```

> **Important:** build `PreparedString` from the values exactly as they appear in the JSON body. Do not reformat dates (keep `2016-01-01T00:00:00` as is) and do not convert numbers to another notation.

## Respond and retries

- Answer HTTP `200` **after** you have verified the hash and saved the result.
- Any other status (or a timeout) is treated as a failure: Paynet retries the notification **up to 3 times** and then stops.
- Because of retries the same notification can arrive more than once. Process each `Payment.ID` only once.
- If you did not receive a notification, use `GET /api/order/{paymentId}` or `GET /api/order/merchant/{Order}`.

## Test notifications on this portal

Open **Notifications (webhooks)** in the sidebar (under **Ecommerce**):

1. Enter your callback URL (it must be reachable from the internet and accept requests from the browser — CORS).
2. Enter the notification secret key (test: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Enter your merchant order number (`Order`) and press **Get** — the portal loads the payment.
4. Press **Send notification** — the portal sends a signed notification built from that payment to your URL and shows the `PreparedString` and `Hash` it used.

This is a simulation sent from your browser, not a real Paynet notification.
