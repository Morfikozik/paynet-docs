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
- The order is fixed — exactly as in the line above. **Do not sort the names in code:** a plain sort puts `EventType` before `Eventid`, and the hash will not match.
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

## What the signature protects, and confirming with the API

The `Hash` header protects only the fields that make up `PreparedString`:

| Signed (checked by `Hash`) | Not signed |
|---|---|
| `EventDate`, `Eventid`, `EventType`, `Payment.Amount`, `Payment.Customer`, `Payment.ExternalId`, `Payment.Id`, `Payment.Merchant`, `Payment.StatusDate` | `Payment.PaidAmount`, `Payment.MoneyType`, `Payment.CardLinkHash`, `Payment.SaleAreaCode`, card and payer data (`CardMask`, `CardIssuer`, `PayerName`…), `Message` |

A valid `Hash` confirms that order `ExternalId` is paid for `Amount`. It does **not** confirm the unsigned fields. Before you act on them — which amount to treat as received, whether to save a card — compare them with the authenticated API response `GET /api/order/merchant/{Order}`. That response is protected by your token and HTTPS.

Compare the values, do not just call the method:

| Check | Notification | API response |
|---|---|---|
| Payment | `Payment.Id` | `paymentId` |
| Status | `EventType` = `PAID` | `status` = `4` |
| Order amount | `Payment.Amount` (and your own order amount) | `amount.amount` |
| Paid amount | `Payment.PaidAmount` | `amount.paidAmount` |
| Customer | your order | `customer.code` |
| Saved card | `Payment.CardLinkHash` | `cardLinkHash`, if the API returns it |

If the values differ, do not fulfil the order automatically and do not save the card: send the order to manual review.

If the signature is valid but you cannot fulfil the order (order not found, amounts differ), still answer `200` and send it to review: otherwise Paynet keeps retrying the notification.

### Complete handler: Node.js

Verifies the signature, stores the notification once, answers `200`, then confirms the values with the API and fulfils the order or sends it to review. The logic of this sample is tested automatically on every documentation build.

```javascript
// paynet-notifications.mjs — complete notification handler, no dependencies (Node.js 18+).
import crypto from 'node:crypto';

// The 9 signed fields, in this exact order. Do not sort.
const signedValues = (n) => {
  const p = n.Payment || {};
  return [n.EventDate, n.Eventid, n.EventType, p.Amount, p.Customer, p.ExternalId, p.Id, p.Merchant, p.StatusDate];
};

export function verifyHash(notification, hashHeader, secret) {
  const prepared = signedValues(notification).map((v) => (v === null || v === undefined ? '' : String(v))).join('');
  const expected = crypto.createHash('md5').update(prepared + secret, 'utf8').digest('base64');
  const received = String(hashHeader || '');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * deps.secret      notification secret key
 * deps.apiUrl      https://ecom-api.paynet.md (test: https://ecom-api-test.paynet.md)
 * deps.getToken()  returns a valid Bearer token (POST /auth, cached)
 * deps.fetch       fetch implementation (globalThis.fetch)
 * deps.db          your storage:
 *   saveNotificationOnce(paymentId, notification) -> true if new, false if already stored
 *   findOrder(order) -> { amount, customerCode, promotionAgreed } or null
 *   markPaid(order, paidAmount), saveCard(customerCode, cardLinkHash), sendToReview(order, problems)
 *
 * handle(rawBody, hashHeader) -> { status, processing }
 *   status: HTTP status to answer Paynet; processing: promise of the work done after answering.
 */
export function createPaynetHandler(deps) {
  const { db } = deps;

  async function confirmWithApi(n, order) {
    const p = n.Payment;
    const response = await deps.fetch(`${deps.apiUrl}/api/order/merchant/${p.ExternalId}`, {
      headers: { Authorization: `Bearer ${await deps.getToken()}` },
    });
    if (!response.ok) throw new Error(`Status check failed: HTTP ${response.status}`);
    const payment = await response.json();

    const problems = [];
    if (payment.paymentId !== p.Id) problems.push('paymentId');
    if (payment.status !== 4) problems.push('status');
    if (payment.amount?.amount !== p.Amount || p.Amount !== order.amount) problems.push('Amount');
    if (payment.amount?.paidAmount !== p.PaidAmount) problems.push('PaidAmount');
    if (payment.customer?.code !== order.customerCode) problems.push('customer');
    if (p.CardLinkHash && payment.cardLinkHash && payment.cardLinkHash !== p.CardLinkHash) problems.push('CardLinkHash');
    return problems;
  }

  async function process(n) {
    const p = n.Payment;
    if (n.EventType !== 'PAID') return db.sendToReview(p.ExternalId, ['EventType']);
    const order = await db.findOrder(p.ExternalId);
    if (!order) return db.sendToReview(p.ExternalId, ['unknown order']);

    const problems = await confirmWithApi(n, order);
    if (p.PaidAmount !== p.Amount && !order.promotionAgreed) problems.push('PaidAmount differs from Amount');
    if (problems.length) return db.sendToReview(p.ExternalId, problems);

    await db.markPaid(p.ExternalId, p.PaidAmount);
    if (p.CardLinkHash) await db.saveCard(order.customerCode, p.CardLinkHash);
  }

  return async function handle(rawBody, hashHeader) {
    let n;
    try {
      n = JSON.parse(rawBody);
    } catch {
      return { status: 400, processing: null };
    }
    if (!verifyHash(n, hashHeader, deps.secret)) return { status: 400, processing: null };

    const isNew = await db.saveNotificationOnce(n.Payment?.Id, n); // idempotency by Payment.Id
    if (!isNew) return { status: 200, processing: null }; // a retry: already stored
    // Answer 200 now; confirm and fulfil after the answer. If this work fails, the stored
    // notification stays unprocessed and a background job can retry it.
    return { status: 200, processing: process(n) };
  };
}
```

