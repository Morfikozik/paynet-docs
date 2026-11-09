# Hosted checkout (client-server)

In this model the customer's browser sends the order to Paynet as a signed HTML form (`POST`). You do not call an API to create the order, but you must compute a `Signature` with your secret key **on your server**.

| Environment | Form action URL |
|---|---|
| Test | `https://test.paynet.md/ecom/checkout` |
| Production | `https://paynet.md/ecom/checkout` |

## Flow

1. The customer clicks "Pay" in your shop.
2. Your server builds the form fields and computes `Signature` (see below).
3. Your page renders an auto-submitting form that posts the fields to the checkout URL.
4. The customer pays on the Paynet page and returns to `LinkUrlSuccess` (paid) or `LinkUrlCancel` (failed or cancelled).
5. Paynet sends a `PAID` [notification](#/guides/notifications) to your callback URL (failed payments are not notified).
6. Before you ship, confirm the payment with `GET /api/order/merchant/{Order}` (server-to-server API, Bearer token): orders created by the form are found by your `Order`.

## Form fields

| Field | Required | Signed | Description |
|---|---|---|---|
| `Order` | yes | yes | Your order number (integer). One shop order = one `Order`. |
| `Currency` | yes | yes | ISO 4217 numeric code, `498` = MDL. |
| `Merchant` | yes | yes | Your merchant code. |
| `SaleAreaCode` | yes | yes | Your sale area code. |
| `Amount` | yes | yes | Amount in minor units: `1235` = 12.35 MDL. |
| `Description` | yes | yes | Order description shown to the customer. |
| `ExpiryDate` | yes | yes | Payment deadline, `YYYY-MM-DDTHH:mm:ss`, Chișinău local time. |
| `LinkUrlSuccess` | yes | yes | Return URL after successful payment. |
| `LinkUrlCancel` | yes | yes | Return URL after cancellation. |
| `Lang` | yes | yes | Payment page language, e.g. `ro`, `ru`, `en`. |
| `MoneyType` | yes | yes | Payment methods shown: `All`, `Card` (card, Apple Pay, Google Pay), `Paynet`, `MIA`, `CashInvoice`. |
| `CustomerCode` | no | yes | Customer ID in your system. |
| `CustomerNameFirst` | no | yes | Customer first name. |
| `CustomerNameLast` | no | yes | Customer last name. |
| `CustomerPhoneNumber` | no | yes | Customer phone. |
| `CustomerEmail` | no | yes | Customer email. |
| `ProductAmount`, `ProductBarcode`, `ProductCode`, `ProductDescription`, `ProductGroupId`, `ProductGroupName`, `ProductLineNo`, `ProductName`, `ProductUnitPrice`, `ProductQuantity`, `ProductUnitProduct` | no | no | Optional product details. |
| `Signature` | yes | — | `Base64(MD5(RawData + SecretKey))` with the **hosted checkout** secret key, see below. |

## Signature

1. Take the **signed** fields from the table above that you actually send (skip fields you do not send).
2. Sort them by field name, A → Z.
3. Percent-encode each **value** with RFC 3986 (`encodeURIComponent` plus `! ' ( ) *`), using UTF-8 (also for Cyrillic and Romanian diacritics).
4. Concatenate the encoded values without separators → `RawData`.
5. `Signature = Base64( MD5( RawData + SecretKey ) )` — Base64 of the raw 16-byte MD5 digest, not of the hex string.

A complete worked example with expected output is on the [Signatures](#/guides/signatures) page. Use it as a unit test.

> **Important:** compute the signature on your server. The secret key must never appear in HTML or JavaScript sent to the browser.

## Example form

```html
<form id="paynet" method="POST" action="https://test.paynet.md/ecom/checkout">
  <input type="hidden" name="Order" value="1762444800000">
  <input type="hidden" name="Currency" value="498">
  <input type="hidden" name="Merchant" value="265505">
  <input type="hidden" name="SaleAreaCode" value="onlidocumentation_md">
  <input type="hidden" name="Amount" value="1235">
  <input type="hidden" name="Description" value="Test&amp;Co SRL">
  <input type="hidden" name="CustomerCode" value="5555">
  <input type="hidden" name="CustomerNameFirst" value="First name">
  <input type="hidden" name="CustomerNameLast" value="Last name">
  <input type="hidden" name="CustomerPhoneNumber" value="060000000">
  <input type="hidden" name="CustomerEmail" value="test@gmail.com">
  <input type="hidden" name="ExpiryDate" value="2026-12-31T23:59:59">
  <input type="hidden" name="LinkUrlCancel" value="https://test.oplta.md/cancel">
  <input type="hidden" name="LinkUrlSuccess" value="https://test.oplta.md/ok">
  <input type="hidden" name="Lang" value="ro">
  <input type="hidden" name="MoneyType" value="Card">
  <input type="hidden" name="Signature" value="cxr/+yLYZp34aR0KXLkb2A==">
</form>
<script>document.getElementById('paynet').submit();</script>
```

The `Signature` above is correct for these exact values and the test secret key. Values in HTML attributes must be HTML-escaped (`&` → `&amp;`); the browser sends the original value, which is what you sign.

## Example: Node.js signature

```javascript
import crypto from 'node:crypto';

const SIGNED_FIELDS = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'CustomerCode', 'CustomerNameFirst',
  'CustomerNameLast', 'CustomerPhoneNumber', 'CustomerEmail', 'ExpiryDate', 'Description', 'Amount',
  'LinkUrlCancel', 'LinkUrlSuccess', 'Lang', 'MoneyType'];

const encodeRfc3986 = (v) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function checkoutSignature(fields, secretKey) {
  const rawData = SIGNED_FIELDS
    .filter((name) => fields[name] !== undefined && fields[name] !== null)
    .sort()
    .map((name) => encodeRfc3986(String(fields[name])))
    .join('');
  return crypto.createHash('md5').update(rawData + secretKey, 'utf8').digest('base64');
}
```

## Example: PHP signature

```php
<?php
function checkoutSignature(array $fields, string $secretKey): string {
    $signed = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'CustomerCode', 'CustomerNameFirst',
        'CustomerNameLast', 'CustomerPhoneNumber', 'CustomerEmail', 'ExpiryDate', 'Description', 'Amount',
        'LinkUrlCancel', 'LinkUrlSuccess', 'Lang', 'MoneyType'];
    $present = array_values(array_filter($signed, fn($name) => isset($fields[$name])));
    sort($present, SORT_STRING);
    $rawData = '';
    foreach ($present as $name) {
        $rawData .= rawurlencode((string) $fields[$name]); // RFC 3986
    }
    return base64_encode(md5($rawData . $secretKey, true));
}
```

## Testing on this portal

Open **E-commerce → Hosted checkout → Checkout form (try it)**. The portal fills a unique `Order` and a future `ExpiryDate`, generates the signature with the test key and opens the Paynet test page in a new tab.

If you post an `Order` that is already paid or being processed by the card issuer, the customer sees the Paynet page "Plata a fost respinsă" (this invoice is already paid or being processed).
