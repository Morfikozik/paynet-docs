# FAQ

## Are test and production keys the same?

No. Production credentials and both secret keys (for the checkout form and for notifications) differ from the test ones. When going live, replace all values — see the [Go-live checklist](#/guides/go-live).

## How do I get production access?

It is sent to your company administrator's email. This takes from 5 minutes to several days depending on the features you connect.

## The customer returned to the success page, but there is no notification. Is the order paid?

Do not treat an order as paid only because the customer returned to `LinkUrlSuccess`. Wait for a verified `PAID` notification or check the status: `GET /api/order/merchant/{Order}`, `status` = `4` means paid. See [Payment status](#/guides/errors-and-statuses).

## The same notification arrived several times

That is normal: if your server did not answer `200`, Paynet sends the notification again. Process each `Payment.Id` once. See [Notifications](#/guides/notifications).

## A notification never arrived

Check the status with `GET /api/order/merchant/{Order}`. You can ask Paynet support to send the notification again.

## The bank declined the payment. Can the same order be paid again?

No: after a decline the order gets status `5` and is closed. Create a new order with a new `Order`. If the customer simply closed the page without paying, the order stays `1` and can be paid with the same `paymentLink`.

## A repeated `POST /api/order` with the same `Order` returned `500`

With the same `Order` and the same data Paynet returns the same payment. `500 TECHNICAL_ERROR` means the data differs, or the order is already paid or its payment is being processed. See [Repeated order number](#/guides/errors-and-statuses).

## Why is `PaidAmount` lower than `Amount`?

Normally they are equal. `PaidAmount` is lower only with a promotion officially agreed with Paynet (for example, a discount for cards of a certain bank). You receive `PaidAmount` minus the Paynet fee.

## Can I make a second refund of the same payment?

No. One refund per payment is possible: full or partial.

## Why does a refund fail?

Check that no more than 180 days have passed since payment; the payment method is not `CASH_INVOICE`; the payment has not been refunded yet; the amount is not above `PaidAmount`; there is money on the merchant's Paynet account. See [Refunds](#/guides/errors-and-statuses).

## Why does the order expire earlier than intended?

`ExpiryDate` is in Chișinău local time (`Europe/Chisinau`). If your server runs in UTC, convert the time, otherwise the order expires 2–3 hours early.

## The signature does not match

Check that the string is encoded in UTF-8; the right key is used (the checkout form and notifications have different keys); values are taken exactly as they appear in the JSON. Compare your code with the [test vectors](#/guides/signatures).

## Do I need CORS for notifications?

No. CORS is needed only by the notification simulator on this portal, because it posts from the browser. Real notifications are sent by the Paynet server.

## Why is `CardLinkHash` `null` in the notification?

Card saving is not enabled for your `SaleAreaCode`, the order had no `Customer`, or the customer unchecked "save card". See [Saved cards](#/guides/saved-cards).
