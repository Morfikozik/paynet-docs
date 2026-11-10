# Notificări (webhooks)

Când o plată este achitată, Paynet trimite un `POST` HTTP cu corp JSON la URL-ul de callback înregistrat la Paynet. Notificarea este aceeași pentru toate tipurile de integrare.

**Se notifică doar plățile reușite.** `EventType` este mereu `PAID`. Dacă plata eșuează, Paynet nu trimite notificare — clientul este doar redirecționat la `LinkUrlCancel`. Considerați comanda neplătită până primiți o notificare `PAID` verificată (sau API-ul de status arată plata), iar după `ExpiryDate` — abandonată.

## Cererea

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

Cererea are doar două antete: `Content-Type` și `Hash`. Nu există antet `Authorization` — autenticitatea este confirmată de `Hash`.

## Câmpuri

> **Important:** în majoritatea limbajelor cheile JSON țin cont de majuscule. Cheile sunt `Id` și `ExternalId` (nu `ID` / `ExternalID`).

| Câmp | Tip | Descriere |
|---|---|---|
| `Eventid` | long | ID-ul notificării. |
| `EventType` | string | Mereu `PAID`. |
| `Message` | string | Status text, de ex. `Request processed successfully`. |
| `EventDate` | string | Când a fost creată notificarea, `YYYY-MM-DDTHH:mm:ss`, ora locală Chișinău. |
| `Payment.Id` | long | ID-ul plății Paynet (`paymentId`). Folosiți-l drept cheie de idempotență. |
| `Payment.ExternalId` | long | Numărul comenzii dvs. (`Order`). |
| `Payment.SaleAreaCode` | string | Codul zonei de vânzare. |
| `Payment.Customer` | string | Codul clientului transmis în comandă (`Customer.Code`), de obicei mascat, de exemplu `37369XXX111` sau `name***@gmail.com`. |
| `Payment.StatusDate` | string | Când plata a ajuns în acest status (ora locală Chișinău). |
| `Payment.Amount` | long | Suma comenzii în unități minime, așa cum ați trimis-o. |
| `Payment.PaidAmount` | long | Suma plătită efectiv de client, în unități minime. Vezi mai jos. |
| `Payment.Merchant` | string | Codul dvs. de comerciant. |
| `Payment.MoneyType` | string | Cum a plătit clientul: `CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`. |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer` | string | Datele cardului. Completate pentru `CARD`, precum și pentru `APPLEPAY` și `GOOGLEPAY` (cardul din portofel); `null` pentru alte metode de plată. |
| `Payment.CardLinkHash` | string | Tokenul cardului salvat: vine dacă pentru `SaleAreaCode` este activată [salvarea cardurilor](#/guides/saved-cards) și clientul a păstrat bifa; altfel `null`. |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP` | string | Datele plătitorului; pot fi `null`. |
| `Payment.RRN` | string | Retrieval reference number. |
| `Hash` (antet HTTP) | string | Semnătura notificării. |

Ignorați câmpurile necunoscute: pot apărea câmpuri opționale noi.

Valorile `MoneyType` din notificare nu coincid cu cele din cererea de creare a comenzii (`Card`, `All`, …). Nu le comparați direct.

### Amount și PaidAmount

`PaidAmount` trebuie să fie egal cu `Amount`.

Pot diferi **doar** dacă compania dvs. a convenit oficial cu Paynet o promoție sau o reducere (de ex. 10% la plata cu un card Mastercard cu un anumit BIN). Paynet configurează promoția pe partea sa, la cererea dvs.; nu se poate activa prin API.

> **Important:** dacă nu aveți o astfel de promoție convenită, iar `PaidAmount` diferă de `Amount`, nu onorați comanda automat. Salvați notificarea și contactați Paynet.

Decontare: primiți `PaidAmount` minus comisionul Paynet. Țineți cont de asta la reconcilierea cu extrasul.

