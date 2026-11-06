# Semnături

Paynet folosește peste tot aceeași schemă de hash:

```text
Signature = Base64( MD5( <string to sign> + SecretKey ) )
```

- MD5 se calculează pe octeții UTF-8 ai șirului.
- Base64 se aplică pe **digestul brut de 16 octeți** (nu pe șirul hex de 32 de caractere). Rezultatul are mereu 24 de caractere și se termină cu `==`.

Diferă doar modul în care se construiește șirul de semnat:

| Unde | Șirul de semnat | Cheia secretă |
|---|---|---|
| Hosted checkout v0.6 (dvs. → Paynet) | `RawData`: valorile câmpurilor semnate, sortate după numele câmpului, codificate RFC 3986, concatenate | cheia hosted checkout |
| Notificări (Paynet → dvs.) | `PreparedString`: 9 valori ale notificării în ordine fixă | cheia pentru notificări |
| Hosted checkout v0.5, vechi | `PreparedString`: valori în ordine fixă, vezi [Hosted checkout](#/guides/hosted-checkout) | cheia hosted checkout |

## Vector de test 1: hosted checkout v0.6

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

`PreparedString` așteptat:

```text
2016-01-01T00:00:0020160622010101PAID12337369XXX111767676612345671231232016-01-01T00:00:00
```

`Hash` așteptat:

```text
U2LhpObu5hnAshxejSovkQ==
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

> **Ciornă:** specificația v0.5 conține un exemplu C# care codifică șirul în Windows-1251 înainte de hash, iar acest portal folosește UTF-8. Pentru litere latine, cifre și semne de punctuație rezultatul este același. Confirmați cu Paynet ce codificare se aplică valorilor cu chirilice sau diacritice românești.

## Greșeli frecvente

| Simptom | Cauză |
|---|---|
| Semnătura are 32 de caractere hex | Ați codificat Base64 șirul hex sau nu ați aplicat Base64 deloc. Codificați digestul brut. |
| Funcționează pentru unele comenzi, pentru altele nu | Valorile cu spații, `&`, `@`, `:` sau `/` nu sunt codificate RFC 3986 (v0.6), sau spațiul este codificat ca `+` în loc de `%20`. |
| Hash-ul notificării nu se potrivește niciodată | Cheie secretă greșită (cheile pentru checkout și notificări diferă) sau câmpuri în ordine greșită. |
| Hash-ul diferă doar pentru nume cu chirilice/diacritice | Nepotrivire de codificare. Portalul și exemplele de mai sus folosesc UTF-8. |
| Semnătura nu mai trece după adăugarea unui câmp | Un câmp semnat a fost adăugat în formular, dar nu în `RawData` (sau invers). |
