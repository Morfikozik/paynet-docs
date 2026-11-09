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
| `Payment.Customer` | string | Код покупателя, который вы передали в заказе (`Customer.Code`), обычно замаскирован, например `37369XXX111` или `name***@gmail.com`. |
| `Payment.StatusDate` | string | Когда платёж перешёл в этот статус (местное время Кишинёва). |
| `Payment.Amount` | long | Сумма заказа в минимальных единицах, как вы её передали. |
| `Payment.PaidAmount` | long | Фактически оплаченная покупателем сумма, в минимальных единицах. См. ниже. |
| `Payment.Merchant` | string | Ваш код мерчанта. |
| `Payment.MoneyType` | string | Чем заплатил покупатель: `CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`. |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer` | string | Данные карты. Заполнены для `CARD`, а также для `APPLEPAY` и `GOOGLEPAY` (карта внутри кошелька); `null` для других способов оплаты. |
| `Payment.CardLinkHash` | string | Токен сохранённой карты: приходит, если для вашего `SaleAreaCode` включено [сохранение карт](#/guides/saved-cards) и покупатель не снял галочку; иначе `null`. |
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
- Порядок фиксированный — ровно как в строке выше. **Не сортируйте имена программно:** обычная сортировка ставит `EventType` перед `Eventid`, и хэш не совпадёт.
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

## Что защищает подпись и сверка через API

Заголовок `Hash` защищает только поля, которые входят в `PreparedString`:

| Подписаны (проверяются через `Hash`) | Не подписаны |
|---|---|
| `EventDate`, `Eventid`, `EventType`, `Payment.Amount`, `Payment.Customer`, `Payment.ExternalId`, `Payment.Id`, `Payment.Merchant`, `Payment.StatusDate` | `Payment.PaidAmount`, `Payment.MoneyType`, `Payment.CardLinkHash`, `Payment.SaleAreaCode`, данные карты и плательщика (`CardMask`, `CardIssuer`, `PayerName`…), `Message` |

Верный `Hash` подтверждает, что заказ `ExternalId` оплачен на сумму `Amount`. Он **не** подтверждает неподписанные поля. Прежде чем принимать по ним решения — какую сумму считать полученной, сохранять ли карту — сверьте их с ответом авторизованного API `GET /api/order/merchant/{Order}`. Этот ответ защищён вашим токеном и HTTPS.

Сравнивайте значения, а не просто вызывайте метод:

| Что сверить | Уведомление | Ответ API |
|---|---|---|
| Платёж | `Payment.Id` | `paymentId` |
| Статус | `EventType` = `PAID` | `status` = `4` |
| Сумма заказа | `Payment.Amount` (и ваша сумма заказа) | `amount.amount` |
| Оплаченная сумма | `Payment.PaidAmount` | `amount.paidAmount` |
| Покупатель | ваш заказ | `customer.code` |
| Сохранённая карта | `Payment.CardLinkHash` | `cardLinkHash`, если API его вернул |

Если значения различаются, не выполняйте заказ автоматически и не сохраняйте карту: отправьте заказ на ручную проверку.

Если подпись верна, но заказ выполнить нельзя (заказ не найден, суммы не совпадают), всё равно ответьте `200` и отправьте заказ на проверку: иначе Paynet продолжит повторять уведомление.

### Node.js

```javascript
// After the Hash check: store the notification, answer 200, then confirm with the API.
const API = process.env.PAYNET_API_URL; // production https://ecom-api.paynet.md, test https://ecom-api-test.paynet.md

async function confirmWithApi(notification, token, myOrder) {
  const p = notification.Payment;
  const response = await fetch(`${API}/api/order/merchant/${p.ExternalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Status check failed: HTTP ${response.status}`);
  const payment = await response.json();

  const problems = [];
  if (payment.paymentId !== p.Id) problems.push('paymentId');
  if (payment.status !== 4) problems.push('status');
  if (payment.amount.amount !== p.Amount || p.Amount !== myOrder.amount) problems.push('Amount');
  if (payment.amount.paidAmount !== p.PaidAmount) problems.push('PaidAmount');
  if (payment.customer?.code !== myOrder.customerCode) problems.push('customer');
  if (p.CardLinkHash && payment.cardLinkHash && payment.cardLinkHash !== p.CardLinkHash) problems.push('CardLinkHash');
  return { ok: problems.length === 0, problems, payment };
}

