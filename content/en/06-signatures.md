# Signatures

Paynet uses one hashing scheme everywhere:

```text
Signature = Base64( MD5( <string to sign> + SecretKey ) )
```

- MD5 over the UTF-8 bytes of the string.
- Base64 of the **raw 16-byte digest** (not of the 32-character hex string). The result is always 24 characters and ends with `==`.

What changes is how the string to sign is built:

| Where | String to sign | Secret key |
|---|---|---|
| Hosted checkout v0.6 (you → Paynet) | `RawData`: signed field values, sorted by field name, RFC 3986-encoded, concatenated | hosted checkout secret key |
| Notifications (Paynet → you) | `PreparedString`: 9 notification values in fixed order | notification secret key |
| Hosted checkout v0.5, legacy | `PreparedString`: values in fixed order, see [Hosted checkout](#/guides/hosted-checkout) | hosted checkout secret key |

## Test vector 1: hosted checkout v0.6

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
  "Eventid": 20160622010101,
  "EventType": "PAID",
  "EventDate": "2016-01-01T00:00:00",
  "Payment": {
    "ID": 1234567,
    "ExternalID": 7676766,
    "Merchant": "123123",
    "Customer": "37369XXX111",
    "StatusDate": "2016-01-01T00:00:00",
    "Amount": 123
  }
}
```

Expected `PreparedString`:

```text
2016-01-01T00:00:0020160622010101PAID12337369XXX111767676612345671231232016-01-01T00:00:00
```

Expected `Hash`:

```text
U2LhpObu5hnAshxejSovkQ==
```

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
                + s(p.get("Customer")) + s(p.get("ExternalID")) + s(p.get("ID")) + s(p.get("Merchant"))
                + s(p.get("StatusDate")))
    return md5_base64(prepared + secret)
```

C#:

```csharp
using System.Security.Cryptography;
using System.Text;

static string Md5Base64(string text) =>
    Convert.ToBase64String(MD5.HashData(Encoding.UTF8.GetBytes(text)));

// Hosted checkout v0.6: Uri.EscapeDataString implements RFC 3986.
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

> **Draft:** the legacy v0.5 specification shows a C# sample that encodes the string with Windows-1251 before hashing, while this portal uses UTF-8. Both give the same result for Latin letters, digits and punctuation. Confirm with Paynet which encoding applies to values with Cyrillic or Romanian diacritics.

## Common mistakes

| Symptom | Cause |
|---|---|
| Signature has 32 hex characters | You Base64-encoded the hex string or did not Base64 at all. Base64 the raw digest. |
| Works for some orders, fails for others | Values with spaces, `&`, `@`, `:` or `/` are not RFC 3986-encoded (v0.6), or `+` is used for spaces instead of `%20`. |
| Notification hash never matches | Wrong secret key (checkout and notification keys are different) or fields in the wrong order. |
| Hash differs only for Cyrillic/Romanian names | Encoding mismatch. This portal and the examples above use UTF-8. |
| Signature fails after you added a field | A signed field was added to the form but not to `RawData` (or the other way round). |
