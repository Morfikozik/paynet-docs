# Testare

## Mediul de test

| Element | Valoare |
|---|---|
| URL de bază API | `https://ecom-api-test.paynet.md` |
| URL hosted checkout | `https://test.paynet.md/ecom/checkout` |
| Utilizator / parolă API | `771064` / `sLgMnGWJ` |
| Codul comerciantului | `265505` |
| Codul zonei de vânzare | `onlidocumentation_md` |
| Cheia secretă hosted checkout | `F90D6485-9CCC-458B-96A3-8958AF9B4458` |
| Cheia secretă pentru notificări | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` |

Aceste date sunt comune pentru toți cei care testează pe portal: plățile de test ale altora apar în căutări și extrase. Dacă aveți nevoie de un mediu izolat, cereți de la Paynet un comerciant de test propriu.

## Card de test

| Card | Expirare | CVV | Rezultat |
|---|---|---|---|
| Visa `4111 1111 1111 1111` | `12/27` | `777` | plată reușită |

> **Ciornă:** cardurile de test pentru plăți refuzate și scenarii 3-D Secure nu sunt încă publicate. Cereți-le de la Paynet dacă aveți nevoie.

## Ce face testele să eșueze

- **`Order` reutilizat.** Fiecare comandă are nevoie de un număr nou. Portalul îl generează automat (ora curentă în milisecunde).
- **`ExpiryDate` în trecut.** Folosiți o dată viitoare. Portalul pune sfârșitul zilei de mâine.
- **Sume în MDL în loc de unități minime.** `100` înseamnă 1,00 MDL.
- **Token expirat.** Tokenul este valabil aproximativ 4 ore; după `401` apelați din nou `/auth`.
- **Produsele nu se potrivesc.** Dacă trimiteți `Products`, trimiteți toate câmpurile produsului și păstrați valorile `Amount` coerente cu `Amount` al serviciului.

## Scenarii de test

| # | Scenariu | Cum | Rezultat așteptat |
|---|---|---|---|
| 1 | Autentificare | `POST /auth` cu datele de test | `200`, `access_token` |
| 2 | Parolă greșită | `POST /auth` cu parolă greșită | eroare `AUTHENTICATION_FAILED` |
| 3 | Creare comandă | `POST /api/order` | `200`, `paymentId`, `paymentLink`, `status` `1` |
| 4 | Cerere invalidă | `POST /api/order` fără `Services` | `400`, `INVALID_PARAMETER` |
| 5 | Fără token | `POST /api/order` fără `Authorization` | `401`, `UNAUTHORIZED` |
| 6 | Plată | deschideți `paymentLink`, plătiți cu cardul de test | revenire la `LinkUrlSuccess` |
| 7 | Status | `GET /api/order/merchant/{Order}` | plată cu `paidDate` completat |
| 8 | Comandă necunoscută | `GET /api/order/{id}` cu un ID aleator | `404`, `NOT_FOUND_RECORD` |
| 9 | Notificare | simulatorul **Notificări** de pe portal → URL-ul dvs. | handler-ul verifică `Hash` și returnează `200` |
| 10 | Hash greșit | trimiteți o notificare cu `Amount` modificat | handler-ul o respinge |
| 11 | Notificare duplicată | trimiteți aceeași notificare de două ori | handler-ul o procesează o singură dată |
| 12 | Hosted checkout | **Order request v0.6** pe portal | se deschide pagina de plată de test Paynet |
| 13 | Rambursare | `POST /api/order/refund` pentru o plată achitată | `200` |

## Testare de pe acest portal

Butoanele „Test API Request” apelează API-ul de test direct din browserul dvs. Funcționează pe domeniul oficial al portalului. Dacă deschideți o copie a portalului de la altă adresă, browserul poate bloca apelurile (CORS) — folosiți atunci cURL sau Postman. Colecția Postman se descarcă din meniul lateral.