Connecting it to Express (read the raw body, answer first, process after):

```javascript
import express from 'express';
import { createPaynetHandler } from './paynet-notifications.mjs';

const handle = createPaynetHandler({
  secret: process.env.PAYNET_NOTIFICATION_SECRET,
  apiUrl: process.env.PAYNET_API_URL,
  getToken, // your cached POST /auth
  fetch: globalThis.fetch,
  db, // your storage
});

const app = express();
app.post('/paynet/notification', express.text({ type: '*/*' }), async (req, res) => {
  const { status, processing } = await handle(req.body, req.get('Hash'));
  res.status(status).json(status === 200 ? { ResultCode: 'SUCCESS' } : { error: 'Invalid notification' });
  processing?.catch((error) => console.error('Paynet notification processing failed', error));
});
```

### Complete handler: PHP

```php
<?php
// paynet-notification.php — complete notification handler (PHP 7.4+, ext-curl).
// $db must implement: saveNotificationOnce($paymentId, array $n): bool, findOrder($order): ?array
// (['amount' => int, 'customerCode' => string, 'promotionAgreed' => bool]), markPaid($order, $paidAmount),
// saveCard($customerCode, $cardLinkHash), sendToReview($order, array $problems).

function paynetVerifyHash(array $n, string $hashHeader, string $secret): bool {
    $p = $n['Payment'] ?? [];
    $s = fn($v) => $v === null ? '' : (string) $v;
    // The 9 signed fields, in this exact order. Do not sort.
    $prepared = $s($n['EventDate'] ?? null) . $s($n['Eventid'] ?? null) . $s($n['EventType'] ?? null)
              . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalId'] ?? null)
              . $s($p['Id'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
    $expected = base64_encode(md5($prepared . $secret, true));
    return hash_equals($expected, $hashHeader);
}

function paynetConfirmWithApi(array $n, array $order, string $apiUrl, string $token): array {
    $p  = $n['Payment'];
    $ch = curl_init($apiUrl . '/api/order/merchant/' . $p['ExternalId']);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200) throw new RuntimeException("Status check failed: HTTP $code");
    $pay = json_decode($body, true);

    $problems = [];
    if (($pay['paymentId'] ?? null) !== $p['Id']) $problems[] = 'paymentId';
    if (($pay['status'] ?? null) !== 4) $problems[] = 'status';
    if (($pay['amount']['amount'] ?? null) !== $p['Amount'] || $p['Amount'] !== $order['amount']) $problems[] = 'Amount';
    if (($pay['amount']['paidAmount'] ?? null) !== ($p['PaidAmount'] ?? null)) $problems[] = 'PaidAmount';
    if (($pay['customer']['code'] ?? null) !== $order['customerCode']) $problems[] = 'customer';
    if (!empty($p['CardLinkHash']) && !empty($pay['cardLinkHash']) && $pay['cardLinkHash'] !== $p['CardLinkHash']) $problems[] = 'CardLinkHash';
    return $problems;
}

function paynetProcess(array $n, $db, string $apiUrl, string $token): void {
    $p = $n['Payment'];
    if (($n['EventType'] ?? '') !== 'PAID') { $db->sendToReview($p['ExternalId'], ['EventType']); return; }
    $order = $db->findOrder($p['ExternalId']);
    if (!$order) { $db->sendToReview($p['ExternalId'], ['unknown order']); return; }

    $problems = paynetConfirmWithApi($n, $order, $apiUrl, $token);
    if (($p['PaidAmount'] ?? null) !== $p['Amount'] && empty($order['promotionAgreed'])) $problems[] = 'PaidAmount differs from Amount';
    if ($problems) { $db->sendToReview($p['ExternalId'], $problems); return; }

    $db->markPaid($p['ExternalId'], $p['PaidAmount']);
    if (!empty($p['CardLinkHash'])) $db->saveCard($order['customerCode'], $p['CardLinkHash']);
}

// --- Endpoint -------------------------------------------------------------
function paynetHandleRequest($db, callable $getToken): void {
    $raw = file_get_contents('php://input');
    $n   = json_decode($raw, true);
    if (!is_array($n) || !paynetVerifyHash($n, $_SERVER['HTTP_HASH'] ?? '', getenv('PAYNET_NOTIFICATION_SECRET'))) {
        http_response_code(400);
        exit('Invalid notification');
    }
    $isNew = $db->saveNotificationOnce($n['Payment']['Id'] ?? null, $n); // idempotency by Payment.Id

    // Answer 200 first.
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['ResultCode' => 'SUCCESS']);
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

    if ($isNew) {
        try {
            paynetProcess($n, $db, getenv('PAYNET_API_URL'), $getToken());
        } catch (Throwable $e) {
            error_log('Paynet notification processing failed: ' . $e->getMessage()); // retry from storage later
        }
    }
}
```

