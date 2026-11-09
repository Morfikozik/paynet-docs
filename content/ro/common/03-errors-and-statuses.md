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

> **Ciornă:** descrierea tuturor valorilor `status` va fi publicată mai târziu. Până atunci, considerați plata achitată când ați primit o notificare `PAID` verificată sau când `paidDate` este completat.

O plată eșuată nu generează notificare: clientul este redirecționat la `LinkUrlCancel`, iar comanda rămâne neplătită până la expirarea `ExpiryDate`.

## Date și formate

| Unde | Format | Exemplu |
|---|---|---|
| `ExpiryDate` în cereri | `YYYY-MM-DDTHH:mm:ss`, **ora locală Chișinău** | `2026-12-31T23:59:59` |
| Datele în răspunsurile despre plată | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
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

- `RefundType`: `full` sau `partial`.
- `Amount` în unități minime; pentru `partial` este suma de returnat.
- Se pot rambursa doar plățile achitate.
