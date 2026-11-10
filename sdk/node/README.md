# Paynet e-commerce SDK for Node.js

Official Paynet SDK, version 1.0.0. Node.js 18+, no dependencies. License: MIT.

Documentation: https://morfikozik.github.io/paynet-docs/#/guides/sdk

## What it does for you

- Gets the API token, caches it and gets a new one on `401`.
- Creates orders; after a network error repeats the request with the same body (Paynet returns the same payment).
- Checks refund rules before calling the API: only paid payments, at most the paid amount, one refund per payment, no `CASH_INVOICE`.
- Verifies the notification `Hash` and confirms unsigned fields (`PaidAmount`…) through the API.
- Signs the hosted checkout form.
- Turns every Paynet error format into one `PaynetError` with `kind`, `code`, `traceId`, `hint`.
- Converts dates to Chișinău time where the API expects it (`ExpiryDate`, search, statements).

## Install

Unpack the archive into your project, then:

```javascript
import { PaynetClient, expiryInHours, PaymentStatus } from './paynet-ecom-sdk/src/index.js';
```

## Quick start

```javascript
import { PaynetClient, expiryInHours, PaymentStatus } from './paynet-ecom-sdk/src/index.js';

const paynet = new PaynetClient({
  username: process.env.PAYNET_USERNAME,
  password: process.env.PAYNET_PASSWORD,
  environment: 'test', // 'production' with production credentials
});

// 1. Create an order and send the customer to paymentLink.
const order = {
  Order: 1762444800000, // your order number
  SaleAreaCode: 'onlidocumentation_md',
  LinkUrlSuccess: 'https://shop.example/payment/success',
  LinkUrlCancel: 'https://shop.example/payment/cancel',
  Customer: { Code: 'customer-42', NameFirst: 'Ion', NameLast: 'Popescu', email: 'ion@example.com' },
  ExpiryDate: expiryInHours(24),
  Currency: 498,
  Services: [{ Name: 'My shop', Description: 'Order #1762444800000', Amount: 300 }], // 300 = 3.00 MDL
  MoneyType: 'All',
  Lang: 'ro',
};
const { paymentId, paymentLink } = await paynet.createOrder(order);

// 2. Before shipping: check the status (4 = paid).
const payment = await paynet.getPaymentByOrder(order.Order);
if (payment.status === PaymentStatus.PAID) {
  // ship the goods
}

// 3. Refund (one refund per payment in production).
await paynet.refund({ paymentId, saleAreaCode: 'onlidocumentation_md', amount: 300, reason: 'Customer request' });
```

More: notification handler, hosted checkout form, errors — see the documentation link above.

## Tests

```bash
node --test test/unit.test.js
```

Offline tests: signature test vectors, all error formats, token refresh, refund rules, Chișinău time.

## Support

Through your Telegram chat with the Paynet developer, or support@paynet.md. Send the `traceId` from `PaynetError`.
