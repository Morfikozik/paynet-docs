# Server-to-server интеграция

В этой модели ваш бэкенд напрямую работает с API Paynet. Это рекомендуемый вариант для магазинов с собственным бэкендом.

## Обзор

1. `POST /auth` → получить токен доступа.
2. `POST /api/order` → зарегистрировать заказ, получить `paymentId` и `paymentLink`.
3. Перенаправить покупателя на `paymentLink`.
4. Принять [уведомление](#/guides/notifications) на callback URL и проверить его `Hash`.
5. Подтвердить через `GET /api/order/{paymentId}` и выполнить заказ.

Базовый URL: `https://ecom-api-test.paynet.md` (тест), `https://ecom-api.paynet.md` (прод). Все тела запросов — JSON (`Content-Type: application/json`).

## 1. Аутентификация

```http
POST /auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

```json
{ "access_token": "Ccxl7QQiMEoakkrUoiUn8PIg…", "token_type": "bearer", "expires_in": 14399 }
```

Передавайте токен во всех остальных запросах: `Authorization: Bearer <access_token>`. `expires_in` указан в секундах (около 4 часов). Кэшируйте токен и запрашивайте новый, когда он истёк или API вернул `401`.

Неверные учётные данные возвращают ошибку с `code` `AUTHENTICATION_FAILED`.

## 2. Создание заказа

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

### Поля запроса

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `Order` | integer (int64) | да | Номер заказа у вас. Один заказ магазина = один `Order` (см. [повтор номера заказа](#/guides/errors-and-statuses)). |
| `SaleAreaCode` | string | да | Код торговой зоны (сайта), выданный Paynet. |
| `LinkUrlSuccess` | string | да | Куда покупатель вернётся после успешной оплаты. |
| `LinkUrlCancel` | string | да | Куда покупатель вернётся после отмены. |
| `Currency` | integer | да | Числовой код ISO 4217. `498` = MDL. |
| `ExpiryDate` | string | да | Срок оплаты, `YYYY-MM-DDTHH:mm:ss`, местное время Кишинёва (`Europe/Chisinau`), в будущем. |
| `Services` | array | да | Минимум одна услуга, см. ниже. |
| `MoneyType` | string | да | `All`, `Card`, `Paynet`, `MIA` или `CashInvoice` (см. ниже). |
| `Lang` | string | да | Язык платёжной страницы: `RO`, `RU` или `EN`. |
| `Customer` | object | нет | Данные покупателя. Обязателен, чтобы [сохранить карту](#/guides/saved-cards) или оплатить сохранённой картой. |
| `Customer.Code` | string | да, если передан `Customer` | ID покупателя в вашей системе. |
| `Customer.NameFirst`, `NameLast`, `email`, `PhoneNumber` | string | нет | Данные покупателя. Обратите внимание: `email` с маленькой буквы. Если не передать `PhoneNumber`, покупателю придётся ввести телефон на платёжной странице (блок «Billing information»). Передавайте данные покупателя, если они у вас есть, — тогда покупателю не нужно вводить их самому. |
| `CardLinkHash` | string | нет | Токен сохранённой карты этого покупателя, полученный в уведомлении. Передавайте вместе с тем же `Customer`. См. [Сохранение карт](#/guides/saved-cards). |

`Services[]`:

| Поле | Тип | Обязательно | Описание |
|---|---|---|---|
| `Name` | string | да | Название услуги. |
| `Description` | string | да | Описание услуги. |
| `Amount` | integer | да | Сумма услуги в минимальных единицах. |
| `Products` | array | нет | Необязательно. Если передаёте товары, у каждого товара обязательны шесть полей (см. ниже). |

`Services[].Products[]` — обязательные: `LineNo` (int), `Name` (string), `UnitPrice` (int), `Quantity` (int), `Amount` (int), `TotalAmount` (int). Необязательные: `Code` (string), `Description` (string). Проверено на тестовой среде: без любого из шести обязательных полей API отвечает `400`.

**`Quantity` — в сотых долях:** `100` = 1 шт., `300` = 3 шт. В примере выше `"Quantity": 300` — это 3 шт. по `UnitPrice` 1,00 MDL.

**Суммы** — целые числа в минимальных единицах (бани): `1201` = 12,01 MDL.

**MoneyType** определяет, какие способы оплаты увидит покупатель:

| `MoneyType` | Покупатель видит |
|---|---|
| `All` | все способы, подключённые мерчанту |
| `Card` | карта (Visa/Mastercard), Apple Pay, Google Pay |
| `Paynet` | кошелёк Paynet |
| `MIA` | мгновенные платежи MIA |
| `CashInvoice` | оплата наличными по счёту |

Отдельного значения для Apple Pay и Google Pay нет: они показываются и при `Card`, и при `All`. Чем покупатель заплатил на самом деле, сообщает уведомление (`CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`).

### Ответ

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

(Ответ тестовой среды, сокращён. После оплаты `status` = `4`, заполнены `paidDate` и `amount.paidAmount`. Полный ответ также содержит `customer`, `payer`, `services`, `cardLinkHash`, `signature`, `linkUrlSuccess`, `linkUrlCancel`.)

Сохраните `paymentId` вместе с заказом: это ключ для проверки статуса, возвратов и уведомлений.

**Повтор запроса.** Если отправить тот же `Order` с теми же данными (пока он не оплачен), вернутся тот же `paymentId` и `paymentLink` — повтор после таймаута безопасен. Тот же `Order` с другими данными или после оплаты даёт `500 TECHNICAL_ERROR`. Если корзина изменилась, используйте новый `Order`.

«Те же данные» значит буквально тот же запрос. Сохраните тело запроса вместе с заказом и при повторе отправляйте его без изменений: например, пересчитанный `ExpiryDate` — это уже другие данные.

## 3. Перенаправьте покупателя

Отправьте браузер покупателя на `paymentLink` (HTTP 302 или ссылка/кнопка). Сохраните эту ссылку вместе с заказом: полная ссылка есть только в ответе на `POST /api/order`, в ответах `GET /api/order/…` она сокращена, без номера платежа. После успешной оплаты покупатель вернётся на `LinkUrlSuccess`, а если оплата не прошла или отменена — на `LinkUrlCancel`.

## 4. Обработайте уведомление

Когда платёж оплачен, Paynet отправляет подписанный `POST` на ваш callback URL (`EventType` = `PAID`; о неуспешных платежах уведомлений нет). Проверьте заголовок `Hash`, сверьте `PaidAmount` с `Amount` и ответьте HTTP `200`. См. [Уведомления](#/guides/notifications).

## 5. Проверьте статус

```http
GET /api/order/{paymentId}
GET /api/order/merchant/{Order}
Authorization: Bearer <access_token>
```

Оба запроса возвращают один и тот же объект платежа. Используйте их перед отгрузкой и если уведомление не пришло. См. [Ошибки и статусы](#/guides/errors-and-statuses).

## Другие операции

| Операция | Запрос | Примечание |
|---|---|---|
| Поиск платежей | `GET /api/order/search?from=…&to=…` | Дата-время **по Кишинёву** без `Z`, например `2026-03-09T08:40:05`. Пометку UTC (`Z`) API не учитывает: время в UTC сдвинет период на 2–3 часа, и свежие платежи не попадут в результат. Если за период нет платежей, API отвечает `404 NOT_FOUND_RECORD` — это пустой результат, а не ошибка. |
| Возврат | `POST /api/order/refund` | Тело: `PaymentId`, `SaleAreaCode`, `RefundType` (`full` или `partial`), `Amount`, `Currency`, `Reason`. |
| Удалить сохранённую карту | `POST /api/linked-cards/unlink` | Тело: `CardLinkHash`, `SaleAreaCode`, `CustomerCode`. |
| Выписка | `GET /api/statement?dateStart=…&dateFinish=…` | Даты вида `2026-03-01`. Необязательный `accountId`. |
| Выписка (Excel) | `GET /api/statement/download?dateStart=…&dateFinish=…` | Возвращает файл `.xlsx`. Период не более 31 дня. |

## Пример: Node.js (18+)

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

## Пример: PHP

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