## Respond and retries

- Answer HTTP `200` **after** you have verified the hash and saved the result.
- Answer fast: store the notification, return `200`, and do heavy processing after the response.
- Any other response (or no response) is treated as a failure, and Paynet sends the notification again. Example from a real log: 7 attempts within about 9 minutes, in two series, after which sending stopped. The exact schedule is not guaranteed — do not rely on it.
- Because of retries the same notification can arrive more than once. Process each `Payment.Id` only once.
- If a notification did not arrive (for example, your server was down longer than all attempts), check the status with `GET /api/order/{paymentId}` or `GET /api/order/merchant/{Order}`. You can ask Paynet support to send it again.
- If your server is behind a firewall, ask Paynet support for the IP addresses notifications come from.
- Antifraud will not cancel a payment you received `PAID` for: it acts before the payment is confirmed. A paid payment changes status only after your own [refund](#/guides/errors-and-statuses) (`5` or `6`).

## Notification simulator on this portal

Open **General → Notifications → Notification simulator**:

1. Enter your callback URL. It must be reachable from the internet and, **for the simulator only**, accept requests from the browser (CORS).
2. Check the notification secret key: the test key `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` is already filled in; you can replace it with your own.
3. Enter your merchant order number (`Order`) of a **paid** test payment and press **Get** — the portal loads the payment.
4. Press **Send notification** — the portal sends a signed `PAID` notification built from that payment to your URL and shows the `PreparedString` and `Hash` it used.

This is a simulation sent from your browser, not a real Paynet notification. For unpaid orders the simulator sends nothing, just like Paynet.

> **Important:** CORS is needed only for the simulator, because it posts from your browser. Real notifications are sent by the Paynet server, and CORS does not apply to them: do not enable CORS on your production endpoint for Paynet. A successful simulation checks your signature verification and processing, not delivery from Paynet (network access, firewall, TLS certificate). Confirm delivery with a real test payment.
