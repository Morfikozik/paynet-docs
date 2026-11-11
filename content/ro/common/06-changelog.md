# Jurnalul modificărilor

## Documentația v3.4 — 11.11.2026

- **Caractere speciale în semnătura hosted checkout** (verificat prin trimiteri reale ale formularului în mediul de test): funcții de codificare corecte și greșite pentru PHP, JavaScript, Python, C#, Java; rândul nou strică semnătura; tagurile și entitățile HTML fac ca Paynet să respingă formularul înainte de verificarea semnăturii. Vector de test 3 nou cu `' & ! ( ) *`, litere chirilice și românești. Vezi [Semnături](#/guides/signatures).
- Linkul „Previous portal version” deschide documentația anterioară https://docs.paynet.md/psp/.
- Împreună cu portalul se publică `robots.txt` și `sitemap.xml`.

## Documentația v3.3 — 10.11.2026

Clarificări în urma unui test în care un dezvoltator nou în Paynet a făcut integrarea folosind doar această documentație.

- **Produse:** dacă trimiteți `Products`, sunt obligatorii `LineNo`, `Name`, `UnitPrice`, `Quantity`, `Amount`, `TotalAmount`; `Code` și `Description` sunt opționale (verificat în mediul de test). Vezi [Server-to-server](#/guides/server-to-server).
- **Linkul de plată:** păstrați `paymentLink` din răspunsul la crearea comenzii — în răspunsurile de status este scurtat.
- **Rambursări:** rambursare integrală = `Amount` egal cu `PaidAmount`; `200` = efectuată; nu repetați rambursarea fără a verifica statusul. Exemplele de cerere și răspuns arată acum aceeași plată. Vezi [Erori și statusuri](#/guides/errors-and-statuses).
- Datele căutării plăților în tabelul de formate: ora Chișinău, fără `Z`.
- Notificări: contează doar codul HTTP `200`, corpul răspunsului nu contează.
- Getting started: unde se folosește codul comerciantului.
- `Customer.PhoneNumber`: opțional, dar fără el clientul introduce telefonul pe pagina de plată. Exemplele îl trimit acum.
- **Statusuri:** `6` — achitat, apoi rambursat parțial; `5` — neachitat (refuz bancar, antifraudă) sau rambursat integral.
- **Notificări:** prima notificare se trimite după ce banca emitentă confirmă plata (timpul depinde de bancă); intervalele reîncercărilor nu s-au schimbat.
- **Exemplul de notificări din SDK:** notificarea se salvează înainte de răspunsul `200`, comanda se onorează din înregistrarea salvată.
- `linkUrlSuccess` / `linkUrlCancel` în răspunsurile despre plată pot fi `null` (referința API, tipurile Node.js SDK).
- `Lang`: majusculele nu contează; la o valoare necunoscută pagina se deschide în engleză (verificat în mediul de test).
- Exemplul de magazin se descarcă acum ca arhivă de pe acest portal.

## Documentația v3.2 — 10.11.2026

- **SDK-uri oficiale pentru PHP și Node.js** (versiunea 1.0.0, licență MIT): autorizare, comenzi, statusuri, rambursări cu verificarea regulilor, carduri salvate, extrase, notificări, formularul hosted checkout, erori. Verificate în mediul de test. Vezi [SDK](#/guides/sdk).
- **Aplicații mobile**: cum acceptă o aplicație plăți prin serverul dvs. și pagina Paynet. Vezi [Aplicații mobile](#/guides/mobile-apps).
- **Căutarea plăților:** `from`/`to` sunt în ora Chișinăului; o perioadă goală dă `404 NOT_FOUND_RECORD`. Colecția Postman a fost corectată.
- `Quantity` produsului este în sutimi (`100` = 1 buc.).

## Documentația v3.1 — 10.11.2026

- **Colecție Postman nouă** cu mediile TEST și PRODUCTION: tokenul se obține automat, fiecare comandă este unică, datele se transmit între cereri. Verificată printr-o rulare în mediul de test. Vezi [Testare → Postman](#/guides/testing).
- **Fișă rapidă pentru erori** cu coloana „repetați cererea?”; au fost adăugate `405`, `415` și `404` cu corp gol (verificat în mediul de test). Vezi [Erori și statusuri](#/guides/errors-and-statuses).
- **Programul reîncercărilor notificărilor:** 9 încercări în circa 25 de minute. **Adresele IP** Paynet pentru firewall. Vezi [Notificări](#/guides/notifications).
- 3-D Secure și motivul refuzului în secțiunea de statusuri; secțiunea „Contactarea suportului”.
- Meniu lateral cu pictograme; tabelele de parametri se citesc pe telefon.

## Documentația v3 — 09.11.2026

- **Exemplu de magazin în Node.js** — o integrare completă fără dependențe. Verificat de un test end-to-end în mediul de test: cumpărare, plată, notificare, rambursare. Vezi [Exemplu de magazin](#/guides/example-shop).
- **Răspunsuri simulate pentru testele de eșec**: statusurile `3`, `5`, `6`, erori de rambursare, `401`, `errorInfo`, notificări semnate. Vezi [Testare](#/guides/testing).
- **Specificația API verificată cu răspunsuri reale** ale mediului de test: `/auth` cu parolă greșită returnează `401` (nu `500`); sunt descrise formatul `401` pentru token și formatul `errorInfo`; a fost adăugat `amount.paidAmount`; au fost adăugate schemele răspunsurilor pentru rambursare, căutare și extras.
- **Salvarea cardurilor verificată în mediul de test:** același client vede cardul, alt client nu. Vezi [Salvarea cardurilor](#/guides/saved-cards).
- **Handlere complete de notificări** în Node.js și PHP; logica Node.js este testată la fiecare build.

## Documentația v2 — 09.11.2026

- Portal pentru mai multe produse: pagina principală, căutare pe tot site-ul, secțiunile „General” și „E-commerce”.
- Reguli API confirmate de Paynet: statusurile plății, plăți eșuate, rambursări, reîncercări ale notificărilor, salvarea cardurilor, accese de producție.
- Ce protejează semnătura notificării și cum confirmați câmpurile nesemnate prin API.
- Întrebări frecvente, meniul „Copiază pentru AI”, fișiere pentru AI în trei limbi.
- Descrierea protocolului învechit din documentația veche a fost eliminată.
- Această versiune este păstrată în ramura `documentation-v2` a depozitului.

## Documentația v1

Portalul original. Disponibil prin linkul „Versiunea anterioară a portalului” din josul paginii.
