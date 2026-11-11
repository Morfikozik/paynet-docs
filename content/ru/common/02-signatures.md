# Подписи

Paynet везде использует одну схему хэширования:

```text
Signature = Base64( MD5( <string to sign> + SecretKey ) )
```

- MD5 считается по байтам строки в **UTF-8** (в том числе для кириллицы и румынской диакритики).
- Base64 берётся от **«сырого» 16-байтового дайджеста** (не от 32-символьной hex-строки). Результат всегда 24 символа и заканчивается на `==`.
- Не путайте с полем `signature` в ответе `POST /api/order`: это служебное значение ссылки на оплату (32 символа, совпадает с параметром `s` в `paymentLink`). Для проверок его не используйте.

Отличается только то, как собирается подписываемая строка:

| Где | Подписываемая строка | Секретный ключ |
|---|---|---|
| Форма hosted checkout (вы → Paynet) | `RawData`: значения подписываемых полей, отсортированные по имени поля, закодированные RFC 3986, склеенные | ключ hosted checkout |
| Уведомления (Paynet → вы) | `PreparedString`: 9 значений уведомления в фиксированном порядке | ключ уведомлений |

Два секретных ключа разные намеренно. Paynet выдаёт вам оба.

## Тестовый вектор 1: форма hosted checkout

Секретный ключ (тест): `F90D6485-9CCC-458B-96A3-8958AF9B4458`

Входные поля:

```json
{
  "Order": 1762444800000,
  "Currency": "498",
  "Merchant": "265505",
  "SaleAreaCode": "onlidocumentation_md",
  "Amount": "1235",
  "Description": "Test&Co SRL",
  "CustomerCode": "5555",
  "CustomerNameFirst": "First name",
  "CustomerNameLast": "Last name",
  "CustomerPhoneNumber": "060000000",
  "CustomerEmail": "test@gmail.com",
  "ExpiryDate": "2026-12-31T23:59:59",
  "LinkUrlCancel": "https://test.oplta.md/cancel",
  "LinkUrlSuccess": "https://test.oplta.md/ok",
  "Lang": "ro",
  "MoneyType": "Card"
}
```

Порядок полей после сортировки: `Amount, Currency, CustomerCode, CustomerEmail, CustomerNameFirst, CustomerNameLast, CustomerPhoneNumber, Description, ExpiryDate, Lang, LinkUrlCancel, LinkUrlSuccess, Merchant, MoneyType, Order, SaleAreaCode`.

Ожидаемый `RawData`:

```text
12354985555test%40gmail.comFirst%20nameLast%20name060000000Test%26Co%20SRL2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800000onlidocumentation_md
```

Ожидаемая `Signature`:

```text
cxr/+yLYZp34aR0KXLkb2A==
```

## Тестовый вектор 2: уведомление

Секретный ключ уведомлений (тест): `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`

```json
{
  "Eventid": 1000001,
  "EventType": "PAID",
  "EventDate": "2026-11-09T12:00:00",
  "Payment": {
    "Id": 1234567,
    "ExternalId": 1762444800000,
    "Merchant": "265505",
    "Customer": "37369XXX111",
    "StatusDate": "2026-11-09T12:00:00",
    "Amount": 1235
  }
}
```

