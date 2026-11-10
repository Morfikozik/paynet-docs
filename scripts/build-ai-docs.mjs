#!/usr/bin/env node
// Builds the machine-readable documentation from the single source of truth:
//   content/en/*.md            → guides
//   src/openapi/openapi.json   → API reference
//   src/data/api_paths.json    → endpoint names, descriptions and response examples
//
// Output (copied by Vite into the site root):
//   public/llms.txt            short index for AI assistants (llmstxt.org format)
//   public/llms-full.txt       the whole documentation in one Markdown file
//   public/docs/<slug>.md      every guide + api-reference.md as separate files
//   public/openapi.json        the OpenAPI specification
//
// Usage: node scripts/build-ai-docs.mjs   (SITE_URL=https://… for absolute links)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content', 'en');
const publicDir = path.join(root, 'public');
const docsOut = path.join(publicDir, 'docs');
const siteUrl = (process.env.SITE_URL || '').replace(/\/?$/, process.env.SITE_URL ? '/' : '');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'src/openapi/openapi.json'), 'utf8'));
const apiPaths = JSON.parse(fs.readFileSync(path.join(root, 'src/data/api_paths.json'), 'utf8'));

// ---------- guides ----------
// Sections in display order. A new product = a new folder in content/<lang>/ and an entry here.
const SECTIONS = [
  { id: 'common', title: 'General (all products)' },
  { id: 'ecom', title: 'E-commerce' },
];
// One-line descriptions for llms.txt (fallback: first paragraph of the guide).
const SUMMARIES = {
  notifications: 'webhook sent when a payment is paid: request format, fields, Hash verification, retries, Amount vs PaidAmount',
  signatures: 'how to compute and verify signatures (MD5 + Base64, UTF-8) with worked test vectors',
  'errors-and-statuses': 'HTTP codes, error body, repeated Order rules, payment status values (1/3/4/5/6), failed payment and retry, date/time formats, refund rules',
  'ai-assistants': 'files and prompt template for integrating with an AI assistant',
  'integration-options': 'what e-commerce offers and how to choose: server-to-server API, hosted checkout form or CMS plugins',
  'getting-started': 'environments, test credentials and a first test payment step by step',
  'server-to-server': 'create an order via API, redirect the customer, handle the notification, check status; fields and code samples',
  'hosted-checkout': 'signed HTML form posted from the browser to Paynet; fields, signature and code samples',
  'saved-cards': 'saving a card (CardLinkHash) on the first payment and paying with it next time; server-to-server only',
  faq: 'frequent integration questions: keys, missing or repeated notifications, declined payments, refunds, signatures',
  'example-shop': 'complete minimal Node.js shop (create order, return pages, notification handler, refund) checked by the end-to-end test',
  changelog: 'what changed in each documentation version',
  testing: 'test environment, test card, rules and test scenarios with expected results',
  'go-live': 'checklist before switching to production',
  sdk: 'official SDKs for PHP and Node.js: install, create order, check status, notifications, refunds, checkout form, errors',
  'mobile-apps': 'how a mobile app takes payments: through your server and the Paynet payment page (iOS/Android), no keys in the app',
};

