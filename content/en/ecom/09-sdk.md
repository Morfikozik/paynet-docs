# SDK for PHP and Node.js

Official Paynet libraries for your shop's server side. They take care of authorization, API rules, signatures and error handling, so you write only your shop logic. No third-party dependencies.

| | PHP | Node.js |
|---|---|---|
| Version | 1.0.0 | 1.0.0 |
| Requirements | PHP 7.4+, `curl` and `json` extensions | Node.js 18+ |
| Download | [paynet-ecom-sdk-php-1.0.0.zip](sdk/paynet-ecom-sdk-php-1.0.0.zip) | [paynet-ecom-sdk-node-1.0.0.zip](sdk/paynet-ecom-sdk-node-1.0.0.zip) |
| License | MIT | MIT |

> **Important:** the SDK runs on your server only. Never send the username, password or secret keys to a browser or a mobile app. For apps, see [Mobile apps](#/guides/mobile-apps).

## What the SDK does for you

| Task | Without the SDK | With the SDK |
|---|---|---|
| Access token | Get it from `/auth`, store it, refresh it | Obtained automatically, refreshed on `401` |
| Creating an order | Store the request body, repeat it unchanged after a network failure | Repeated automatically after a network failure, with the same body |
| Refund | Check yourself: is it paid, is the amount not too big, was there a refund already | Rules are checked **before** calling the API — a clear error instead of an API rejection |
| Notifications | Build the string from 9 fields, MD5 + Base64, confirm unsigned fields | `parseNotification` + `confirmNotification` |
| Hosted checkout form | RFC 3986, field sorting, signature | `buildCheckoutForm` returns ready HTML |
| Errors | Three body formats and different key case | One error: kind, code, `traceId`, hint |
| Time | `ExpiryDate`, search and statements use Chișinău time | Dates are converted automatically |

## Install

Unpack the archive into your project — you get a `paynet-ecom-sdk` folder.

PHP:

```php
require __DIR__ . '/paynet-ecom-sdk/autoload.php';
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';
```

To check that everything is in place: `php paynet-ecom-sdk/tests/run.php` or `node --test paynet-ecom-sdk/test/unit.test.js`.

## Connect

PHP:

```php
use Paynet\Ecom\PaynetClient;

$paynet = new PaynetClient([
    'username' => getenv('PAYNET_USERNAME'),
    'password' => getenv('PAYNET_PASSWORD'),
    'environment' => 'test', // 'production' — with production credentials
]);
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';

export const paynet = new PaynetClient({
  username: process.env.PAYNET_USERNAME,
  password: process.env.PAYNET_PASSWORD,
  environment: 'test', // 'production' — with production credentials
});
```

In Node.js, save this code as `paynet.js`: the examples below import the client from it. Test credentials are on the [Testing](#/guides/testing) page. Production credentials are different.

## Create an order and send the customer to pay

Store the request body with your order: to repeat the request, send it unchanged — Paynet returns the same payment.

PHP:

```php
use Paynet\Ecom\Time;

$order = [
    'Order' => 1762444800000, // your shop's order number
    'SaleAreaCode' => 'onlidocumentation_md',
    'LinkUrlSuccess' => 'https://shop.example/payment/success',
    'LinkUrlCancel' => 'https://shop.example/payment/cancel',
    'Customer' => ['Code' => 'customer-42', 'NameFirst' => 'Ion', 'NameLast' => 'Popescu', 'email' => 'ion@example.com'],
    'ExpiryDate' => Time::expiryInHours(24), // in 24 hours, Chișinău time
    'Currency' => 498,
    'Services' => [['Name' => 'My shop', 'Description' => 'Order #1762444800000', 'Amount' => 300]], // 300 = 3.00 MDL
    'MoneyType' => 'All',
    'Lang' => 'ro',
];
$created = $paynet->createOrder($order);
header('Location: ' . $created['paymentLink']);
```

Node.js:

```javascript
import { expiryInHours } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

const order = {
  Order: 1762444800000, // your shop's order number
  SaleAreaCode: 'onlidocumentation_md',
  LinkUrlSuccess: 'https://shop.example/payment/success',
  LinkUrlCancel: 'https://shop.example/payment/cancel',
  Customer: { Code: 'customer-42', NameFirst: 'Ion', NameLast: 'Popescu', email: 'ion@example.com' },
  ExpiryDate: expiryInHours(24), // in 24 hours, Chișinău time
  Currency: 498,
  Services: [{ Name: 'My shop', Description: 'Order #1762444800000', Amount: 300 }], // 300 = 3.00 MDL
  MoneyType: 'All',
  Lang: 'ro',
};
const { paymentId, paymentLink } = await paynet.createOrder(order);
// redirect the customer to paymentLink
```

## Check the payment

Before shipping, check the status through the API: a customer returning to `LinkUrlSuccess` does not by itself mean the payment is done.

PHP:

```php
use Paynet\Ecom\PaymentStatus;

$payment = $paynet->getPaymentByOrder(1762444800000);
if ($payment['status'] === PaymentStatus::PAID) {
    // the order is paid — you can fulfil it
}
```

Node.js:

```javascript
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

const payment = await paynet.getPaymentByOrder(1762444800000);
if (payment.status === PaymentStatus.PAID) {
  // the order is paid — you can fulfil it
}
```

Statuses: `1` — not paid, `3` — processing (wait, up to about a day), `4` — paid, `5` and `6` — final. More: [Statuses and errors](#/guides/errors-and-statuses).

## Receive a notification

Answer `200` quickly and only after the signature check. Then confirm the payment through the API: the paid amount (`PaidAmount`) and some other fields are not signed.

PHP:

```php
use Paynet\Ecom\Notification;
use Paynet\Ecom\PaynetException;

try {
    $notification = Notification::parse(file_get_contents('php://input'), $_SERVER['HTTP_HASH'] ?? null, getenv('PAYNET_NOTIFICATION_KEY'));
} catch (PaynetException $e) {
    http_response_code(400);
    exit;
}
// store the notification (retries come with the same Payment.Id) and answer 200
http_response_code(200);

$check = Notification::confirm($paynet, $notification, ['amount' => 300, 'customerCode' => 'customer-42']);
if ($check['ok']) {
    // fulfil the order
} else {
    // send to manual review: $check['problems']
}
```

Node.js:

```javascript
import { parseNotification, confirmNotification } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// rawBody — the request body as a string, unchanged; hash — the Hash header
export async function handlePaynetNotification(rawBody, hash, res) {
  let notification;
  try {
    notification = parseNotification(rawBody, hash, process.env.PAYNET_NOTIFICATION_KEY);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // store the notification (retries come with the same Payment.Id) and answer 200
  res.writeHead(200).end();

  const check = await confirmNotification(paynet, notification, { amount: 300, customerCode: 'customer-42' });
  if (check.ok) {
    // fulfil the order
  } else {
    // send to manual review: check.problems
  }
}
```

Use the **notification key**, not the checkout form key. More: [Notifications](#/guides/notifications).

## Make a refund

In production a payment can have **one** refund (full or partial), within 180 days, at most the paid amount, not for `CASH_INVOICE`. The SDK checks these rules before calling the API. The type (`full` / `partial`) is chosen from the amount.

PHP:

```php
$refund = $paynet->refund((int) $created['paymentId'], 'onlidocumentation_md', 300, null, 'Customer request');
```

Node.js:

```javascript
import { paynet } from './paynet.js';

const refund = await paynet.refund({ paymentId: 328731, saleAreaCode: 'onlidocumentation_md', amount: 300, reason: 'Customer request' });
```

The result comes in the response; there is no refund notification.

## Hosted checkout form

The signature is computed on the server; only the ready form goes to the browser. Use the **checkout form key**.

PHP:

```php
use Paynet\Ecom\Checkout;

$form = Checkout::buildForm([
    'Order' => 1762444800000,
    'Merchant' => '265505',
    'SaleAreaCode' => 'onlidocumentation_md',
    'Amount' => 300,
    'Description' => 'Order #1762444800000',
    'LinkUrlSuccess' => 'https://shop.example/payment/success',
    'LinkUrlCancel' => 'https://shop.example/payment/cancel',
    'Lang' => 'ro',
    'MoneyType' => 'All',
], getenv('PAYNET_CHECKOUT_KEY'), 'test');
echo $form['html'];
```

Node.js:

```javascript
import { buildCheckoutForm } from './paynet-ecom-sdk/src/index.js';

const form = buildCheckoutForm({
  secretKey: process.env.PAYNET_CHECKOUT_KEY,
  environment: 'test',
  fields: {
    Order: 1762444800000,
    Merchant: '265505',
    SaleAreaCode: 'onlidocumentation_md',
    Amount: 300,
    Description: 'Order #1762444800000',
    LinkUrlSuccess: 'https://shop.example/payment/success',
    LinkUrlCancel: 'https://shop.example/payment/cancel',
    Lang: 'ro',
    MoneyType: 'All',
  },
});
// send form.html to the browser
```

`Currency` defaults to `498`, `ExpiryDate` to 24 hours from now in Chișinău time.

## Errors

Every API error or rule violation is a `PaynetException` (PHP) or `PaynetError` (Node.js) with: kind (`kind`), HTTP code, Paynet code, `traceId`, a hint (`hint`) and whether repeating can help (`retryable`).

| Kind (`kind`) | When | What to do |
|---|---|---|
| `validation` | `400`: invalid or missing fields | Fix the request using `details` |
| `authentication` | `/auth`: wrong username or password | Check the credentials (test and production differ) |
| `unauthorized` | `401` even after refreshing the token | Check the credentials |
| `not_found` | `404 NOT_FOUND_RECORD`: no payment; refund of an unpaid payment | Check `paymentId` / `Order` |
| `server` | `500 TECHNICAL_ERROR` | Look the order up by `Order`; a repeated `Order` with other data needs a new `Order` |
| `network` | No response (timeout, network) | Look the order up by `Order`, repeat the same request |
| `rule` | The SDK did not call the API: a rule is broken (for example, a second refund) | Read the message — no request was sent |
| `wrong_address`, `method_not_allowed`, `unsupported_media_type` | `404` with an empty body, `405`, `415` | A client setup error — should not happen when using the SDK |

PHP:

```php
use Paynet\Ecom\PaynetException;

try {
    $paynet->refund(328731, 'onlidocumentation_md', 300);
} catch (PaynetException $e) {
    error_log($e->kind . ' ' . $e->errorCode . ' traceId=' . $e->traceId . ' — ' . $e->hint);
}
```

Node.js:

```javascript
import { PaynetError } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

try {
  await paynet.refund({ paymentId: 328731, saleAreaCode: 'onlidocumentation_md', amount: 300 });
} catch (error) {
  if (error instanceof PaynetError) console.error(error.kind, error.code, `traceId=${error.traceId}`, error.hint);
  else throw error;
}
```

Send the `traceId` when you contact support.

## SDK methods

| What | PHP | Node.js | API method |
|---|---|---|---|
| Create an order | `createOrder($order)` | `createOrder(order)` | `POST /api/order` |
| Payment by `paymentId` | `getPayment($id)` | `getPayment(id)` | `GET /api/order/{id}` |
| Payment by your order number | `getPaymentByOrder($order)` | `getPaymentByOrder(order)` | `GET /api/order/merchant/{id}` |
| Is the order paid | `isPaid($order)` | `isPaid(order)` | `GET /api/order/merchant/{id}` |
| Search a period | `searchPayments($from, $to)` | `searchPayments({ from, to })` | `GET /api/order/search` |
| Refund | `refund($paymentId, $saleArea, $amount, …)` | `refund({ paymentId, saleAreaCode, amount, … })` | `POST /api/order/refund` |
| Delete a saved card | `unlinkCard($hash, $saleArea, $customer)` | `unlinkCard({ cardLinkHash, saleAreaCode, customerCode })` | `POST /api/linked-cards/unlink` |
| Statement | `getStatement($start, $finish)` | `getStatement({ dateStart, dateFinish })` | `GET /api/statement` |
| Statement `.xlsx` | `downloadStatement($start, $finish)` | `downloadStatement({ dateStart, dateFinish })` | `GET /api/statement/download` |
| Verify a notification | `Notification::parse(…)`, `Notification::confirm(…)` | `parseNotification(…)`, `confirmNotification(…)` | — |
| Hosted checkout form | `Checkout::buildForm(…)` | `buildCheckoutForm(…)` | — |

Search: dates are converted to Chișinău time; an empty period returns an empty list (the API answers `404` in that case).

## How the SDKs are checked

- **Unit tests** (included in the archive): signatures against the test vectors from [Signatures](#/guides/signatures), all error formats, token refresh, refund rules, Chișinău time. They run on every publication of the portal.
- **Check on the test environment** (merchant 265505): each SDK creates its own order, repeats the request, and after a test card payment checks status `4`, search, a partial refund, refusal of a second refund, deleting the saved card, statements and errors. Result on 10.11.2026: PHP — 20 of 20, Node.js — 20 of 20.

## Support

SDK questions go the same way as API questions: in the Telegram chat with a Paynet developer (through your manager) or to [support@paynet.md](mailto:support@paynet.md). Send the `traceId` from the error. More: [Contacting support](#/guides/errors-and-statuses).
