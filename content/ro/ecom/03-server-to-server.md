# Integrare server-to-server

În acest model backend-ul dvs. comunică direct cu API-ul Paynet. Este opțiunea recomandată pentru magazinele cu backend propriu.

## Prezentare generală

1. `POST /auth` → obțineți tokenul de acces.
2. `POST /api/order` → înregistrați comanda, primiți `paymentId` și `paymentLink`.
3. Redirecționați clientul la `paymentLink`.
4. Primiți [notificarea](#/guides/notifications) la URL-ul de callback și verificați `Hash`.
5. Confirmați cu `GET /api/order/{paymentId}` și onorați comanda.

URL de bază: `https://ecom-api-test.paynet.md` (test), `https://ecom-api.paynet.md` (producție). Toate corpurile cererilor sunt JSON (`Content-Type: application/json`).

## 1. Autentificare

```http
POST /auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

```json
{ "access_token": "Ccxl7QQiMEoakkrUoiUn8PIg…", "token_type": "bearer", "expires_in": 14399 }
```

Trimiteți tokenul în toate celelalte cereri: `Authorization: Bearer <access_token>`. `expires_in` este în secunde (aproximativ 4 ore). Păstrați tokenul în cache și cereți unul nou când expiră sau când API-ul returnează `401`.

Datele de autentificare greșite returnează o eroare cu `code` `AUTHENTICATION_FAILED`.

## 2. Crearea comenzii

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
          "Quantity": 3,
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

### Câmpurile cererii

| Câmp | Tip | Obligatoriu | Descriere |
|---|---|---|---|
| `Order` | integer (int64) | da | Numărul comenzii la dvs. O comandă din magazin = un `Order` (vezi [număr de comandă repetat](#/guides/errors-and-statuses)). |
| `SaleAreaCode` | string | da | Codul zonei de vânzare (site-ului) emis de Paynet. |
| `LinkUrlSuccess` | string | da | Unde revine clientul după plata reușită. |
| `LinkUrlCancel` | string | da | Unde revine clientul după anulare. |
| `Currency` | integer | da | Cod numeric ISO 4217. `498` = MDL. |
| `ExpiryDate` | string | da | Termenul de plată, `YYYY-MM-DDTHH:mm:ss`, ora locală Chișinău (`Europe/Chisinau`), în viitor. |
| `Services` | array | da | Cel puțin un serviciu, vezi mai jos. |
| `MoneyType` | string | da | `All`, `Card`, `Paynet`, `MIA` sau `CashInvoice` (vezi mai jos). |
| `Lang` | string | da | Limba paginii de plată: `RO`, `RU` sau `EN`. |
| `Customer` | object | nu | Datele clientului. Obligatoriu pentru a [salva cardul](#/guides/saved-cards) sau a plăti cu un card salvat. |
| `Customer.Code` | string | da, dacă se trimite `Customer` | ID-ul clientului în sistemul dvs. |
| `Customer.NameFirst`, `NameLast`, `email`, `PhoneNumber` | string | nu | Datele clientului. Atenție: `email` cu literă mică. |
| `CardLinkHash` | string | nu | Tokenul cardului salvat al acestui client, primit într-o notificare. Trimiteți-l împreună cu același `Customer`. Vezi [Salvarea cardurilor](#/guides/saved-cards). |

`Services[]`:

| Câmp | Tip | Obligatoriu | Descriere |
|---|---|---|---|
| `Name` | string | da | Denumirea serviciului. |
| `Description` | string | da | Descrierea serviciului. |
| `Amount` | integer | da | Suma serviciului în unități minime. |
| `Products` | array | nu | Dacă trimiteți produse, toate câmpurile produsului de mai jos sunt obligatorii. |

`Services[].Products[]`: `LineNo` (int), `Code` (string), `Name` (string), `Description` (string), `UnitPrice` (int), `Quantity` (int), `Amount` (int), `TotalAmount` (int).

**Sumele** sunt numere întregi în unități minime (bani): `1201` = 12,01 MDL.

**MoneyType** stabilește ce metode de plată vede clientul:

| `MoneyType` | Clientul vede |
|---|---|
| `All` | toate metodele activate pentru comerciant |
| `Card` | card (Visa/Mastercard), Apple Pay, Google Pay |
| `Paynet` | portofel Paynet |
| `MIA` | plăți instant MIA |
| `CashInvoice` | factură cu plată în numerar |

Nu există o valoare separată pentru Apple Pay și Google Pay: apar atât cu `Card`, cât și cu `All`. Cum a plătit clientul efectiv vă spune notificarea (`CARD`, `APPLEPAY`, `GOOGLEPAY`, `MIA_QR`, `PAYNET`, `CASH_INVOICE`).

### Răspuns

```json
{
  "paymentId": 317184,
  "paymentLink": "https://test.paynet.md/ecom/getecom/317184?s=ea20bad9b2c464765542e000eb886057",
  "status": 1,
  "order": 18223,
  "merchantCode": "111125",
  "saleAreaCode": "makle",
  "amount": { "requestAmount": 3, "requestCurrency": 498, "amount": 3, "amountCurrency": 3 },
  "expiryDate": "2026-04-03 12:01:12",
  "registered": "2026-04-01 15:01:12",
  "paidDate": null,
  "moneyType": "All"
}
```

(Prescurtat. Răspunsul complet conține și `customer`, `payer`, `services`, `cardLinkHash`, `signature`, `linkUrlSuccess`, `linkUrlCancel`.)

Salvați `paymentId` împreună cu comanda: este cheia pentru verificarea statusului, rambursări și notificări.

**Repetarea cererii.** Dacă trimiteți din nou același `Order` cu aceleași date (cât timp nu este plătit), primiți același `paymentId` și `paymentLink` — repetarea după un timeout este sigură. Același `Order` cu date diferite sau după plată dă `500 TECHNICAL_ERROR`. Dacă s-a schimbat coșul, folosiți un `Order` nou.

## 3. Redirecționați clientul

Trimiteți browserul clientului la `paymentLink` (HTTP 302 sau link/buton). După plata reușită clientul revine la `LinkUrlSuccess`; dacă plata eșuează sau este anulată — la `LinkUrlCancel`.

## 4. Procesați notificarea

Când plata este achitată, Paynet trimite un `POST` semnat la URL-ul dvs. de callback (`EventType` = `PAID`; plățile eșuate nu se notifică). Verificați antetul `Hash`, comparați `PaidAmount` cu `Amount` și răspundeți HTTP `200`. Vezi [Notificări](#/guides/notifications).

## 5. Verificați statusul

```http
GET /api/order/{paymentId}
GET /api/order/merchant/{Order}
Authorization: Bearer <access_token>
```

Ambele returnează același obiect de plată. Folosiți-le înainte de livrare și dacă notificarea nu a sosit. Vezi [Erori și statusuri](#/guides/errors-and-statuses).

## Alte operațiuni

| Operațiune | Cerere | Note |
|---|---|---|
| Căutare plăți | `GET /api/order/search?from=…&to=…` | Dată-oră ISO 8601, de ex. `2026-03-09T06:40:05.010Z`. |
| Rambursare | `POST /api/order/refund` | Corp: `PaymentId`, `SaleAreaCode`, `RefundType` (`full` sau `partial`), `Amount`, `Currency`, `Reason`. |
| Deconectarea unui card salvat | `POST /api/linked-cards/unlink` | Corp: `CardLinkHash`, `SaleAreaCode`, `CustomerCode`. |
| Extras | `GET /api/statement?dateStart=…&dateFinish=…` | Date de forma `2026-03-01`. `accountId` opțional. |
| Extras (Excel) | `GET /api/statement/download?dateStart=…&dateFinish=…` | Returnează un fișier `.xlsx`. Perioadă de cel mult 31 de zile. |

## Exemplu: Node.js (18+)

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

## Exemplu: PHP

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
