# Signatures

Paynet uses one hashing scheme everywhere:

```text
Signature = Base64( MD5( <string to sign> + SecretKey ) )
```

- MD5 over the **UTF-8** bytes of the string (also for Cyrillic and Romanian diacritics).
- Base64 of the **raw 16-byte digest** (not of the 32-character hex string). The result is always 24 characters and ends with `==`.
- Do not confuse it with the `signature` field in the `POST /api/order` response: that is an internal value of the payment link (32 characters, equal to the `s` parameter in `paymentLink`). Do not use it for verification.

What changes is how the string to sign is built:

| Where | String to sign | Secret key |
|---|---|---|
| Hosted checkout form (you → Paynet) | `RawData`: signed field values, sorted by field name, RFC 3986-encoded, concatenated | hosted checkout secret key |
| Notifications (Paynet → you) | `PreparedString`: 9 notification values in fixed order | notification secret key |

The two secret keys are different on purpose. Paynet issues both to you.

## Test vector 1: hosted checkout form

Secret key (test): `F90D6485-9CCC-458B-96A3-8958AF9B4458`

Input fields:

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

Field order after sorting: `Amount, Currency, CustomerCode, CustomerEmail, CustomerNameFirst, CustomerNameLast, CustomerPhoneNumber, Description, ExpiryDate, Lang, LinkUrlCancel, LinkUrlSuccess, Merchant, MoneyType, Order, SaleAreaCode`.

Expected `RawData`:

```text
12354985555test%40gmail.comFirst%20nameLast%20name060000000Test%26Co%20SRL2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800000onlidocumentation_md
```

Expected `Signature`:

```text
cxr/+yLYZp34aR0KXLkb2A==
```

## Test vector 2: notification

Notification secret key (test): `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`

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

(Only the fields used in the signature are shown; the real notification has more, see [Notifications](#/guides/notifications).)

Expected `PreparedString`:

```text
2026-11-09T12:00:001000001PAID123537369XXX111176244480000012345672655052026-11-09T12:00:00
```

Expected `Hash`:

```text
lq3+OCn0J/zSyNF5iAoShg==
```

## Test vector 3: special characters

Same secret key as vector 1. The values contain `'`, `&`, `!`, `(`, `)`, `*`, Cyrillic and Romanian letters. The test environment accepted this exact form (11.11.2026).

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

Expected `RawData`:

```text
12354985555%D0%9C%D0%B0%D1%80%D0%B8%D1%8F%C8%9AurcanMary%27s%20Cake%20%26%20Co%21%20%281%29%2A2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800003onlidocumentation_md
```

Expected `Signature`:

```text
fm47qWzVzqPQQ+huHgWVZw==
```

## Special characters

Results of real form submissions to the test environment:

| The value contains | Result |
|---|---|
| `" ' & < > # ; % + = ? / \`, `’`, emoji, Cyrillic, Romanian letters | Works if every value is RFC 3986-encoded (table below). |
| A line break (multi-line `Description`) | The signature fails. Replace line breaks with a space before signing. |
| An HTML tag (`<b>`) or an HTML entity (`&#039;`) | Paynet rejects the form before checking the signature: the customer sees the Paynet home page instead of the payment page. Remove tags and turn entities into plain characters before signing. |

Encoding function by language:

| Language | Correct | Wrong (breaks on some characters) |
|---|---|---|
| PHP | `rawurlencode($v)` | `urlencode($v)`: space becomes `+`, `~` becomes `%7E` |
| JavaScript / Node.js | `encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())` | `encodeURIComponent(v)` alone: leaves `! ' ( ) *` |
| Python | `urllib.parse.quote(v, safe="~")` | `quote(v)` (leaves `/`), `quote_plus(v)` (space becomes `+`) |
| C# | `Uri.EscapeDataString(v)` (.NET Core / .NET 5+) | `HttpUtility.UrlEncode`, `WebUtility.UrlEncode`: space becomes `+` |
| Java | `URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20").replace("*", "%2A").replace("%7E", "~")` | `URLEncoder.encode` alone: space becomes `+`, `*` is left |

Rules:

- Sign the original values: exactly what the browser will send. Do not sign HTML-escaped text (`&amp;`, `&#039;`).
- Escape values for HTML only once, when you write them into the form (`&` → `&amp;`, `"` → `&quot;`). An unescaped `"` cuts the value off inside `value="…"`.
- Do not change values after signing (trimming, replacing characters, shortening).
- Serve the page in UTF-8 (`<meta charset="utf-8">`) and add `accept-charset="UTF-8"` to the form.
- If your CMS gives you product names with HTML entities (`Mary&#039;s`), decode them (`Mary's`) before you build the form.

## Check your implementation

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

## Common mistakes

| Symptom | Cause |
|---|---|
| Signature has 32 hex characters | You Base64-encoded the hex string or did not Base64 at all. Base64 the raw digest. |
| Works for some orders, fails for others | Values with spaces, `&`, `@`, `:` or `/` are not RFC 3986-encoded, or `+` is used for spaces instead of `%20`. |
| Notification hash never matches | Wrong secret key (checkout and notification keys are different), fields in the wrong order, or the code reads `Payment.ID` / `Payment.ExternalID` instead of `Payment.Id` / `Payment.ExternalId` (keys are case-sensitive). |
| Hash differs only for Cyrillic/Romanian names | The string was not encoded as UTF-8 before hashing. |
| Signature fails after you added a field | A signed field was added to the form but not to `RawData` (or the other way round). |
| Fails only when a value contains `'`, `!`, `(`, `)` or `*` | `encodeURIComponent` (or another function) that does not encode these five characters. See "Special characters" above. |
| After the form is sent, the Paynet home page opens instead of the payment page | A value contains an HTML tag (`<b>`) or an HTML entity (`&#039;`). See "Special characters" above. |
| Fails when `Description` has several lines | A line break in a value. Replace it with a space before signing. |
