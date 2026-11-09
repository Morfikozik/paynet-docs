# Integrare cu un asistent AI

Puteți da această documentație oricărui asistent AI de programare (Claude, ChatGPT, Gemini, Copilot, Cursor și alții) și să-i cereți să scrie integrarea.

## Fișiere pentru AI

| Fișier | Ce conține | Când îl folosiți |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | Toată documentația într-un singur fișier text: toate produsele, ghidurile, referința API, semnăturile cu vectori de test, datele de test | Dați asistentului acest singur fișier. |
| [`llms-ecom.txt`](llms-ecom.txt) | Doar E-commerce și subiectele generale de care are nevoie (notificări, semnături, erori) | Când integrați doar plățile e-commerce. |
| [`llms.txt`](llms.txt) | Cuprins scurt cu linkuri către toate paginile | Pentru asistenții care navighează singuri prin linkuri. |
| [`openapi.json`](openapi.json) | Specificația OpenAPI 3 a API-ului server-to-server | Pentru generatoare de cod și clienți tipizați. |
| `docs/<page>.md` | Fiecare ghid ca fișier Markdown separat | Când aveți nevoie de un singur subiect. |

Fiecare pagină de ghid are un buton **Copiază pentru AI**, care copiază pagina în format Markdown.

> **Notă:** majoritatea asistenților nu pot citi portalul deschizând adresa lui, deoarece paginile sunt generate cu JavaScript. Dați-le `llms-full.txt` sau `llms-ecom.txt` (încărcați fișierul sau lipiți linkul). Fișierele pentru AI sunt în engleză, limba cu care modelele lucrează cel mai bine; vă pot răspunde în orice limbă.

## Șablon de cerere

Copiați, completați parantezele și atașați `llms-ecom.txt`:

```text
You are integrating Paynet e-commerce payments into my project.
Use ONLY the attached Paynet documentation as the source of truth.

My stack: [e.g. Node.js 20 + Express / PHP 8.2 + Laravel / Python 3.12 + Django]
Integration type: [server-to-server API | hosted checkout form]
What to build:
1. Create a payment for a cart and redirect the customer to Paynet.
2. A notification endpoint that verifies the Hash header and marks the order paid exactly once.
3. A status check by paymentId used before fulfilment.

Requirements:
- Read credentials and secret keys from environment variables.
- One shop order = one unique Order number; ExpiryDate in the future, in Europe/Chisinau time.
- Amounts are integers in minor units (100 = 1.00 MDL).
- Implement signatures exactly as documented and add unit tests that reproduce
  the test vectors from the "Signatures" section.
- Do not invent endpoints, fields or status values that are not in the documentation.
  If something is missing, list it as an open question instead of guessing.
- Answer me in Romanian.
```

## Reguli pentru asistent

Aceste reguli sunt incluse și la începutul fișierelor pentru AI:

1. API de test: `https://ecom-api-test.paynet.md`; API de producție: `https://ecom-api.paynet.md` (aceleași căi: `/auth`, `/api/...`). Formularul hosted checkout: `https://test.paynet.md/ecom/checkout` (test), `https://paynet.md/ecom/checkout` (producție).
2. Autentificare cu `POST /auth` (JSON), apoi antetul `Authorization: Bearer <token>`.
3. O comandă din magazin = un `Order`. Repetarea unui `Order` cu aceleași date returnează aceeași plată; cu date diferite sau după plată — eroare `500 TECHNICAL_ERROR`.
4. `ExpiryDate` este `YYYY-MM-DDTHH:mm:ss` în ora locală Chișinău (`Europe/Chisinau`) și trebuie să fie în viitor.
5. Sumele sunt numere întregi în unități minime; `Currency` este `498` pentru MDL.
6. Semnături: `Base64(MD5(UTF8(șir + secretKey)))`, Base64 din digestul brut. Cheia pentru checkout și cea pentru notificări diferă.
7. Notificările se trimit doar pentru plățile achitate (`EventType` = `PAID`). Cheile sunt `Payment.Id` și `Payment.ExternalId` (țin cont de majuscule). La o plată eșuată clientul este doar redirecționat la `LinkUrlCancel`.
8. `PaidAmount` trebuie să fie egal cu `Amount`, cu excepția unei promoții convenite cu Paynet; altfel nu onorați comanda automat.
9. Nu vă bazați pe revenirea la `LinkUrlSuccess`; confirmați cu o notificare verificată sau cu API-ul de status.
10. Secretele nu ajung niciodată în codul browserului.
