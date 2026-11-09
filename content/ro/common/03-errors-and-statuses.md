# Erori și statusuri

## Coduri HTTP

| HTTP | `code` | Semnificație | Ce faceți |
|---|---|---|---|
| `200` | — | Succes. | — |
| `400` | `INVALID_PARAMETER` | Unul sau mai mulți parametri lipsesc sau sunt invalizi. `details` numește parametrul. | Corectați cererea. Nu o repetați nemodificată. |
| `401` | `UNAUTHORIZED` | Tokenul Bearer lipsește, este invalid sau a expirat. | Apelați din nou `/auth` și repetați o singură dată. |
| `404` | `NOT_FOUND_RECORD` | Nu există plată/înregistrare cu acest ID. | Verificați ID-ul (`paymentId` sau `Order`-ul dvs.). |
| `500` | `TECHNICAL_ERROR` | Eroare pe partea Paynet **sau** un `Order` repetat care nu poate fi refolosit (vezi mai jos). | Verificați cu `GET /api/order/merchant/{Order}` dacă comanda există; dacă este o eroare tehnică reală, reîncercați mai târziu, cu pauză. |
| `500` | `AUTHENTICATION_FAILED` | `/auth` cu utilizator sau parolă greșite. | Verificați datele de autentificare. |

## Corpul erorii

```json
{
  "status": 400,
  "message": "One or more entered parameters are incorrect.",
  "code": "INVALID_PARAMETER",
  "traceId": "9b9346f9-f83a-465d-ac8d-dc382c460c22",
  "details": "The invalid parameter is: XXXX"
}
```

| Câmp | Descriere |
|---|---|
| `status` | Statusul HTTP. |
| `message` | Mesaj pentru oameni. |
| `code` | Codul erorii, citibil de mașină (tabelul de mai sus). |
| `traceId` | ID-ul cererii. Trimiteți-l suportului Paynet când raportați o problemă. |
| `details` | Informații suplimentare, de ex. parametrul invalid. |

> **Notă:** răspunsurile `401` folosesc chei cu majusculă (`Status`, `Message`, `Code`, `TraceId`). Citiți câmpurile erorii fără a ține cont de majuscule. `/auth` poate returna obiectul de eroare într-un array.

### JSON invalid sau câmpuri obligatorii lipsă

Dacă corpul cererii nu poate fi citit (JSON invalid, tipuri greșite, lipsește un câmp obligatoriu), API-ul răspunde `400` într-un alt format, cu eroarea în `errorInfo`:

```json
{
  "errorInfo": {
    "title": "One or more validation errors occurred.",
    "status": 400,
    "ppResponseCodeEnum": "TECHNICAL_ERROR",
    "ppResponseCode": 1,
    "ppResponseCodeText": "TECHNICAL_ERROR",
    "errors": {
      "$": ["JSON deserialization for type '…DeleteLinkedCardRequest' was missing required properties including: 'cardLinkHash', 'saleAreaCode', 'customerCode'."]
    },
    "traceId": "00-7c209d88f31e3e5cd2f7bd88ae2f23c2-ad167338e418068c-00"
  }
}
```

`errors` enumeră câmpurile cu probleme. Tratați ambele formate de eroare: verificați întâi `errorInfo`, apoi citiți `status` / `code` / `message`.

Numele câmpurilor din cerere nu țin cont de majuscule: sunt acceptate și `CardLinkHash`, și `cardLinkHash` (verificat pe API-ul de test). Folosiți scrierea din exemple.

## Număr de comandă repetat (Order)

| Situație | Rezultat |
|---|---|
| `Order` nou | Se creează o plată nouă. |
| Același `Order`, **aceleași date**, plata încă neachitată | Se returnează același `paymentId` și `paymentLink`. Repetarea este sigură, de ex. după un timeout. |
| Același `Order`, **date diferite** (sumă, produse, …) | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. |
| Același `Order`, plata deja achitată sau în procesare la banca emitentă | Server-to-server: HTTP `500`, `TECHNICAL_ERROR`. Hosted checkout: clientul vede pagina Paynet „Plata a fost respinsă” (factura este deja plătită sau în curs de procesare). |

Corpul erorii în aceste cazuri:

```json
{
  "status": 500,
  "message": "One or more errors occurred.",
  "code": "TECHNICAL_ERROR",
  "traceId": "11de6054-87ef-484d-a368-7cfae0b452ff",
  "details": "Please verify the transmitted data and try again, or contact support."
}
```

**Regulă:** o comandă în magazin = un `Order`. Dacă clientul modifică coșul, creați o comandă nouă cu un `Order` nou.

## Statusul plății

Obiectul plății (`POST /api/order`, `GET /api/order/{id}`, `GET /api/order/merchant/{id}`, `GET /api/order/search`) are un `status` numeric și datele `registered`, `paidDate`, `expiryDate`.

O comandă nou creată are `status` = `1` și `paidDate` = `null`.

| `status` | Semnificație | Ce faceți |
|---|---|---|
| `1` | Înregistrată: comanda există, încă nu e plătită | Așteptați plata. Dacă clientul a părăsit pagina, îl puteți trimite din nou la același `paymentLink`. |
| `3` | În procesare: clientul a apăsat „Plătește”, banca încă nu a răspuns | Nu creați comanda din nou și nu o anulați. Verificați statusul mai târziu. |
| `4` | Achitată | Onorați comanda. |
| `5` | Anulată: refuzată de bancă, anulată de antifraudă sau rambursată integral | Final. O nouă încercare de plată necesită o comandă cu un `Order` nou. |
| `6` | Rambursată parțial | Final. |

