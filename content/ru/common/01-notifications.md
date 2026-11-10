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

### Полный обработчик: Node.js

Проверяет подпись, сохраняет уведомление один раз, отвечает `200`, затем сверяет значения через API и выполняет заказ или отправляет его на проверку. Логика этого примера проверяется автоматически при каждой сборке документации.

```javascript
// paynet-notifications.mjs — complete notification handler, no dependencies (Node.js 18+).
import crypto from 'node:crypto';

// The 9 signed fields, in this exact order. Do not sort.
const signedValues = (n) => {
  const p = n.Payment || {};
  return [n.EventDate, n.Eventid, n.EventType, p.Amount, p.Customer, p.ExternalId, p.Id, p.Merchant, p.StatusDate];
};

export function verifyHash(notification, hashHeader, secret) {
  const prepared = signedValues(notification).map((v) => (v === null || v === undefined ? '' : String(v))).join('');
  const expected = crypto.createHash('md5').update(prepared + secret, 'utf8').digest('base64');
  const received = String(hashHeader || '');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * deps.secret      notification secret key
 * deps.apiUrl      https://ecom-api.paynet.md (test: https://ecom-api-test.paynet.md)
 * deps.getToken()  returns a valid Bearer token (POST /auth, cached)
 * deps.fetch       fetch implementation (globalThis.fetch)
 * deps.db          your storage:
 *   saveNotificationOnce(paymentId, notification) -> true if new, false if already stored
 *   findOrder(order) -> { amount, customerCode, promotionAgreed } or null
 *   markPaid(order, paidAmount), saveCard(customerCode, cardLinkHash), sendToReview(order, problems)
 *
 * handle(rawBody, hashHeader) -> { status, processing }
 *   status: HTTP status to answer Paynet; processing: promise of the work done after answering.
 */
export function createPaynetHandler(deps) {
  const { db } = deps;

  async function confirmWithApi(n, order) {
    const p = n.Payment;
    const response = await deps.fetch(`${deps.apiUrl}/api/order/merchant/${p.ExternalId}`, {
      headers: { Authorization: `Bearer ${await deps.getToken()}` },
    });
    if (!response.ok) throw new Error(`Status check failed: HTTP ${response.status}`);
    const payment = await response.json();

    const problems = [];
    if (payment.paymentId !== p.Id) problems.push('paymentId');
    if (payment.status !== 4) problems.push('status');
    if (payment.amount?.amount !== p.Amount || p.Amount !== order.amount) problems.push('Amount');
    if (payment.amount?.paidAmount !== p.PaidAmount) problems.push('PaidAmount');
    if (payment.customer?.code !== order.customerCode) problems.push('customer');
    if (p.CardLinkHash && payment.cardLinkHash && payment.cardLinkHash !== p.CardLinkHash) problems.push('CardLinkHash');
    return problems;
  }

  async function process(n) {
    const p = n.Payment;
    if (n.EventType !== 'PAID') return db.sendToReview(p.ExternalId, ['EventType']);
    const order = await db.findOrder(p.ExternalId);
    if (!order) return db.sendToReview(p.ExternalId, ['unknown order']);

    const problems = await confirmWithApi(n, order);
    if (p.PaidAmount !== p.Amount && !order.promotionAgreed) problems.push('PaidAmount differs from Amount');
    if (problems.length) return db.sendToReview(p.ExternalId, problems);

    await db.markPaid(p.ExternalId, p.PaidAmount);
    if (p.CardLinkHash) await db.saveCard(order.customerCode, p.CardLinkHash);
  }

  return async function handle(rawBody, hashHeader) {
    let n;
    try {
      n = JSON.parse(rawBody);
    } catch {
      return { status: 400, processing: null };
    }
    if (!verifyHash(n, hashHeader, deps.secret)) return { status: 400, processing: null };

    const isNew = await db.saveNotificationOnce(n.Payment?.Id, n); // idempotency by Payment.Id
    if (!isNew) return { status: 200, processing: null }; // a retry: already stored
    // Answer 200 now; confirm and fulfil after the answer. If this work fails, the stored
    // notification stays unprocessed and a background job can retry it.
    return { status: 200, processing: process(n) };
  };
}
```