const guides = SECTIONS.flatMap((section) =>
  fs
    .readdirSync(path.join(contentDir, section.id))
    .filter((file) => /^\d+-.+\.md$/.test(file))
    .sort()
    .map((file) => {
      const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
      const source = fs.readFileSync(path.join(contentDir, section.id, file), 'utf8');
      const title = (source.match(/^#\s+(.+)$/m) || [null, slug])[1].trim();
      const summary = (source.split('\n').find((line) => line.trim() && !line.startsWith('#') && !line.startsWith('|')) || '').trim();
      return { slug, section: section.id, title, summary: SUMMARIES[slug] || summary, source };
    })
);

/** Portal-internal links (#/guides/x) become links to the Markdown files. */
const rewriteLinks = (markdown, mode) =>
  markdown
    .replace(/\]\(#\/guides\/([a-z0-9-]+)\)/g, (_, slug) =>
      mode === 'full' ? `](#${slug})` : `](${siteUrl}docs/${slug}.md)`
    )
    .replace(/\]\(mocks\//g, `](${siteUrl}mocks/`).replace(/\]\(postman\//g, `](${siteUrl}postman/`).replace(/\]\(#\/page\//g, `](${siteUrl}#/page/`).replace(/\]\(sdk\//g, `](${siteUrl}sdk/`);

// ---------- API reference from OpenAPI ----------
const resolveRef = (ref) => ref.replace('#/', '').split('/').reduce((node, key) => node?.[key], spec);

const englishInfo = (apiPath, method) => {
  for (const group of apiPaths.paths) {
    const methods = group[apiPath];
    if (!methods) continue;
    const entry = methods.find((m) => m.method.toLowerCase() === method);
    if (!entry) continue;
    const en = entry.info.find((info) => info.language === 'en');
    return { name: en?.name, description: en?.description, responses: entry.responses || {} };
  }
  return { responses: {} };
};

const schemaTable = (schema, prefix = '') => {
  if (!schema) return [];
  if (schema.$ref) return schemaTable(resolveRef(schema.$ref), prefix);
  const rows = [];
  const required = new Set(schema.required || []);
  for (const [name, prop] of Object.entries(schema.properties || {})) {
    const resolved = prop.$ref ? resolveRef(prop.$ref) : prop;
    const type = resolved.type === 'array' ? 'array' : resolved.type || 'object';
    const enumText = resolved.enum ? ` Values: ${resolved.enum.map((v) => `\`${v}\``).join(', ')}.` : '';
    rows.push(`| \`${prefix}${name}\` | ${type}${resolved.format ? ` (${resolved.format})` : ''} | ${required.has(name) ? 'yes' : 'no'} | ${(resolved.description || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|')}${enumText} |`);
    if (resolved.type === 'object' || resolved.properties) rows.push(...schemaTable(resolved, `${prefix}${name}.`));
    if (resolved.type === 'array' && resolved.items) rows.push(...schemaTable(resolved.items, `${prefix}${name}[].`));
  }
  return rows;
};

