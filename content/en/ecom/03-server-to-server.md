# Server-to-server integration

In this model your backend talks to the Paynet API directly. It is the recommended option for shops with their own backend.

## Overview

1. `POST /auth` → get an access token.
2. `POST /api/order` → register the order, receive `paymentId` and `paymentLink`.
3. Redirect the customer to `paymentLink`.
4. Receive the [notification](#/guides/notifications) on your callback URL and verify its `Hash`.
5. Confirm with `GET /api/order/{paymentId}` and fulfil the order.

Base URL: `https://ecom-api-test.paynet.md` (test), `https://ecom-api.paynet.md` (production). All bodies are JSON (`Content-Type: application/json`).

## 1. Authenticate

```http
POST /auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

```json
{ "access_token": "Ccxl7QQiMEoakkrUoiUn8PIg…", "token_type": "bearer", "expires_in": 14399 }
```

Send the token in every other request: `Authorization: Bearer <access_token>`. `expires_in` is in seconds (about 4 hours). Cache the token and request a new one when it expires or when the API returns `401`.

Wrong credentials return an error with `code` `AUTHENTICATION_FAILED`.

## 2. Create an order

```http
POST /api/order
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "Order": 1762444800000,
  "SaleAreaCode": "onlidocumentation_md",
  "LinkUrlSuccess": "https://shop.example/payment/success",
  "LinkUrlCancel": "https://shop.example/payment/cancel",
  "Customer": {
    "Code": "464566161",
    "NameFirst": "First Name",
    "NameLast": "Last Name",
    "email": "customer@example.com",
    "PhoneNumber": "37360000000"
  },
  "Currency": 498,
  "ExpiryDate": "2026-12-31T23:59:59",
  "Services": [
    {
      "Name": "Demo eShop",
      "Description": "Order #1762444800000",
      "Amount": 300,
      "Products": [
        {
          "LineNo": 1,
          "Code": "SKU-1",
          "Name": "Demo product",
          "Description": "Demo product",
          "UnitPrice": 100,
          "Quantity": 300,
          "Amount": 300,
          "TotalAmount": 300
        }
      ]
    }
  ],
  "MoneyType": "All",
  "Lang": "EN"
}
```

### Request fields

| Field | Type | Required | Description |
|---|---|---|---|
| `Order` | integer (int64) | yes | Your order number. One shop order = one `Order` (see [repeated order number](#/guides/errors-and-statuses)). |
| `SaleAreaCode` | string | yes | Your sale area (website) code issued by Paynet. |
| `LinkUrlSuccess` | string | yes | Where the customer returns after a successful payment. |
| `LinkUrlCancel` | string | yes | Where the customer returns after cancelling. |
| `Currency` | integer | yes | ISO 4217 numeric code. `498` = MDL. |
| `ExpiryDate` | string | yes | Payment deadline, `YYYY-MM-DDTHH:mm:ss`, Chișinău local time (`Europe/Chisinau`), must be in the future. |
| `Services` | array | yes | At least one service, see below. |
| `MoneyType` | string | yes | `All`, `Card`, `Paynet`, `MIA` or `CashInvoice` (see below). |
| `Lang` | string | yes | Payment page language: `RO`, `RU` or `EN`. |
| `Customer` | object | no | Customer data. Required to [save a card](#/guides/saved-cards) or to pay with a saved card. |
| `Customer.Code` | string | yes, if `Customer` is sent | Customer ID in your system. |
| `Customer.NameFirst`, `NameLast`, `email`, `PhoneNumber` | string | no | Customer details. Note the lowercase `email`. |
| `CardLinkHash` | string | no | Saved card token of this customer, received in a notification. Send it together with the same `Customer`. See [Saved cards](#/guides/saved-cards). |

`Services[]`:

| Field | Type | Required | Description |
|---|---|---|---|
| `Name` | string | yes | Service name. |
| `Description` | string | yes | Service description. |
| `Amount` | integer | yes | Service amount in minor units. |
| `Products` | array | no | Optional. If you send products, six fields of each product are required (see below). |

`Services[].Products[]` — required: `LineNo` (int), `Name` (string), `UnitPrice` (int), `Quantity` (int), `Amount` (int), `TotalAmount` (int). Optional: `Code` (string), `Description` (string). Checked on the test environment: without any of the six required fields the API answers `400`.

**`Quantity` is in hundredths:** `100` = 1 pc, `300` = 3 pcs. In the example above `"Quantity": 300` means 3 pcs at `UnitPrice` 1.00 MDL.

**Amounts** are integers in minor units (bani): `1201` = 12.01 MDL.

**MoneyType** selects which payment methods the customer sees:

| `MoneyType` | Customer sees |
|---|---|
| `All` | all methods enabled for your merchant |
| `Card` | card (Visa/Mastercard), Apple Pay, Google Pay |
| `Paynet` | Paynet wallet |
| `MIA` | MIA instant payments |
| `CashInvoice` | cash invoice |

There is no separate value for Apple Pay or Google Pay: they are shown with `Card` and with `All`. The notification tells you how the customer actually paid (`CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`).

### Response

```json
{
  "paymentId": 328731,
  "paymentLink": "https://test.paynet.md/ecom/getecom/328731?s=8fa1bd0923368d3bb700fccacc263735",
  "cardLinkHash": null,
  "status": 1,
  "order": 1762444800000,
  "merchantCode": "265505",
  "saleAreaCode": "onlidocumentation_md",
  "amount": { "requestAmount": 300, "requestCurrency": 498, "amount": 300, "paidAmount": null },
  "expiryDate": "2026-12-31 23:59:59",
  "registered": "2026-11-09 18:16:41",
  "paidDate": null,
  "moneyType": "All"
}
```

(Test environment response, shortened. After payment `status` = `4`, and `paidDate` and `amount.paidAmount` are filled. The full response also contains `customer`, `payer`, `services`, `cardLinkHash`, `signature`, `linkUrlSuccess`, `linkUrlCancel`.)

Store `paymentId` together with your order. It is the key for status checks, refunds and notifications.

**Repeating the request.** Sending the same `Order` again with the same data (while it is not paid) returns the same `paymentId` and `paymentLink`, so it is safe to retry after a timeout. The same `Order` with different data, or after payment, fails with `500 TECHNICAL_ERROR`. If the cart changes, use a new `Order`.

"The same data" means literally the same request. Store the request body with the order and resend it unchanged: for example, a recomputed `ExpiryDate` already counts as different data.

## 3. Redirect the customer

Send the customer's browser to `paymentLink` (HTTP 302 or a link/button). Save this link with the order: only the `POST /api/order` response has the full link; `GET /api/order/…` responses return it shortened, without the payment number. After a successful payment the customer returns to `LinkUrlSuccess`; if the payment fails or is cancelled, to `LinkUrlCancel`.

## 4. Handle the notification

Paynet sends a signed `POST` to your callback URL when the payment is paid (`EventType` = `PAID`; failed payments are not notified). Verify the `Hash` header, check that `PaidAmount` equals `Amount`, and answer HTTP `200`. See [Notifications](#/guides/notifications).

## 5. Check the status

```http
GET /api/order/{paymentId}
GET /api/order/merchant/{Order}
Authorization: Bearer <access_token>
```

Both return the same payment object. Use them before shipping goods and whenever a notification did not arrive. See [Errors and statuses](#/guides/errors-and-statuses).

## Other operations

| Operation | Request | Notes |
|---|---|---|
| Search payments | `GET /api/order/search?from=…&to=…` | Date-time **in Chișinău time** without `Z`, e.g. `2026-03-09T08:40:05`. The API ignores the UTC marker (`Z`): UTC times shift the period by 2–3 hours, and recent payments are missed. If there are no payments in the period, the API answers `404 NOT_FOUND_RECORD` — an empty result, not an error. |
| Refund | `POST /api/order/refund` | Body: `PaymentId`, `SaleAreaCode`, `RefundType` (`full` or `partial`), `Amount`, `Currency`, `Reason`. |
| Unlink a saved card | `POST /api/linked-cards/unlink` | Body: `CardLinkHash`, `SaleAreaCode`, `CustomerCode`. |
| Statement | `GET /api/statement?dateStart=…&dateFinish=…` | Dates like `2026-03-01`. Optional `accountId`. |
| Statement (Excel) | `GET /api/statement/download?dateStart=…&dateFinish=…` | Returns an `.xlsx` file. Period of at most 31 days. |

## Example: Node.js (18+)

```javascript
const BASE_URL = 'https://ecom-api-test.paynet.md';

async function getToken() {
  const res = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantType: 'password', username: process.env.PAYNET_USER, password: process.env.PAYNET_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function createOrder(token, order) {
  const res = await fetch(`${BASE_URL}/api/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(order),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Create order failed: ${res.status} ${JSON.stringify(body)}`);
  return body; // { paymentId, paymentLink, status, ... }
}
```

## Example: PHP

```php
<?php
$baseUrl = 'https://ecom-api-test.paynet.md';

function paynetRequest(string $method, string $url, ?array $body = null, ?string $token = null): array {
    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    if ($token) { $headers[] = 'Authorization: Bearer ' . $token; }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    if ($body !== null) { curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body)); }
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $data = json_decode($raw, true);
    if ($status !== 200) { throw new RuntimeException("Paynet error $status: $raw"); }
    return $data;
}

$auth  = paynetRequest('POST', "$baseUrl/auth", ['grantType' => 'password', 'username' => getenv('PAYNET_USER'), 'password' => getenv('PAYNET_PASSWORD')]);
$token = $auth['access_token'];
// $payment = paynetRequest('POST', "$baseUrl/api/order", $order, $token);
// header('Location: ' . $payment['paymentLink']);
```
