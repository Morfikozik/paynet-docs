# Semnături

Paynet folosește peste tot aceeași schemă de hash:

```text
Signature = Base64( MD5( <string to sign> + SecretKey ) )
```

- MD5 se calculează pe octeții **UTF-8** ai șirului (inclusiv pentru chirilice și diacritice românești).
- Base64 se aplică pe **digestul brut de 16 octeți** (nu pe șirul hex de 32 de caractere). Rezultatul are mereu 24 de caractere și se termină cu `==`.

Diferă doar modul în care se construiește șirul de semnat:

| Unde | Șirul de semnat | Cheia secretă |
|---|---|---|
| Formularul hosted checkout (dvs. → Paynet) | `RawData`: valorile câmpurilor semnate, sortate după numele câmpului, codificate RFC 3986, concatenate | cheia hosted checkout |
| Notificări (Paynet → dvs.) | `PreparedString`: 9 valori ale notificării în ordine fixă | cheia pentru notificări |

Cele două chei secrete diferă intenționat. Paynet vi le emite pe amândouă.

## Vector de test 1: formularul hosted checkout

Cheia secretă (test): `F90D6485-9CCC-458B-96A3-8958AF9B4458`

Câmpuri de intrare:

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

Ordinea câmpurilor după sortare: `Amount, Currency, CustomerCode, CustomerEmail, CustomerNameFirst, CustomerNameLast, CustomerPhoneNumber, Description, ExpiryDate, Lang, LinkUrlCancel, LinkUrlSuccess, Merchant, MoneyType, Order, SaleAreaCode`.

`RawData` așteptat:

```text
12354985555test%40gmail.comFirst%20nameLast%20name060000000Test%26Co%20SRL2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800000onlidocumentation_md
```

`Signature` așteptată:

```text
cxr/+yLYZp34aR0KXLkb2A==
```

## Vector de test 2: notificare

Cheia secretă pentru notificări (test): `D9873689-E5F8-4272-A67F-0D8BA3F9BAA7`

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

(Sunt afișate doar câmpurile folosite în semnătură; notificarea reală are mai multe, vezi [Notificări](#/guides/notifications).)

`PreparedString` așteptat:

```text
2026-11-09T12:00:001000001PAID123537369XXX111176244480000012345672655052026-11-09T12:00:00
```

`Hash` așteptat:

```text
lq3+OCn0J/zSyNF5iAoShg==
```

## Verificați implementarea

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

## Greșeli frecvente

| Simptom | Cauză |
|---|---|
| Semnătura are 32 de caractere hex | Ați codificat Base64 șirul hex sau nu ați aplicat Base64 deloc. Codificați digestul brut. |
| Funcționează pentru unele comenzi, pentru altele nu | Valorile cu spații, `&`, `@`, `:` sau `/` nu sunt codificate RFC 3986, sau spațiul este codificat ca `+` în loc de `%20`. |
| Hash-ul notificării nu se potrivește niciodată | Cheie secretă greșită (cheile pentru checkout și notificări diferă), câmpuri în ordine greșită sau codul citește `Payment.ID` / `Payment.ExternalID` în loc de `Payment.Id` / `Payment.ExternalId` (cheile țin cont de majuscule). |
| Hash-ul diferă doar pentru nume cu chirilice/diacritice | Șirul nu a fost codificat în UTF-8 înainte de hash. |
| Semnătura nu mai trece după adăugarea unui câmp | Un câmp semnat a fost adăugat în formular, dar nu în `RawData` (sau invers). |
