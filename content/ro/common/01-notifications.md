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
- Ordinea este fixă: cele 9 câmpuri de mai sus, sortate alfabetic după numele complet.
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

## Răspuns și reîncercări

- Răspundeți HTTP `200` **după** ce ați verificat hash-ul și ați salvat rezultatul.
- Răspundeți repede: salvați notificarea, returnați `200`, iar procesarea grea faceți-o după răspuns.
- Orice alt răspuns (sau lipsa răspunsului) este considerat eșec, iar Paynet trimite notificarea din nou. Exemplu dintr-un log real: 7 încercări în circa 9 minute, în două serii, după care trimiterea s-a oprit. Programul exact nu este garantat — nu vă bazați pe el.
- Din cauza reîncercărilor aceeași notificare poate sosi de mai multe ori. Procesați fiecare `Payment.Id` o singură dată.
- Dacă notificarea nu a sosit (de exemplu, serverul a fost indisponibil mai mult decât toate încercările), verificați statusul cu `GET /api/order/{paymentId}` sau `GET /api/order/merchant/{Order}`. Retrimiterea o puteți cere la suportul Paynet.
- Dacă serverul dvs. este protejat de firewall, adresele IP de la care vin notificările le puteți obține de la suportul Paynet.
- `PAID` este final: antifrauda acționează înainte de confirmarea plății, deci nu va anula ulterior această plată. Doar [rambursarea](#/guides/errors-and-statuses) dvs. schimbă o plată achitată.

## Simulatorul de notificări pe acest portal

Deschideți **General → Notificări → Simulator notificări**:

1. Introduceți URL-ul dvs. de callback. Trebuie să fie accesibil din internet și, **doar pentru simulator**, să accepte cereri din browser (CORS).
2. Introduceți cheia secretă pentru notificări (test: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Introduceți numărul comenzii comerciantului (`Order`) al unei plăți de test **achitate** și apăsați **Get** — portalul încarcă plata.
4. Apăsați **Send notification** — portalul trimite la URL-ul dvs. o notificare `PAID` semnată, construită din această plată, și afișează `PreparedString` și `Hash` folosite.

Este o simulare trimisă din browserul dvs., nu o notificare reală Paynet. Pentru comenzile neplătite simulatorul nu trimite nimic — la fel ca Paynet.

> **Important:** CORS este necesar doar simulatorului, deoarece trimite cererea din browser. Notificările reale sunt trimise de serverul Paynet și CORS nu se aplică: nu activați CORS pe endpoint-ul de producție pentru Paynet. O simulare reușită verifică validarea semnăturii și procesarea, nu livrarea de la Paynet (acces din rețea, firewall, certificat TLS). Confirmați livrarea cu o plată de test reală.
