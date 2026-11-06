# Statusuri și erori

## Coduri HTTP

| HTTP | `code` | Semnificație | Ce faceți |
|---|---|---|---|
| `200` | — | Succes. | — |
| `400` | `INVALID_PARAMETER` | Unul sau mai mulți parametri lipsesc sau sunt invalizi. `details` numește parametrul. | Corectați cererea. Nu o repetați nemodificată. |
| `401` | `UNAUTHORIZED` | Tokenul Bearer lipsește, este invalid sau a expirat. | Apelați din nou `/auth` și repetați o singură dată. |
| `404` | `NOT_FOUND_RECORD` | Nu există plată/înregistrare cu acest ID. | Verificați ID-ul (`paymentId` sau `Order`-ul dvs.). |
| `500` | `TECHNICAL_ERROR` | Eroare pe partea Paynet. | Reîncercați mai târziu, cu pauză. Pentru `POST /api/order` verificați întâi cu `GET /api/order/merchant/{Order}` dacă comanda a fost creată. |
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

> **Notă:** unele răspunsuri `401` folosesc chei cu majusculă (`Status`, `Message`, `Code`, `TraceId`). Citiți câmpurile erorii fără a ține cont de majuscule. `/auth` poate returna obiectul de eroare într-un array.

## Statusul plății

Obiectul plății (`POST /api/order`, `GET /api/order/{id}`, `GET /api/order/merchant/{id}`, `GET /api/order/search`) are un `status` numeric și datele `registered`, `paidDate`, `expiryDate`.

O comandă nou creată are `status` = `1` și `paidDate` = `null`.

> **Ciornă:** semnificația tuturor valorilor `status` în API v1 nu este încă confirmată de Paynet. Specificația v0.5 definește: `1` Înregistrată, `2` Client verificat, `3` Inițiată pentru plată, `4` Plătită. Până la confirmare, considerați plata achitată când ați primit o notificare `PAID` verificată sau când `paidDate` este completat.

## Date și formate

| Unde | Format | Exemplu |
|---|---|---|
| `ExpiryDate` în cereri | `YYYY-MM-DDTHH:mm:ss` | `2026-12-31T23:59:59` |
| Datele în răspunsurile despre plată | `YYYY-MM-DD HH:mm:ss` | `2026-04-01 15:01:12` |
| `from` / `to` în `/api/order/search` | dată-oră ISO 8601 | `2026-03-09T06:40:05.010Z` |
| `dateStart` / `dateFinish` în extrase | dată | `2026-03-01` |
| Sume | întreg, unități minime | `1201` = 12,01 MDL |
| Monedă | numeric ISO 4217 | `498` = MDL |

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
