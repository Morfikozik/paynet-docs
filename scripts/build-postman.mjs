// Builds a ready-to-use Postman collection and two environments (test, production)
// from src/openapi/openapi.json. Output: public/postman/*.json (published with the site).
//
// What makes it usable without edits:
// - the token is fetched automatically before any request (collection pre-request script);
// - every "Create order" run gets a new Order and a fresh ExpiryDate (Chisinau time, +1 day);
// - paymentId / paymentLink / Order from the last created order are saved and reused by the next requests;
// - search and statement periods are calculated automatically.
import fs from 'node:fs';
import path from 'node:path';

const spec = JSON.parse(fs.readFileSync('src/openapi/openapi.json', 'utf8'));
const outDir = 'public/postman';
fs.mkdirSync(outDir, { recursive: true });

const SITE = 'https://morfikozik.github.io/paynet-docs/';
const op = (p, m) => spec.paths[p][m];
const describe = (p, m, extra = '') => {
  const o = op(p, m);
  return [extra, o.description || o.summary, `\n**Docs:** ${SITE}#/api/${m}-${p.replace(/^\//, '').replace(/[/{}]+/g, '-').replace(/-+$/, '')}`]
    .filter(Boolean)
    .join('\n\n');
};
const lines = (s) => s.trim().split('\n');
// Numeric placeholders must not be quoted in the JSON body: "{{amount}}" -> {{amount}}.
const NUMERIC = ['orderNumber', 'amount', 'paymentId'];
const json = (value) => {
  let raw = JSON.stringify(value, null, 2);
  NUMERIC.forEach((name) => { raw = raw.split(`"{{${name}}}"`).join(`{{${name}}}`); });
  return { mode: 'raw', raw, options: { raw: { language: 'json' } } };
};
const url = (pathTemplate, query = []) => ({
  raw: `{{baseUrl}}${pathTemplate}${query.length ? '?' + query.map((q) => `${q.key}=${q.value}`).join('&') : ''}`,
  host: ['{{baseUrl}}'],
  path: pathTemplate.replace(/^\//, '').split('/'),
  ...(query.length ? { query } : {}),
});
const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];
const request = (name, method, pathTemplate, { body, query, description, prerequest, test, auth } = {}) => ({
  name,
  event: [
    ...(prerequest ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: lines(prerequest) } }] : []),
    ...(test ? [{ listen: 'test', script: { type: 'text/javascript', exec: lines(test) } }] : []),
  ],
  request: {
    method,
    header: body ? jsonHeader : [],
    ...(body ? { body: json(body) } : {}),
    url: url(pathTemplate, query),
    description,
    ...(auth ? { auth } : {}),
  },
});

// ---------- collection-level scripts ----------
const collectionPrerequest = `
// Gets a token automatically (POST /auth) when there is none or it is about to expire.
// Credentials come from the environment / collection variables: username, password.
const isAuthRequest = pm.request.url.getPath().endsWith('/auth');
const token = pm.collectionVariables.get('accessToken');
const expiresAt = Number(pm.collectionVariables.get('accessTokenExpiresAt') || 0);
if (!isAuthRequest && (!token || Date.now() > expiresAt - 60000)) {
  pm.sendRequest({
    url: pm.variables.replaceIn('{{baseUrl}}/auth'),
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    body: { mode: 'raw', raw: JSON.stringify({
      grantType: 'password',
      username: pm.variables.get('username'),
      password: pm.variables.get('password'),
    }) },
  }, (error, response) => {
    if (error || response.code !== 200) {
      console.error('Paynet: could not get a token. Check username / password / baseUrl.', error || response.text());
      return;
    }
    const data = response.json();
    pm.collectionVariables.set('accessToken', data.access_token);
    pm.collectionVariables.set('accessTokenExpiresAt', String(Date.now() + data.expires_in * 1000));
  });
}
`;

