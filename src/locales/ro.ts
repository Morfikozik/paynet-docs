import { TranslationResources } from '../types/language';

export const ro: TranslationResources = {
  common: {
    search: 'Căutare',
    endpoints: 'Metode',
    projectInfo: 'Info',
    parameters: 'Parametri',
    responses: 'Răspunsuri',
    codeExamples: 'Exemple de cod',
    name: 'Nume',
    type: 'Tip',
    in: 'În',
    required: 'Obligatoriu',
    optional: 'Opțional',
    description: 'Descriere',
    copyToClipboard: 'Copiază în clipboard',
    copied: 'Copiat!',
    authentication: 'Autentificare',
    quickLinks: 'Link-uri rapide',
    contactSupport: 'Contactează suportul',
    termsOfService: 'Termeni și condiții',
    secure: 'Securizat',
    fast: 'Rapid',
    global: 'Global',
    secureDesc: 'Securitate standard în industrie cu autentificare duală și conformitate PCI DSS',
    fastDesc: 'Procesare de tranzacții în timp real cu monitorizare cuprinzătoare',
    globalDesc: 'Suport multi-valută cu procesare de plăți internaționale',
    requestTypeAndUrl: 'Tipul Cererii și URL',
    methodDescription: 'Descrierea Metodei',
    responses: 'Răspunsuri',
    customizeRequest: 'Personalizează Cererea',
    showInput: 'Arată Input',
    hideInput: 'Ascunde Input',
    parameters: 'Parametri',
    requestBody: 'Corpul Cererii',
    enterJsonRequestBody: 'Introduceți corpul cererii JSON',
    formatJson: 'Formatează JSON',
    updateCodeExamples: 'Actualizează Exemplele de Cod',
    testApiRequest: 'Testează Cererea API',
    testing: 'Se testează...',
    generating: 'Se generează...',
    apiResponse: 'Răspunsul API',
    hide: 'Ascunde',
    copyResponse: 'Copiază Răspunsul',
    generatingCodeExamples: 'Se generează exemple de cod...',
    noCodeExamplesAvailable: 'Nu sunt disponibile exemple de cod',
    pathParameter: 'Parametru de cale',
    bodyParameter: 'Parametru de corp',
    enterParameter: 'Introduceți {parameter}',
    contentType: 'Tip-Conținut',
    corsWarning: 'Testarea API-urilor externe din browser este limitată de politica CORS. Utilizați exemplele de cod generate în backend-ul dvs. sau în instrumentele de testare API.',
    corsError: 'Nu se pot testa API-urile externe direct din browser din cauza politicii CORS'
  },
  welcome: {
    title: 'Bun venit la documentația API TPS',
    subtitle: 'Documentație cuprinzătoare pentru API-ul Transfer Payment System (PSP) incluzând gestionarea soldului, tranzacțiile și operațiunile de transfer. Selectați un punct final din bara laterală pentru a începe.',
    authTitle: 'Autentificare',
    authDescription: 'Toate cererile API necesită autentificare duală folosind atât TPS API Key cât și X-API-KEY. Includeți ambele chei în anteturile cererii:',
    authNote: 'Puteți obține acreditările API din portalul pentru dezvoltatori PayNet după crearea unui cont.'
  },
  placeholders: {
    searchEndpoints: 'Căutați puncte finale...',
    selectEndpoint: 'Selectați un punct final pentru a vedea exemple de cod',
    switchToEndpoints: 'Comutați la vizualizarea Puncte finale pentru a vedea exemple de cod',
    noEndpointSelected: 'Selectați un punct final din bara laterală pentru a începe.',
    downloadPostmanCollection: 'Descărcați Colecția Postman'
  },
  ecommerce: {
    pageTitle: 'Ecommerce',
    mainTitle: 'Procesare plăți prin Paynet',
    introParagraph1:
      'Paynet oferă o soluție modernă de plată online care permite comercianților să accepte plăți în mod sigur, rapid și convenabil printr-o gamă largă de metode de plată.',
    introParagraph2:
      'Cu o singură integrare, obțineți acces la opțiuni de plată locale și internaționale, asigurând rate ridicate de conversie și o experiență utilizator fluidă.',
    paymentMethodsTitle: 'Metode de plată disponibile',
    paymentMethodsIntro: 'Paynet vă permite să acceptați plăți prin:',
    paymentVisaTitle: '💳 Carduri bancare Visa și MasterCard',
    paymentVisaDesc:
      'Suport pentru carduri locale și internaționale cu securitate avansată și autentificare 3D Secure',
    paymentPaynetWalletTitle: '💼 Carduri și portofele Paynet',
    paymentPaynetWalletDesc: 'Plăți în ecosistemul Paynet cu confirmare instantanee a tranzacției',
    paymentMiaTitle: '⚡ Plăți instant MIA',
    paymentMiaDesc: 'Plăți în timp real între conturi, disponibile 24/7',
    paymentAppleGoogleTitle: '📱 Apple Pay și Google Pay',
    paymentAppleGoogleDesc:
      'Plăți rapide și convenabile cu un singur clic de pe dispozitive mobile, fără să introduceți datele cardului',
    paymentCashTitle: '💵 Numerar prin rețeaua de terminale Paynet',
    paymentCashDesc:
      'Posibilitatea de a plăti numerar printr-o rețea largă de terminale self-service în țară',
    keyBenefitsTitle: 'Beneficii principale',
    benefitSingleIntegration: 'Integrare unică — un singur API pentru toate metodele de plată',
    benefitConversion: 'Rate ridicate de conversie — suport pentru opțiuni de plată populare',
    benefitSecurity: 'Securitate — conformitate PCI DSS și mecanisme avansate de protecție',
    benefitInstant: 'Procesare instantanee — execuție și confirmare rapidă a tranzacțiilor',
    benefitFlexibility: 'Flexibilitate — suportă diverse modele de business și scenarii de utilizare'
  },
  serverServer: {
    pageTitle: 'Model Server-Server',
    mainTitle: 'Integrare server-la-server cu Paynet',
    introParagraph1:
      'În modelul Server-Server sistemele dvs. de backend comunică direct cu Paynet prin HTTPS. Cererile și răspunsurile sunt schimbate între servere—fără a depinde de browserul clientului pentru fluxurile principale de API.',
    introParagraph2:
      'Acest model este potrivit pentru automatizarea ciclului de viață al comenzilor, rambursări, verificarea stării plății, extrase și rapoarte. Oferă control complet pe server, comportament predictibil sub sarcină și integrare simplă cu serviciile existente.',
    characteristicsTitle: 'Caracteristici de integrare',
    characteristicsIntro: 'Trăsături tipice ale unei integrări server-server:',
    aspect1Title: '🔐 HTTPS și securitatea transportului',
    aspect1Desc:
      'Toate apelurile folosesc TLS. Păstrați credențialele în afara jurnalelor, rotiți cheile când e nevoie și restricționați accesul ieșitor din nivelul de aplicație.',
    aspect2Title: '🔑 Autentificare bazată pe token',
    aspect2Desc:
      'Endpoint-urile protejate folosesc token-uri Bearer obținute prin fluxul de autentificare. Token-urile se trimit în anteturi—niciodată în URL-uri sau pe partea clientului publică.',
    aspect3Title: '📦 Payload-uri JSON',
    aspect3Desc:
      'Cererile și răspunsurile sunt JSON, cu excepția cazurilor în care un endpoint returnează explicit alt tip de conținut (de exemplu descărcare fișier).',
    aspect4Title: '⚙️ Potrivit pentru automatizare',
    aspect4Desc:
      'Conceput pentru reîncercări, job-uri batch, reconciliere și monitorizare din back-office sau stratul de integrare.',
    aspect5Title: '📊 Vizibilitate operațională',
    aspect5Desc:
      'Combinați răspunsurile API cu propriile loguri și alerte pentru a urmări ciclul de viață al plăților și a investiga rapid problemele.',
    keyBenefitsTitle: 'Beneficii principale',
    benefit1: 'Control direct pe server — fără dependență de browserele utilizatorilor pentru apeluri API',
    benefit2: 'Suprafață de integrare stabilă — potrivită pentru producție și automatizare',
    benefit3: 'Model de securitate clar — anteturi, TLS și utilizarea token-urilor aliniată cu bunele practici API',
    benefit4: 'Acoperă ciclul complet — creare comenzi, interogare status, rambursări și raportare unde se aplică',
    benefit5: 'Aceeași documentație ca endpoint-urile — folosiți metodele listate sub această secțiune în bara laterală'
  },
  clientServer: {
    pageTitle: 'Model Client-Server',
    mainTitle: 'Integrare client-server cu Paynet',
    introParagraph1:
      'În modelul Client-Server, datele de plată sunt pregătite de sistemul dvs. și transmise către Paynet prin fluxul clientului. Clientul este redirecționat către paginile Paynet pentru autentificare și finalizarea plății.',
    introParagraph2:
      'Modelul este potrivit pentru checkout web și mobil, unde fluxul începe în browser sau aplicație. Pentru protejarea integrității datelor, payload-ul de plată este semnat înainte de redirect și verificat de ambele sisteme.',
    characteristicsTitle: 'Caracteristici de integrare',
    characteristicsIntro: 'Trăsături tipice ale unei integrări client-server:',
    aspect1Title: '🔐 Semnătură în loc de autentificare pe token',
    aspect1Desc:
      'Protecția principală se bazează pe semnarea cererii cu o cheie secretă comună. Cheia trebuie păstrată doar pe backend-ul de încredere.',
    aspect2Title: '🧾 Payload de plată structurat',
    aspect2Desc:
      'Se transmit comanda, datele clientului, serviciile, produsele, moneda, data expirării și metadatele merchantului într-o structură strict definită.',
    aspect3Title: '↪️ Flux redirect pentru client',
    aspect3Desc:
      'După trimiterea datelor, clientul este redirecționat pe paginile Paynet pentru alegerea metodei de plată, confirmare și finalizare.',
    aspect4Title: '🔁 Return URL și urmărirea statusului',
    aspect4Desc:
      'Integrarea include URL-uri de succes/anulare și verificări ulterioare de status pentru finalizarea corectă a comenzii.',
    aspect5Title: '📣 Validarea notificărilor',
    aspect5Desc:
      'Notificările de plată sunt, de asemenea, semnate. Backend-ul trebuie să valideze semnătura și să proceseze idempotent callback-urile duplicate.',
    keyBenefitsTitle: 'Beneficii principale',
    benefit1: 'Adoptare rapidă în checkout — potrivit natural pentru fluxuri web și mobile',
    benefit2: 'Control puternic al integrității — semnăturile protejează câmpurile sensibile de plată',
    benefit3: 'Experiență flexibilă pentru client — păstrați fluxul magazinului și redirecționați doar la pasul de plată',
    benefit4: 'Flux de decontare clar — combinați rezultatul redirectului cu status API și notificări',
    benefit5: 'Siguranță operațională — reguli deterministe de semnare și validare callback'
  }
};