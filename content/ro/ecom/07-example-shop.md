# Exemplu de magazin (Node.js)

O integrare server-to-server minimă și gata de folosit: un server Node.js 18+ fără dependențe. Cod sursă: [paynet-example-shop-node.zip](sdk/paynet-example-shop-node.zip).

> **Important:** acest exemplu este verificat de un test end-to-end în mediul de test Paynet: un robot cumpără un produs în exemplu, plătește cu cardul de test, trimite notificarea și face o rambursare. Deci codul exemplului funcționează.

## Pornire

Exemplul este un magazin online funcțional, conectat la mediul de test Paynet. Rulează pe calculatorul dvs.; în afară de Node.js nu trebuie instalat sau configurat nimic.

### Înainte de început: Node.js

Aveți nevoie de **Node.js 18 sau mai nou**. Deschideți linia de comandă:

| Sistem | Cum se deschide |
|---|---|
| Windows | **Win+R** → tastați `cmd` → **Enter** |
| macOS | aplicația **Terminal** (Aplicații → Utilitare) |
| Linux | **Terminal** (de obicei **Ctrl+Alt+T**) |

Tastați comanda și apăsați **Enter**:

```
node --version
```

Dacă apare un număr de versiune (de exemplu `v22.11.0`), totul e gata. Dacă apare o eroare, instalați Node.js de pe https://nodejs.org (butonul **LTS**), apoi închideți și redeschideți linia de comandă.

### Pasul 1. Descărcați arhiva și porniți magazinul

Descărcați [paynet-example-shop-node.zip](sdk/paynet-example-shop-node.zip). În linia de comandă tastați comenzile pe rând, apăsând **Enter** după fiecare rând:

```
cd Downloads
tar -xf paynet-example-shop-node.zip
cd node-shop
node server.mjs
```

| Comandă | Ce face |
|---|---|
| `cd Downloads` | trece în folderul Descărcări, unde browserul a salvat arhiva |
| `tar -xf …zip` | dezarhivează arhiva (Windows 10/11, macOS); apare folderul `node-shop` |
| `cd node-shop` | trece în folderul magazinului |
| `node server.mjs` | pornește magazinul |

**Linux:** în loc de `tar -xf paynet-example-shop-node.zip` tastați `unzip paynet-example-shop-node.zip` (`tar` standard din Linux nu deschide `.zip`; dacă `unzip` lipsește: `sudo apt install unzip`).

Apare rândul `Demo shop on http://localhost:3000 …`. **Nu închideți această fereastră**: magazinul funcționează cât timp ea este deschisă. Oprirea magazinului — **Ctrl+C**.

> Arhiva nu s-a salvat în Descărcări? În loc de `cd Downloads` tastați `cd ` cu un spațiu (în Windows — `cd /d ` cu un spațiu) și trageți cu mouse-ul în fereastra liniei de comandă **folderul în care se află arhiva**: calea se inserează automat. Trageți folderul, nu arhiva `.zip`. În Linux cu interfață în altă limbă folderul poate avea un nume tradus.

### Pasul 2. Plătiți o comandă de test

Deschideți în browser http://localhost:3000, apăsați **Buy** și plătiți cu cardul de test: numărul `4111 1111 1111 1111`, valabil până la `12/27`, CVV `777`. După plată reveniți în magazin.

### Pasul 3. Trimiteți notificarea de plată

Deschideți http://localhost:3000/orders. Comanda este **`pending`**, și este normal: magazinul marchează comanda ca plătită **doar după notificarea Paynet** — la fel trebuie să funcționeze și magazinul dvs. real. Paynet trimite notificările la URL-ul de callback al comerciantului dvs., iar ele nu ajung la `localhost`. De aceea, în timpul dezvoltării trimiteți notificarea singuri: scriptul verifică plata prin API, construiește notificarea și o semnează la fel ca Paynet.

Deschideți **a doua** linie de comandă și tastați, cu numărul comenzii dvs. din coloana **Order**:

```
cd Downloads/node-shop
node tools/send-test-notification.mjs <Order>
```

De exemplu: `node tools/send-test-notification.mjs 1794411831126`. Pagina comenzilor din magazin afișează comanda gata de copiat pentru fiecare comandă `pending`.

### Pasul 4. Verificați rezultatul

Reîmprospătați http://localhost:3000/orders: comanda este acum **`paid`**, iar alături este butonul de rambursare — încercați o rambursare.

### Dacă ceva nu merge

| Mesaj | Cauză și soluție |
|---|---|
| `'node' is not recognized…` / `command not found: node` | Node.js nu este instalat sau linia de comandă a fost deschisă înainte de instalare. Instalați Node.js și redeschideți linia de comandă |
| `The system cannot find the path specified` / `No such file or directory` după `cd Downloads` | Arhiva este în alt folder. Folosiți sfatul de sub pasul 1 |
| `The directory name is invalid` | Ați tras arhiva `.zip`, nu un folder. Trageți folderul în care se află arhiva |
| `tar: This does not look like a tar archive` | Sunteți pe Linux: folosiți `unzip paynet-example-shop-node.zip` în loc de `tar -xf` |
| `Cannot find module …server.mjs` | Linia de comandă nu este în folderul `node-shop`. Repetați pasul 1 |
| `EADDRINUSE … 3000` | Magazinul rulează deja în altă fereastră. Închideți-o (sau apăsați **Ctrl+C** în ea) și porniți din nou |
| `Payment is not paid (status 1)` | Plata comenzii nu a fost finalizată. Creați o comandă nouă și finalizați plata |
| Comanda rămâne `pending` | Notificarea nu a fost trimisă. Faceți pasul 3 |

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
