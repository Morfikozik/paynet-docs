# Opțiuni de integrare

Există trei moduri de a accepta plăți prin Paynet. Toate se termină pe aceeași pagină de plată Paynet, deci nu colectați niciodată singuri datele cardurilor.

| | API server-to-server | Hosted checkout (client-server) | Pluginuri gata făcute |
|---|---|---|---|
| Cum ajunge comanda la Paynet | **backend-ul** dvs. apelează `POST /api/order` cu token Bearer | **browserul** clientului trimite la Paynet un formular HTML semnat | pluginul o face pentru dvs. |
| Ce protejează cererea | token de acces (`/auth`) | `Signature` = MD5 + Base64 cu cheia dvs. secretă | setările pluginului |
| Ce primiți | `paymentId` + `paymentLink` în JSON | clientul ajunge direct pe pagina de plată | — |
| Statusuri, rambursări, extrase | da, același API | da, prin API-ul server-to-server | depinde de plugin |
| Potrivit pentru | magazine și aplicații proprii cu backend | site-uri simple, start rapid fără client API | WordPress/WooCommerce, OpenCart, PrestaShop, Magento, CS-Cart, Shopify |

## Cum alegeți

- **Aveți backend și doriți control deplin** → [Server-to-server](#/guides/server-to-server). Cea mai flexibilă opțiune, primiți `paymentId` imediat.
- **Aveți nevoie doar de un buton „Plătește” fără apel API pentru crearea comenzii** → [Hosted checkout](#/guides/hosted-checkout). Backend-ul este totuși necesar pentru calculul semnăturii: cheia secretă nu trebuie să ajungă în codul browserului.
- **Magazinul rulează pe un CMS suportat** → descărcați un plugin de pe pagina **Plugins**. Shopify se conectează prin Cybersource.

## Ce necesită orice integrare

1. **Un URL de callback** pentru [notificări](#/guides/notifications). Paynet îl apelează când plata este achitată. Comunicați acest URL către Paynet.
2. **Verificarea semnăturii** fiecărei notificări, vezi [Semnături](#/guides/signatures).
3. **Verificarea statusului** înainte de livrare: `GET /api/order/{paymentId}` sau `GET /api/order/merchant/{order}`.
4. **Numere de comandă unice** (`Order`) pe partea dvs.

## Fluxul general

```text
Client          Magazinul dvs. (backend)            Paynet
   |  checkout   |                                     |
   |-----------> | 1. creare comandă (API sau formular)|
   |             |------------------------------------>|
   | 2. redirecționare la pagina de plată              |
   |-------------------------------------------------->|
   |              3. clientul plătește pe pagina Paynet |
   |<--------------------------------------------------|
   | 4. revenire la LinkUrlSuccess / LinkUrlCancel      |
   |             | 5. notificare (POST, antet Hash)    |
   |             |<------------------------------------|
   |             | 6. verificare Hash și status, livrare|
```

Revenirea clientului la `LinkUrlSuccess` este doar un pas de interfață. **Nu marcați comanda ca plătită doar pentru că clientul a revenit pe pagina de succes.** Bazați-vă pe notificare și/sau pe API-ul de status.
