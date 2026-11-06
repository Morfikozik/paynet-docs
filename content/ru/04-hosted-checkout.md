# Hosted checkout (client-server)

В этой модели браузер покупателя отправляет заказ в Paynet подписанной HTML-формой (`POST`). Вызывать API для создания заказа не нужно, но `Signature` нужно рассчитать вашим секретным ключом **на сервере**.

| Среда | URL формы (action) |
|---|---|
| Тест | `https://test.paynet.md/ecom/checkout` |
| Продакшн | `https://paynet.md/ecom/checkout` |

Здесь описан протокол **v0.6**. Устаревший протокол v0.5 (`/acquiring/SetEcom`) описан в конце страницы.

## Сценарий

1. Покупатель нажимает «Оплатить» в вашем магазине.
2. Ваш сервер формирует поля формы и рассчитывает `Signature` (см. ниже).
3. Ваша страница выводит форму, которая автоматически отправляет поля на URL checkout.
4. Покупатель платит на странице Paynet и возвращается на `LinkUrlSuccess` или `LinkUrlCancel`.
5. Paynet отправляет [уведомление](#/guides/notifications) на ваш callback URL.

## Поля формы

| Поле | Обязательно | В подписи | Описание |
|---|---|---|---|
| `Order` | да | да | Номер заказа у вас (целое число). Новый для каждого платежа. |
| `Currency` | да | да | Числовой код ISO 4217, `498` = MDL. |
| `Merchant` | да | да | Ваш код мерчанта. |
| `SaleAreaCode` | да | да | Ваш код торговой зоны. |
| `Amount` | да | да | Сумма в минимальных единицах: `1235` = 12,35 MDL. |
| `Description` | да | да | Описание заказа, которое увидит покупатель. |
| `ExpiryDate` | да | да | Срок оплаты, `YYYY-MM-DDTHH:mm:ss`. |
| `LinkUrlSuccess` | да | да | URL возврата после успешной оплаты. |
| `LinkUrlCancel` | да | да | URL возврата после отмены. |
| `Lang` | да | да | Язык платёжной страницы, например `ro`, `ru`, `en`. |
| `MoneyType` | да | да | Способ оплаты, например `Card`. |
| `CustomerCode` | нет | да | ID покупателя в вашей системе. |
| `CustomerNameFirst` | нет | да | Имя покупателя. |
| `CustomerNameLast` | нет | да | Фамилия покупателя. |
| `CustomerPhoneNumber` | нет | да | Телефон покупателя. |
| `CustomerEmail` | нет | да | Email покупателя. |
| `ProductAmount`, `ProductBarcode`, `ProductCode`, `ProductDescription`, `ProductGroupId`, `ProductGroupName`, `ProductLineNo`, `ProductName`, `ProductUnitPrice`, `ProductQuantity`, `ProductUnitProduct` | нет | нет | Необязательные данные о товаре. |
| `Signature` | да | — | `Base64(MD5(RawData + SecretKey))`, см. ниже. |

## Подпись (v0.6)

1. Возьмите поля из таблицы с отметкой «В подписи», которые вы действительно передаёте (поля, которые не передаёте, пропустите).
2. Отсортируйте их по имени поля от A до Z.
3. Закодируйте каждое **значение** по RFC 3986 (`encodeURIComponent` плюс `! ' ( ) *`) в UTF-8.
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

Откройте **Client-Server Model → Order request v0.6**. Портал подставит уникальный `Order` и будущую `ExpiryDate`, сгенерирует подпись тестовым ключом и откроет тестовую страницу Paynet в новой вкладке.

## Устаревший протокол v0.5

Старые интеграции отправляют форму на `https://test.paynet.md/acquiring/SetEcom` с вложенными полями (`ExternalID`, `Customer.*`, `Services[].Products[]`, `MoneyType.Code`) и `SignVersion` = `v05`. Подпись v0.5 — `Base64(MD5(PreparedString + SecretKey))`, где `PreparedString` склеивает исходные значения в таком порядке:

```text
Currency + Customer.Address + Customer.City + Customer.Code + Customer.Country +
Customer.email + Customer.NameFirst + Customer.NameLast + Customer.PhoneNumber +
ExpiryDate + ExternalID + Merchant + MoneyType.Code
+ for each service: Amount + Description + Name
  + for each product: Amount + Barcode + Code + Description + GroupId + GroupName +
                      LineNo + Name + UnitPrice + UnitProduct
```

Для новых интеграций используйте v0.6. Форма v0.5 остаётся на портале как **Order request v0.5 (old)**.
