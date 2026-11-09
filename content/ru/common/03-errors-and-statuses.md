# Ошибки и статусы

## HTTP-коды

| HTTP | `code` | Значение | Что делать |
|---|---|---|---|
| `200` | — | Успех. | — |
| `400` | `INVALID_PARAMETER` | Один или несколько параметров отсутствуют или неверны. `details` называет параметр. | Исправьте запрос. Не повторяйте без изменений. |
| `401` | `UNAUTHORIZED` | Bearer-токен отсутствует, неверен или истёк. | Снова вызовите `/auth` и повторите запрос один раз. |
| `404` | `NOT_FOUND_RECORD` | Нет платежа/записи с таким ID. | Проверьте ID (`paymentId` или ваш `Order`). |
| `500` | `TECHNICAL_ERROR` | Ошибка на стороне Paynet **или** повтор `Order`, который нельзя использовать снова (см. ниже). | Проверьте через `GET /api/order/merchant/{Order}`, существует ли заказ; если это настоящая техническая ошибка — повторите позже с паузой. |
| `500` | `AUTHENTICATION_FAILED` | `/auth` с неверным логином или паролем. | Проверьте учётные данные. |

## Тело ошибки

```json
{
  "status": 400,
  "message": "One or more entered parameters are incorrect.",
  "code": "INVALID_PARAMETER",
  "traceId": "9b9346f9-f83a-465d-ac8d-dc382c460c22",
  "details": "The invalid parameter is: XXXX"
}
```

| Поле | Описание |
|---|---|
| `status` | HTTP-статус. |
| `message` | Сообщение для человека. |
| `code` | Машиночитаемый код ошибки (таблица выше). |
| `traceId` | ID запроса. Передайте его в поддержку Paynet, когда сообщаете о проблеме. |
| `details` | Дополнительная информация, например неверный параметр. |

> **Примечание:** ответы `401` используют ключи с большой буквы (`Status`, `Message`, `Code`, `TraceId`). Читайте поля ошибки без учёта регистра. `/auth` может вернуть объект ошибки внутри массива.

### Неверный JSON или нет обязательных полей

Если тело запроса нельзя прочитать (неверный JSON, неверные типы, нет обязательного поля), API отвечает `400` в другом формате — ошибка внутри `errorInfo`:

```json
{
  "errorInfo": {
    "title": "One or more validation errors occurred.",
    "status": 400,
    "ppResponseCodeEnum": "TECHNICAL_ERROR",
    "ppResponseCode": 1,
    "ppResponseCodeText": "TECHNICAL_ERROR",
    "errors": {
      "$": ["JSON deserialization for type '…DeleteLinkedCardRequest' was missing required properties including: 'cardLinkHash', 'saleAreaCode', 'customerCode'."]
    },
    "traceId": "00-7c209d88f31e3e5cd2f7bd88ae2f23c2-ad167338e418068c-00"
  }
}
```

`errors` перечисляет проблемные поля. Обрабатывайте оба формата ошибок: сначала проверьте наличие `errorInfo`, затем читайте `status` / `code` / `message`.

Названия полей в запросе не чувствительны к регистру: принимаются и `CardLinkHash`, и `cardLinkHash` (проверено на тестовом API). Используйте написание из примеров.

## Повтор номера заказа (Order)

| Ситуация | Результат |
|---|---|
| Новый `Order` | Создаётся новый платёж. |
| Тот же `Order`, **те же данные**, платёж ещё не оплачен | Возвращаются тот же `paymentId` и `paymentLink`. Повтор безопасен, например после таймаута. |
| Тот же `Order`, **другие данные** (сумма, товары, …) | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. |
| Тот же `Order`, платёж уже оплачен или в обработке у банка-эмитента | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. Hosted checkout: покупатель видит страницу Paynet «Plata a fost respinsă» (счёт уже оплачен или в обработке). |

Тело ошибки в этих случаях:

```json
{
  "status": 500,
  "message": "One or more errors occurred.",
  "code": "TECHNICAL_ERROR",
  "traceId": "11de6054-87ef-484d-a368-7cfae0b452ff",
  "details": "Please verify the transmitted data and try again, or contact support."
}
```

**Правило:** один заказ в магазине = один `Order`. Если покупатель изменил корзину, создайте новый заказ с новым `Order`.

## Статус платежа

Объект платежа (`POST /api/order`, `GET /api/order/{id}`, `GET /api/order/merchant/{id}`, `GET /api/order/search`) содержит числовой `status` и даты `registered`, `paidDate`, `expiryDate`.

У только что созданного заказа `status` = `1`, а `paidDate` = `null`.

> **Черновик:** описание всех значений `status` будет опубликовано позже. До тех пор считайте платёж оплаченным, если получили проверенное уведомление `PAID` или заполнен `paidDate`.

Неуспешная оплата не порождает уведомление: покупатель перенаправляется на `LinkUrlCancel`, а заказ остаётся неоплаченным до истечения `ExpiryDate`.

## Даты и форматы

| Где | Формат | Пример |
|---|---|---|
| `ExpiryDate` в запросах | `YYYY-MM-DDTHH:mm:ss`, **местное время Кишинёва** | `2026-12-31T23:59:59` |
| Даты в ответах о платеже | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
| Даты в уведомлениях | `YYYY-MM-DDTHH:mm:ss`, местное время Кишинёва | `2026-11-09T12:00:00` |
| `from` / `to` в `/api/order/search` | дата-время ISO 8601 | `2026-03-09T06:40:05.010Z` |
| `dateStart` / `dateFinish` в выписках | дата | `2026-03-01` |
| Суммы | целое, минимальные единицы | `1201` = 12,01 MDL |
| Валюта | числовой ISO 4217 | `498` = MDL |

Местное время Кишинёва — часовой пояс `Europe/Chisinau`: UTC+2 зимой, UTC+3 летом. Если сервер работает в UTC, переводите время перед формированием `ExpiryDate`, иначе заказы будут истекать на 2–3 часа раньше задуманного.

## Возвраты

`POST /api/order/refund`:

```json
{
  "PaymentId": 296901,
  "SaleAreaCode": "onlidocumentation_md",
  "RefundType": "full",
  "Amount": 50000,
  "Currency": 498,
  "Reason": "Customer request"
}
```

- `RefundType`: `full` или `partial`.
- `Amount` в минимальных единицах; для `partial` — сумма к возврату.
- Вернуть можно только оплаченный платёж.
