# Сохранение карт

Покупатель может сохранить карту при первой оплате, а в следующий раз выбрать её на странице Paynet, не вводя номер заново.

Работает только при [интеграции server-to-server](#/guides/server-to-server). В форме hosted checkout сохранение карт недоступно.

> **Важно:** это не списание без участия покупателя. Покупатель всегда проходит через страницу Paynet и подтверждает оплату. Paynet может запросить CVC или 3-D Secure — это зависит от настроек вашего магазина на стороне Paynet.

## Подключение

Сохранение карт включается для вашего `SaleAreaCode` на стороне Paynet: обратитесь к вашему менеджеру Paynet. В тестовой среде оно включено для `onlidocumentation_md`.

## Как это работает

| Шаг | Кто | Что происходит |
|---|---|---|
| 1 | Вы | Создаёте заказ `POST /api/order` и передаёте объект `Customer`. Без `Customer` карта не сохраняется. |
| 2 | Покупатель | Оплачивает картой на странице Paynet. Галочка «сохранить карту» стоит по умолчанию; покупатель может её снять. |
| 3 | Paynet | Присылает уведомление `PAID` с `Payment.CardLinkHash`. Если покупатель снял галочку, там `null`. |
| 4 | Вы | Сохраняете `CardLinkHash` вместе с этим покупателем (его `Customer.Code`). |
| 5 | Вы | При следующей оплате передаёте в `POST /api/order` поле `CardLinkHash` и те же данные `Customer`. |
| 6 | Покупатель | Видит на странице Paynet сохранённую карту и подтверждает оплату. |

## Первая оплата

Обычный запрос [создания заказа](#/guides/server-to-server) с объектом `Customer`:

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
  "Lang": "RU"
}
```

После оплаты в уведомлении `PAID` придёт токен:

```json
{
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "CardLinkHash": "1037153_b3f50103610e4fe9948ff8db553151f3"
  }
}
```

(Фрагмент. Полный формат — в разделе [Уведомления](#/guides/notifications).)

## Повторная оплата

Новый заказ с новым `Order`, тем же `Customer` и сохранённым `CardLinkHash`:

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
  "Lang": "RU"
}
```

Дальше всё как обычно: отправьте покупателя по `paymentLink` и дождитесь уведомления `PAID`.

## Правила

- `CardLinkHash` работает только вместе с тем `Customer`, для которого он выдан. Передавайте пару без изменений.
- Токен действует, пока действует карта. Если карта истекла или перевыпущена, покупатель оплачивает новой картой, и вы получаете новый `CardLinkHash` — замените им старый.
- `CardLinkHash` в уведомлении может быть `null` (покупатель снял галочку или сохранение не включено). Это нормально: просто ничего не сохраняйте.
- Храните `CardLinkHash` на сервере и не показывайте его в браузере.
- Чтобы удалить карту (например, по просьбе покупателя), вызовите `POST /api/linked-cards/unlink` с `CardLinkHash`, `SaleAreaCode` и `CustomerCode`.
