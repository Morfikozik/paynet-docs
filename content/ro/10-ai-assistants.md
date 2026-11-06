# Integrare cu un asistent AI

Puteți da această documentație oricărui asistent AI de programare (Claude, ChatGPT, Gemini, Copilot, Cursor și alții) și să-i cereți să scrie integrarea.

## Fișiere pentru AI

| Fișier | Ce conține | Când îl folosiți |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | Toată documentația într-un singur fișier text: ghiduri, referința API, semnături cu vectori de test, date de test | Dați asistentului acest singur fișier. |
| [`llms.txt`](llms.txt) | Cuprins scurt cu linkuri către toate paginile | Pentru asistenții care navighează singuri prin linkuri. |
| [`openapi.json`](openapi.json) | Specificația OpenAPI 3 a API-ului server-to-server | Pentru generatoare de cod și clienți tipizați. |
| `docs/<page>.md` | Fiecare ghid ca fișier Markdown separat | Când aveți nevoie de un singur subiect. |

Fiecare pagină de ghid are un buton **Copiază pentru AI**, care copiază pagina în format Markdown.

> **Notă:** majoritatea asistenților nu pot citi portalul deschizând adresa lui, deoarece paginile sunt generate cu JavaScript. Dați-le `llms-full.txt` (încărcați fișierul sau lipiți linkul). Fișierele pentru AI sunt în engleză, limba cu care modelele lucrează cel mai bine; vă pot răspunde în orice limbă.

## Șablon de cerere

Copiați, completați parantezele și atașați `llms-full.txt`:

```text
You are integrating Paynet e-commerce payments into my project.
Use ONLY the attached Paynet documentation (llms-full.txt) as the source of truth.

My stack: [e.g. Node.js 20 + Express / PHP 8.2 + Laravel / Python 3.12 + Django]
Integration type: [server-to-server API | hosted checkout v0.6]
What to build:
1. Create a payment for a cart and redirect the customer to Paynet.
2. A notification endpoint that verifies the Hash header and marks the order paid exactly once.
3. A status check by paymentId used before fulfilment.

Requirements:
- Read credentials and secret keys from environment variables.
- Use a new unique Order number for every payment and an ExpiryDate in the future.
- Amounts are integers in minor units (100 = 1.00 MDL).
- Implement signatures exactly as documented and add unit tests that reproduce
  the test vectors from the "Signatures" section.
- Do not invent endpoints, fields or status values that are not in the documentation.
  If something is missing, list it as an open question instead of guessing.
- Answer me in Romanian.
```

## Reguli pentru asistent

Aceste reguli sunt incluse și la începutul `llms-full.txt`:

1. URL-ul de bază de test este `https://ecom-api-test.paynet.md`; URL-ul de test pentru hosted checkout este `https://test.paynet.md/ecom/checkout`.
2. Autentificare cu `POST /auth` (JSON), apoi antetul `Authorization: Bearer <token>`.
3. `Order` este unic pentru fiecare plată; `ExpiryDate` este în viitor (`YYYY-MM-DDTHH:mm:ss`).
4. Sumele sunt numere întregi în unități minime; `Currency` este `498` pentru MDL.
5. Semnături: `Base64(MD5(șir + secretKey))` pe UTF-8, Base64 din digestul brut.
6. Nu vă bazați pe revenirea la `LinkUrlSuccess`; confirmați cu o notificare verificată sau cu API-ul de status.
7. Cheia secretă pentru checkout și cea pentru notificări sunt diferite.
8. Secretele nu ajung niciodată în codul browserului.
