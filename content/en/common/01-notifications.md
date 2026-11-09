# Notifications (webhooks)

When a payment is paid, Paynet sends an HTTP `POST` with a JSON body to the callback URL you registered with Paynet. The same notification is used by all integration types.

**Only successful payments are notified.** `EventType` is always `PAID`. If a payment fails, Paynet does not send a notification; the customer is only redirected to your `LinkUrlCancel`. Treat an order as unpaid until you receive a verified `PAID` notification (or the status API shows it paid), and as abandoned after its `ExpiryDate`.

## Request

```http
POST https://shop.example/paynet/notification
Content-Type: application/json; charset=utf-8
Hash: lq3+OCn0J/zSyNF5iAoShg==
```

```json
{
  "Eventid": 1000001,
  "EventType": "PAID",
  "Message": "Request processed successfully",
  "EventDate": "2026-11-09T12:00:00",
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "SaleAreaCode": "onlidocumentation_md",
    "Customer": "37369XXX111",
    "StatusDate": "2026-11-09T12:00:00",
    "Amount": 1235,
    "PaidAmount": 1235,
    "Merchant": "265505",
    "CardMask": "411111******1111",
    "CardExpireMonth": "12",
    "CardExpireYear": "27",
    "CardIssuer": "TEST BANK",
    "CardLinkHash": null,
    "MoneyType": "CARD",
    "PayerName": "Ion",
    "PayerSurname": "Popescu",
    "PayerIDNP": null,
    "RRN": "000000000000"
  }
}
```

The request has only two headers: `Content-Type` and `Hash`. There is no `Authorization` header — authenticity is proven by `Hash`.

## Fields

> **Important:** JSON keys are case-sensitive in most languages. The keys are `Id` and `ExternalId` (not `ID` / `ExternalID`).

| Field | Type | Description |
|---|---|---|
| `Eventid` | long | Notification ID. |
| `EventType` | string | Always `PAID`. |
| `Message` | string | Text status, e.g. `Request processed successfully`. |
| `EventDate` | string | When the notification was created, `YYYY-MM-DDTHH:mm:ss`, Chișinău local time. |
| `Payment.Id` | long | Paynet payment ID (`paymentId`). Use it as the idempotency key. |
| `Payment.ExternalId` | long | Your order number (`Order`). |
| `Payment.SaleAreaCode` | string | Sale area code. |
| `Payment.Customer` | string | The customer code you sent in the order (`Customer.Code`), usually masked, e.g. `37369XXX111` or `name***@gmail.com`. |
| `Payment.StatusDate` | string | When the payment reached this status (Chișinău local time). |
| `Payment.Amount` | long | Order amount in minor units, as you sent it. |
| `Payment.PaidAmount` | long | Amount actually paid by the customer, in minor units. See below. |
| `Payment.Merchant` | string | Your merchant code. |
| `Payment.MoneyType` | string | How the customer paid: `CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`. |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer` | string | Card details. Filled for `CARD`, and also for `APPLEPAY` and `GOOGLEPAY` (the card behind the wallet); `null` for other payment methods. |
| `Payment.CardLinkHash` | string | Saved card token: sent when [card saving](#/guides/saved-cards) is enabled for your `SaleAreaCode` and the customer kept the checkbox; otherwise `null`. |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP` | string | Payer details; may be `null`. |
| `Payment.RRN` | string | Retrieval reference number. |
| `Hash` (HTTP header) | string | Signature of the notification. |

Ignore fields you do not know: new optional fields may be added.

The `MoneyType` values in notifications are not the same as in the order request (`Card`, `All`, …). Do not compare them directly.

### Amount and PaidAmount

`PaidAmount` must be equal to `Amount`.

They can differ **only** if your company has officially agreed a promotion or discount with Paynet (for example 10% off for Mastercard cards of a certain BIN). Paynet configures such a promotion on its side at your request; it cannot be enabled through the API.

> **Important:** if you have no such agreement and `PaidAmount` is not equal to `Amount`, do not fulfil the order automatically. Save the notification and contact Paynet.

Settlement: you receive `PaidAmount` minus the Paynet commission. Use this when you reconcile with the statement.

## Verify the signature

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalId + Payment.Id + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( UTF8( PreparedString + NotificationSecretKey ) ) )
```

- Take the values exactly as they appear in the JSON body. A missing or `null` value is an empty string.
- The order is fixed: the 9 fields above, sorted alphabetically by full name.
- Use the **notification** secret key (it is different from the checkout key).
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
    s(p.ExternalId) + s(p.Id) + s(p.Merchant) + s(p.StatusDate);
  return crypto.createHash('md5').update(prepared + SECRET, 'utf8').digest('base64');
}

const app = express();
app.post('/paynet/notification', express.json(), async (req, res) => {
  const received = req.get('Hash') || '';
  const expected = expectedHash(req.body);
  const ok = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(400).send('Invalid hash');

  const p = req.body.Payment;
  // Process each Payment.Id only once (idempotency).
  // If PaidAmount !== Amount and you have no agreed promotion: do not fulfil, contact Paynet.
  // await markOrderPaidOnce(p.Id, p.ExternalId, p.Amount, p.PaidAmount);
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
          . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalId'] ?? null)
          . $s($p['Id'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
$expected = base64_encode(md5($prepared . $secret, true));

if (!hash_equals($expected, $_SERVER['HTTP_HASH'] ?? '')) {
    http_response_code(400);
    exit('Invalid hash');
}
// Process once per Payment.Id; check PaidAmount === Amount (unless a promotion is agreed), then:
http_response_code(200);
echo json_encode(['ResultCode' => 'SUCCESS']);
```

> **Important:** build `PreparedString` from the values exactly as they appear in the JSON body. Do not reformat dates (keep `2026-11-09T12:00:00` as is) and do not convert numbers to another notation.

## Respond and retries

- Answer HTTP `200` **after** you have verified the hash and saved the result.
- Answer fast: store the notification, return `200`, and do heavy processing after the response.
- Any other response (or no response) is treated as a failure, and Paynet sends the notification again. Example from a real log: 7 attempts within about 9 minutes, in two series, after which sending stopped. The exact schedule is not guaranteed — do not rely on it.
- Because of retries the same notification can arrive more than once. Process each `Payment.Id` only once.
- If a notification did not arrive (for example, your server was down longer than all attempts), check the status with `GET /api/order/{paymentId}` or `GET /api/order/merchant/{Order}`. You can ask Paynet support to send it again.
- If your server is behind a firewall, ask Paynet support for the IP addresses notifications come from.
- `PAID` is final: antifraud acts before the payment is confirmed, so it will not cancel this payment later. Only your own [refund](#/guides/errors-and-statuses) changes a paid payment.

## Notification simulator on this portal

Open **General → Notifications → Notification simulator**:

1. Enter your callback URL. It must be reachable from the internet and, **for the simulator only**, accept requests from the browser (CORS).
2. Enter the notification secret key (test: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Enter your merchant order number (`Order`) of a **paid** test payment and press **Get** — the portal loads the payment.
4. Press **Send notification** — the portal sends a signed `PAID` notification built from that payment to your URL and shows the `PreparedString` and `Hash` it used.

This is a simulation sent from your browser, not a real Paynet notification. For unpaid orders the simulator sends nothing, just like Paynet.

> **Important:** CORS is needed only for the simulator, because it posts from your browser. Real notifications are sent by the Paynet server, and CORS does not apply to them: do not enable CORS on your production endpoint for Paynet. A successful simulation checks your signature verification and processing, not delivery from Paynet (network access, firewall, TLS certificate). Confirm delivery with a real test payment.