const findBodySchema = (example) => {
  // The spec has examples without direct schema refs; match by property names.
  const keys = Object.keys(example || {}).map((k) => k.toLowerCase());
  let best = null;
  let bestScore = 0;
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    const props = Object.keys(schema.properties || {}).map((k) => k.toLowerCase());
    const score = keys.filter((k) => props.includes(k)).length / Math.max(keys.length, 1);
    if (score > bestScore) {
      best = { name, schema };
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
};

const json = (value) => '```json\n' + JSON.stringify(value, null, 2) + '\n```';

/** Per-method Markdown files (docs/api/<id>.md), ids as in the portal router. */
const methodFiles = [];
const methodId = (method, apiPath) =>
  `${method}-${apiPath}`.replace(/[{}\/]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

const apiReference = () => {
  const base = spec.servers?.[0]?.url || '';
  const out = [
    '# API reference (server-to-server)',
    '',
    `Base URL (test): \`${base}\`. All endpoints except \`/auth\` require \`Authorization: Bearer <access_token>\`.`,
    '',
  ];
  for (const [apiPath, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const info = englishInfo(apiPath, method);
      const sectionStart = out.length;
      out.push(`## ${method.toUpperCase()} ${apiPath} — ${(info.name || op.summary || '').replace(/\.$/, '')}`, '');
      if (info.description || op.description) out.push(info.description || op.description, '');
      if (op.parameters?.length) {
        out.push('| Parameter | In | Type | Required | Description |', '|---|---|---|---|---|');
        for (const p of op.parameters) {
          out.push(`| \`${p.name}\` | ${p.in} | ${p.schema?.type || ''}${p.schema?.format ? ` (${p.schema.format})` : ''} | ${p.required ? 'yes' : 'no'} | ${(p.description || '').replace(/\|/g, '\\|')} |`);
        }
        out.push('');
      }
      const body = op.requestBody?.content?.['application/json'];
      if (body?.example) {
        const match = findBodySchema(body.example);
        if (match) {
          out.push(`Request body (\`${match.name}\`):`, '', '| Field | Type | Required | Description |', '|---|---|---|---|', ...schemaTable(match.schema), '');
        }
        out.push('Request example:', '', json(body.example), '');
      }
      for (const [code, response] of Object.entries(info.responses)) {
        const example = response.content?.object;
        out.push(`Response \`${code}\`${response.description ? ` — ${response.description}` : ''}:`, '');
        if (example && !(typeof example === 'object' && Object.keys(example).length === 0)) out.push(json(example), '');
      }
      const section = out.slice(sectionStart).join('\n').replace(/^## /, '# ');
      methodFiles.push({
        id: methodId(method, apiPath),
        markdown: [
          section,
          '',
          '---',
          '',
          `Base URL: test \`${base}\`, production \`https://ecom-api.paynet.md\` (same paths). All endpoints except \`/auth\` require \`Authorization: Bearer <access_token>\`.`,
          '',
          `Full API reference with all schemas: ${siteUrl}docs/api-reference.md. Complete documentation: ${siteUrl}llms-full.txt.`,
          '',
        ].join('\n'),
      });
    }
  }
  out.push('## Schemas', '');
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    out.push(`### ${name}`, '');
    if (schema.description) out.push(schema.description, '');
    out.push('| Field | Type | Required | Description |', '|---|---|---|---|', ...schemaTable(schema), '');
  }
  return out.join('\n');
};

// ---------- outputs ----------
const rules = `## Rules for AI assistants

- Use only this document as the source of truth. Do not invent endpoints, fields or status values; list missing information as open questions.
- E-commerce API base URL: test \`https://ecom-api-test.paynet.md\`, production \`https://ecom-api.paynet.md\` (same paths). Hosted checkout form: test \`https://test.paynet.md/ecom/checkout\`, production \`https://paynet.md/ecom/checkout\`.
- Authenticate with \`POST /auth\` (JSON \`grantType\`, \`username\`, \`password\`), then send \`Authorization: Bearer <access_token>\`.
- One shop order = one \`Order\`. Repeating an \`Order\` with the same data returns the same payment; with different data or after payment it fails with \`500 TECHNICAL_ERROR\`.
- \`ExpiryDate\` must be in the future, format \`YYYY-MM-DDTHH:mm:ss\`, Chișinău local time (\`Europe/Chisinau\`).
- Amounts are integers in minor units (100 = 1.00 MDL). \`Currency\` is ISO 4217 numeric (\`498\` = MDL).
- Signatures: \`Base64(MD5(UTF8(stringToSign + secretKey)))\`; Base64 of the raw 16-byte digest. Reproduce the test vectors in "Signatures" in unit tests.
- The hosted checkout secret key and the notification secret key are different. Secrets never go to browser code.
- Notifications are sent only for paid payments (\`EventType\` = \`PAID\`); a failed payment only redirects the customer to \`LinkUrlCancel\`. Notification keys are \`Payment.Id\` and \`Payment.ExternalId\` (case-sensitive).
- \`PaidAmount\` must equal \`Amount\` unless the merchant has an agreed promotion with Paynet; otherwise do not fulfil the order automatically.
- Errors come in two formats: usually \`status\` / \`message\` / \`code\` / \`traceId\` / \`details\` (capitalised keys on a token \`401\`; \`/auth\` with a wrong password returns \`401 AUTHENTICATION_FAILED\` with the usual keys), but invalid JSON or missing required fields return \`400\` with an \`errorInfo\` object. Handle both.
- Never treat the redirect to \`LinkUrlSuccess\` as proof of payment. Use a verified notification or the status API.
- Payment \`status\`: \`1\` registered (not paid), \`3\` pending (bank processing), \`4\` paid, \`5\` cancelled (declined, antifraud or full refund), \`6\` partially refunded. \`5\` and \`6\` are final; \`2\` is not used; there is no expired status (an expired unpaid order stays \`1\`). Paid = verified \`PAID\` notification or \`status\` \`4\`.
- After a declined payment (\`status\` \`5\`) create a new order with a new \`Order\`. If the order is still \`1\`, the customer can reuse the same \`paymentLink\` — the full link from the \`POST /api/order\` response (store it with the order; \`GET /api/order/…\` responses return a shortened link without the payment number). While it is \`3\`, do not create a new order.
- Paynet retries a notification while your server does not answer \`200\` (only \`200\` counts; \`204\` and other \`2xx\` cause retries; the response body does not matter): 9 attempts within about 25 minutes, then it stops. Answer \`200\` fast (Paynet waits about 30 seconds), process each \`Payment.Id\` once, and poll the status API as a fallback. Notifications come from \`93.113.159.22\` (production) and \`93.113.159.23\` (test).
- Refunds: one refund per payment (full or partial), within 180 days, not for \`CASH_INVOICE\`, at most \`PaidAmount\`; full refund = \`RefundType\` \`full\` with \`Amount\` = \`PaidAmount\`; \`200\` in the refund response = done (no callback); never repeat a refund blindly — after a timeout check the status (\`5\`/\`6\` = refunded); it fails if the merchant's Paynet balance is empty.
- Saved cards (server-to-server only): send \`Customer\` to get \`Payment.CardLinkHash\` in the \`PAID\` notification (it may be \`null\`); next time send \`CardLinkHash\` with the same \`Customer\`. The customer still confirms on the Paynet page; it is not a silent charge.
- Notification signature order is fixed (EventDate, Eventid, EventType, Payment.Amount, Payment.Customer, Payment.ExternalId, Payment.Id, Payment.Merchant, Payment.StatusDate); never sort the names in code.
- \`PaidAmount\`, \`MoneyType\` and \`CardLinkHash\` are not covered by the notification Hash. Before acting on them, compare with \`GET /api/order/merchant/{Order}\` (\`amount.paidAmount\`, \`cardLinkHash\`, \`customer.code\`, \`status\`); on any mismatch send the order to manual review. For a valid but unfulfillable notification still answer \`200\`.
- To retry \`POST /api/order\` safely, resend the stored request body unchanged (a recomputed \`ExpiryDate\` is different data).
- Refund errors: unpaid payment → \`404 NOT_FOUND_RECORD\`; amount above \`PaidAmount\` → \`400 INVALID_PARAMETER\` (details name \`RefundType\`). Refund response \`eventDate\` uses \`DD.MM.YYYY HH:mm:ss\`.
- If the developer's stack is PHP (7.4+) or Node.js (18+), recommend the official Paynet SDK (section "SDK for PHP and Node.js", archives \`sdk/paynet-ecom-sdk-php-1.0.0.zip\` and \`sdk/paynet-ecom-sdk-node-1.0.0.zip\`) instead of writing a new HTTP client; use only the SDK methods listed in that section.
- Mobile apps: never put the API username, password, secret keys or token in the app. The app asks the merchant's server, the server creates the order and returns \`paymentLink\`, the app opens it in \`SFSafariViewController\` / Chrome Custom Tabs (not a WebView) and asks the server for the status.
- \`GET /api/order/search\`: \`from\` / \`to\` are read as Chișinău local time (\`YYYY-MM-DDTHH:mm:ss\`; a trailing \`Z\` is ignored). No payments in the period → \`404 NOT_FOUND_RECORD\`, which means an empty result.
- \`Services[].Products[]\` is optional; if sent, \`LineNo\`, \`Name\`, \`UnitPrice\`, \`Quantity\`, \`Amount\`, \`TotalAmount\` are required (\`400\` otherwise), \`Code\` and \`Description\` are optional. \`Quantity\` is in hundredths: \`100\` = 1 pc.
- \`Customer.PhoneNumber\` is optional, but if it is not sent the customer has to type the phone on the payment page (block "Billing information"); send the customer's name, email and phone when you have them.
- \`Merchant\` (merchant code) is not sent in \`POST /api/order\`; it is used in the hosted checkout form and appears in notifications.
- Status \`3\` can last up to about a day. A failed 3-D Secure gives status \`5\` and returns the customer to \`LinkUrlCancel\`; the decline reason is not available through the API.
- \`CardLinkHash\` is Paynet's internal saved-card token, bound to the \`SaleAreaCode\` and the \`Customer.Code\`. \`POST /api/order\` accepts any token (200); with another \`Customer.Code\` or an unknown token the payment page simply does not show the saved card.`;

const reference = apiReference();

/** One Markdown file with the given guides (+ optional API reference). */
const bundle = (title, intro, list, withReference) =>
  [
    `# ${title}`,
    '',
    `> ${intro}`,
    '',
    rules,
    '',
    '## Contents',
    '',
    ...list.map((g) => `- [${g.title}](#${g.slug})`),
    ...(withReference ? ['- [API reference](#api-reference)'] : []),
    '',
    ...list.flatMap((g) => [
      '---',
      '',
      `<a id="${g.slug}"></a>`,
      '',
      // demote headings by one level so the file has a single H1
      rewriteLinks(g.source, 'full').replace(/^(#{1,5}) /gm, '#$1 '),
      '',
    ]),
    ...(withReference ? ['---', '', '<a id="api-reference"></a>', '', reference.replace(/^(#{1,5}) /gm, '#$1 '), ''] : []),
  ].join('\n');

const full = bundle(
  'Paynet for developers — complete documentation',
  'Single-file documentation of all Paynet developer products for developers and AI assistants. Generated from the same sources as the documentation portal.',
  guides,
  true
);
const ecom = bundle(
  'Paynet E-commerce — documentation',
  'Everything needed to integrate Paynet e-commerce payments: general topics (notifications, signatures, errors) and the e-commerce guides and API reference.',
  guides.filter((g) => g.section === 'common' || g.section === 'ecom'),
  true
);

const index = [
  '# Paynet for developers',
  '',
  '> Paynet (Moldova) developer documentation. Products: E-commerce — accept card, Apple Pay, Google Pay, Paynet wallet, MIA and cash invoice payments on a Paynet-hosted payment page (server-to-server REST API with Bearer tokens, signed hosted checkout form, signed webhook notifications).',
  '',
  `Start with ${siteUrl}llms-full.txt (everything) or ${siteUrl}llms-ecom.txt (e-commerce only).`,
  '',
  rules,
  '',
  ...SECTIONS.flatMap((section) => [
    `## ${section.title}`,
    '',
    ...guides
      .filter((g) => g.section === section.id)
      .map((g) => `- [${g.title}](${siteUrl}docs/${g.slug}.md): ${g.summary.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '')}`),
    '',
  ]),
  '## API',
  '',
  `- [E-commerce API reference](${siteUrl}docs/api-reference.md): every server-to-server endpoint with fields and examples`,
  `- [OpenAPI specification](${siteUrl}openapi.json): machine-readable OpenAPI 3 file`,
  '',
  '## Optional',
  '',
  `- [Complete documentation](${siteUrl}llms-full.txt): all guides and the API reference in one file`,
  `- [E-commerce documentation](${siteUrl}llms-ecom.txt): e-commerce and the general topics it needs, in one file`,
  '',
].join('\n');

fs.mkdirSync(docsOut, { recursive: true });
for (const g of guides) fs.writeFileSync(path.join(docsOut, `${g.slug}.md`), rewriteLinks(g.source, 'file'));
fs.writeFileSync(path.join(docsOut, 'api-reference.md'), reference);
fs.mkdirSync(path.join(docsOut, 'api'), { recursive: true });
for (const m of methodFiles) fs.writeFileSync(path.join(docsOut, 'api', `${m.id}.md`), m.markdown);

// Guides in Russian and Romanian for the "View as Markdown" menu (links stay within the language).
for (const lang of ['ru', 'ro']) {
  const langDir = path.join(root, 'content', lang);
  fs.mkdirSync(path.join(docsOut, lang), { recursive: true });
  for (const section of SECTIONS) {
    const dir = path.join(langDir, section.id);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => /^\d+-.+\.md$/.test(f))) {
      const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
      const source = fs.readFileSync(path.join(dir, file), 'utf8')
        .replace(/\]\(#\/guides\/([a-z0-9-]+)\)/g, (_, target) => `](${siteUrl}docs/${lang}/${target}.md)`)
        .replace(/\]\(mocks\//g, `](${siteUrl}mocks/`).replace(/\]\(postman\//g, `](${siteUrl}postman/`).replace(/\]\(#\/page\//g, `](${siteUrl}#/page/`).replace(/\]\(sdk\//g, `](${siteUrl}sdk/`);
      fs.writeFileSync(path.join(docsOut, lang, `${slug}.md`), source);
    }
  }
}
fs.writeFileSync(path.join(publicDir, 'llms.txt'), index);
fs.writeFileSync(path.join(publicDir, 'llms-full.txt'), full);
fs.writeFileSync(path.join(publicDir, 'llms-ecom.txt'), ecom);
fs.copyFileSync(path.join(root, 'src/openapi/openapi.json'), path.join(publicDir, 'openapi.json'));

console.log(`✓ AI docs: ${guides.length} guides (+ ru/ro), ${methodFiles.length} API method files, llms.txt (${index.length} B), llms-full.txt (${full.length} B), llms-ecom.txt (${ecom.length} B)`);

// ---------- Mock responses for testing failure paths (public/mocks) ----------
// Bodies are copied from real test-environment responses (09.11.2026); only the status-specific
// fields differ between the payment variants. Notifications are signed with the TEST key.
{
  const { notificationHash } = await import('./lib/signatures.mjs');
  const TEST_NOTIFICATION_KEY = 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
  const mocksDir = path.join(publicDir, 'mocks');
  fs.mkdirSync(mocksDir, { recursive: true });
  const ORDER = 1762444800000;
  const basePayment = {
    paymentId: 328731,
    paymentLink: 'https://test.paynet.md/ecom/getecom',
    cardLinkHash: null,
    status: 1,
    message: null,
    order: ORDER,
    merchantCode: '265505',
    saleAreaCode: 'onlidocumentation_md',
    linkUrlSuccess: 'https://shop.example/payment/success',
    linkUrlCancel: 'https://shop.example/payment/cancel',
    signature: null,
    amount: { requestAmount: 300, requestCurrency: 498, amount: 300, paidAmount: null },
    customer: { code: '464566161', nameFirst: 'First Name', nameLast: 'Last Name', email: 'customer@example.com', country: null, city: null, address: null, phoneNumber: '37360000000', cardLinkHash: null },
    payer: null,
    expiryDate: '2026-12-31 23:59:59',
    registered: '2026-11-09 18:16:41',
    paidDate: null,
    services: [{ name: 'Demo eShop', description: `Order #${ORDER}`, amount: 300, products: [{ lineNo: 1, name: 'Demo eShop', description: `Order #${ORDER}`, unitPrice: 300, unitProduct: null, quantity: 100, amount: 300, totalAmount: 300 }] }],
    moneyType: 'All',
  };
  const paid = { paidDate: '2026-11-09 18:17:10', amount: { ...basePayment.amount, paidAmount: 300 } };
  const notificationBody = (payment) => ({
    Eventid: 8482869, EventType: 'PAID', Message: 'Request processed successfully', EventDate: '2026-11-09T18:17:10',
    Payment: {
      Id: 328731, ExternalId: ORDER, SaleAreaCode: 'onlidocumentation_md', Customer: '4645XXX61', StatusDate: '2026-11-09T18:17:10',
      Amount: 300, PaidAmount: 300, Merchant: '265505', CardMask: '411111******1111', CardExpireMonth: '12', CardExpireYear: '27',
      CardIssuer: 'TEST BANK', CardLinkHash: null, MoneyType: 'CARD', PayerName: 'Docs', PayerSurname: 'Check', PayerIDNP: null, RRN: '000559440827',
      ...payment,
    },
  });
  const signed = (body, hash) => ({ request: { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Hash: hash ?? notificationHash(body, TEST_NOTIFICATION_KEY) }, body } });
  const goodNotification = notificationBody({});
  const tampered = notificationBody({ PaidAmount: 1 }); // unsigned field changed after signing
  const mocks = {
    'payment-status-1.json': ['GET /api/order/merchant/{Order}', 200, 'Registered, not paid', basePayment],
    'payment-status-3.json': ['GET /api/order/merchant/{Order}', 200, 'Pending: the bank has not answered yet', { ...basePayment, status: 3 }],
    'payment-status-4.json': ['GET /api/order/merchant/{Order}', 200, 'Paid', { ...basePayment, status: 4, ...paid }],
    'payment-status-5-declined.json': ['GET /api/order/merchant/{Order}', 200, 'Declined by the bank (constructed: real status value, other fields as an unpaid payment)', { ...basePayment, status: 5 }],
    'payment-status-5-refunded.json': ['GET /api/order/merchant/{Order}', 200, 'Fully refunded (paidDate stays filled)', { ...basePayment, status: 5, ...paid }],
    'payment-status-6.json': ['GET /api/order/merchant/{Order}', 200, 'Partially refunded', { ...basePayment, status: 6, ...paid }],
    'refund-200.json': ['POST /api/order/refund', 200, 'Refund done', { paymentId: 328731, saleAreaCode: 'onlidocumentation_md', customer: '464566161', eventDate: '09.11.2026 18:17:54', refundType: 'full', currency: 498, amount: 300, merchant: '265505', cardMask: '411111******1111', cardLinkHash: null, moneyType: 'CYBER_SOURCE' }],
    'refund-400-amount-or-second.json': ['POST /api/order/refund', 400, 'Amount above PaidAmount, or another refund of the same payment', { status: 400, message: 'One or more entered parameters are incorrect.', code: 'INVALID_PARAMETER', traceId: 'e353a049-9eca-44e9-bc17-e5c4816320da', details: 'The invalid parameter is: RefundType' }],
    'refund-404-unpaid.json': ['POST /api/order/refund', 404, 'Payment not paid or not found', { status: 404, message: 'Record not found', code: 'NOT_FOUND_RECORD', traceId: '72f97a7d-3a42-4c5f-9d8e-e98ee2aaa9ac', details: 'No records were found for the provided data' }],
    'order-500-repeated-order.json': ['POST /api/order', 500, 'Same Order with different data, or already paid / processing / closed', { status: 500, message: 'One or more errors occurred.', code: 'TECHNICAL_ERROR', traceId: '665d3c07-2a73-45e0-b284-9e3c9d53fa73', details: 'Please verify the transmitted data and try again, or contact support.' }],
    'order-400-errorinfo.json': ['POST /api/order', 400, 'Body cannot be read (missing required field)', { errorInfo: { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', status: 400, detail: null, instance: null, ppResponseCodeEnum: 'TECHNICAL_ERROR', ppResponseCode: 1, ppResponseCodeText: 'TECHNICAL_ERROR', ppResponseCodeDescription: null, errors: { $: ["JSON deserialization for type 'PaymentRequest' was missing required properties including: 'services'."] }, traceId: '00-7c209d88f31e3e5cd2f7bd88ae2f23c2-ad167338e418068c-00' } }],
    'error-401-token.json': ['any method with a token', 401, 'Token missing, invalid or expired (capitalised keys)', { Status: 401, Message: 'Access denied. The Bearer token is missing, invalid, or has expired.', Code: 'UNAUTHORIZED', TraceId: 'b4480a88-5942-455c-99ac-68d3547aaccb' }],
    'error-401-auth.json': ['POST /auth', 401, 'Wrong username or password', { status: 401, message: 'Wrong credentials', code: 'AUTHENTICATION_FAILED', traceId: '8d489156-7b1c-4bfb-b88b-7a946c1b862e', details: null }],
    'error-404-not-found.json': ['GET /api/order/{id}', 404, 'Payment not found', { status: 404, message: 'Record not found', code: 'NOT_FOUND_RECORD', traceId: '72f97a7d-3a42-4c5f-9d8e-e98ee2aaa9ac', details: 'No records were found for the provided data' }],
  };
  const index = [];
  for (const [file, [endpoint, httpStatus, description, body]] of Object.entries(mocks)) {
    fs.writeFileSync(path.join(mocksDir, file), JSON.stringify({ endpoint, httpStatus, description, body }, null, 2));
    index.push({ file, endpoint, httpStatus, description });
  }
  const notifications = {
    'notification-paid.json': ['Valid PAID notification: answer 200, fulfil once', signed(goodNotification)],
    'notification-paid-wrong-hash.json': ['Wrong Hash: answer 400, change nothing', signed(goodNotification, 'AAAAAAAAAAAAAAAAAAAAAA==')],
    'notification-paid-tampered-paidamount.json': ['Valid Hash but PaidAmount changed (unsigned field): the API check must catch it', signed(tampered, notificationHash(goodNotification, TEST_NOTIFICATION_KEY))],
  };
  for (const [file, [description, content]] of Object.entries(notifications)) {
    fs.writeFileSync(path.join(mocksDir, file), JSON.stringify({ description, signedWith: 'test notification key', ...content }, null, 2));
    index.push({ file, endpoint: 'POST <your notification URL>', httpStatus: null, description });
  }
  fs.writeFileSync(path.join(mocksDir, 'index.json'), JSON.stringify({ generated: 'from real test-environment responses', files: index }, null, 2));
  console.log(`✓ Mocks: ${index.length} files in public/mocks`);
}