const collectionTest = `
// Paynet returns errors in two formats: { status, code, message, traceId, details } or { errorInfo: {...} }.
// Key case differs (401 by token uses Status/Code/TraceId). Show the error in a readable way.
if (pm.response.code >= 400) {
  let body = {};
  try { body = pm.response.json(); } catch (e) {}
  const e = body.errorInfo || body;
  const pick = (k) => e[k] ?? e[k.charAt(0).toUpperCase() + k.slice(1)];
  console.warn('Paynet error', pm.response.code, pick('code') || pick('ppResponseCodeText') || '', pick('message') || pick('title') || '', 'details:', pick('details') || JSON.stringify(e.errors || ''), 'traceId:', pick('traceId'));
  if (pm.response.code === 401 && !pm.request.url.getPath().endsWith('/auth')) {
    pm.collectionVariables.unset('accessToken'); // the next request gets a new token
  }
}
`;

const chisinauDate = `
// Chisinau local time without Intl (not reliable in the Postman sandbox):
// UTC+3 from the last Sunday of March 01:00 UTC to the last Sunday of October 01:00 UTC, otherwise UTC+2.
const lastSundayUtc = (year, month) => {
  const d = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
};
const chisinau = (date, withTime = true) => {
  const y = date.getUTCFullYear();
  const summer = date.getTime() >= lastSundayUtc(y, 2) && date.getTime() < lastSundayUtc(y, 9);
  const local = new Date(date.getTime() + (summer ? 3 : 2) * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const day = local.getUTCFullYear() + '-' + pad(local.getUTCMonth() + 1) + '-' + pad(local.getUTCDate());
  return withTime ? day + 'T' + pad(local.getUTCHours()) + ':' + pad(local.getUTCMinutes()) + ':' + pad(local.getUTCSeconds()) : day;
};
`;

// ---------- requests ----------
const authExample = op('/auth', 'post').requestBody.content['application/json'].example;
const orderExample = op('/api/order', 'post').requestBody.content['application/json'].example;

const auth = request('Authorization (optional — runs automatically)', 'POST', '/auth', {
  body: { grantType: 'password', username: '{{username}}', password: '{{password}}' },
  auth: { type: 'noauth' },
  description: describe('/auth', 'post', 'You do not need to run this request: every other request gets a token automatically. Run it to see the token response.'),
  test: `
pm.test('HTTP 200', () => pm.response.to.have.status(200));
const data = pm.response.json();
if (data.access_token) {
  pm.collectionVariables.set('accessToken', data.access_token);
  pm.collectionVariables.set('accessTokenExpiresAt', String(Date.now() + data.expires_in * 1000));
}
`,
});
void authExample;

const createOrder = request('Create order', 'POST', '/api/order', {
  body: {
    ...orderExample,
    Order: '{{orderNumber}}',
    SaleAreaCode: '{{saleAreaCode}}',
    Customer: { ...orderExample.Customer, Code: '{{customerCode}}' },
    ExpiryDate: '{{expiryDate}}',
    Services: [{ Name: 'Demo eShop', Description: 'Order #{{orderNumber}}', Amount: '{{amount}}' }],
  },
  description: describe('/api/order', 'post', [
    'Every run creates a NEW order: `Order` = current time in ms, `ExpiryDate` = now + 1 day (Chisinau time).',
    '`Amount` is in minor units: 300 = 3.00 MDL (variable `amount`).',
    'After a successful response, `paymentId`, `paymentLink` and `lastOrder` are saved for the next requests. Open `paymentLink` in a browser to pay.',
    'Test card: 4111 1111 1111 1111, 12/27, CVV 777.',
  ].join('\n\n')),
  prerequest: `${chisinauDate}
pm.collectionVariables.set('orderNumber', String(Date.now()));
pm.collectionVariables.set('expiryDate', chisinau(new Date(Date.now() + 24 * 3600 * 1000)));
`,
  test: `
pm.test('HTTP 200', () => pm.response.to.have.status(200));
const data = pm.response.json();
pm.test('paymentId and paymentLink returned', () => { pm.expect(data.paymentId).to.be.a('number'); pm.expect(data.paymentLink).to.be.a('string'); });
pm.collectionVariables.set('paymentId', String(data.paymentId));
pm.collectionVariables.set('paymentLink', data.paymentLink);
pm.collectionVariables.set('lastOrder', pm.collectionVariables.get('orderNumber'));
console.log('Open to pay:', data.paymentLink);
`,
});

