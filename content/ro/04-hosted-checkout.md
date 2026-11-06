# Hosted checkout (client-server)

În acest model browserul clientului trimite comanda la Paynet ca formular HTML semnat (`POST`). Nu apelați un API pentru crearea comenzii, dar trebuie să calculați `Signature` cu cheia dvs. secretă **pe server**.

| Mediu | URL-ul formularului (action) |
|---|---|
| Test | `https://test.paynet.md/ecom/checkout` |
| Producție | `https://paynet.md/ecom/checkout` |

Această pagină descrie protocolul **v0.6**. Protocolul mai vechi v0.5 (`/acquiring/SetEcom`) este descris la final.

## Fluxul

1. Clientul apasă „Plătește” în magazinul dvs.
2. Serverul dvs. construiește câmpurile formularului și calculează `Signature` (vezi mai jos).
3. Pagina dvs. afișează un formular care se trimite automat la URL-ul de checkout.
4. Clientul plătește pe pagina Paynet și revine la `LinkUrlSuccess` sau `LinkUrlCancel`.
5. Paynet trimite o [notificare](#/guides/notifications) la URL-ul dvs. de callback.

## Câmpurile formularului

| Câmp | Obligatoriu | Semnat | Descriere |
|---|---|---|---|
| `Order` | da | da | Numărul comenzii la dvs. (număr întreg). Nou pentru fiecare plată. |
| `Currency` | da | da | Cod numeric ISO 4217, `498` = MDL. |
| `Merchant` | da | da | Codul dvs. de comerciant. |
| `SaleAreaCode` | da | da | Codul zonei dvs. de vânzare. |
| `Amount` | da | da | Suma în unități minime: `1235` = 12,35 MDL. |
| `Description` | da | da | Descrierea comenzii afișată clientului. |
| `ExpiryDate` | da | da | Termenul de plată, `YYYY-MM-DDTHH:mm:ss`. |
| `LinkUrlSuccess` | da | da | URL de revenire după plata reușită. |
| `LinkUrlCancel` | da | da | URL de revenire după anulare. |
| `Lang` | da | da | Limba paginii de plată, de ex. `ro`, `ru`, `en`. |
| `MoneyType` | da | da | Metoda de plată, de ex. `Card`. |
| `CustomerCode` | nu | da | ID-ul clientului în sistemul dvs. |
| `CustomerNameFirst` | nu | da | Prenumele clientului. |
| `CustomerNameLast` | nu | da | Numele clientului. |
| `CustomerPhoneNumber` | nu | da | Telefonul clientului. |
| `CustomerEmail` | nu | da | Emailul clientului. |
| `ProductAmount`, `ProductBarcode`, `ProductCode`, `ProductDescription`, `ProductGroupId`, `ProductGroupName`, `ProductLineNo`, `ProductName`, `ProductUnitPrice`, `ProductQuantity`, `ProductUnitProduct` | nu | nu | Date opționale despre produs. |
| `Signature` | da | — | `Base64(MD5(RawData + SecretKey))`, vezi mai jos. |

## Semnătura (v0.6)

1. Luați câmpurile **semnate** din tabelul de mai sus pe care le trimiteți efectiv (omiteți câmpurile pe care nu le trimiteți).
2. Sortați-le după numele câmpului, A → Z.
3. Codificați fiecare **valoare** conform RFC 3986 (`encodeURIComponent` plus `! ' ( ) *`), în UTF-8.
4. Concatenați valorile codificate fără separatori → `RawData`.
5. `Signature = Base64( MD5( RawData + SecretKey ) )` — Base64 din digestul MD5 brut de 16 octeți, nu din șirul hex.

Un exemplu complet cu rezultatul așteptat se află pe pagina [Semnături](#/guides/signatures). Folosiți-l ca test unitar.

> **Important:** calculați semnătura pe server. Cheia secretă nu trebuie să apară niciodată în HTML sau JavaScript trimis browserului.

## Exemplu de formular

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

`Signature` de mai sus este corectă exact pentru aceste valori și cheia de test. Valorile din atributele HTML trebuie escapate (`&` → `&amp;`); browserul trimite valoarea originală, iar aceasta se semnează.

## Exemplu: semnătura în Node.js

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

## Exemplu: semnătura în PHP

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

## Testare pe acest portal

Deschideți **Client-Server Model → Order request v0.6**. Portalul completează un `Order` unic și un `ExpiryDate` în viitor, generează semnătura cu cheia de test și deschide pagina de test Paynet într-un tab nou.

## Protocolul vechi v0.5

Integrările mai vechi trimit formularul la `https://test.paynet.md/acquiring/SetEcom` cu câmpuri imbricate (`ExternalID`, `Customer.*`, `Services[].Products[]`, `MoneyType.Code`) și `SignVersion` = `v05`. Semnătura v0.5 este `Base64(MD5(PreparedString + SecretKey))`, unde `PreparedString` concatenează valorile brute în această ordine:

```text
Currency + Customer.Address + Customer.City + Customer.Code + Customer.Country +
Customer.email + Customer.NameFirst + Customer.NameLast + Customer.PhoneNumber +
ExpiryDate + ExternalID + Merchant + MoneyType.Code
+ for each service: Amount + Description + Name
  + for each product: Amount + Barcode + Code + Description + GroupId + GroupName +
                      LineNo + Name + UnitPrice + UnitProduct
```

Pentru integrări noi folosiți v0.6. Formularul v0.5 rămâne pe portal ca **Order request v0.5 (old)**.
