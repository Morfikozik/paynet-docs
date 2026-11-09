# Salvarea cardurilor

Clientul își poate salva cardul la prima plată, iar data viitoare îl poate alege pe pagina Paynet fără să introducă din nou numărul cardului.

Funcționează doar la [integrarea server-to-server](#/guides/server-to-server). În formularul hosted checkout salvarea cardurilor nu este disponibilă.

> **Important:** aceasta nu este o debitare fără participarea clientului. Clientul trece întotdeauna prin pagina Paynet și confirmă plata. Paynet poate cere CVC sau 3-D Secure — depinde de setările magazinului dvs. pe partea Paynet.

## Activare

Salvarea cardurilor se activează pentru `SaleAreaCode` dvs. pe partea Paynet: contactați managerul dvs. Paynet. Pentru zona de vânzare de test comună `onlidocumentation_md` ea este activată: puteți încerca scenariul cu accesele de test.

## Ce este `CardLinkHash`

- Identificatorul intern Paynet al unui card salvat. Nu este numărul cardului și nici un token de rețea Visa/Mastercard.
- Este legat de `SaleAreaCode` (care aparține unui singur comerciant) și de `Customer.Code` al clientului.
- Nu funcționează în altă zonă de vânzare, chiar a aceluiași comerciant — cu excepția cazului în care Paynet a grupat acele zone pe partea sa.

## Cum funcționează

| Pas | Cine | Ce se întâmplă |
|---|---|---|
| 1 | Dvs. | Creați comanda cu `POST /api/order` și trimiteți obiectul `Customer`. Fără `Customer` cardul nu se salvează. |
| 2 | Clientul | Plătește cu cardul pe pagina Paynet. Bifa „salvează cardul” este activă implicit; clientul o poate debifa. |
| 3 | Paynet | Trimite notificarea `PAID` cu `Payment.CardLinkHash`. Dacă clientul a debifat, valoarea este `null`. |
| 4 | Dvs. | Salvați `CardLinkHash` împreună cu acest client (`Customer.Code`). |
| 5 | Dvs. | La următoarea plată trimiteți în `POST /api/order` câmpul `CardLinkHash` și aceleași date `Customer`. |
| 6 | Clientul | Vede cardul salvat pe pagina Paynet și confirmă plata. |

## Prima plată

O cerere obișnuită de [creare a comenzii](#/guides/server-to-server) cu obiectul `Customer`:

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
    { "Name": "Demo eShop", "Description": "Order #1762444800000", "Amount": 300 }
  ],
  "MoneyType": "Card",
  "Lang": "RO"
}
```

După plată notificarea `PAID` conține tokenul:

```json
{
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "CardLinkHash": "1037153_b3f50103610e4fe9948ff8db553151f3"
  }
}
```

(Fragment. Formatul complet este în [Notificări](#/guides/notifications).)

## Plata următoare

O comandă nouă cu un `Order` nou, același `Customer` și `CardLinkHash` salvat:

```json
{
  "Order": 1762531200000,
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
  "CardLinkHash": "1037153_b3f50103610e4fe9948ff8db553151f3",
  "Currency": 498,
  "ExpiryDate": "2026-12-31T23:59:59",
  "Services": [
    { "Name": "Demo eShop", "Description": "Order #1762531200000", "Amount": 300 }
  ],
  "MoneyType": "Card",
  "Lang": "RO"
}
```

Restul este ca de obicei: trimiteți clientul la `paymentLink` și așteptați notificarea `PAID`.

## Ce s-a verificat în mediul de test

| Situație | Ce se întâmplă |
|---|---|
| Prima plată cu `Customer`, bifa păstrată | `CardLinkHash` vine în notificare și în răspunsul `GET /api/order/merchant/{Order}` (`cardLinkHash` și `customer.cardLinkHash`) |
| Plata următoare: același `Customer` + `CardLinkHash` | Pagina Paynet afișează cardul salvat (masca și data expirării). Clientul îl poate alege, poate introduce alt card sau poate șterge cardul salvat |
| Alt `Customer.Code` + același `CardLinkHash` | Comanda se creează (`200`), dar cardul salvat **nu se afișează** — clientul introduce cardul din nou |
| `CardLinkHash` inexistent | Comanda se creează (`200`), pagina de plată este cea obișnuită |

API-ul nu respinge un token nepotrivit la crearea comenzii: protecția funcționează pe pagina de plată. De aceea păstrați fiecare token strict în pereche cu clientul pentru care a fost emis.

## Reguli

- `CardLinkHash` funcționează doar împreună cu `Customer` pentru care a fost emis. Trimiteți perechea neschimbată.
- `CardLinkHash` nu este acoperit de semnătura notificării. Înainte de a-l salva, confirmați plata și clientul prin API — vezi [Ce protejează semnătura](#/guides/notifications).
- Tokenul este valabil cât timp este valabil cardul. Dacă cardul a expirat sau a fost reemis, clientul plătește cu cardul nou și primiți un `CardLinkHash` nou — înlocuiți-l pe cel vechi.
- `CardLinkHash` în notificare poate fi `null` (clientul a debifat sau salvarea nu este activată). Este normal: nu salvați nimic.
- Păstrați `CardLinkHash` pe server și nu-l expuneți în browser.
- Pentru a șterge un card (de exemplu, la cererea clientului), apelați `POST /api/linked-cards/unlink` cu `CardLinkHash`, `SaleAreaCode` și `CustomerCode`.
