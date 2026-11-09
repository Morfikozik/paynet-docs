# Întrebări frecvente

## Cheile de test și de producție sunt aceleași?

Nu. Accesele de producție și ambele chei secrete (pentru formularul checkout și pentru notificări) diferă de cele de test. La trecerea în producție înlocuiți toate valorile — vezi [Lista de verificare pentru lansare](#/guides/go-live).

## Cum obțin accesele de producție?

Sunt trimise pe emailul administratorului companiei dvs. Durează de la 5 minute la câteva zile, în funcție de funcțiile conectate.

## Clientul a revenit pe pagina de succes, dar notificarea nu a venit. Comanda e plătită?

Nu considerați comanda plătită doar pentru că clientul a revenit la `LinkUrlSuccess`. Așteptați o notificare `PAID` verificată sau verificați statusul: `GET /api/order/merchant/{Order}`, `status` = `4` înseamnă achitată. Vezi [Statusul plății](#/guides/errors-and-statuses).

## Aceeași notificare a venit de mai multe ori

Este normal: dacă serverul dvs. nu a răspuns `200`, Paynet trimite notificarea din nou. Procesați fiecare `Payment.Id` o singură dată. Vezi [Notificări](#/guides/notifications).

## Notificarea nu a mai venit

Verificați statusul cu `GET /api/order/merchant/{Order}`. Retrimiterea notificării o puteți cere la suportul Paynet.

## Banca a refuzat plata. Se poate plăti aceeași comandă din nou?

Nu: după refuz comanda primește statusul `5` și se închide. Creați o comandă nouă cu un `Order` nou. Dacă clientul doar a închis pagina fără să plătească, comanda rămâne `1` și poate fi plătită cu același `paymentLink`.

## Un `POST /api/order` repetat cu același `Order` a returnat `500`

Cu același `Order` și aceleași date Paynet returnează aceeași plată. `500 TECHNICAL_ERROR` înseamnă că datele diferă sau comanda este deja plătită ori plata ei este în procesare. Vezi [Număr de comandă repetat](#/guides/errors-and-statuses).

## De ce `PaidAmount` este mai mic decât `Amount`?

De obicei sunt egale. `PaidAmount` este mai mic doar la o promoție convenită oficial cu Paynet (de exemplu, reducere pentru cardurile unei anumite bănci). Primiți `PaidAmount` minus comisionul Paynet.

## Pot face a doua rambursare pentru aceeași plată?

Nu. Pentru o plată este posibilă o singură rambursare: integrală sau parțială.

## De ce nu trece rambursarea?

Verificați: nu au trecut mai mult de 180 de zile de la plată; metoda de plată nu este `CASH_INVOICE`; plata nu a fost încă rambursată; suma nu depășește `PaidAmount`; în contul comerciantului din Paynet sunt bani. Vezi [Rambursări](#/guides/errors-and-statuses).

## De ce comanda expiră mai devreme decât am planificat?

`ExpiryDate` este în ora locală a Chișinăului (`Europe/Chisinau`). Dacă serverul dvs. lucrează în UTC, convertiți ora, altfel comanda expiră cu 2–3 ore mai devreme.

## Semnătura nu se potrivește

Verificați: șirul este codificat UTF-8; se folosește cheia corectă (formularul checkout și notificările au chei diferite); valorile sunt luate exact cum apar în JSON. Comparați codul cu [vectorii de test](#/guides/signatures).

## Trebuie activat CORS pentru notificări?

Nu. CORS este necesar doar simulatorului de notificări de pe acest portal, deoarece trimite cererea din browser. Notificările reale sunt trimise de serverul Paynet.

## De ce `CardLinkHash` este `null` în notificare?

Salvarea cardurilor nu este activată pentru `SaleAreaCode` dvs., comanda nu a avut `Customer` sau clientul a debifat „salvează cardul”. Vezi [Salvarea cardurilor](#/guides/saved-cards).
