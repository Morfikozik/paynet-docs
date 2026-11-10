# E-commerce: integration options

Paynet e-commerce lets your online shop accept payments by card (including Apple Pay and Google Pay), Paynet wallet, MIA instant payments and cash invoice. There are three ways to integrate. All of them end on the same Paynet-hosted payment page, so you never collect card data yourself.

| | Server-to-server API | Hosted checkout (client-server) | Ready-made plugins |
|---|---|---|---|
| How the order reaches Paynet | your **backend** calls `POST /api/order` with a Bearer token | the customer's **browser** posts a signed HTML form to Paynet | the plugin does it for you |
| What protects the request | access token (`/auth`) | `Signature` = MD5 + Base64 with your secret key | plugin settings |
| What you get back | `paymentId` + `paymentLink` in JSON | the customer lands directly on the payment page | — |
| Status checks, refunds, statements | yes, same API | yes, via the server-to-server API (orders are found by your `Order`) | depends on plugin |
| Best for | custom shops and apps with a backend | simple sites, quick start without an API client | WordPress/WooCommerce, OpenCart, PrestaShop, Magento, CS-Cart, Shopify |

## How to choose

- **You have a backend and want full control** → [Server-to-server integration](#/guides/server-to-server). This is the most flexible option and gives you the `paymentId` immediately.
- **You only need a "Pay" button and do not want to call an API to create orders** → [Hosted checkout](#/guides/hosted-checkout). You still need a backend to compute the signature, because the secret key must never be in browser code.
- **You want less code** → ready-made [SDKs for PHP and Node.js](#/guides/sdk): authorization, refund rules, signatures and errors are already done.
- **You have a mobile app** → payments go through your server and the Paynet page, see [Mobile apps](#/guides/mobile-apps).
- **Your shop runs on a supported CMS** → download a plugin from [**Plugins**](#/page/plugins). Shopify is connected through Cybersource.

## What every integration needs

1. **A callback URL** for [notifications](#/guides/notifications). Paynet calls it when a payment is paid (only successful payments are notified). Send this URL to Paynet.
2. **Signature verification** of every notification, see [Signatures](#/guides/signatures).
3. **A status check** before you ship goods: `GET /api/order/{paymentId}` or `GET /api/order/merchant/{order}`.
4. **Unique order numbers** (`Order`) on your side: one shop order = one `Order`.
5. **Two secret keys** from Paynet: one for the hosted checkout signature, one for notifications.

## Common flow

```text
Customer        Your shop (backend)                 Paynet
   |  checkout   |                                     |
   |-----------> | 1. create order (API or signed form)|
   |             |------------------------------------>|
   | 2. redirect to payment page                       |
   |-------------------------------------------------->|
   |              3. customer pays on Paynet page       |
   |<--------------------------------------------------|
   | 4. back to LinkUrlSuccess / LinkUrlCancel          |
   |             | 5. notification (POST, Hash header) |
   |             |<------------------------------------|
   |             | 6. verify Hash, check status, ship   |
```

The redirect back to `LinkUrlSuccess` is only a user-interface step. **Do not mark an order as paid because the customer came back to the success page.** Rely on the notification and/or the status API.

If the payment fails, the customer is redirected to `LinkUrlCancel`. Paynet does not send a notification for failed payments.