Connecting it to Express (read the raw body, answer first, process after):

```javascript
import express from 'express';
import { createPaynetHandler } from './paynet-notifications.mjs';

const handle = createPaynetHandler({
  secret: process.env.PAYNET_NOTIFICATION_SECRET,
  apiUrl: process.env.PAYNET_API_URL,
  getToken, // your cached POST /auth
  fetch: globalThis.fetch,
  db, // your storage
});

const app = express();
app.post('/paynet/notification', express.text({ type: '*/*' }), async (req, res) => {
  const { status, processing } = await handle(req.body, req.get('Hash'));
  res.status(status).json(status === 200 ? { ResultCode: 'SUCCESS' } : { error: 'Invalid notification' });
  processing?.catch((error) => console.error('Paynet notification processing failed', error));
});
```

### Полный обработчик: PHP

```php
<?php
// paynet-notification.php — complete notification handler (PHP 7.4+, ext-curl).
// $db must implement: saveNotificationOnce($paymentId, array $n): bool, findOrder($order): ?array
// (['amount' => int, 'customerCode' => string, 'promotionAgreed' => bool]), markPaid($order, $paidAmount),
// saveCard($customerCode, $cardLinkHash), sendToReview($order, array $problems).

function paynetVerifyHash(array $n, string $hashHeader, string $secret): bool {
    $p = $n['Payment'] ?? [];
    $s = fn($v) => $v === null ? '' : (string) $v;
    // The 9 signed fields, in this exact order. Do not sort.
    $prepared = $s($n['EventDate'] ?? null) . $s($n['Eventid'] ?? null) . $s($n['EventType'] ?? null)
              . $s($p['Amount'] ?? null) . $s($p['Customer'] ?? null) . $s($p['ExternalId'] ?? null)
              . $s($p['Id'] ?? null) . $s($p['Merchant'] ?? null) . $s($p['StatusDate'] ?? null);
    $expected = base64_encode(md5($prepared . $secret, true));
    return hash_equals($expected, $hashHeader);
}

function paynetConfirmWithApi(array $n, array $order, string $apiUrl, string $token): array {
    $p  = $n['Payment'];
    $ch = curl_init($apiUrl . '/api/order/merchant/' . $p['ExternalId']);
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
    if (($pay['paymentId'] ?? null) !== $p['Id']) $problems[] = 'paymentId';
    if (($pay['status'] ?? null) !== 4) $problems[] = 'status';
    if (($pay['amount']['amount'] ?? null) !== $p['Amount'] || $p['Amount'] !== $order['amount']) $problems[] = 'Amount';
    if (($pay['amount']['paidAmount'] ?? null) !== ($p['PaidAmount'] ?? null)) $problems[] = 'PaidAmount';
    if (($pay['customer']['code'] ?? null) !== $order['customerCode']) $problems[] = 'customer';
    if (!empty($p['CardLinkHash']) && !empty($pay['cardLinkHash']) && $pay['cardLinkHash'] !== $p['CardLinkHash']) $problems[] = 'CardLinkHash';
    return $problems;
}

function paynetProcess(array $n, $db, string $apiUrl, string $token): void {
    $p = $n['Payment'];
    if (($n['EventType'] ?? '') !== 'PAID') { $db->sendToReview($p['ExternalId'], ['EventType']); return; }
    $order = $db->findOrder($p['ExternalId']);
    if (!$order) { $db->sendToReview($p['ExternalId'], ['unknown order']); return; }

    $problems = paynetConfirmWithApi($n, $order, $apiUrl, $token);
    if (($p['PaidAmount'] ?? null) !== $p['Amount'] && empty($order['promotionAgreed'])) $problems[] = 'PaidAmount differs from Amount';
    if ($problems) { $db->sendToReview($p['ExternalId'], $problems); return; }

    $db->markPaid($p['ExternalId'], $p['PaidAmount']);
    if (!empty($p['CardLinkHash'])) $db->saveCard($order['customerCode'], $p['CardLinkHash']);
}

// --- Endpoint -------------------------------------------------------------
function paynetHandleRequest($db, callable $getToken): void {
    $raw = file_get_contents('php://input');
    $n   = json_decode($raw, true);
    if (!is_array($n) || !paynetVerifyHash($n, $_SERVER['HTTP_HASH'] ?? '', getenv('PAYNET_NOTIFICATION_SECRET'))) {
        http_response_code(400);
        exit('Invalid notification');
    }
    $isNew = $db->saveNotificationOnce($n['Payment']['Id'] ?? null, $n); // idempotency by Payment.Id

    // Answer 200 first.
    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['ResultCode' => 'SUCCESS']);
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();

    if ($isNew) {
        try {
            paynetProcess($n, $db, getenv('PAYNET_API_URL'), $getToken());
        } catch (Throwable $e) {
            error_log('Paynet notification processing failed: ' . $e->getMessage()); // retry from storage later
        }
    }
}
```

