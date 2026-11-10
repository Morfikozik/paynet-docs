# Mobile apps

A separate mobile SDK is not needed. A mobile app takes payments through **your server** and the **Paynet payment page**. Other payment providers with a hosted payment page work the same way.

> **Important:** never store the API username and password, secret keys or the token in the app. Anyone can download and take an app apart — the keys would be found, and someone could create orders, make refunds and forge notifications on behalf of your shop. Everything that needs keys is done by the server only.

## How it works

| Step | Where | What happens |
|---|---|---|
| 1 | App | The customer taps "Pay". The app sends the order to **your server** |
| 2 | Your server | Creates the order in Paynet ([SDK](#/guides/sdk) or [API](#/guides/server-to-server)) and returns `paymentLink` to the app |
| 3 | App | Opens `paymentLink` in the **system browser view**. The customer pays on the Paynet page |
| 4 | Paynet → your server | [Notification](#/guides/notifications) `PAID`. The server checks the signature and the payment |
| 5 | Paynet → app | After payment the page returns the customer to `LinkUrlSuccess` (or `LinkUrlCancel`) |
| 6 | App → your server | The app asks **your server** whether the order is paid. Decide only by the server's answer |

## Server: create an order for the app

A Node.js example with the [SDK](#/guides/sdk). The app calls `POST /mobile/orders/{id}/pay` and gets the payment link; `GET /mobile/orders/{id}/status` tells whether the order is paid.

```javascript
import http from 'node:http';
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// In a real shop the order comes from your database by id: the amount comes from the order, not from the app's request.
// expiryDate is stored when the order is created (for example, expiryInHours(1)), so that tapping
// "Pay" again sends exactly the same request to Paynet.
const findOrder = async (id) => ({ order: Number(id), amount: 300, customerCode: 'customer-42', expiryDate: '2026-11-10T19:00:00' });

http.createServer(async (req, res) => {
  const match = req.url.match(/^\/mobile\/orders\/(\d+)\/(pay|status)$/);
  if (!match) return res.writeHead(404).end();
  const order = await findOrder(match[1]);

  if (match[2] === 'pay' && req.method === 'POST') {
    const { paymentLink } = await paynet.createOrder({
      Order: order.order,
      SaleAreaCode: 'onlidocumentation_md',
      LinkUrlSuccess: `https://shop.example/app/payment/success?order=${order.order}`,
      LinkUrlCancel: `https://shop.example/app/payment/cancel?order=${order.order}`,
      Customer: { Code: order.customerCode },
      ExpiryDate: order.expiryDate,
      Currency: 498,
      Services: [{ Name: 'My shop', Description: `Order #${order.order}`, Amount: order.amount }],
      MoneyType: 'All',
      Lang: 'ro',
    });
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ paymentLink }));
  }

  const payment = await paynet.getPaymentByOrder(order.order);
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ paid: payment.status === PaymentStatus.PAID, status: payment.status }));
}).listen(3000);
```

Authorize the app's requests to your server the same way as the app's other requests. Tapping "Pay" again for the same order must send **the same** request to Paynet — then Paynet returns the same payment.

## iOS: open the payment page

Use `SFSafariViewController` — the system Safari view inside your app.

```swift
import SafariServices
import UIKit

func openPayment(_ paymentLink: String, from viewController: UIViewController) {
    guard let url = URL(string: paymentLink) else { return }
    let safari = SFSafariViewController(url: url)
    viewController.present(safari, animated: true)
}
```

## Android: open the payment page

Use Chrome Custom Tabs (the `androidx.browser` library).

```kotlin
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

fun openPayment(context: Context, paymentLink: String) {
    CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(paymentLink))
}
```

## Returning to the app after payment

Set `LinkUrlSuccess` and `LinkUrlCancel` to addresses of your website linked to the app: **Universal Links** (iOS) and **App Links** (Android). After payment the app opens, or your website if the app is not installed.

After returning, the app **does not treat the order as paid** just because the customer came back: it asks your server for the status (step 6). If the customer closed the payment view before finishing, the app also asks the server for the status.

## Recommendations

- **Do not use a WebView** for the payment page. In the system browser view the customer sees the Paynet page address, and Apple Pay and Google Pay may not work in an embedded WebView.
- **Take the amount from the order on the server**, not from the app's request.
- **Do not fulfil the order before the server confirms it**: a `PAID` notification with a verified signature, or `status` = `4` through the API.
- **Test on real devices** before going live: card payment, Apple Pay (iPhone), Google Pay (Android), returning to the app, cancelling the payment.

## Checklist before going live

- [ ] The app contains no Paynet username, password, keys or token.
- [ ] The server creates the order; the amount comes from the order on the server.
- [ ] The payment page opens in `SFSafariViewController` / Chrome Custom Tabs, not in a WebView.
- [ ] After payment and after cancelling, the customer returns to the app.
- [ ] The app gets the order status from the server, and the server from the notification or the API.
- [ ] Tapping "Pay" again does not create a second payment for the same order.