const statusCheck = `
pm.test('HTTP 200', () => pm.response.to.have.status(200));
const data = pm.response.json();
const meaning = { 1: 'registered, not paid', 3: 'processing (wait, do not create a new order)', 4: 'PAID', 5: 'cancelled: declined / antifraud / full refund (final)', 6: 'partial refund (final)' };
console.log('status', data.status, '—', meaning[data.status] || 'unknown');
if (data.cardLinkHash) pm.collectionVariables.set('cardLinkHash', data.cardLinkHash);
`;

const getById = request('Get payment by paymentId', 'GET', '/api/order/{{paymentId}}', {
  description: describe('/api/order/{id}', 'get', 'Uses `paymentId` saved by "Create order".'),
  test: statusCheck,
});
const getByOrder = request('Get payment by Order (merchant order number)', 'GET', '/api/order/merchant/{{lastOrder}}', {
  description: describe('/api/order/merchant/{id}', 'get', 'Uses `lastOrder` saved by "Create order". Paid when `status` = 4.'),
  test: statusCheck,
});
const search = request('Search payments (last 24 hours)', 'GET', '/api/order/search', {
  query: [{ key: 'from', value: '{{searchFrom}}' }, { key: 'to', value: '{{searchTo}}' }],
  description: describe('/api/order/search', 'get', '`from` / `to` are set automatically to the last 24 hours (ISO 8601).'),
  prerequest: `
pm.collectionVariables.set('searchTo', new Date().toISOString());
pm.collectionVariables.set('searchFrom', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
`,
  test: `pm.test('HTTP 200', () => pm.response.to.have.status(200));`,
});
const refund = request('Refund (pay the order first)', 'POST', '/api/order/refund', {
  body: { PaymentId: '{{paymentId}}', SaleAreaCode: '{{saleAreaCode}}', RefundType: 'full', Amount: '{{amount}}', Currency: 498, Reason: 'Customer request' },
  description: describe('/api/order/refund', 'post', [
    'Refunds the last created order (`paymentId`). Pay it first via `paymentLink`, otherwise the API answers 404.',
    'Production rule: ONE refund per payment (full or partial), within 180 days, at most PaidAmount, not for CASH_INVOICE.',
    'For a partial refund set `RefundType` = "partial" and a smaller `Amount`.',
  ].join('\n\n')),
  test: `pm.test('HTTP 200', () => pm.response.to.have.status(200));`,
});
const unlink = request('Delete saved card', 'POST', '/api/linked-cards/unlink', {
  body: { CardLinkHash: '{{cardLinkHash}}', SaleAreaCode: '{{saleAreaCode}}', CustomerCode: '{{customerCode}}' },
  description: describe('/api/linked-cards/unlink', 'post', '`cardLinkHash` is saved automatically when a payment response contains it (customer paid with "Save card" checked). The token works only with the same `customerCode`.'),
  test: `pm.test('HTTP 200', () => pm.response.to.have.status(200));`,
});
const statementPrerequest = `${chisinauDate}
pm.collectionVariables.set('dateFinish', chisinau(new Date(), false));
pm.collectionVariables.set('dateStart', chisinau(new Date(Date.now() - 7 * 24 * 3600 * 1000), false));
`;
const statement = request('Statement (last 7 days)', 'GET', '/api/statement', {
  query: [{ key: 'dateStart', value: '{{dateStart}}' }, { key: 'dateFinish', value: '{{dateFinish}}' }],
  description: describe('/api/statement', 'get', 'Period is set automatically to the last 7 days.'),
  prerequest: statementPrerequest,
  test: `pm.test('HTTP 200', () => pm.response.to.have.status(200));`,
});
const statementDownload = request('Download statement (.xlsx, last 7 days)', 'GET', '/api/statement/download', {
  query: [{ key: 'dateStart', value: '{{dateStart}}' }, { key: 'dateFinish', value: '{{dateFinish}}' }],
  description: describe('/api/statement/download', 'get', 'Use "Send and Download" in Postman to save the file.'),
  prerequest: statementPrerequest,
  test: `pm.test('HTTP 200', () => pm.response.to.have.status(200));`,
});