(Показаны только поля, участвующие в подписи; в настоящем уведомлении их больше, см. [Уведомления](#/guides/notifications).)

Ожидаемый `PreparedString`:

```text
2026-11-09T12:00:001000001PAID123537369XXX111176244480000012345672655052026-11-09T12:00:00
```

Ожидаемый `Hash`:

```text
lq3+OCn0J/zSyNF5iAoShg==
```

## Тестовый вектор 3: спецсимволы

Тот же секретный ключ, что в векторе 1. В значениях есть `'`, `&`, `!`, `(`, `)`, `*`, кириллица и румынские буквы. Тестовая среда приняла именно эту форму (11.11.2026).

```json
{
  "Order": 1762444800003,
  "Currency": "498",
  "Merchant": "265505",
  "SaleAreaCode": "onlidocumentation_md",
  "Amount": "1235",
  "Description": "Mary's Cake & Co! (1)*",
  "CustomerCode": "5555",
  "CustomerNameFirst": "Мария",
  "CustomerNameLast": "Țurcan",
  "ExpiryDate": "2026-12-31T23:59:59",
  "LinkUrlCancel": "https://test.oplta.md/cancel",
  "LinkUrlSuccess": "https://test.oplta.md/ok",
  "Lang": "ro",
  "MoneyType": "Card"
}
```

Ожидаемый `RawData`:

```text
12354985555%D0%9C%D0%B0%D1%80%D0%B8%D1%8F%C8%9AurcanMary%27s%20Cake%20%26%20Co%21%20%281%29%2A2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800003onlidocumentation_md
```

Ожидаемая `Signature`:

```text
fm47qWzVzqPQQ+huHgWVZw==
```

## Спецсимволы

Результаты реальных отправок формы в тестовую среду:

| В значении есть | Результат |
|---|---|
| `" ' & < > # ; % + = ? / \`, `’`, эмодзи, кириллица, румынские буквы | Работает, если каждое значение закодировано по RFC 3986 (таблица ниже). |
| Перенос строки (многострочный `Description`) | Подпись не сходится. Замените переносы строк пробелом до подписи. |
| HTML-тег (`<b>`) или HTML-сущность (`&#039;`) | Paynet отклоняет форму ещё до проверки подписи: покупатель видит главную страницу Paynet вместо платёжной. Уберите теги и замените сущности обычными символами до подписи. |

Функция кодирования по языкам:

| Язык | Правильно | Неправильно (ломается на части символов) |
|---|---|---|
| PHP | `rawurlencode($v)` | `urlencode($v)`: пробел становится `+`, `~` — `%7E` |
| JavaScript / Node.js | `encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())` | один `encodeURIComponent(v)`: не кодирует `! ' ( ) *` |
| Python | `urllib.parse.quote(v, safe="~")` | `quote(v)` (не кодирует `/`), `quote_plus(v)` (пробел становится `+`) |
| C# | `Uri.EscapeDataString(v)` (.NET Core / .NET 5+) | `HttpUtility.UrlEncode`, `WebUtility.UrlEncode`: пробел становится `+` |
| Java | `URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20").replace("*", "%2A").replace("%7E", "~")` | один `URLEncoder.encode`: пробел становится `+`, `*` не кодируется |

Правила:

- Подписывайте исходные значения — ровно то, что отправит браузер. Не подписывайте текст, экранированный для HTML (`&amp;`, `&#039;`).
- Экранируйте значения для HTML один раз — когда пишете их в форму (`&` → `&amp;`, `"` → `&quot;`). Неэкранированная `"` обрезает значение внутри `value="…"`.
- Не меняйте значения после подписи (обрезка пробелов, замена символов, сокращение).
- Отдавайте страницу в UTF-8 (`<meta charset="utf-8">`) и добавьте в форму `accept-charset="UTF-8"`.
- Если CMS отдаёт названия товаров с HTML-сущностями (`Mary&#039;s`), раскодируйте их (`Mary's`) до сборки формы.

## Проверьте свою реализацию

Python:

```python
import base64, hashlib, urllib.parse

def md5_base64(text: str) -> str:
    return base64.b64encode(hashlib.md5(text.encode("utf-8")).digest()).decode()

SIGNED = ["Order", "Currency", "Merchant", "SaleAreaCode", "CustomerCode", "CustomerNameFirst",
          "CustomerNameLast", "CustomerPhoneNumber", "CustomerEmail", "ExpiryDate", "Description",
          "Amount", "LinkUrlCancel", "LinkUrlSuccess", "Lang", "MoneyType"]

def checkout_signature(fields: dict, secret: str) -> str:
    names = sorted(n for n in SIGNED if fields.get(n) is not None)
    raw = "".join(urllib.parse.quote(str(fields[n]), safe="~") for n in names)
    return md5_base64(raw + secret)

def notification_hash(n: dict, secret: str) -> str:
    s = lambda v: "" if v is None else str(v)
    p = n.get("Payment", {})
    prepared = (s(n.get("EventDate")) + s(n.get("Eventid")) + s(n.get("EventType")) + s(p.get("Amount"))
                + s(p.get("Customer")) + s(p.get("ExternalId")) + s(p.get("Id")) + s(p.get("Merchant"))
                + s(p.get("StatusDate")))
    return md5_base64(prepared + secret)
```

C#:

```csharp
using System.Security.Cryptography;
using System.Text;

static string Md5Base64(string text) =>
    Convert.ToBase64String(MD5.HashData(Encoding.UTF8.GetBytes(text)));

// Hosted checkout form: Uri.EscapeDataString implements RFC 3986.
static string CheckoutSignature(IDictionary<string, string?> fields, string secret)
{
    string[] signed = { "Order", "Currency", "Merchant", "SaleAreaCode", "CustomerCode", "CustomerNameFirst",
        "CustomerNameLast", "CustomerPhoneNumber", "CustomerEmail", "ExpiryDate", "Description", "Amount",
        "LinkUrlCancel", "LinkUrlSuccess", "Lang", "MoneyType" };
    var raw = new StringBuilder();
    foreach (var name in signed.Where(n => fields.TryGetValue(n, out var v) && v != null).OrderBy(n => n, StringComparer.Ordinal))
        raw.Append(Uri.EscapeDataString(fields[name]!));
    return Md5Base64(raw + secret);
}
```

## Частые ошибки

| Симптом | Причина |
|---|---|
| Подпись из 32 hex-символов | Вы закодировали в Base64 hex-строку или не закодировали вовсе. Кодируйте «сырой» дайджест. |
| Работает для одних заказов и не работает для других | Значения с пробелами, `&`, `@`, `:` или `/` не закодированы по RFC 3986, или пробел закодирован как `+` вместо `%20`. |
| Хэш уведомления никогда не совпадает | Не тот секретный ключ (ключи checkout и уведомлений разные), поля в неправильном порядке, или код читает `Payment.ID` / `Payment.ExternalID` вместо `Payment.Id` / `Payment.ExternalId` (ключи чувствительны к регистру). |
| Хэш отличается только для имён на кириллице/румынском | Строка не была закодирована в UTF-8 перед хэшированием. |
| Подпись перестала сходиться после добавления поля | Подписываемое поле добавили в форму, но не в `RawData` (или наоборот). |
| Не работает, только когда в значении есть `'`, `!`, `(`, `)` или `*` | `encodeURIComponent` (или другая функция) не кодирует эти пять символов. См. «Спецсимволы» выше. |
| После отправки формы открывается главная страница Paynet вместо платёжной | В значении есть HTML-тег (`<b>`) или HTML-сущность (`&#039;`). См. «Спецсимволы» выше. |
| Не работает, когда в `Description` несколько строк | Перенос строки в значении. Замените его пробелом до подписи. |
