# Saved cards

A customer can save their card during the first payment and next time choose it on the Paynet page without typing the card number again.

This works only with the [server-to-server integration](#/guides/server-to-server). Card saving is not available in the hosted checkout form.

> **Important:** this is not a charge without the customer. The customer always goes through the Paynet page and confirms the payment. Paynet may ask for the CVC or 3-D Secure — this depends on your shop's settings on the Paynet side.

## Enabling

Card saving is enabled for your `SaleAreaCode` on the Paynet side: contact your Paynet manager. It is enabled for the shared test sale area `onlidocumentation_md`: you can try the flow with the test credentials.

## What `CardLinkHash` is

- Paynet's internal identifier of a saved card. It is not the card number and not a Visa/Mastercard network token.
- It is bound to the `SaleAreaCode` (which belongs to one merchant) and to the customer's `Customer.Code`.
- It does not work in another sale area, even of the same merchant — unless Paynet has grouped those sale areas on its side.

## How it works

| Step | Who | What happens |
|---|---|---|
| 1 | You | Create an order with `POST /api/order` and send the `Customer` object. Without `Customer` the card is not saved. |
| 2 | Customer | Pays by card on the Paynet page. The "save card" checkbox is checked by default; the customer can uncheck it. |
| 3 | Paynet | Sends the `PAID` notification with `Payment.CardLinkHash`. If the customer unchecked the box, it is `null`. |
| 4 | You | Store `CardLinkHash` together with this customer (their `Customer.Code`). |
| 5 | You | On the next payment send `CardLinkHash` and the same `Customer` data in `POST /api/order`. |
| 6 | Customer | Sees the saved card on the Paynet page and confirms the payment. |

## First payment

A regular [create order](#/guides/server-to-server) request with the `Customer` object:

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
    { "Name": "Demo eShop", "Description": "Order #1762444800000", "Amount": 300 }
  ],
  "MoneyType": "Card",
  "Lang": "EN"
}
```

After payment the `PAID` notification carries the token:

```json
{
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "CardLinkHash": "1037153_b3f50103610e4fe9948ff8db553151f3"
  }
}
```

(Fragment. The full format is in [Notifications](#/guides/notifications).)

## Next payment

A new order with a new `Order`, the same `Customer` and the saved `CardLinkHash`:

```json
{
  "Order": 1762531200000,
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
  "CardLinkHash": "1037153_b3f50103610e4fe9948ff8db553151f3",
  "Currency": 498,
  "ExpiryDate": "2026-12-31T23:59:59",
  "Services": [
    { "Name": "Demo eShop", "Description": "Order #1762531200000", "Amount": 300 }
  ],
  "MoneyType": "Card",
  "Lang": "EN"
}
```

The rest is as usual: send the customer to `paymentLink` and wait for the `PAID` notification.

## Checked on the test environment

| Situation | What happens |
|---|---|
| First payment with `Customer`, checkbox kept | `CardLinkHash` arrives in the notification and in the `GET /api/order/merchant/{Order}` response (`cardLinkHash` and `customer.cardLinkHash`) |
| Next payment: same `Customer` + `CardLinkHash` | The Paynet page shows the saved card (mask and expiry date). The customer can choose it, enter another card or delete the saved one |
| Another `Customer.Code` + the same `CardLinkHash` | The order is created (`200`), but the saved card is **not shown** — the customer enters a card again |
| Unknown `CardLinkHash` | The order is created (`200`), the payment page is the usual one |

The API does not reject an unsuitable token when the order is created: the protection works on the payment page. So keep each token strictly paired with the customer it was issued for.

## Rules

- `CardLinkHash` works only together with the `Customer` it was issued for. Send the pair unchanged.
- `CardLinkHash` is not covered by the notification signature. Before storing it, confirm the payment and the customer with the API — see [What the signature protects](#/guides/notifications).
- The token is valid as long as the card is. If the card expired or was reissued, the customer pays with the new card and you receive a new `CardLinkHash` — replace the old one.
- `CardLinkHash` in a notification may be `null` (the customer unchecked the box, or saving is not enabled). That is normal: just store nothing.
- Keep `CardLinkHash` on your server and never expose it in the browser.
- To delete a card (for example, at the customer's request), call `POST /api/linked-cards/unlink` with `CardLinkHash`, `SaleAreaCode` and `CustomerCode`.
