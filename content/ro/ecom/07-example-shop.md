# Exemplu de magazin (Node.js)

O integrare server-to-server minimă și gata de folosit: un server Node.js 18+ fără dependențe. Cod sursă: [paynet-example-shop-node.zip](sdk/paynet-example-shop-node.zip).

> **Important:** acest exemplu este verificat de un test end-to-end în mediul de test Paynet: un robot cumpără un produs în exemplu, plătește cu cardul de test, trimite notificarea și face o rambursare. Deci codul exemplului funcționează.

## Pornire

```bash
# descărcați paynet-example-shop-node.zip de pe această pagină, apoi:
unzip paynet-example-shop-node.zip
cd node-shop
node server.mjs
```

Deschideți `http://localhost:3000`, apăsați **Buy** și plătiți cu cardul de test `4111 1111 1111 1111`, `12/27`, CVV `777`. Implicit exemplul folosește mediul de test și accesele de test.

Paynet trimite notificările reale la URL-ul de callback al comerciantului dvs., iar ele nu ajung la `localhost`. În timpul dezvoltării trimiteți notificarea singuri — scriptul o construiește și o semnează pe baza unei plăți de test achitate, la fel ca Paynet:

```bash
node tools/send-test-notification.mjs <Order>
```

După aceasta, pe `http://localhost:3000/orders` comanda apare ca `paid` și de acolo puteți face o rambursare.

## Ce conține

| Fișier | Ce face |
|---|---|
| `server.mjs` | Magazin: produs, creare comandă, redirecționare la plată, pagini de revenire, primirea notificărilor, rambursări |
| `paynet-client.mjs` | Client API: cache pentru token, creare comandă cu repetare sigură, căutare plată, rambursare |
| `paynet-notifications.mjs` | Handler de notificări — același cod ca în [Notificări](#/guides/notifications) |
| `store.mjs` | Stocare în fișier JSON — înlocuiți-o cu baza dvs. de date |
| `tools/send-test-notification.mjs` | Trimite o notificare `PAID` semnată la adresa dvs. |

## Ce reguli arată exemplul

| Pas | Cum face exemplul | Regulă |
|---|---|---|
| Creare comandă | `Order` unic; corpul cererii se salvează înainte de apelul Paynet | Repetare doar cu același corp ([Număr de comandă repetat](#/guides/errors-and-statuses)) |
| Termen de plată | `ExpiryDate` = acum + 1 zi, ora Chișinăului | `Europe/Chisinau` |
| Revenirea clientului | Pagina verifică `status` prin API, nu se bazează pe redirecționare | Revenirea la `LinkUrlSuccess` nu dovedește plata |
| `status` = `1` | „Continuă plata” cu același link | Clientul nu a plătit |
| `status` = `3` | Pagina așteaptă și se reîmprospătează | Banca încă răspunde; nu creați o comandă nouă |
| `status` = `5` | „Încearcă din nou” creează o comandă nouă cu un `Order` nou | Comanda este închisă după refuz |
| Notificare | Semnătură, o dată per `Payment.Id`, întâi `200`, apoi confirmare prin API | [Ce protejează semnătura](#/guides/notifications) |
| Rambursare | Doar la `status` = `4`, cel mult `PaidAmount`, o singură dată | [Rambursări](#/guides/errors-and-statuses) |
| Card salvat | `CardLinkHash` dintr-o notificare confirmată se salvează pentru client | [Salvarea cardurilor](#/guides/saved-cards) |

## Trecerea în producție

Setați variabilele de mediu cu valorile de producție — ele diferă de cele de test — și nu le păstrați în cod:

| Variabilă | Valoare |
|---|---|
| `PAYNET_API_URL` | `https://ecom-api.paynet.md` |
| `PAYNET_USERNAME`, `PAYNET_PASSWORD` | accesele API de producție |
| `PAYNET_SALE_AREA` | codul zonei dvs. de vânzare |
| `PAYNET_NOTIFICATION_SECRET` | cheia de notificări de producție |
| `PUBLIC_URL` | adresa magazinului dvs. (pentru `LinkUrlSuccess` / `LinkUrlCancel`) |

Înlocuiți `store.mjs` cu baza dvs. de date și parcurgeți [lista de verificare pentru lansare](#/guides/go-live).
