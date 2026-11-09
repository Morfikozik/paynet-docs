# Jurnalul modificărilor

## Documentația v3 — 09.11.2026

- **Exemplu de magazin în Node.js** — o integrare completă fără dependențe. Verificat de un test end-to-end în mediul de test: cumpărare, plată, notificare, rambursare. Vezi [Exemplu de magazin](#/guides/example-shop).
- **Răspunsuri simulate pentru testele de eșec**: statusurile `3`, `5`, `6`, erori de rambursare, `401`, `errorInfo`, notificări semnate. Vezi [Testare](#/guides/testing).
- **Specificația API verificată cu răspunsuri reale** ale mediului de test `/auth` cu parolă greșită returnează `401` (nu `500`);; sunt descrise formatul `401` pentru token și formatul `errorInfo`;; a fost adăugat `amount.paidAmount`;; au fost adăugate schemele răspunsurilor pentru rambursare, căutare și extras.
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
