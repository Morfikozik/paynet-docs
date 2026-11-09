# Уведомления (webhooks)

Когда платёж оплачен, Paynet отправляет HTTP `POST` с JSON-телом на callback URL, который вы зарегистрировали в Paynet. Уведомление одинаковое для всех типов интеграции.

**Уведомления приходят только об успешных платежах.** `EventType` всегда `PAID`. Если оплата не прошла, Paynet уведомление не отправляет — покупатель просто перенаправляется на ваш `LinkUrlCancel`. Считайте заказ неоплаченным, пока не получили проверенное уведомление `PAID` (или API статуса не показал оплату), и брошенным после его `ExpiryDate`.

## Запрос

```http
POST https://shop.example/paynet/notification
Content-Type: application/json; charset=utf-8
Hash: lq3+OCn0J/zSyNF5iAoShg==
```

```json
{
  "Eventid": 1000001,
  "EventType": "PAID",
  "Message": "Request processed successfully",
  "EventDate": "2026-11-09T12:00:00",
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "SaleAreaCode": "onlidocumentation_md",
    "Customer": "37369XXX111",
    "StatusDate": "2026-11-09T12:00:00",
    "Amount": 1235,
    "PaidAmount": 1235,
    "Merchant": "265505",
    "CardMask": "411111******1111",
    "CardExpireMonth": "12",
    "CardExpireYear": "27",
    "CardIssuer": "TEST BANK",
    "CardLinkHash": null,
    "MoneyType": "CARD",
    "PayerName": "Ion",
    "PayerSurname": "Popescu",
    "PayerIDNP": null,
    "RRN": "000000000000"
  }
}
```

У запроса только два заголовка: `Content-Type` и `Hash`. Заголовка `Authorization` нет — подлинность подтверждает `Hash`.

## Поля

> **Важно:** в большинстве языков ключи JSON чувствительны к регистру. Ключи называются `Id` и `ExternalId` (не `ID` / `ExternalID`).

| Поле | Тип | Описание |
|---|---|---|
| `Eventid` | long | ID уведомления. |
| `EventType` | string | Всегда `PAID`. |
| `Message` | string | Текстовый статус, например `Request processed successfully`. |
| `EventDate` | string | Когда создано уведомление, `YYYY-MM-DDTHH:mm:ss`, местное время Кишинёва. |
| `Payment.Id` | long | ID платежа Paynet (`paymentId`). Используйте как ключ идемпотентности. |
| `Payment.ExternalId` | long | Ваш номер заказа (`Order`). |
| `Payment.SaleAreaCode` | string | Код торговой зоны. |
| `Payment.Customer` | string | Ссылка на покупателя, может быть замаскирована. |
| `Payment.StatusDate` | string | Когда платёж перешёл в этот статус (местное время Кишинёва). |
| `Payment.Amount` | long | Сумма заказа в минимальных единицах, как вы её передали. |
| `Payment.PaidAmount` | long | Фактически оплаченная покупателем сумма, в минимальных единицах. См. ниже. |
| `Payment.Merchant` | string | Ваш код мерчанта. |
| `Payment.MoneyType` | string | Чем заплатил покупатель: `CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`. |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer` | string | Данные карты при оплате картой; могут быть `null`. |
| `Payment.CardLinkHash` | string | Хэш сохранённой карты; может быть `null`. |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP` | string | Данные плательщика; могут быть `null`. |
| `Payment.RRN` | string | Retrieval reference number. |
| `Hash` (HTTP-заголовок) | string | Подпись уведомления. |

Неизвестные поля игнорируйте: могут добавиться новые необязательные поля.

Значения `MoneyType` в уведомлении не совпадают со значениями в запросе на создание заказа (`Card`, `All`, …). Не сравнивайте их напрямую.

### Amount и PaidAmount

`PaidAmount` должен совпадать с `Amount`.

Они могут различаться **только** если ваша компания официально согласовала с Paynet акцию или скидку (например, 10% при оплате картой Mastercard определённого BIN). Такую акцию Paynet настраивает на своей стороне по вашему запросу, через API её включить нельзя.

> **Важно:** если у вас нет такой согласованной акции, а `PaidAmount` не равен `Amount`, не выполняйте заказ автоматически. Сохраните уведомление и свяжитесь с Paynet.

Расчёты: вы получаете `PaidAmount` за вычетом комиссии Paynet. Учитывайте это при сверке с выпиской.

## Проверка подписи

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalId + Payment.Id + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( UTF8( PreparedString + NotificationSecretKey ) ) )
```

- Берите значения ровно так, как они записаны в JSON. Отсутствующее значение или `null` — пустая строка.
- Порядок фиксированный: 9 полей выше, отсортированные по алфавиту по полному имени.
- Используйте секретный ключ **уведомлений** (он отличается от ключа checkout).
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
    s(p.ExternalId) + s(p.Id) + s(p.Merchant) + s(p.StatusDate);
  return crypto.createHash('md5').update(prepared + SECRET, 'utf8').digest('base64');
}

const app = express();
app.post('/paynet/notification', express.json(), async (req, res) => {
  const received = req.get('Hash') || '';
  const expected = expectedHash(req.body);
  const ok = received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.status(400).send('Invalid hash');

  const p = req.body.Payment;
  // Process each Payment.Id only once (idempotency).
  // If PaidAmount !== Amount and you have no agreed promotion: do not fulfil, contact Paynet.
  // await markOrderPaidOnce(p.Id, p.ExternalId, p.Amount, p.PaidAmount);
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
          . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalId'] ?? null)
          . $s($p['Id'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
$expected = base64_encode(md5($prepared . $secret, true));

if (!hash_equals($expected, $_SERVER['HTTP_HASH'] ?? '')) {
    http_response_code(400);
    exit('Invalid hash');
}
// Process once per Payment.Id; check PaidAmount === Amount (unless a promotion is agreed), then:
http_response_code(200);
echo json_encode(['ResultCode' => 'SUCCESS']);
```

> **Важно:** собирайте `PreparedString` из значений ровно в том виде, в каком они записаны в JSON. Не переформатируйте даты (оставляйте `2026-11-09T12:00:00` как есть) и не меняйте запись чисел.

## Ответ и повторы

- Отвечайте HTTP `200` **после** того, как проверили хэш и сохранили результат.
- Любой другой статус (или таймаут) считается ошибкой: Paynet повторит уведомление **до 3 раз** и затем остановится.
- Из-за повторов одно и то же уведомление может прийти несколько раз. Обрабатывайте каждый `Payment.Id` один раз.
- Если уведомление не пришло, используйте `GET /api/order/{paymentId}` или `GET /api/order/merchant/{Order}`.

## Симулятор уведомлений на портале

Откройте **Общее → Уведомления → Симулятор уведомлений**:

1. Введите ваш callback URL (он должен быть доступен из интернета и принимать запросы из браузера — CORS).
2. Введите секретный ключ уведомлений (тест: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Введите номер заказа мерчанта (`Order`) **оплаченного** тестового платежа и нажмите **Get** — портал загрузит платёж.
4. Нажмите **Send notification** — портал отправит на ваш URL подписанное уведомление `PAID` по этому платежу и покажет использованные `PreparedString` и `Hash`.

Это симуляция из вашего браузера, а не настоящее уведомление Paynet. Для неоплаченных заказов симулятор ничего не отправляет — так же, как Paynet.