// Error examples: show what errors look like (the requests fail on purpose).
const errNoToken = request('401 — request without token', 'GET', '/api/order/{{paymentId}}', {
  auth: { type: 'noauth' },
  description: 'Fails on purpose: no `Authorization` header → `401 UNAUTHORIZED`. Note the capitalised keys (`Status`, `Code`, `TraceId`).',
  test: `pm.test('HTTP 401', () => pm.response.to.have.status(401));`,
});
const errEmptyBody = request('400 — empty order body', 'POST', '/api/order', {
  body: {},
  description: 'Fails on purpose: required fields missing → `400`, error inside `errorInfo`.',
  test: `pm.test('HTTP 400', () => pm.response.to.have.status(400));`,
});
const errNotFound = request('404 — payment does not exist', 'GET', '/api/order/999999999', {
  description: 'Fails on purpose: unknown `paymentId` → `404 NOT_FOUND_RECORD`.',
  test: `pm.test('HTTP 404', () => pm.response.to.have.status(404));`,
});

// ---------- variables ----------
const testVars = [
  ['baseUrl', 'https://ecom-api-test.paynet.md'],
  ['username', '771064'],
  ['password', 'sLgMnGWJ'],
  ['saleAreaCode', 'onlidocumentation_md'],
  ['customerCode', 'postman-customer-1'],
  ['amount', '300'],
];
const runtimeVars = ['accessToken', 'accessTokenExpiresAt', 'orderNumber', 'expiryDate', 'paymentId', 'paymentLink', 'lastOrder', 'cardLinkHash', 'searchFrom', 'searchTo', 'dateStart', 'dateFinish'];

const collection = {
  info: {
    name: 'Paynet E-commerce API',
    description: [
      'Ready-to-use collection for the Paynet E-commerce API.',
      '',
      '**Start in 3 steps**',
      '1. Import this collection and the "Paynet — TEST" environment, select the environment.',
      '2. Run **Payments → Create order**. The token is obtained automatically.',
      '3. Open `paymentLink` (Postman Console) and pay with the test card 4111 1111 1111 1111, 12/27, CVV 777. Then run **Get payment by Order**: `status` = 4 means paid.',
      '',
      'The test credentials are public. For production, use the "Paynet — PRODUCTION" environment and fill in YOUR credentials (never share them).',
      '',
      'Amounts are integers in minor units (300 = 3.00 MDL). Currency 498 = MDL.',
      '',
      `Documentation: ${SITE}`,
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  event: [
    { listen: 'prerequest', script: { type: 'text/javascript', exec: lines(collectionPrerequest) } },
    { listen: 'test', script: { type: 'text/javascript', exec: lines(collectionTest) } },
  ],
  variable: [
    ...testVars.map(([key, value]) => ({ key, value })),
    ...runtimeVars.map((key) => ({ key, value: '' })),
  ],
  item: [
    { name: '1. Payments', item: [createOrder, getByOrder, getById, search, refund] },
    { name: '2. Saved cards', item: [unlink] },
    { name: '3. Statements', item: [statement, statementDownload] },
    { name: '4. Authorization', item: [auth] },
    { name: '5. Error examples (fail on purpose)', item: [errNoToken, errEmptyBody, errNotFound] },
  ],
};

const environment = (name, values) => ({
  name,
  values: values.map(([key, value, type = 'default']) => ({ key, value, type, enabled: true })),
  _postman_variable_scope: 'environment',
});

fs.writeFileSync(path.join(outDir, 'paynet-ecom.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(outDir, 'paynet-test.postman_environment.json'), JSON.stringify(environment('Paynet — TEST', testVars), null, 2));
fs.writeFileSync(
  path.join(outDir, 'paynet-production.postman_environment.json'),
  JSON.stringify(environment('Paynet — PRODUCTION', [
    ['baseUrl', 'https://ecom-api.paynet.md'],
    ['username', '', 'secret'],
    ['password', '', 'secret'],
    ['saleAreaCode', ''],
    ['customerCode', ''],
    ['amount', '300'],
  ]), null, 2)
);
console.log('Postman collection and environments written to', outDir);