```
1 ──► 3 ──► 4 ──► 5  (full refund / полный возврат / rambursare totală)
      │      └──► 6  (partial refund / частичный возврат / rambursare parțială)
      └──► 5  (declined, antifraud / отказ, антифрод / refuz, antifraudă)
```

- `5` și `6` sunt finale: după ele nu se mai schimbă nimic. Valoarea `2` nu se folosește.
- Nu există un status separat „expirată”: dacă `ExpiryDate` a trecut fără plată, comanda rămâne `1`, dar nu mai poate fi plătită.
- Antifrauda acționează înainte de confirmarea plății. După ce ați primit o notificare `PAID` verificată, antifrauda nu va anula acea plată; statusul `5` la o comandă plătită înseamnă doar rambursare integrală.
- Considerați plata achitată când ați primit o notificare `PAID` verificată sau `status` = `4`.

### Plată eșuată și o nouă încercare

O plată eșuată nu generează notificare: clientul revine la `LinkUrlCancel`. Verificați statusul cu `GET /api/order/merchant/{Order}`:

| `status` | Ce s-a întâmplat | Cum îi permiteți clientului să plătească din nou |
|---|---|---|
| `1` | Clientul nu a plătit (de exemplu, a închis pagina) | Trimiteți-l la același `paymentLink`. |
| `3` | Plata este încă în procesare | Așteptați și verificați statusul din nou. Nu creați o comandă nouă. |
| `5` | Banca a refuzat plata | Comanda este închisă. Creați o comandă nouă cu un `Order` **nou** și trimiteți clientul la noul `paymentLink`. |

## Date și formate

| Unde | Format | Exemplu |
|---|---|---|
| `ExpiryDate` în cereri | `YYYY-MM-DDTHH:mm:ss`, **ora locală Chișinău** | `2026-12-31T23:59:59` |
| Datele în răspunsurile despre plată | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
| `eventDate` în răspunsul la rambursare | `DD.MM.YYYY HH:mm:ss` | `09.11.2026 18:17:54` |
| Datele în notificări | `YYYY-MM-DDTHH:mm:ss`, ora locală Chișinău | `2026-11-09T12:00:00` |
| `from` / `to` în `/api/order/search` | dată-oră ISO 8601 | `2026-03-09T06:40:05.010Z` |
| `dateStart` / `dateFinish` în extrase | dată | `2026-03-01` |
| Sume | întreg, unități minime | `1201` = 12,01 MDL |
| Monedă | numeric ISO 4217 | `498` = MDL |

Ora locală Chișinău este fusul orar `Europe/Chisinau`: UTC+2 iarna, UTC+3 vara. Dacă serverul rulează în UTC, convertiți ora înainte de a construi `ExpiryDate`, altfel comenzile expiră cu 2–3 ore mai devreme decât intenționat.

## Rambursări

`POST /api/order/refund`:

```json
{
  "PaymentId": 296901,
  "SaleAreaCode": "onlidocumentation_md",
  "RefundType": "full",
  "Amount": 50000,
  "Currency": 498,
  "Reason": "Customer request"
}
```

| Regulă | Valoare |
|---|---|
| Ce se poate rambursa | Doar o plată achitată (`status` = `4`). |
| De câte ori | **O singură** rambursare per plată: integrală (`full`) sau parțială (`partial`). A doua rambursare a aceleiași plăți nu este posibilă. |
| Suma | `Amount` în unități minime; maximum `PaidAmount` al plății (mai mic decât suma comenzii când s-a aplicat o promoție). |
| Termen | 180 de zile după plată. |
| Metode de plată | Toate, cu excepția `CASH_INVOICE`. |
| Rezultat | Imediat în răspunsul `POST /api/order/refund`. Pentru rambursări nu se trimite notificare pe callback. |
| Statusul după | `5` după rambursarea integrală, `6` după cea parțială. Ambele sunt finale. |
| Soldul comerciantului | Dacă în contul comerciantului din Paynet nu sunt bani, rambursarea nu trece. |

### Răspunsuri la rambursare (verificat în mediul de test)

| Situație | Răspuns |
|---|---|
| Rambursare efectuată | `200`, corpul mai jos |
| Plata nu este achitată | `404 NOT_FOUND_RECORD` |
| Suma depășește suma plătită | `400 INVALID_PARAMETER`, `details`: „The invalid parameter is: RefundType”. Câmpul din `details` este indicat greșit: cauza este suma |
| Rambursare integrală după una parțială | `400 INVALID_PARAMETER`, `details`: „The invalid parameter is: RefundType” |

```json
{
  "paymentId": 328733,
  "saleAreaCode": "onlidocumentation_md",
  "customer": "464566161",
  "eventDate": "09.11.2026 18:17:54",
  "refundType": "full",
  "currency": 498,
  "amount": 400,
  "merchant": "265505",
  "cardMask": "411111******1111",
  "cardLinkHash": null,
  "moneyType": "CYBER_SOURCE"
}
```

- `eventDate` în răspunsul la rambursare are formatul `DD.MM.YYYY HH:mm:ss`.
- `moneyType` aici este codul de procesare (de exemplu `CYBER_SOURCE`), nu valoarea din notificare (`CARD`…).
- După rambursare `paidDate` al plății rămâne completat.

> **Important:** mediul de test a acceptat o a doua rambursare parțială pentru aceeași plată. Regula Paynet este o singură rambursare per plată; nu vă bazați pe rambursări repetate în producție.
