# Aplicații mobile

Nu este nevoie de un SDK mobil separat. Aplicația mobilă acceptă plăți prin **serverul dvs.** și **pagina de plată Paynet**. La fel funcționează și alți furnizori cu pagină de plată proprie.

> **Important:** nu păstrați niciodată în aplicație utilizatorul și parola API, cheile secrete sau tokenul. Oricine poate descărca și dezasambla aplicația — cheile ar fi găsite, iar cineva ar putea crea comenzi, face rambursări și falsifica notificări în numele magazinului. Tot ce necesită chei face doar serverul.

## Cum funcționează

| Pas | Unde | Ce se întâmplă |
|---|---|---|
| 1 | Aplicație | Clientul apasă „Plătește”. Aplicația trimite comanda la **serverul dvs.** |
| 2 | Serverul dvs. | Creează comanda în Paynet ([SDK](#/guides/sdk) sau [API](#/guides/server-to-server)) și returnează aplicației `paymentLink` |
| 3 | Aplicație | Deschide `paymentLink` în **fereastra de sistem a browserului**. Clientul plătește pe pagina Paynet |
| 4 | Paynet → serverul dvs. | [Notificare](#/guides/notifications) `PAID`. Serverul verifică semnătura și plata |
| 5 | Paynet → aplicație | După plată pagina îl întoarce pe client la `LinkUrlSuccess` (sau `LinkUrlCancel`) |
| 6 | Aplicație → serverul dvs. | Aplicația întreabă **serverul dvs.** dacă comanda este achitată. Decizia — doar după răspunsul serverului |

## Server: crearea comenzii pentru aplicație

Exemplu Node.js cu [SDK](#/guides/sdk). Aplicația apelează `POST /mobile/orders/{id}/pay` și primește linkul de plată; `GET /mobile/orders/{id}/status` arată dacă comanda este achitată.

```javascript
import http from 'node:http';
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// Într-un magazin real comanda se ia din baza de date după id: suma — din comandă, nu din cererea aplicației.
// expiryDate se salvează la crearea comenzii (de exemplu, expiryInHours(1)), astfel încât o nouă apăsare
// pe „Plătește” să trimită în Paynet exact aceeași cerere.
const findOrder = async (id) => ({ order: Number(id), amount: 300, customerCode: 'customer-42', customerPhone: '37360000000', expiryDate: '2026-11-10T19:00:00' });

http.createServer(async (req, res) => {
  const match = req.url.match(/^\/mobile\/orders\/(\d+)\/(pay|status)$/);
  if (!match) return res.writeHead(404).end();
  const order = await findOrder(match[1]);

  if (match[2] === 'pay' && req.method === 'POST') {
    const { paymentLink } = await paynet.createOrder({
      Order: order.order,
      SaleAreaCode: 'onlidocumentation_md',
      LinkUrlSuccess: `https://shop.example/app/payment/success?order=${order.order}`,
      LinkUrlCancel: `https://shop.example/app/payment/cancel?order=${order.order}`,
      Customer: { Code: order.customerCode, PhoneNumber: order.customerPhone },
      ExpiryDate: order.expiryDate,
      Currency: 498,
      Services: [{ Name: 'My shop', Description: `Order #${order.order}`, Amount: order.amount }],
      MoneyType: 'All',
      Lang: 'ro',
    });
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ paymentLink }));
  }

  const payment = await paynet.getPaymentByOrder(order.order);
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ paid: payment.status === PaymentStatus.PAID, status: payment.status }));
}).listen(3000);
```

Autorizați cererile aplicației către serverul dvs. la fel ca celelalte cereri ale aplicației. O nouă apăsare pe „Plătește” pentru aceeași comandă trebuie să trimită în Paynet **aceeași** cerere — atunci Paynet returnează aceeași plată.

## iOS: deschiderea paginii de plată

Folosiți `SFSafariViewController` — fereastra de sistem Safari în interiorul aplicației.

```swift
import SafariServices
import UIKit

func openPayment(_ paymentLink: String, from viewController: UIViewController) {
    guard let url = URL(string: paymentLink) else { return }
    let safari = SFSafariViewController(url: url)
    viewController.present(safari, animated: true)
}
```

## Android: deschiderea paginii de plată

Folosiți Chrome Custom Tabs (biblioteca `androidx.browser`).

```kotlin
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

fun openPayment(context: Context, paymentLink: String) {
    CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(paymentLink))
}
```

## Revenirea în aplicație după plată

Setați în `LinkUrlSuccess` și `LinkUrlCancel` adrese ale site-ului dvs. legate de aplicație: **Universal Links** (iOS) și **App Links** (Android). După plată se deschide aplicația, iar dacă nu este instalată — site-ul dvs.

După revenire, aplicația **nu consideră comanda achitată** doar pentru că clientul s-a întors: întreabă serverul dvs. despre status (pasul 6). Dacă clientul a închis fereastra de plată înainte de final, aplicația întreabă și ea serverul.

## Recomandări

- **Nu folosiți WebView** pentru pagina de plată. În fereastra de sistem a browserului clientul vede adresa paginii Paynet, iar Apple Pay și Google Pay pot să nu funcționeze într-un WebView încorporat.
- **Luați suma din comanda de pe server**, nu din cererea aplicației.
- **Nu executați comanda înainte de confirmarea serverului**: notificare `PAID` cu semnătură verificată sau `status` = `4` prin API.
- **Testați pe dispozitive reale** înainte de lansare: plata cu cardul, Apple Pay (iPhone), Google Pay (Android), revenirea în aplicație, anularea plății.

## Ce verificați înainte de lansare

- [ ] Aplicația nu conține utilizatorul, parola, cheile sau tokenul Paynet.
- [ ] Comanda o creează serverul; suma se ia din comanda de pe server.
- [ ] Pagina de plată se deschide în `SFSafariViewController` / Chrome Custom Tabs, nu în WebView.
- [ ] După plată și după anulare clientul revine în aplicație.
- [ ] Aplicația află statusul comenzii de la server, iar serverul — din notificare sau prin API.
- [ ] O nouă apăsare pe „Plătește” nu creează a doua plată pentru aceeași comandă.
