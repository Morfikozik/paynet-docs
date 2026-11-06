# Notificări (webhooks)

Paynet notifică sistemul dvs. când plata este achitată. Notificarea este un `POST` HTTP cu corp JSON, trimis la URL-ul de callback comunicat către Paynet. Funcționează la fel pentru integrările server-to-server și hosted checkout.

## Cererea

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

## Câmpuri

| Câmp | Tip | Descriere |
|---|---|---|
| `Eventid` | long | ID-ul notificării. |
| `EventType` | string | Tipul evenimentului, `PAID` pentru o plată achitată. Comparați fără a ține cont de majuscule (documentele vechi scriu `Paid`). |
| `EventDate` | datetime | Când a fost creată notificarea (ISO 8601). |
| `Payment.ID` | long | ID-ul plății Paynet (`paymentId`). Folosiți-l drept cheie de idempotență. |
| `Payment.ExternalID` | long | Numărul comenzii dvs. (`Order`). |
| `Payment.Merchant` | string | Codul dvs. de comerciant. |
| `Payment.Customer` | string | Referința clientului (poate fi mascată). |
| `Payment.StatusDate` | datetime | Când plata a ajuns în acest status. |
| `Payment.Amount` | long | Suma în unități minime. |
| `Payment.SaleAreaCode` | string | Codul zonei de vânzare (opțional). |
| `Payment.CardMask`, `CardExpireMonth`, `CardExpireYear`, `CardIssuer`, `CardLinkHash` | string | Datele cardului, pentru plăți cu cardul (opțional). |
| `Payment.MoneyType` | string | Metoda de plată (opțional). |
| `Payment.PayerName`, `PayerSurname`, `PayerIDNP`, `RRN` | string | Datele plătitorului și RRN (opțional). |
| `Hash` (antet HTTP) | string | Semnătura notificării. |

Ignorați câmpurile necunoscute: pot apărea câmpuri opționale noi.

## Verificarea semnăturii

```text
PreparedString = EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
                 Payment.ExternalID + Payment.ID + Payment.Merchant + Payment.StatusDate
ExpectedHash   = Base64( MD5( PreparedString + NotificationSecretKey ) )
```

- Folosiți valorile exact așa cum au fost primite (ca șiruri). O valoare lipsă sau `null` este un șir gol.
- Ordinea este fixă: câmpurile sortate alfabetic după numele complet.
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

> **Important:** construiți `PreparedString` din valorile exact așa cum apar în corpul JSON. Nu reformatați datele (păstrați `2016-01-01T00:00:00` ca atare) și nu schimbați notația numerelor.

## Răspuns și reîncercări

- Răspundeți HTTP `200` **după** ce ați verificat hash-ul și ați salvat rezultatul.
- Orice alt status (sau un timeout) este considerat eșec: Paynet reîncearcă notificarea **de până la 3 ori**, apoi se oprește.
- Din cauza reîncercărilor aceeași notificare poate sosi de mai multe ori. Procesați fiecare `Payment.ID` o singură dată.
- Dacă nu ați primit notificarea, folosiți `GET /api/order/{paymentId}` sau `GET /api/order/merchant/{Order}`.

## Testarea notificărilor pe acest portal

Deschideți **Notificări (webhooks)** în meniul lateral (secțiunea **Ecommerce**):

1. Introduceți URL-ul dvs. de callback (trebuie să fie accesibil din internet și să accepte cereri din browser — CORS).
2. Introduceți cheia secretă pentru notificări (test: `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`).
3. Introduceți numărul comenzii comerciantului (`Order`) și apăsați **Get** — portalul încarcă plata.
4. Apăsați **Send notification** — portalul trimite la URL-ul dvs. o notificare semnată, construită din această plată, și afișează `PreparedString` și `Hash` folosite.

Este o simulare trimisă din browserul dvs., nu o notificare reală Paynet.
