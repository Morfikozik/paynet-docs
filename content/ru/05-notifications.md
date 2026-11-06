# Уведомления (webhooks)

Paynet уведомляет вашу систему, когда платёж оплачен. Уведомление — это HTTP `POST` с JSON-телом на callback URL, который вы сообщили в Paynet. Оно работает одинаково для server-to-server и hosted checkout.

## Запрос

```http
POST https://shop.example/paynet/notification
Content-Type: application/json
Hash: U2LhpObu5hnAshxejSovkQ==
```

```json
{
  "Eventid": 20160622010101,
  "EventType": "PAID",
  "EventDate": "2016-01-01T00:00:00",
  "Payment": {
    "ID": 1234567,
    "ExternalID": 7676766,
    "Merchant": "123123",
    "Customer": "37369XXX111",
    "StatusDate": "2016-01-01T00:00:00",
    "Amount": 123
  }
}
```

## Поля

| Поле | Тип | Описание |
|---|---|---|
| `Eventid` | long | ID уведомления. |
| `EventType` | string | Тип события, `PAID` для оплаченного платежа. Сравнивайте без учёта регистра (в старых документах — `Paid`). |
| `EventDate` | datetime | Когда создано уведомление (ISO 8601). |
| `Payment.ID` | long | ID платежа Paynet (`paymentId`). Используйте как ключ идемпотентности. |
| `Payment.ExternalID` | long | Ваш номер заказа (`Order`). |
| `Payment.Merchant` | string | Ваш код мерчанта. |
| `Payment.Customer` | string | Ссылка на покупателя (может быть замаскирована). |
| `Payment.StatusDate` | datetime | Когда платёж перешёл в этот статус. |
| `Payment.Amount` | long | Сумма в минимальных единицах. |
| `Payment.SaleAreaCode` | string | Код торговой зоны (необязательно). |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer`, `CardLinkHash` | string | Данные карты при оплате картой (необязательно). |
| `Payment.MoneyType` | string | Способ оплаты (необязательно). |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP`, `RRN` | string | Данные плательщика и RRN (необязательно). |
| `Hash` (HTTP-заголовок) | string | Подпись уведомления. |

Неизвестные поля игнорируйте: могут добавиться новые необязательные поля.

## Проверка подписи

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalID + Payment.ID + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( PreparedString + NotificationSecretKey ) )
```

- Берите значения ровно так, как они пришли (как строки). Отсутствующее значение или `null` — пустая строка.
- Порядок фиксированный: поля отсортированы по алфавиту по полному имени.
- Сравните `ExpectedHash` с заголовком `Hash`. Если не совпадает — отклоните запрос (например, HTTP `400`) и не меняйте заказ.

Разобранный пример с ожидаемым результатом: [Подписи](#/guides/signatures).

### Node.js (Express)

```javascript
import crypto from 'node:crypto';
import express from 'express';

const SECRET = process.env.PAYNET_NOTIFICATION_SECRET;
const s = (v) => (v === null || v === undefined ? '' : String(v));

function expectedHash(n) {
  const p = n.Payment || {};
  const prepared = s(n.EventDate) + s(n.Eventid) + s(n.EventType) + s(p.Amount) + s(p.Customer) +
    s(p.ExternalID) + s(p.ID) + s(p.Merchant) + s(p.StatusDate);
  return crypto.createHash('md5').update(prepared + SECRET, 'utf8').digest('base64');
}

const app = express();
app.post('/paynet/notification', express.json(), async (req, res) => {
  const received = req.get('Hash') || '';
  const expected = expectedHash(req.body);
  const ok = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(400).send('Invalid hash');

  // Idempotency: process each Payment.ID only once.
  // await markOrderPaidOnce(req.body.Payment.ID, req.body.Payment.ExternalID, req.body.Payment.Amount);
  res.status(200).json({ ResultCode: 'SUCCESS' });
});
```

### PHP

```php
<?php
$secret = getenv('PAYNET_NOTIFICATION_SECRET');
$body   = file_get_contents('php://input');
$n      = json_decode($body, true);
$p      = $n['Payment'] ?? [];
$s      = fn($v) => $v === null ? '' : (string) $v;

$prepared = $s($n['EventDate'] ?? null) . $s($n['Eventid'] ?? null) . $s($n['EventType'] ?? null)
          . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalID'] ?? null)
          . $s($p['ID'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
$expected = base64_encode(md5($prepared . $secret, true));

if (!hash_equals($expected, $_SERVER['HTTP_HASH'] ?? '')) {
    http_response_code(400);
    exit('Invalid hash');
}
// Process once per Payment.ID, then:
http_response_code(200);
echo json_encode(['ResultCode' => 'SUCCESS']);
```

> **Важно:** собирайте `PreparedString` из значений ровно в том виде, в каком они записаны в JSON. Не переформатируйте даты (оставляйте `2016-01-01T00:00:00` как есть) и не меняйте запись чисел.

## Ответ и повторы

- Отвечайте HTTP `200` **после** того, как проверили хэш и сохранили результат.
- Любой другой статус (или таймаут) считается ошибкой: Paynet повторит уведомление **до 3 раз** и затем остановится.
- Из-за повторов одно и то же уведомление может прийти несколько раз. Обрабатывайте каждый `Payment.ID` один раз.
- Если уведомление не пришло, используйте `GET /api/order/{paymentId}` или `GET /api/order/merchant/{Order}`.

## Тест уведомлений на портале

Откройте **Уведомления (webhooks)** в боковом меню (раздел **Ecommerce**):

1. Введите ваш callback URL (он должен быть доступен из интернета и принимать запросы из браузера — CORS).
2. Введите секретный ключ уведомлений (тест: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Введите номер заказа мерчанта (`Order`) и нажмите **Get** — портал загрузит платёж.
4. Нажмите **Send notification** — портал отправит на ваш URL подписанное уведомление по этому платежу и покажет использованные `PreparedString` и `Hash`.

Это симуляция из вашего браузера, а не настоящее уведомление Paynet.
