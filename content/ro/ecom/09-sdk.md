# SDK pentru PHP și Node.js

Biblioteci oficiale Paynet pentru partea de server a magazinului. Ele se ocupă de autorizare, regulile API, semnături și tratarea erorilor, iar dvs. scrieți doar logica magazinului. Fără dependențe externe.

| | PHP | Node.js |
|---|---|---|
| Versiune | 1.0.0 | 1.0.0 |
| Cerințe | PHP 7.4+, extensiile `curl` și `json` | Node.js 18+ |
| Descărcare | [paynet-ecom-sdk-php-1.0.0.zip](sdk/paynet-ecom-sdk-php-1.0.0.zip) | [paynet-ecom-sdk-node-1.0.0.zip](sdk/paynet-ecom-sdk-node-1.0.0.zip) |
| Licență | MIT | MIT |

> **Important:** SDK-ul rulează doar pe server. Nu trimiteți niciodată utilizatorul, parola sau cheile secrete în browser sau într-o aplicație mobilă. Pentru aplicații, vedeți [Aplicații mobile](#/guides/mobile-apps).

## Ce face SDK-ul în locul dvs.

| Sarcină | Fără SDK | Cu SDK |
|---|---|---|
| Token de acces | Obținut prin `/auth`, păstrat, reînnoit | Se obține automat, se reînnoiește la `401` |
| Crearea comenzii | Păstrați corpul cererii, repetați-l neschimbat după o eroare de rețea | Repetat automat după o eroare de rețea, cu același corp |
| Rambursare | Verificați singur: este achitată, suma nu e prea mare, nu a existat deja o rambursare | Regulile se verifică **înainte** de apelul API — o eroare clară în loc de refuzul API |
| Notificări | Construiți șirul din 9 câmpuri, MD5 + Base64, verificați câmpurile nesemnate | `parseNotification` + `confirmNotification` |
| Formularul hosted checkout | RFC 3986, sortarea câmpurilor, semnătura | `buildCheckoutForm` returnează HTML gata |
| Erori | Trei formate de corp și majuscule diferite în chei | O singură eroare: tip, cod, `traceId`, indicație |
| Ora | `ExpiryDate`, căutarea și extrasele folosesc ora Chișinăului | Datele se convertesc automat |

## Instalare

Dezarhivați arhiva în proiect — obțineți dosarul `paynet-ecom-sdk`.

PHP:

```php
require __DIR__ . '/paynet-ecom-sdk/autoload.php';
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';
```

Pentru a verifica: `php paynet-ecom-sdk/tests/run.php` sau `node --test paynet-ecom-sdk/test/unit.test.js`.

## Conectare

PHP:

```php
use Paynet\Ecom\PaynetClient;

$paynet = new PaynetClient([
    'username' => getenv('PAYNET_USERNAME'),
    'password' => getenv('PAYNET_PASSWORD'),
    'environment' => 'test', // 'production' — cu datele de acces de producție
]);
```

Node.js:

```javascript
import { PaynetClient } from './paynet-ecom-sdk/src/index.js';

export const paynet = new PaynetClient({
  username: process.env.PAYNET_USERNAME,
  password: process.env.PAYNET_PASSWORD,
  environment: 'test', // 'production' — cu datele de acces de producție
});
```

În Node.js, salvați acest cod în fișierul `paynet.js`: exemplele de mai jos importă clientul de acolo. Datele de acces de test sunt pe pagina [Testare](#/guides/testing). Cele de producție sunt diferite.

## Creați comanda și trimiteți clientul la plată

Păstrați corpul cererii împreună cu comanda: pentru a repeta cererea, trimiteți-o neschimbată — Paynet returnează aceeași plată.

PHP:

```php
use Paynet\Ecom\Time;

$order = [
    'Order' => 1762444800000, // numărul comenzii în magazinul dvs.
    'SaleAreaCode' => 'onlidocumentation_md',
    'LinkUrlSuccess' => 'https://shop.example/payment/success',
    'LinkUrlCancel' => 'https://shop.example/payment/cancel',
    'Customer' => ['Code' => 'customer-42', 'NameFirst' => 'Ion', 'NameLast' => 'Popescu', 'email' => 'ion@example.com', 'PhoneNumber' => '37360000000'],
    'ExpiryDate' => Time::expiryInHours(24), // peste 24 de ore, ora Chișinăului
    'Currency' => 498,
    'Services' => [['Name' => 'My shop', 'Description' => 'Order #1762444800000', 'Amount' => 300]], // 300 = 3.00 MDL
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
  Order: 1762444800000, // numărul comenzii în magazinul dvs.
  SaleAreaCode: 'onlidocumentation_md',
  LinkUrlSuccess: 'https://shop.example/payment/success',
  LinkUrlCancel: 'https://shop.example/payment/cancel',
  Customer: { Code: 'customer-42', NameFirst: 'Ion', NameLast: 'Popescu', email: 'ion@example.com', PhoneNumber: '37360000000' },
  ExpiryDate: expiryInHours(24), // peste 24 de ore, ora Chișinăului
  Currency: 498,
  Services: [{ Name: 'My shop', Description: 'Order #1762444800000', Amount: 300 }], // 300 = 3.00 MDL
  MoneyType: 'All',
  Lang: 'ro',
};
const { paymentId, paymentLink } = await paynet.createOrder(order);
// redirecționați clientul la paymentLink
```

## Verificați plata

Înainte de livrare, verificați statusul prin API: revenirea clientului la `LinkUrlSuccess` nu înseamnă singură că plata s-a efectuat.

PHP:

```php
use Paynet\Ecom\PaymentStatus;

$payment = $paynet->getPaymentByOrder(1762444800000);
if ($payment['status'] === PaymentStatus::PAID) {
    // comanda este achitată — o puteți executa
}
```

Node.js:

```javascript
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

const payment = await paynet.getPaymentByOrder(1762444800000);
if (payment.status === PaymentStatus.PAID) {
  // comanda este achitată — o puteți executa
}
```

Statusuri: `1` — neachitat, `3` — în procesare (așteptați, până la circa o zi), `4` — achitat, `5` și `6` — finale. Mai mult: [Statusuri și erori](#/guides/errors-and-statuses).

## Primiți notificarea

Răspundeți `200` rapid și doar după verificarea semnăturii. Apoi confirmați plata prin API: suma achitată (`PaidAmount`) și alte câteva câmpuri nu sunt semnate.

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
// salvați notificarea (reîncercările vin cu același Payment.Id) și răspundeți 200
http_response_code(200);

$check = Notification::confirm($paynet, $notification, ['amount' => 300, 'customerCode' => 'customer-42']);
if ($check['ok']) {
    // executați comanda
} else {
    // trimiteți la verificare manuală: $check['problems']
}
```

Node.js:

```javascript
import { parseNotification, confirmNotification } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// rawBody — corpul cererii ca șir, neschimbat; hash — antetul Hash
export async function handlePaynetNotification(rawBody, hash, res) {
  let notification;
  try {
    notification = parseNotification(rawBody, hash, process.env.PAYNET_NOTIFICATION_KEY);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // salvați notificarea (reîncercările vin cu același Payment.Id) și răspundeți 200
  res.writeHead(200).end();

  const check = await confirmNotification(paynet, notification, { amount: 300, customerCode: 'customer-42' });
  if (check.ok) {
    // executați comanda
  } else {
    // trimiteți la verificare manuală: check.problems
  }
}
```

Folosiți **cheia pentru notificări**, nu cheia formularului checkout. Mai mult: [Notificări](#/guides/notifications).

## Efectuați o rambursare

În producție o plată poate avea **o singură** rambursare (totală sau parțială), în 180 de zile, cel mult suma achitată, nu pentru `CASH_INVOICE`. SDK-ul verifică aceste reguli înainte de apelul API. Tipul (`full` / `partial`) se alege după sumă.

PHP:

```php
$refund = $paynet->refund((int) $created['paymentId'], 'onlidocumentation_md', 300, null, 'Customer request');
```

Node.js:

```javascript
import { paynet } from './paynet.js';

const refund = await paynet.refund({ paymentId: 328731, saleAreaCode: 'onlidocumentation_md', amount: 300, reason: 'Customer request' });
```

Rezultatul vine în răspuns; nu există notificare despre rambursare.

## Formularul hosted checkout

Semnătura se calculează pe server; în browser ajunge doar formularul gata. Folosiți **cheia formularului checkout**.

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
// trimiteți form.html în browser
```

`Currency` implicit `498`, `ExpiryDate` — peste 24 de ore, ora Chișinăului.

## Erori

Orice eroare API sau încălcare a unei reguli este un `PaynetException` (PHP) sau `PaynetError` (Node.js) cu: tip (`kind`), cod HTTP, cod Paynet, `traceId`, indicație (`hint`) și dacă repetarea poate ajuta (`retryable`).

| Tip (`kind`) | Când | Ce faceți |
|---|---|---|
| `validation` | `400`: câmpuri invalide sau lipsă | Corectați cererea după `details` |
| `authentication` | `/auth`: utilizator sau parolă greșite | Verificați datele de acces (test și producție diferă) |
| `unauthorized` | `401` chiar după reînnoirea tokenului | Verificați datele de acces |
| `not_found` | `404 NOT_FOUND_RECORD`: plata nu există; rambursarea unei plăți neachitate | Verificați `paymentId` / `Order` |
| `server` | `500 TECHNICAL_ERROR` | Căutați comanda după `Order`; un `Order` repetat cu alte date necesită un `Order` nou |
| `network` | Niciun răspuns (timeout, rețea) | Căutați comanda după `Order`, repetați aceeași cerere |
| `rule` | SDK-ul nu a apelat API-ul: o regulă este încălcată (de exemplu, a doua rambursare) | Citiți mesajul — cererea nu a fost trimisă |
| `wrong_address`, `method_not_allowed`, `unsupported_media_type` | `404` cu corp gol, `405`, `415` | Eroare de configurare a clientului — nu ar trebui să apară cu SDK-ul |

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

Trimiteți `traceId` când contactați suportul.

## Metodele SDK

| Ce | PHP | Node.js | Metoda API |
|---|---|---|---|
| Creare comandă | `createOrder($order)` | `createOrder(order)` | `POST /api/order` |
| Plata după `paymentId` | `getPayment($id)` | `getPayment(id)` | `GET /api/order/{id}` |
| Plata după numărul comenzii | `getPaymentByOrder($order)` | `getPaymentByOrder(order)` | `GET /api/order/merchant/{id}` |
| Este comanda achitată | `isPaid($order)` | `isPaid(order)` | `GET /api/order/merchant/{id}` |
| Căutare într-o perioadă | `searchPayments($from, $to)` | `searchPayments({ from, to })` | `GET /api/order/search` |
| Rambursare | `refund($paymentId, $saleArea, $amount, …)` | `refund({ paymentId, saleAreaCode, amount, … })` | `POST /api/order/refund` |
| Ștergerea cardului salvat | `unlinkCard($hash, $saleArea, $customer)` | `unlinkCard({ cardLinkHash, saleAreaCode, customerCode })` | `POST /api/linked-cards/unlink` |
| Extras | `getStatement($start, $finish)` | `getStatement({ dateStart, dateFinish })` | `GET /api/statement` |
| Extras `.xlsx` | `downloadStatement($start, $finish)` | `downloadStatement({ dateStart, dateFinish })` | `GET /api/statement/download` |
| Verificarea notificării | `Notification::parse(…)`, `Notification::confirm(…)` | `parseNotification(…)`, `confirmNotification(…)` | — |
| Formular hosted checkout | `Checkout::buildForm(…)` | `buildCheckoutForm(…)` | — |

Căutare: datele se convertesc în ora Chișinăului; o perioadă goală returnează o listă goală (API-ul răspunde `404` în acest caz).

## Cum sunt verificate SDK-urile

- **Teste unitare** (incluse în arhivă): semnături pe vectorii de test de pe pagina [Semnături](#/guides/signatures), toate formatele de erori, reînnoirea tokenului, regulile de rambursare, ora Chișinăului. Rulează la fiecare publicare a portalului.
- **Verificare în mediul de test** (comerciantul 265505): fiecare SDK creează propria comandă, repetă cererea, iar după plata cu cardul de test verifică statusul `4`, căutarea, o rambursare parțială, refuzul celei de-a doua rambursări, ștergerea cardului salvat, extrasele și erorile. Rezultat 10.11.2026: PHP — 20 din 20, Node.js — 20 din 20.

## Suport

Întrebările despre SDK — ca și cele despre API: în chatul Telegram cu dezvoltatorul Paynet (prin managerul dvs.) sau la [support@paynet.md](mailto:support@paynet.md). Trimiteți `traceId` din eroare. Mai mult: [Contactarea suportului](#/guides/errors-and-statuses).
