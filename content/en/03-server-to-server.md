# Server-to-server integration

In this model your backend talks to the Paynet API directly. It is the recommended option for shops with their own backend.

## Overview

1. `POST /auth` → get an access token.
2. `POST /api/order` → register the order, receive `paymentId` and `paymentLink`.
3. Redirect the customer to `paymentLink`.
4. Receive the [notification](#/guides/notifications) on your callback URL and verify its `Hash`.
5. Confirm with `GET /api/order/{paymentId}` and fulfil the order.

Base URL (test): `https://ecom-api-test.paynet.md`. All bodies are JSON (`Content-Type: application/json`).

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
          "Quantity": 3,
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
| `Order` | integer (int64) | yes | Your order number. Must be new for every payment. |
| `SaleAreaCode` | string | yes | Your sale area (website) code issued by Paynet. |
| `LinkUrlSuccess` | string | yes | Where the customer returns after a successful payment. |
| `LinkUrlCancel` | string | yes | Where the customer returns after cancelling. |
| `Currency` | integer | yes | ISO 4217 numeric code. `498` = MDL. |
| `ExpiryDate` | string | yes | Payment deadline, `YYYY-MM-DDTHH:mm:ss`, must be in the future. |
| `Services` | array | yes | At least one service, see below. |
| `MoneyType` | string | yes | `All`, `Card`, `Paynet`, `MIA` or `CashInvoice` (see below). |
| `Lang` | string | yes | Payment page language: `RO`, `RU` or `EN`. |
| `Customer` | object | no | Customer data. Required in full if `CardLinkHash` is sent. |
| `Customer.Code` | string | yes, if `Customer` is sent | Customer ID in your system. |
| `Customer.NameFirst`, `NameLast`, `email`, `PhoneNumber` | string | no | Customer details. Note the lowercase `email`. |
| `CardLinkHash` | string | no | Hash of a saved card of this customer (one-click payment). |

`Services[]`:

| Field | Type | Required | Description |
|---|---|---|---|
| `Name` | string | yes | Service name. |
| `Description` | string | yes | Service description. |
| `Amount` | integer | yes | Service amount in minor units. |
| `Products` | array | no | If you send products, all product fields below are required. |

`Services[].Products[]`: `LineNo` (int), `Code` (string), `Name` (string), `Description` (string), `UnitPrice` (int), `Quantity` (int), `Amount` (int), `TotalAmount` (int).

**Amounts** are integers in minor units (bani): `1201` = 12.01 MDL.

**MoneyType** selects which payment methods the customer sees: `Card` (Visa/Mastercard), `Paynet` (Paynet wallet), `MIA` (MIA instant payments), `CashInvoice` (cash invoice), `All` (all methods enabled for your merchant).

### Response

```json
{
  "paymentId": 317184,
  "paymentLink": "https://test.paynet.md/ecom/getecom/317184?s=ea20bad9b2c464765542e000eb886057",
  "status": 1,
  "order": 18223,
  "merchantCode": "111125",
  "saleAreaCode": "makle",
  "amount": { "requestAmount": 3, "requestCurrency": 498, "amount": 3, "amountCurrency": 3 },
  "expiryDate": "2026-04-03 12:01:12",
  "registered": "2026-04-01 15:01:12",
  "paidDate": null,
  "moneyType": "All"
}
```

(Shortened. The full response also contains `customer`, `payer`, `services`, `cardLinkHash`, `signature`, `linkUrlSuccess`, `linkUrlCancel`.)

Store `paymentId` together with your order. It is the key for status checks, refunds and notifications.

## 3. Redirect the customer

Send the customer's browser to `paymentLink` (HTTP 302 or a link/button). After payment the customer returns to `LinkUrlSuccess` or `LinkUrlCancel`.

## 4. Handle the notification

Paynet sends a signed `POST` to your callback URL when the payment is paid. Verify the `Hash` header and answer HTTP `200`. See [Notifications](#/guides/notifications).

## 5. Check the status

```http
GET /api/order/{paymentId}
GET /api/order/merchant/{Order}
Authorization: Bearer <access_token>
```

Both return the same payment object. Use them before shipping goods and whenever a notification did not arrive. See [Statuses and errors](#/guides/statuses-and-errors).

## Other operations

| Operation | Request | Notes |
|---|---|---|
| Search payments | `GET /api/order/search?from=…&to=…` | ISO 8601 date-time, e.g. `2026-03-09T06:40:05.010Z`. |
| Refund | `POST /api/order/refund` | Body: `paymentId`, `saleAreaCode`, `refundType` (`full` or `partial`), `amount`, `currency`, `reason`. |
| Unlink a saved card | `POST /api/linked-cards/unlink` | Body: `cardLinkHash`, `saleAreaCode`, `customerCode`. |
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
