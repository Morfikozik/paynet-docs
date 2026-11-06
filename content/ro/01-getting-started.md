# Primii pași

API-ul de comerț electronic Paynet permite magazinului online să accepte plăți cu cardul, portofelul Paynet și alte metode. Clientul plătește pe pagina de plată Paynet, deci nu lucrați cu datele cardurilor.

Această pagină vă duce de la zero la o plată de test reușită în aproximativ 10 minute, folosind contul de test comun și panourile „Test API Request” ale portalului.

## De ce aveți nevoie

| Element | Mediu de test | Producție |
|---|---|---|
| URL de bază API | `https://ecom-api-test.paynet.md` | oferit de Paynet la lansare |
| Utilizator API (`username` / `password`) | `771064` / `sLgMnGWJ` | emis companiei dvs. de Paynet |
| Codul comerciantului (`Merchant`) | `265505` | emis de Paynet |
| Codul zonei de vânzare (`SaleAreaCode`) | `onlidocumentation_md` | emis de Paynet (unul per site/magazin) |
| Cheia secretă hosted checkout | `F90D6485-9CCC-458B-96A3-8958AF9B4458` | emisă de Paynet, păstrați-o secretă |
| Cheia secretă pentru notificări | `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7` | emisă de Paynet, păstrați-o secretă |
| Card de test | Visa `4111 1111 1111 1111`, expirare `12/27`, CVV `777` | carduri reale |

> **Notă:** datele de test de mai sus sunt publice intenționat și comune pentru toți cei care testează pe portal. Nu le folosiți niciodată în producție și nu puneți niciodată secretele de producție în codul front-end.

## Prima plată de test (server-to-server)

### Pasul 1. Obțineți tokenul de acces

Deschideți **Server-Server model → Autentificare și autorizare** și apăsați **Test API Request**. Nu modificați utilizatorul și parola.

```http
POST https://ecom-api-test.paynet.md/auth
Content-Type: application/json

{ "grantType": "password", "username": "771064", "password": "sLgMnGWJ" }
```

Rezultat așteptat: HTTP `200` cu `access_token` (valabil aproximativ 4 ore, vezi `expires_in`). Portalul reține tokenul și îl adaugă la următoarele cereri ca `Authorization: Bearer <token>`.

### Pasul 2. Creați comanda

Deschideți **Server-Server model → Creați o plată** și apăsați **Test API Request**.

Portalul completează automat un număr `Order` unic și `ExpiryDate` pentru mâine, deci exemplul funcționează fără modificări. Dacă editați cererea manual, rețineți:

- `Order` trebuie să fie nou pentru fiecare plată;
- `ExpiryDate` trebuie să fie în viitor, format `YYYY-MM-DDTHH:mm:ss`;
- sumele sunt numere întregi în unități minime: `300` = 3,00 MDL.

Rezultat așteptat: HTTP `200` cu `paymentId`, `status` `1` și un `paymentLink` de forma `https://test.paynet.md/ecom/getecom/317184?s=…`.

### Pasul 3. Plătiți pe pagina de plată

Deschideți `paymentLink` în browser și plătiți cu cardul de test `4111 1111 1111 1111`, `12/27`, CVV `777`.

### Pasul 4. Verificați statusul plății

Deschideți **Server-Server model → Obține informații despre plată după numărul comenzii comerciantului**, introduceți numărul `Order` și executați cererea. Veți vedea detaliile plății și statusul ei.

### Pasul 5. Testați notificarea (webhook)

Deschideți **Notificări (webhooks)** în meniul lateral. Introduceți URL-ul dvs. de callback, cheia secretă pentru notificări și numărul `Order`, apoi apăsați **Get** și **Send notification**. Portalul trimite la URL-ul dvs. o notificare simulată și semnată, ca să vă testați handler-ul. Detalii: [Notificări](#/guides/notifications).

## Pașii următori

- Alegeți modul de integrare: [Opțiuni de integrare](#/guides/integration-options).
- Citiți fluxul complet: [Server-to-server](#/guides/server-to-server) sau [Hosted checkout](#/guides/hosted-checkout).
- Scrieți integrarea cu ajutorul AI? Începeți cu [Integrare cu un asistent AI](#/guides/ai-assistants).