// In the notification handler, after the Hash check:
//   await saveNotificationOnce(p.Id, req.body);   // idempotent by Payment.Id
//   res.status(200).json({ ResultCode: 'SUCCESS' });
//   const check = await confirmWithApi(req.body, await getToken(), await loadOrder(p.ExternalId));
//   if (check.ok) {
//     if (p.PaidAmount === p.Amount /* or an agreed promotion */) await fulfil(p.ExternalId);
//     if (p.CardLinkHash) await saveCard(check.payment.customer.code, p.CardLinkHash);
//   } else {
//     await sendToManualReview(p.ExternalId, check.problems); // do not fulfil automatically
//   }
```

### PHP

```php
<?php
// After the Hash check: store the notification, answer 200, then confirm with the API.
function confirmWithApi(array $n, string $token, array $myOrder): array {
    $api = getenv('PAYNET_API_URL'); // production https://ecom-api.paynet.md, test https://ecom-api-test.paynet.md
    $p   = $n['Payment'];
    $ch  = curl_init($api . '/api/order/merchant/' . $p['ExternalId']);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token],
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200) throw new RuntimeException("Status check failed: HTTP $code");
    $pay = json_decode($body, true);

    $problems = [];
    if ($pay['paymentId'] !== $p['Id']) $problems[] = 'paymentId';
    if ($pay['status'] !== 4) $problems[] = 'status';
    if ($pay['amount']['amount'] !== $p['Amount'] || $p['Amount'] !== $myOrder['amount']) $problems[] = 'Amount';
    if ($pay['amount']['paidAmount'] !== $p['PaidAmount']) $problems[] = 'PaidAmount';
    if (($pay['customer']['code'] ?? null) !== $myOrder['customerCode']) $problems[] = 'customer';
    if (!empty($p['CardLinkHash']) && !empty($pay['cardLinkHash']) && $pay['cardLinkHash'] !== $p['CardLinkHash']) $problems[] = 'CardLinkHash';
    return ['ok' => !$problems, 'problems' => $problems, 'payment' => $pay];
}
// If 'ok' is false: do not fulfil automatically, send the order to manual review.
```

## Ответ и повторы

- Отвечайте HTTP `200` **после** того, как проверили хэш и сохранили результат.
- Отвечайте быстро: сохраните уведомление, верните `200`, а тяжёлую обработку выполняйте после ответа.
- Любой другой ответ (или отсутствие ответа) считается ошибкой, и Paynet отправляет уведомление повторно. Пример из реального лога: 7 попыток примерно за 9 минут, двумя сериями, после чего отправка прекратилась. Точное расписание не гарантируется — не полагайтесь на него.
- Из-за повторов одно и то же уведомление может прийти несколько раз. Обрабатывайте каждый `Payment.Id` один раз.
- Если уведомление не пришло (например, сервер был недоступен дольше всех попыток), проверьте статус через `GET /api/order/{paymentId}` или `GET /api/order/merchant/{Order}`. Повторную отправку можно запросить в поддержке Paynet.
- Если ваш сервер закрыт файрволом, IP-адреса, с которых приходят уведомления, можно получить в поддержке Paynet.
- Оплату, по которой пришло `PAID`, антифрод уже не отменит: он срабатывает до подтверждения оплаты. Статус оплаченного платежа меняется только после вашего [возврата](#/guides/errors-and-statuses) (`5` или `6`).

## Симулятор уведомлений на портале

Откройте **Общее → Уведомления → Симулятор уведомлений**:

1. Введите ваш callback URL. Он должен быть доступен из интернета и, **только для симулятора**, принимать запросы из браузера (CORS).
2. Введите секретный ключ уведомлений (тест: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Введите номер заказа мерчанта (`Order`) **оплаченного** тестового платежа и нажмите **Get** — портал загрузит платёж.
4. Нажмите **Send notification** — портал отправит на ваш URL подписанное уведомление `PAID` по этому платежу и покажет использованные `PreparedString` и `Hash`.

Это симуляция из вашего браузера, а не настоящее уведомление Paynet. Для неоплаченных заказов симулятор ничего не отправляет — так же, как Paynet.

> **Важно:** CORS нужен только симулятору, потому что он отправляет запрос из браузера. Настоящие уведомления отправляет сервер Paynet, и CORS на них не влияет: не включайте CORS на боевом endpoint ради Paynet. Успешная симуляция проверяет вашу проверку подписи и обработку, но не доставку от Paynet (доступ из сети, firewall, TLS-сертификат). Доставку подтвердите настоящим тестовым платежом.
