import { TranslationResources } from '../types/language';

export const en: TranslationResources = {
  common: {
    search: 'Search',
    endpoints: 'Endpoints',
    projectInfo: 'Info',
    codeExamples: 'Code Examples',
    name: 'Name',
    type: 'Type',
    in: 'In',
    required: 'Required',
    optional: 'Optional',
    description: 'Description',
    copyToClipboard: 'Copy to clipboard',
    copied: 'Copied!',
    authentication: 'Authentication',
    quickLinks: 'Quick Links',
    contactSupport: 'Contact Support',
    termsOfService: 'Terms of Service',
    secure: 'Secure',
    fast: 'Fast',
    global: 'Global',
    secureDesc: 'Industry-standard security with dual authentication and PCI DSS compliance',
    fastDesc: 'Real-time transaction processing with comprehensive monitoring',
    globalDesc: 'Multi-currency support with international payment processing',
    requestTypeAndUrl: 'Request Type and URL',
    methodDescription: 'Method Description',
    responses: 'Responses',
    customizeRequest: 'Customize Request',
    showInput: 'Show Input',
    hideInput: 'Hide Input',
    parameters: 'Parameters',
    requestBody: 'Request Body',
    enterJsonRequestBody: 'Enter JSON request body',
    formatJson: 'Format JSON',
    updateCodeExamples: 'Update Code Examples',
    testApiRequest: 'Test API Request',
    testing: 'Testing...',
    generating: 'Generating...',
    apiResponse: 'API Response',
    hide: 'Hide',
    copyResponse: 'Copy Response',
    generatingCodeExamples: 'Generating code examples...',
    noCodeExamplesAvailable: 'No code examples available',
    pathParameter: 'Path parameter',
    bodyParameter: 'Body parameter',
    enterParameter: 'Enter {parameter}',
    contentType: 'Content-Type',
    corsWarning: 'Testing external APIs from browser is limited by CORS policy. Use the generated code examples in your backend or API testing tools.',
    corsError: 'Cannot test external APIs directly from browser due to CORS policy'
  },
  welcome: {
    title: 'Welcome to TPS API Documentation',
    subtitle: 'Comprehensive documentation for Transfer Payment System (PSP) API including balance management, transactions, and transfer operations. Select an endpoint from the sidebar to get started.',
    authTitle: 'Authentication',
    authDescription: 'All API requests require dual authentication using both TPS API Key and X-API-KEY. Include both keys in the request headers:',
    authNote: 'You can obtain your API credentials from the PayNet developer portal after creating an account.'
  },
  placeholders: {
    searchEndpoints: 'Search endpoints...',
    selectEndpoint: 'Select an endpoint to view code examples',
    switchToEndpoints: 'Switch to Endpoints view to see code examples',
    noEndpointSelected: 'Select an endpoint from the sidebar to get started.',
    downloadPostmanCollection: 'Download Postman Collection'
  },
  ecommerce: {
    pageTitle: 'Ecommerce',
    mainTitle: 'Payment Processing by Paynet',
    introParagraph1:
      'Paynet provides a modern online payment solution that enables businesses to accept payments securely, quickly, and conveniently through a wide range of payment methods.',
    introParagraph2:
      'With a single integration, you gain access to both local and international payment options, ensuring high conversion rates and a seamless user experience.',
    paymentMethodsTitle: 'Available Payment Methods',
    paymentMethodsIntro: 'Paynet allows you to accept payments via:',
    paymentVisaTitle: '💳 Visa & MasterCard bank cards',
    paymentVisaDesc:
      'Support for both local and international cards with advanced security and 3D Secure authentication',
    paymentPaynetWalletTitle: '💼 Paynet cards and wallets',
    paymentPaynetWalletDesc: 'Payments within the Paynet ecosystem with instant transaction confirmation',
    paymentMiaTitle: '⚡ MIA Instant Payments',
    paymentMiaDesc: 'Real-time account-to-account payments available 24/7',
    paymentAppleGoogleTitle: '📱 Apple Pay & Google Pay',
    paymentAppleGoogleDesc:
      'Fast and convenient one-click payments from mobile devices without entering card details',
    paymentCashTitle: '💵 Cash via Paynet terminal network',
    paymentCashDesc:
      'Ability to pay in cash through a wide network of self-service terminals across the country',
    keyBenefitsTitle: 'Key Benefits',
    benefitSingleIntegration: 'Single integration — one API for all payment methods',
    benefitConversion: 'High conversion rates — support for popular payment options',
    benefitSecurity: 'Security — PCI DSS compliance and advanced protection mechanisms',
    benefitInstant: 'Instant processing — fast transaction execution and confirmation',
    benefitFlexibility: 'Flexibility — supports various business models and use cases'
  },
  serverServer: {
    pageTitle: 'Server-Server model',
    mainTitle: 'Server-to-server integration with Paynet',
    introParagraph1:
      'In the Server-Server model your backend systems communicate directly with Paynet over HTTPS. Requests and responses are exchanged machine-to-machine—without relying on a customer browser for core API flows.',
    introParagraph2:
      'This model fits automated order lifecycle, refunds, payment status checks, statements, and reporting. It gives you full control on the server side, predictable behaviour under load, and straightforward integration with your existing services.',
    characteristicsTitle: 'Integration characteristics',
    characteristicsIntro: 'Typical traits of a server-server integration:',
    aspect1Title: '🔐 HTTPS and transport security',
    aspect1Desc:
      'All calls use TLS. Keep credentials out of logs, rotate keys when needed, and restrict outbound access from your application tier.',
    aspect2Title: '🔑 Token-based authentication',
    aspect2Desc:
      'Protected endpoints use Bearer tokens obtained through the authentication flow. Tokens are sent in headers—never in URLs or client-side storage on a public site.',
    aspect3Title: '📦 JSON payloads',
    aspect3Desc:
      'Requests and responses are JSON unless an endpoint explicitly returns another content type (for example file download).',
    aspect4Title: '⚙️ Automation-friendly',
    aspect4Desc:
      'Designed for retries, batch jobs, reconciliation, and monitoring from your back office or integration layer.',
    aspect5Title: '📊 Operational visibility',
    aspect5Desc:
      'Combine API responses with your own logging and alerting to track payment lifecycle and investigate issues quickly.',
    keyBenefitsTitle: 'Key benefits',
    benefit1: 'Direct server control — no dependency on end-user browsers for API calls',
    benefit2: 'Stable integration surface — suitable for production workloads and automation',
    benefit3: 'Clear security model — headers, TLS, and token usage aligned with API best practices',
    benefit4: 'Covers full lifecycle — create orders, query status, refunds, and reporting where applicable',
    benefit5: 'Same documentation as endpoints — use the methods listed under this section in the sidebar'
  },
  clientServer: {
    pageTitle: 'Client-Server model',
    mainTitle: 'Client-to-server integration with Paynet',
    introParagraph1:
      'In the Client-Server model, payment data is prepared on your side and sent to Paynet through the client flow. The customer is redirected to Paynet payment pages to complete authentication and payment.',
    introParagraph2:
      'This model is useful when checkout starts in the browser or mobile app. To protect request integrity, payment payloads are signed before redirect and validated by both systems.',
    characteristicsTitle: 'Integration characteristics',
    characteristicsIntro: 'Typical traits of a client-server integration:',
    aspect1Title: '🔐 Signed payload instead of token auth',
    aspect1Desc:
      'Core protection is based on request signing using a shared secret key. Keep the key private and generate signatures on trusted backend only.',
    aspect2Title: '🧾 Structured payment payload',
    aspect2Desc:
      'You send order, customer, services, products, currency, expiry date, and merchant metadata in a strictly defined structure.',
    aspect3Title: '↪️ Redirect-based customer journey',
    aspect3Desc:
      'After payload submission, the customer is redirected to Paynet pages to select method, confirm, and complete payment.',
    aspect4Title: '🔁 Return URLs and status tracking',
    aspect4Desc:
      'Integration includes success/cancel URLs and follow-up status checks so your system can finalize order state reliably.',
    aspect5Title: '📣 Notification verification',
    aspect5Desc:
      'Payment notifications are also signed. Your backend should verify signatures and handle duplicate callbacks idempotently.',
    keyBenefitsTitle: 'Key benefits',
    benefit1: 'Fast checkout adoption — works naturally with web and mobile payment journeys',
    benefit2: 'Strong integrity controls — signatures protect sensitive payment fields',
    benefit3: 'Flexible customer experience — keep your storefront flow and redirect only for payment step',
    benefit4: 'Clear settlement flow — combine redirect result with API status and notifications',
    benefit5: 'Operational safety — deterministic signing rules and callback validation'
  }
};