## Verificarea semnăturii

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalId + Payment.Id + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( UTF8( PreparedString + NotificationSecretKey ) ) )
```

- Folosiți valorile exact așa cum apar în corpul JSON. O valoare lipsă sau `null` este un șir gol.
- Ordinea este fixă — exact ca în rândul de mai sus. **Nu sortați numele în cod:** o sortare obișnuită pune `EventType` înainte de `Eventid`, iar hash-ul nu se va potrivi.
- Folosiți cheia secretă pentru **notificări** (diferă de cheia pentru checkout).
- Comparați `ExpectedHash` cu antetul `Hash`. Dacă diferă, respingeți cererea (de ex. HTTP `400`) și nu modificați comanda.

Exemplu complet cu rezultatul așteptat: [Semnături](#/guides/signatures).

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

> **Important:** construiți `PreparedString` din valorile exact așa cum apar în corpul JSON. Nu reformatați datele (păstrați `2026-11-09T12:00:00` ca atare) și nu schimbați notația numerelor.

## Ce protejează semnătura și confirmarea prin API

Antetul `Hash` protejează doar câmpurile care intră în `PreparedString`:

| Semnate (verificate prin `Hash`) | Nesemnate |
|---|---|
| `EventDate`, `Eventid`, `EventType`, `Payment.Amount`, `Payment.Customer`, `Payment.ExternalId`, `Payment.Id`, `Payment.Merchant`, `Payment.StatusDate` | `Payment.PaidAmount`, `Payment.MoneyType`, `Payment.CardLinkHash`, `Payment.SaleAreaCode`, datele cardului și ale plătitorului (`CardMask`, `CardIssuer`, `PayerName`…), `Message` |

Un `Hash` valid confirmă că comanda `ExternalId` este plătită cu suma `Amount`. El **nu** confirmă câmpurile nesemnate. Înainte de a decide pe baza lor — ce sumă considerați primită, dacă salvați cardul — comparați-le cu răspunsul API-ului autentificat `GET /api/order/merchant/{Order}`. Acest răspuns este protejat de tokenul dvs. și de HTTPS.

Comparați valorile, nu doar apelați metoda:

| Ce verificați | Notificarea | Răspunsul API |
|---|---|---|
| Plata | `Payment.Id` | `paymentId` |
| Statusul | `EventType` = `PAID` | `status` = `4` |
| Suma comenzii | `Payment.Amount` (și suma comenzii dvs.) | `amount.amount` |
| Suma plătită | `Payment.PaidAmount` | `amount.paidAmount` |
| Clientul | comanda dvs. | `customer.code` |
| Cardul salvat | `Payment.CardLinkHash` | `cardLinkHash`, dacă API-ul îl returnează |

Dacă valorile diferă, nu onorați comanda automat și nu salvați cardul: trimiteți comanda la verificare manuală.

Dacă semnătura este validă, dar comanda nu poate fi onorată (comandă negăsită, sume diferite), răspundeți totuși `200` și trimiteți-o la verificare: altfel Paynet va repeta notificarea.

### Handler complet: Node.js

Verifică semnătura, salvează notificarea o singură dată, răspunde `200`, apoi confirmă valorile prin API și onorează comanda sau o trimite la verificare. Logica acestui exemplu este testată automat la fiecare build al documentației.

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

### Handler complet: PHP

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

## Răspuns și reîncercări

- Răspundeți HTTP `200` **după** ce ați verificat hash-ul și ați salvat rezultatul.
- Răspundeți repede: salvați notificarea, returnați `200`, iar procesarea grea faceți-o după răspuns.
- Orice alt răspuns (sau lipsa răspunsului) este considerat eșec, iar Paynet trimite notificarea din nou. După un răspuns `200`, reîncercările se opresc.
- Contează doar codul HTTP; corpul răspunsului nu contează. `{ "ResultCode": "SUCCESS" }` din exemple este opțional.
- Programul reîncercărilor — **9 încercări în circa 25 de minute**, după care trimiterea se oprește:

| Încercarea | Când |
|---|---|
| 1 | ~20 de secunde după plată |
| 2–4 | după ~1 minut, apoi la fiecare ~35 de secunde |
| 5–7 | după ~5 minute, apoi la fiecare ~35 de secunde |
| 8–9 | după ~15 minute, apoi după ~35 de secunde |

> **Important:** reîncercările durează doar circa 25 de minute. Dacă serverul dvs. a fost indisponibil mai mult, notificarea nu va mai veni. De aceea verificați statusul comenzilor neplătite prin API și faceți reconcilierea zilnic.

- Din cauza reîncercărilor aceeași notificare poate sosi de mai multe ori. Procesați fiecare `Payment.Id` o singură dată.
- Dacă notificarea nu a sosit (de exemplu, serverul a fost indisponibil mai mult decât toate încercările), verificați statusul cu `GET /api/order/{paymentId}` sau `GET /api/order/merchant/{Order}`. Retrimiterea o puteți cere la suportul Paynet.
- Dacă serverul dvs. este protejat de firewall, permiteți cererile de intrare de la adresele IP Paynet: `93.113.159.22` — producție, `93.113.159.23` — mediul de test.
- Antifrauda nu va anula o plată pentru care ați primit `PAID`: ea acționează înainte de confirmarea plății. O plată achitată își schimbă statusul doar după [rambursarea](#/guides/errors-and-statuses) dvs. (`5` sau `6`).

## Simulatorul de notificări pe acest portal

Deschideți **General → Notificări → Simulator notificări**:

1. Introduceți URL-ul dvs. de callback. Trebuie să fie accesibil din internet și, **doar pentru simulator**, să accepte cereri din browser (CORS).
2. Verificați cheia secretă pentru notificări: cheia de test `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` este deja completată; o puteți înlocui cu propria cheie.
3. Introduceți numărul comenzii comerciantului (`Order`) al unei plăți de test **achitate** și apăsați **Get** — portalul încarcă plata.
4. Apăsați **Send notification** — portalul trimite la URL-ul dvs. o notificare `PAID` semnată, construită din această plată, și afișează `PreparedString` și `Hash` folosite.

Este o simulare trimisă din browserul dvs., nu o notificare reală Paynet. Pentru comenzile neplătite simulatorul nu trimite nimic — la fel ca Paynet.

> **Important:** CORS este necesar doar simulatorului, deoarece trimite cererea din browser. Notificările reale sunt trimise de serverul Paynet și CORS nu se aplică: nu activați CORS pe endpoint-ul de producție pentru Paynet. O simulare reușită verifică validarea semnăturii și procesarea, nu livrarea de la Paynet (acces din rețea, firewall, certificat TLS). Confirmați livrarea cu o plată de test reală.
