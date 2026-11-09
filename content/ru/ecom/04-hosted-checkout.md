# Hosted checkout (client-server)

В этой модели браузер покупателя отправляет заказ в Paynet подписанной HTML-формой (`POST`). Вызывать API для создания заказа не нужно, но `Signature` нужно рассчитать вашим секретным ключом **на сервере**.

| Среда | URL формы (action) |
|---|---|
| Тест | `https://test.paynet.md/ecom/checkout` |
| Продакшн | `https://paynet.md/ecom/checkout` |

## Сценарий

1. Покупатель нажимает «Оплатить» в вашем магазине.
2. Ваш сервер формирует поля формы и рассчитывает `Signature` (см. ниже).
3. Ваша страница выводит форму, которая автоматически отправляет поля на URL checkout.
4. Покупатель платит на странице Paynet и возвращается на `LinkUrlSuccess` (оплачено) или `LinkUrlCancel` (не прошло или отменено).
5. Paynet отправляет [уведомление](#/guides/notifications) `PAID` на ваш callback URL (о неуспешных платежах уведомлений нет).
6. Перед отгрузкой подтвердите оплату через `GET /api/order/merchant/{Order}` (server-to-server API, Bearer-токен): заказы, созданные формой, ищутся по вашему `Order`.

## Поля формы

| Поле | Обязательно | В подписи | Описание |
|---|---|---|---|
| `Order` | да | да | Номер заказа у вас (целое число). Один заказ магазина = один `Order`. |
| `Currency` | да | да | Числовой код ISO 4217, `498` = MDL. |
| `Merchant` | да | да | Ваш код мерчанта. |
| `SaleAreaCode` | да | да | Ваш код торговой зоны. |
| `Amount` | да | да | Сумма в минимальных единицах: `1235` = 12,35 MDL. |
| `Description` | да | да | Описание заказа, которое увидит покупатель. |
| `ExpiryDate` | да | да | Срок оплаты, `YYYY-MM-DDTHH:mm:ss`, местное время Кишинёва. |
| `LinkUrlSuccess` | да | да | URL возврата после успешной оплаты. |
| `LinkUrlCancel` | да | да | URL возврата после отмены. |
| `Lang` | да | да | Язык платёжной страницы, например `ro`, `ru`, `en`. |
| `MoneyType` | да | да | Показываемые способы оплаты: `All`, `Card` (карта, Apple Pay, Google Pay), `Paynet`, `MIA`, `CashInvoice`. |
| `CustomerCode` | нет | да | ID покупателя в вашей системе. |
| `CustomerNameFirst` | нет | да | Имя покупателя. |
| `CustomerNameLast` | нет | да | Фамилия покупателя. |
| `CustomerPhoneNumber` | нет | да | Телефон покупателя. |
| `CustomerEmail` | нет | да | Email покупателя. |
| `ProductAmount`, `ProductBarcode`, `ProductCode`, `ProductDescription`, `ProductGroupId`, `ProductGroupName`, `ProductLineNo`, `ProductName`, `ProductUnitPrice`, `ProductQuantity`, `ProductUnitProduct` | нет | нет | Необязательные данные о товаре. |
| `Signature` | да | — | `Base64(MD5(RawData + SecretKey))` с секретным ключом **hosted checkout**, см. ниже. |

## Подпись

1. Возьмите поля из таблицы с отметкой «В подписи», которые вы действительно передаёте (поля, которые не передаёте, пропустите).
2. Отсортируйте их по имени поля от A до Z.
3. Закодируйте каждое **значение** по RFC 3986 (`encodeURIComponent` плюс `! ' ( ) *`) в UTF-8 (в том числе кириллицу и румынскую диакритику).
4. Склейте закодированные значения без разделителей → `RawData`.
5. `Signature = Base64( MD5( RawData + SecretKey ) )` — Base64 от «сырого» 16-байтового MD5, а не от hex-строки.

Полный разобранный пример с ожидаемым результатом — на странице [Подписи](#/guides/signatures). Используйте его как юнит-тест.

> **Важно:** считайте подпись на сервере. Секретный ключ никогда не должен попадать в HTML или JavaScript, который уходит в браузер.

## Пример формы

```html
<form id="paynet" method="POST" action="https://test.paynet.md/ecom/checkout">
  <input type="hidden" name="Order" value="1762444800000">
  <input type="hidden" name="Currency" value="498">
  <input type="hidden" name="Merchant" value="265505">
  <input type="hidden" name="SaleAreaCode" value="onlidocumentation_md">
  <input type="hidden" name="Amount" value="1235">
  <input type="hidden" name="Description" value="Test&amp;Co SRL">
  <input type="hidden" name="CustomerCode" value="5555">
  <input type="hidden" name="CustomerNameFirst" value="First name">
  <input type="hidden" name="CustomerNameLast" value="Last name">
  <input type="hidden" name="CustomerPhoneNumber" value="060000000">
  <input type="hidden" name="CustomerEmail" value="test@gmail.com">
  <input type="hidden" name="ExpiryDate" value="2026-12-31T23:59:59">
  <input type="hidden" name="LinkUrlCancel" value="https://test.oplta.md/cancel">
  <input type="hidden" name="LinkUrlSuccess" value="https://test.oplta.md/ok">
  <input type="hidden" name="Lang" value="ro">
  <input type="hidden" name="MoneyType" value="Card">
  <input type="hidden" name="Signature" value="cxr/+yLYZp34aR0KXLkb2A==">
</form>
<script>document.getElementById('paynet').submit();</script>
```

`Signature` выше верна именно для этих значений и тестового ключа. Значения в HTML-атрибутах нужно экранировать (`&` → `&amp;`); браузер отправит исходное значение, и подписывается именно оно.

## Пример: подпись на Node.js

```javascript
import crypto from 'node:crypto';

const SIGNED_FIELDS = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'CustomerCode', 'CustomerNameFirst',
  'CustomerNameLast', 'CustomerPhoneNumber', 'CustomerEmail', 'ExpiryDate', 'Description', 'Amount',
  'LinkUrlCancel', 'LinkUrlSuccess', 'Lang', 'MoneyType'];

const encodeRfc3986 = (v) =>
  encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function checkoutSignature(fields, secretKey) {
  const rawData = SIGNED_FIELDS
    .filter((name) => fields[name] !== undefined && fields[name] !== null)
    .sort()
    .map((name) => encodeRfc3986(String(fields[name])))
    .join('');
  return crypto.createHash('md5').update(rawData + secretKey, 'utf8').digest('base64');
}
```

## Пример: подпись на PHP

```php
<?php
function checkoutSignature(array $fields, string $secretKey): string {
    $signed = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'CustomerCode', 'CustomerNameFirst',
        'CustomerNameLast', 'CustomerPhoneNumber', 'CustomerEmail', 'ExpiryDate', 'Description', 'Amount',
        'LinkUrlCancel', 'LinkUrlSuccess', 'Lang', 'MoneyType'];
    $present = array_values(array_filter($signed, fn($name) => isset($fields[$name])));
    sort($present, SORT_STRING);
    $rawData = '';
    foreach ($present as $name) {
        $rawData .= rawurlencode((string) $fields[$name]); // RFC 3986
    }
    return base64_encode(md5($rawData . $secretKey, true));
}
```

## Тестирование на портале

Откройте **E-commerce → Hosted checkout → Форма checkout (попробовать)**. Портал подставит уникальный `Order` и будущую `ExpiryDate`, сгенерирует подпись тестовым ключом и откроет тестовую страницу Paynet в новой вкладке.

Если отправить `Order`, который уже оплачен или находится в обработке у банка-эмитента, покупатель увидит страницу Paynet «Plata a fost respinsă» (счёт уже оплачен или в обработке).
