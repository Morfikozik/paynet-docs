# Lista de verificare pentru lansare

## Înainte de trecerea în producție

**Acces și configurare**

- [ ] Ați primit de la Paynet utilizatorul API de producție, codul comerciantului, codul zonei de vânzare și cheile secrete.
- [ ] Ați primit de la Paynet URL-ul de bază API de producție.
- [ ] Secretele sunt păstrate în configurația serverului (variabile de mediu, vault), nu în cod sau în front-end.
- [ ] URL-ul dvs. de callback (HTTPS) este înregistrat la Paynet.
- [ ] `LinkUrlSuccess` și `LinkUrlCancel` indică paginile de producție.

**Plăți**

- [ ] Fiecare comandă primește un număr `Order` unic, inclusiv după reporniri și la cereri paralele.
- [ ] `ExpiryDate` este calculat (de ex. acum + 1 zi), nu fixat în cod.
- [ ] Sumele sunt trimise în unități minime și corespund totalului coșului.
- [ ] Hosted checkout: semnătura este calculată pe server și trece [vectorii de test](#/guides/signatures).

**Notificări**

- [ ] Handler-ul verifică antetul `Hash` cu cheia pentru notificări.
- [ ] Handler-ul este idempotent (un `Payment.ID` = o singură onorare a comenzii).
- [ ] Handler-ul răspunde `200` doar după ce comanda este salvată.
- [ ] Un job de rezervă verifică comenzile neplătite cu `GET /api/order/{paymentId}` dacă notificarea nu a sosit.

**Operare**

- [ ] Tokenul este păstrat în cache și reînnoit la `401`.
- [ ] Erorile sunt înregistrate împreună cu `traceId`.
- [ ] Comanda nu este marcată plătită doar pentru că clientul a revenit la `LinkUrlSuccess`.
- [ ] Rambursările și extrasele sunt testate, dacă le folosiți.

## După lansare

- Faceți o plată reală de valoare mică și rambursați-o.
- Comparați plățile din prima zi cu extrasul (`GET /api/statement`).
