# Мобильные приложения

Отдельный мобильный SDK не нужен. Мобильное приложение принимает оплату через **ваш сервер** и **страницу оплаты Paynet**. Так устроены и другие платёжные системы с оплатой на своей странице.

> **Важно:** логин и пароль API, секретные ключи и токен нельзя хранить в приложении. Приложение может скачать и разобрать кто угодно — ключи будут найдены, и от имени магазина можно будет создавать заказы, делать возвраты и подделывать уведомления. Всё, что требует ключей, делает только сервер.

## Как это работает

| Шаг | Где | Что происходит |
|---|---|---|
| 1 | Приложение | Покупатель нажимает «Оплатить». Приложение отправляет заказ на **ваш сервер** |
| 2 | Ваш сервер | Создаёт заказ в Paynet ([SDK](#/guides/sdk) или [API](#/guides/server-to-server)) и возвращает приложению `paymentLink` |
| 3 | Приложение | Открывает `paymentLink` в **системном окне браузера**. Покупатель платит на странице Paynet |
| 4 | Paynet → ваш сервер | [Уведомление](#/guides/notifications) `PAID`. Сервер проверяет подпись и платёж |
| 5 | Paynet → приложение | После оплаты страница возвращает покупателя на `LinkUrlSuccess` (или `LinkUrlCancel`) |
| 6 | Приложение → ваш сервер | Приложение спрашивает у **своего сервера**, оплачен ли заказ. Решение — только по ответу сервера |

## Сервер: создать заказ для приложения

Пример на Node.js с [SDK](#/guides/sdk). Приложение вызывает `POST /mobile/orders/{id}/pay` и получает ссылку на оплату; `GET /mobile/orders/{id}/status` — оплачен ли заказ.

```javascript
import http from 'node:http';
import { PaymentStatus } from './paynet-ecom-sdk/src/index.js';
import { paynet } from './paynet.js';

// В реальном магазине заказ берётся из вашей базы по id: сумма — из заказа, а не из запроса приложения.
// expiryDate сохраняется при создании заказа (например, expiryInHours(1)), чтобы повторное нажатие
// «Оплатить» отправляло в Paynet тот же самый запрос.
const findOrder = async (id) => ({ order: Number(id), amount: 300, customerCode: 'customer-42', expiryDate: '2026-11-10T19:00:00' });

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
      Customer: { Code: order.customerCode },
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

Авторизуйте запросы приложения к вашему серверу так же, как остальные запросы вашего приложения. Повторное нажатие «Оплатить» по тому же заказу должно отправлять в Paynet **тот же** запрос — тогда Paynet вернёт тот же платёж.

## iOS: открыть страницу оплаты

Используйте `SFSafariViewController` — системное окно Safari внутри приложения.

```swift
import SafariServices
import UIKit

func openPayment(_ paymentLink: String, from viewController: UIViewController) {
    guard let url = URL(string: paymentLink) else { return }
    let safari = SFSafariViewController(url: url)
    viewController.present(safari, animated: true)
}
```

## Android: открыть страницу оплаты

Используйте Chrome Custom Tabs (библиотека `androidx.browser`).

```kotlin
import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

fun openPayment(context: Context, paymentLink: String) {
    CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(paymentLink))
}
```

## Возврат в приложение после оплаты

Укажите в `LinkUrlSuccess` и `LinkUrlCancel` адреса вашего сайта, привязанные к приложению: **Universal Links** (iOS) и **App Links** (Android). Тогда после оплаты откроется приложение, а если его нет — ваш сайт.

После возврата приложение **не считает заказ оплаченным** по одному факту возврата: оно запрашивает статус у вашего сервера (шаг 6). Если покупатель закрыл окно оплаты, не дойдя до конца, приложение тоже спрашивает статус у сервера.

## Рекомендации

- **Не используйте WebView** для страницы оплаты. В системном окне браузера покупатель видит адрес страницы Paynet, а Apple Pay и Google Pay во встроенном WebView могут не работать.
- **Сумму берите из заказа на сервере**, а не из запроса приложения.
- **Не выполняйте заказ до подтверждения сервером**: уведомление `PAID` с проверенной подписью или `status` = `4` через API.
- **Проверьте на реальных устройствах** перед запуском: оплата картой, Apple Pay (iPhone), Google Pay (Android), возврат в приложение, отмена оплаты.

## Что проверить перед запуском

- [ ] В приложении нет логина, пароля, ключей и токена Paynet.
- [ ] Заказ создаёт сервер; сумма берётся из заказа на сервере.
- [ ] Страница оплаты открывается в `SFSafariViewController` / Chrome Custom Tabs, а не в WebView.
- [ ] После оплаты и после отмены покупатель возвращается в приложение.
- [ ] Статус заказа приложение узнаёт у сервера, а сервер — из уведомления или через API.
- [ ] Повторное нажатие «Оплатить» не создаёт второй платёж по тому же заказу.
