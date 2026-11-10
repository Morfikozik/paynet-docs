# SDK для PHP и Node.js

Официальные библиотеки Paynet для серверной части магазина. Они берут на себя авторизацию, правила API, подписи и обработку ошибок, а вы пишете только логику магазина. Сторонних зависимостей нет.

| | PHP | Node.js |
|---|---|---|
| Версия | 1.0.0 | 1.0.0 |
| Требования | PHP 7.4+, расширения `curl` и `json` | Node.js 18+ |
| Скачать | [paynet-ecom-sdk-php-1.0.0.zip](sdk/paynet-ecom-sdk-php-1.0.0.zip) | [paynet-ecom-sdk-node-1.0.0.zip](sdk/paynet-ecom-sdk-node-1.0.0.zip) |
| Лицензия | MIT | MIT |

> **Важно:** SDK работает только на сервере. Логин, пароль и секретные ключи нельзя передавать в браузер или в мобильное приложение. Для приложений см. [Мобильные приложения](#/guides/mobile-apps).

## Что SDK делает за вас

| Задача | Без SDK | С SDK |
|---|---|---|
| Токен доступа | Получать через `/auth`, хранить, обновлять | Получается сам, обновляется при `401` |
| Создание заказа | Хранить тело запроса, повторять его без изменений при сбое сети | Повтор после сбоя сети — сам, с тем же телом |
| Возврат | Самому проверять: оплачен ли, не больше ли суммы, не было ли возврата | Правила проверяются **до** вызова API — понятная ошибка вместо отказа API |
| Уведомления | Собрать строку из 9 полей, MD5 + Base64, сверить неподписанные поля | `parseNotification` + `confirmNotification` |
| Форма hosted checkout | RFC 3986, сортировка полей, подпись | `buildCheckoutForm` возвращает готовый HTML |
| Ошибки | Три формата тела и разный регистр ключей | Одна ошибка: тип, код, `traceId`, подсказка |
| Время | `ExpiryDate`, поиск и выписки — по Кишинёву | Даты переводятся сами |

## Установка

Распакуйте архив в проект — получится папка `paynet-ecom-sdk`.

PHP:

```php
require __DIR__ . '/paynet-ecom-sdk/autoload.php';
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';
```

Проверить, что всё на месте: `php paynet-ecom-sdk/tests/run.php` или `node --test paynet-ecom-sdk/test/unit.test.js`.

## Подключение

PHP:

```php
use Paynet\Ecom\PaynetClient;

$paynet = new PaynetClient([
    'username' => getenv('PAYNET_USERNAME'),
    'password' => getenv('PAYNET_PASSWORD'),
    'environment' => 'test', // 'production' — с боевыми доступами
]);
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';

export const paynet = new PaynetClient({
  username: process.env.PAYNET_USERNAME,
  password: process.env.PAYNET_PASSWORD,
  environment: 'test', // 'production' — с боевыми доступами
});
```

В Node.js сохраните этот код в файл `paynet.js`: примеры ниже берут клиент оттуда. Тестовые доступы — на странице [Тестирование](#/guides/testing). Боевые отличаются от тестовых.

## Создать заказ и отправить покупателя на оплату

Сохраните тело запроса вместе с заказом: если нужно повторить запрос, отправляйте его без изменений — Paynet вернёт тот же платёж.

PHP:

```php
use Paynet\Ecom\Time;

$order = [
    'Order' => 1762444800000, // номер заказа в вашем магазине
    'SaleAreaCode' => 'onlidocumentation_md',
    'LinkUrlSuccess' => 'https://shop.example/payment/success',
    'LinkUrlCancel' => 'https://shop.example/payment/cancel',
    'Customer' => ['Code' => 'customer-42', 'NameFirst' => 'Ion', 'NameLast' => 'Popescu', 'email' => 'ion@example.com'],
    'ExpiryDate' => Time::expiryInHours(24), // через сутки, по Кишинёву
    'Currency' => 498,
    'Services' => [['Name' => 'My shop', 'Description' => 'Order #1762444800000', 'Amount' => 300]], // 300 = 3,00 MDL
    'MoneyType' => 'All',
    'Lang' => 'ro',
];
$created = $paynet->createOrder($order);
header('Location: ' . $created['paymentLink']);
```

Node.js:

```javascript
import { expiryInHours } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

const order = {
  Order: 1762444800000, // номер заказа в вашем магазине
  SaleAreaCode: 'onlidocumentation_md',
  LinkUrlSuccess: 'https://shop.example/payment/success',
  LinkUrlCancel: 'https://shop.example/payment/cancel',
  Customer: { Code: 'customer-42', NameFirst: 'Ion', NameLast: 'Popescu', email: 'ion@example.com' },
  ExpiryDate: expiryInHours(24), // через сутки, по Кишинёву
  Currency: 498,
  Services: [{ Name: 'My shop', Description: 'Order #1762444800000', Amount: 300 }], // 300 = 3,00 MDL
  MoneyType: 'All',
  Lang: 'ro',
};
const { paymentId, paymentLink } = await paynet.createOrder(order);
// перенаправьте покупателя на paymentLink
```

## Проверить оплату

Перед отгрузкой проверяйте статус через API: возврат покупателя на `LinkUrlSuccess` ещё не означает оплату.

PHP:

```php
use Paynet\Ecom\PaymentStatus;

$payment = $paynet->getPaymentByOrder(1762444800000);
if ($payment['status'] === PaymentStatus::PAID) {
    // заказ оплачен — можно выполнять
}
```

Node.js:

```javascript
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

const payment = await paynet.getPaymentByOrder(1762444800000);
if (payment.status === PaymentStatus.PAID) {
  // заказ оплачен — можно выполнять
}
```

Статусы: `1` — не оплачен, `3` — в обработке (ждите, до суток), `4` — оплачен, `5` и `6` — окончательные. Подробнее: [Статусы и ошибки](#/guides/errors-and-statuses).

## Принять уведомление

Ответьте `200` быстро и только после проверки подписи. Затем сверьте платёж через API: сумма оплаты (`PaidAmount`) и некоторые другие поля в подпись не входят.

PHP:

```php
use Paynet\Ecom\Notification;
use Paynet\Ecom\PaynetException;

try {
    $notification = Notification::parse(file_get_contents('php://input'), $_SERVER['HTTP_HASH'] ?? null, getenv('PAYNET_NOTIFICATION_KEY'));
} catch (PaynetException $e) {
    http_response_code(400);
    exit;
}
// сохраните уведомление (повторы приходят с тем же Payment.Id) и ответьте 200
http_response_code(200);

$check = Notification::confirm($paynet, $notification, ['amount' => 300, 'customerCode' => 'customer-42']);
if ($check['ok']) {
    // выполнить заказ
} else {
    // отправить на ручную проверку: $check['problems']
}
```

Node.js:

```javascript
import { parseNotification, confirmNotification } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// rawBody — тело запроса как строка, без изменений; hash — заголовок Hash
export async function handlePaynetNotification(rawBody, hash, res) {
  let notification;
  try {
    notification = parseNotification(rawBody, hash, process.env.PAYNET_NOTIFICATION_KEY);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // сохраните уведомление (повторы приходят с тем же Payment.Id) и ответьте 200
  res.writeHead(200).end();

  const check = await confirmNotification(paynet, notification, { amount: 300, customerCode: 'customer-42' });
  if (check.ok) {
    // выполнить заказ
  } else {
    // отправить на ручную проверку: check.problems
  }
}
```

Используйте **ключ уведомлений**, а не ключ формы checkout. Подробнее: [Уведомления](#/guides/notifications).

## Сделать возврат

В продакшне по одному платежу — **один** возврат (полный или частичный), в течение 180 дней, не больше оплаченной суммы, не для `CASH_INVOICE`. SDK проверяет эти правила до обращения к API. Тип (`full` / `partial`) определяется сам по сумме.

PHP:

```php
$refund = $paynet->refund((int) $created['paymentId'], 'onlidocumentation_md', 300, null, 'Customer request');
```

Node.js:

```javascript
import { paynet } from './paynet.js';

const refund = await paynet.refund({ paymentId: 328731, saleAreaCode: 'onlidocumentation_md', amount: 300, reason: 'Customer request' });
```

Результат приходит сразу в ответе, уведомления о возврате нет.

## Форма hosted checkout

Подпись считается на сервере, в браузер уходит только готовая форма. Нужен **ключ формы checkout**.

PHP:

```php
use Paynet\Ecom\Checkout;

$form = Checkout::buildForm([
    'Order' => 1762444800000,
    'Merchant' => '265505',
    'SaleAreaCode' => 'onlidocumentation_md',
    'Amount' => 300,
    'Description' => 'Order #1762444800000',
    'LinkUrlSuccess' => 'https://shop.example/payment/success',
    'LinkUrlCancel' => 'https://shop.example/payment/cancel',
    'Lang' => 'ro',
    'MoneyType' => 'All',
], getenv('PAYNET_CHECKOUT_KEY'), 'test');
echo $form['html'];
```

Node.js:

```javascript
import { buildCheckoutForm } from './paynet-ecom-sdk/src/index.js';

const form = buildCheckoutForm({
  secretKey: process.env.PAYNET_CHECKOUT_KEY,
  environment: 'test',
  fields: {
    Order: 1762444800000,
    Merchant: '265505',
    SaleAreaCode: 'onlidocumentation_md',
    Amount: 300,
    Description: 'Order #1762444800000',
    LinkUrlSuccess: 'https://shop.example/payment/success',
    LinkUrlCancel: 'https://shop.example/payment/cancel',
    Lang: 'ro',
    MoneyType: 'All',
  },
});
// отдайте form.html в браузер
```

`Currency` по умолчанию `498`, `ExpiryDate` — через сутки по Кишинёву.

## Ошибки

Любая ошибка API или нарушение правила — это `PaynetException` (PHP) или `PaynetError` (Node.js) с полями: тип (`kind`), HTTP-код, код Paynet, `traceId`, подсказка (`hint`) и признак «можно повторить» (`retryable`).

| Тип (`kind`) | Когда | Что делать |
|---|---|---|
| `validation` | `400`: неверные или недостающие поля | Исправить запрос по `details` |
| `authentication` | `/auth`: неверный логин или пароль | Проверить доступы (тест и продакшн — разные) |
| `unauthorized` | `401` даже после обновления токена | Проверить доступы |
| `not_found` | `404 NOT_FOUND_RECORD`: нет платежа; возврат неоплаченного | Проверить `paymentId` / `Order` |
| `server` | `500 TECHNICAL_ERROR` | Проверить заказ по `Order`; повтор `Order` с другими данными — нужен новый `Order` |
| `network` | Нет ответа (таймаут, сеть) | Проверить заказ по `Order`, повторить тот же запрос |
| `rule` | SDK не стал вызывать API: нарушено правило (например, второй возврат) | Прочитать сообщение — запрос не отправлялся |
| `wrong_address`, `method_not_allowed`, `unsupported_media_type` | `404` с пустым телом, `405`, `415` | Ошибка в настройке клиента — не должна возникать при работе через SDK |

PHP:

```php
use Paynet\Ecom\PaynetException;

try {
    $paynet->refund(328731, 'onlidocumentation_md', 300);
} catch (PaynetException $e) {
    error_log($e->kind . ' ' . $e->errorCode . ' traceId=' . $e->traceId . ' — ' . $e->hint);
}
```

Node.js:

```javascript
import { PaynetError } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

try {
  await paynet.refund({ paymentId: 328731, saleAreaCode: 'onlidocumentation_md', amount: 300 });
} catch (error) {
  if (error instanceof PaynetError) console.error(error.kind, error.code, `traceId=${error.traceId}`, error.hint);
  else throw error;
}
```

При обращении в поддержку присылайте `traceId`.

## Методы SDK

| Что | PHP | Node.js | Метод API |
|---|---|---|---|
| Создать заказ | `createOrder($order)` | `createOrder(order)` | `POST /api/order` |
| Платёж по `paymentId` | `getPayment($id)` | `getPayment(id)` | `GET /api/order/{id}` |
| Платёж по номеру заказа | `getPaymentByOrder($order)` | `getPaymentByOrder(order)` | `GET /api/order/merchant/{id}` |
| Оплачен ли заказ | `isPaid($order)` | `isPaid(order)` | `GET /api/order/merchant/{id}` |
| Поиск за период | `searchPayments($from, $to)` | `searchPayments({ from, to })` | `GET /api/order/search` |
| Возврат | `refund($paymentId, $saleArea, $amount, …)` | `refund({ paymentId, saleAreaCode, amount, … })` | `POST /api/order/refund` |
| Удалить сохранённую карту | `unlinkCard($hash, $saleArea, $customer)` | `unlinkCard({ cardLinkHash, saleAreaCode, customerCode })` | `POST /api/linked-cards/unlink` |
| Выписка | `getStatement($start, $finish)` | `getStatement({ dateStart, dateFinish })` | `GET /api/statement` |
| Выписка `.xlsx` | `downloadStatement($start, $finish)` | `downloadStatement({ dateStart, dateFinish })` | `GET /api/statement/download` |
| Проверить уведомление | `Notification::parse(…)`, `Notification::confirm(…)` | `parseNotification(…)`, `confirmNotification(…)` | — |
| Форма hosted checkout | `Checkout::buildForm(…)` | `buildCheckoutForm(…)` | — |

Поиск: даты переводятся во время Кишинёва, пустой период возвращает пустой список (API в этом случае отвечает `404`).

## Как SDK проверены

- **Модульные тесты** (входят в архив): подписи по тестовым векторам со страницы [Подписи](#/guides/signatures), все форматы ошибок, обновление токена, правила возврата, время Кишинёва. Запускаются при каждой публикации портала.
- **Проверка на тестовой среде** (мерчант 265505): каждый SDK создаёт свой заказ, повторяет запрос, после оплаты тестовой картой проверяет статус `4`, поиск, частичный возврат, отказ во втором возврате, удаление сохранённой карты, выписки и ошибки. Результат 10.11.2026: PHP — 20 из 20, Node.js — 20 из 20.

## Поддержка

Вопросы по SDK — так же, как по API: в Telegram-чате с разработчиком Paynet (через вашего менеджера) или на [support@paynet.md](mailto:support@paynet.md). Присылайте `traceId` из ошибки. Подробнее: [Обращение в поддержку](#/guides/errors-and-statuses).
