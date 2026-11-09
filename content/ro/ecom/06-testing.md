# Testare

## Mediul de test

| Element | Valoare |
|---|---|
| URL de bază API | `https://ecom-api-test.paynet.md` |
| URL-ul formularului hosted checkout | `https://test.paynet.md/ecom/checkout` |
| Utilizator / parolă API | `771064` / `sLgMnGWJ` |
| Codul comerciantului | `265505` |
| Codul zonei de vânzare | `onlidocumentation_md` |
| Cheia secretă pentru semnătura hosted checkout | `F90D6485-9CCC-458B-96A3-8958AF9B4458` |
| Cheia secretă pentru notificări | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` |

Aceste date sunt comune pentru toți cei care testează pe portal: plățile de test ale altora apar în căutări și extrase. Dacă aveți nevoie de un mediu izolat, cereți de la Paynet un comerciant de test propriu.

## Card de test

| Card | Expirare | CVV | Rezultat |
|---|---|---|---|
| Visa `4111 1111 1111 1111` | `12/27` | `777` | plată reușită |

Cardurile de test pot reproduce doar o plată reușită: nu există carduri pentru plăți refuzate sau 3-D Secure. Tratarea refuzului trebuie totuși implementată și testată cu răspunsuri API simulate: `status` = `5` și revenirea clientului la `LinkUrlCancel` (vezi [Plată eșuată](#/guides/errors-and-statuses)). Când o plată reală eșuează, clientul este doar redirecționat la `LinkUrlCancel` și nu se trimite notificare.

## Ce face testele să eșueze

- **`Order` reutilizat.** Același `Order` cu date diferite sau un `Order` deja achitat dă `500 TECHNICAL_ERROR`. Portalul generează automat un `Order` nou (ora curentă în milisecunde).
- **`ExpiryDate` în trecut.** Folosiți o dată viitoare în ora locală Chișinău. Portalul pune sfârșitul zilei de mâine.
- **Sume în MDL în loc de unități minime.** `100` înseamnă 1,00 MDL.
- **Token expirat.** Tokenul este valabil aproximativ 4 ore; după `401` apelați din nou `/auth`.
- **Produsele nu se potrivesc.** Dacă trimiteți `Products`, trimiteți toate câmpurile produsului și păstrați valorile `Amount` coerente cu `Amount` al serviciului.

## Scenarii de test

| # | Scenariu | Cum | Rezultat așteptat |
|---|---|---|---|
| 1 | Autentificare | `POST /auth` cu datele de test | `200`, `access_token` |
| 2 | Parolă greșită | `POST /auth` cu parolă greșită | eroare `AUTHENTICATION_FAILED` |
| 3 | Creare comandă | `POST /api/order` | `200`, `paymentId`, `paymentLink`, `status` `1` |
| 4 | Repetarea aceleiași cereri | trimiteți scenariul 3 din nou, nemodificat | același `paymentId` și `paymentLink` |
| 5 | Același `Order`, altă sumă | modificați `Amount`, păstrați `Order` | `500`, `TECHNICAL_ERROR` |
| 6 | Cerere invalidă | `POST /api/order` fără `Services` | `400`, `INVALID_PARAMETER` |
| 7 | Fără token | `POST /api/order` fără `Authorization` | `401`, `UNAUTHORIZED` |
| 8 | Plată | deschideți `paymentLink`, plătiți cu cardul de test | revenire la `LinkUrlSuccess` |
| 9 | Status | `GET /api/order/merchant/{Order}` | plată cu `paidDate` completat |
| 10 | Comandă necunoscută | `GET /api/order/{id}` cu un ID aleator | `404`, `NOT_FOUND_RECORD` |
| 11 | Notificare | **Simulator notificări** → URL-ul dvs. | handler-ul verifică `Hash` și returnează `200` |
| 12 | Hash greșit | trimiteți o notificare cu `Amount` modificat | handler-ul o respinge |
| 13 | Notificare duplicată | trimiteți aceeași notificare de două ori | handler-ul o procesează o singură dată |
| 14 | Hosted checkout | **Formular checkout (încercați)** | se deschide pagina de plată de test Paynet |
| 15 | Rambursare | `POST /api/order/refund` pentru o plată achitată | `200`; `status` devine `5` (integrală) sau `6` (parțială) |
| 16 | Rambursare peste suma plătită | `RefundType` `partial`, `Amount` mai mare decât `PaidAmount` | `400 INVALID_PARAMETER` |
| 17 | Salvarea cardului (dacă este activată pentru `SaleAreaCode`) | `POST /api/order` cu `Customer`, plătiți păstrând bifa „salvează cardul” | notificarea `PAID` conține `CardLinkHash` |
| 18 | Plata cu card salvat (dacă este activată) | `POST /api/order` cu `CardLinkHash` și același `Customer` | pagina Paynet afișează cardul salvat |
| 19 | Clientul a plecat fără să plătească | deschideți `paymentLink`, închideți pagina, deschideți linkul din nou | `status` rămâne `1`, plata e încă posibilă |

## Testare de pe acest portal

Butoanele „Test API Request” apelează API-ul de test direct din browserul dvs. Funcționează pe domeniul oficial al portalului. Dacă deschideți o copie a portalului de la altă adresă, browserul poate bloca apelurile (CORS) — folosiți atunci cURL sau Postman. Colecția Postman se descarcă din meniul lateral.