## Ответ и повторы

- Отвечайте HTTP `200` **после** того, как проверили хэш и сохранили результат.
- Отвечайте быстро: сохраните уведомление, верните `200`, а тяжёлую обработку выполняйте после ответа.
- Любой другой ответ (или отсутствие ответа) считается ошибкой, и Paynet отправляет уведомление повторно. После ответа `200` повторы прекращаются.
- Важен только HTTP-код; тело ответа значения не имеет. `{ "ResultCode": "SUCCESS" }` в примерах необязательно.
- Расписание — **9 попыток**; повторы идут примерно 25 минут после первой попытки, затем отправка прекращается:

| Попытка | Когда |
|---|---|
| 1 | после того как банк-эмитент подтвердил оплату (зависит от банка: от нескольких секунд до нескольких минут) |
| 2–4 | через ~1 минуту, затем каждые ~35 секунд |
| 5–7 | через ~5 минут, затем каждые ~35 секунд |
| 8–9 | через ~15 минут, затем через ~35 секунд |

> **Важно:** повторы идут всего около 25 минут после первой попытки. Если ваш сервер был недоступен дольше, уведомление больше не придёт. Поэтому проверяйте статус неоплаченных заказов через API и делайте ежедневную сверку.

- Из-за повторов одно и то же уведомление может прийти несколько раз. Обрабатывайте каждый `Payment.Id` один раз.
- Если уведомление не пришло (например, сервер был недоступен дольше всех попыток), проверьте статус через `GET /api/order/{paymentId}` или `GET /api/order/merchant/{Order}`. Повторную отправку можно запросить в поддержке Paynet.
- Если ваш сервер закрыт файрволом, разрешите входящие запросы с IP-адресов Paynet: `93.113.159.22` — продакшн, `93.113.159.23` — тестовая среда.
- Оплату, по которой пришло `PAID`, антифрод уже не отменит: он срабатывает до подтверждения оплаты. Статус оплаченного платежа меняется только после вашего [возврата](#/guides/errors-and-statuses) (`5` или `6`).

## Симулятор уведомлений на портале

Откройте **Общее → Уведомления → Симулятор уведомлений**:

1. Введите ваш callback URL. Он должен быть доступен из интернета и, **только для симулятора**, принимать запросы из браузера (CORS).
2. Проверьте секретный ключ уведомлений: тестовый ключ `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` уже подставлен, свой ключ можно вписать вместо него.
3. Введите номер заказа мерчанта (`Order`) **оплаченного** тестового платежа и нажмите **Get** — портал загрузит платёж.
4. Нажмите **Send notification** — портал отправит на ваш URL подписанное уведомление `PAID` по этому платежу и покажет использованные `PreparedString` и `Hash`.

Это симуляция из вашего браузера, а не настоящее уведомление Paynet. Для неоплаченных заказов симулятор ничего не отправляет — так же, как Paynet.

> **Важно:** CORS нужен только симулятору, потому что он отправляет запрос из браузера. Настоящие уведомления отправляет сервер Paynet, и CORS на них не влияет: не включайте CORS на боевом endpoint ради Paynet. Успешная симуляция проверяет вашу проверку подписи и обработку, но не доставку от Paynet (доступ из сети, firewall, TLS-сертификат). Доставку подтвердите настоящим тестовым платежом.
