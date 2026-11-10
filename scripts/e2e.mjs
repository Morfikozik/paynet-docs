// End-to-end check of the documentation against the Paynet TEST environment.
// Usage: node scripts/e2e.mjs <explore|full|shop|contract|cards|portal|probe-errors|postman> <outDir>
// Results (log.json, screenshots, page HTML) go to outDir; CI publishes them to the ci/e2e branch.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [stage = 'explore', outDir = 'e2e-out'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const API = 'https://ecom-api-test.paynet.md';
const SALE_AREA = 'onlidocumentation_md';
const CARD = { number: '4111111111111111', month: '12', year: '27', cvv: '777' };
const log = [];
const note = (step, data) => {
  log.push({ step, time: new Date().toISOString(), ...data });
  fs.writeFileSync(path.join(outDir, 'log.json'), JSON.stringify(log, null, 2));
  console.log(step, JSON.stringify(data).slice(0, 400));
};

const call = async (method, url, body, token) => {
  const response = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, body: json };
};

// ExpiryDate in Chisinau local time, +1 day.
const expiry = () => {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

const customer = { Code: 'e2e-docs-customer-1', NameFirst: 'Docs', NameLast: 'Check', email: 'docs-check@example.com', PhoneNumber: '37360000000' };
const orderBody = (order, amount, extra = {}) => ({
  Order: order,
  SaleAreaCode: SALE_AREA,
  LinkUrlSuccess: 'https://morfikozik.github.io/paynet-docs/#/e2e/success',
  LinkUrlCancel: 'https://morfikozik.github.io/paynet-docs/#/e2e/cancel',
  Customer: customer,
  Currency: 498,
  ExpiryDate: expiry(),
  Services: [{ Name: 'Docs E2E', Description: `Order #${order}`, Amount: amount }],
  MoneyType: 'Card',
  Lang: 'EN',
  ...extra,
});

const snap = async (page, name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  fs.writeFileSync(path.join(outDir, `${name}.html`), await page.content());
  const frames = page.frames().map((f) => f.url());
  const inputs = [];
  for (const frame of page.frames()) {
    for (const el of await frame.$$('input, button, select, label')) {
      inputs.push({
        frame: frame.url().slice(0, 80),
        tag: await el.evaluate((n) => n.tagName),
        attrs: await el.evaluate((n) => Object.fromEntries([...n.attributes].map((a) => [a.name, a.value]))),
        text: (await el.innerText().catch(() => '')).slice(0, 60),
      });
    }
  }
  note(`page:${name}`, { url: page.url(), frames, inputs });
};


// Fill the Paynet test payment page (card fields live in Cybersource iframes) and press Pay.
const fillAndPay = async (p, name) => {
  await p.waitForTimeout(2500);
  const numberFrame = p.frames().find((f) => f.url().includes('microform') && f.url().includes('%22fieldType%22:%22number%22'));
  const cvvFrame = p.frames().find((f) => f.url().includes('microform') && f.url().includes('securityCode'));
  if (numberFrame) await numberFrame.fill('#number', CARD.number);
  if (cvvFrame) await cvvFrame.fill('#securityCode', CARD.cvv);
  await p.click('#CardExp');
  await p.keyboard.type(CARD.month + CARD.year, { delay: 80 });
  await p.waitForTimeout(800);
  await snap(p, `${name}-filled`);
  await p.click('#submit-default');
};

// ---- stage "shop": run examples/node-shop against the test API --------------------------
import { spawn, execFileSync } from 'node:child_process';
const shopStage = async () => {
  const SHOP = 'http://localhost:3000';
  const store = path.join(outDir, 'shop-data.json');
  const shop = spawn(process.execPath, ['server.mjs'], {
    cwd: path.join('examples', 'node-shop'),
    env: { ...process.env, PORT: '3000', PUBLIC_URL: SHOP, STORE_FILE: path.resolve(store) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let shopLog = '';
  shop.stdout.on('data', (d) => { shopLog += d; });
  shop.stderr.on('data', (d) => { shopLog += d; });
  await new Promise((r) => setTimeout(r, 1500));
  const orders = async () => (await (await fetch(`${SHOP}/api/orders`)).json());
  const browser = await chromium.launch();
  try {
    // 1. Buy and pay through the shop.
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(SHOP);
    await page.fill('input[name=customer]', 'e2e-shop-customer');
    await page.click('button:has-text("Buy")');
    await page.waitForURL(/paynet\.md/, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    note('shop:redirected-to-paynet', { url: page.url().split('?')[0] });
    await fillAndPay(page, 'shop-pay');
    await page.waitForURL(/localhost:3000\/return\/success/, { timeout: 90000 });
    await page.waitForTimeout(1000);
    await snap(page, 'shop-return-success');
    const successText = await page.innerText('h1');
    const order = (await orders()).orders[0];
    note('shop:return-success', { order: order.order, heading: successText, state: order.state });

    // 2. Signed PAID notification to the shop (Paynet cannot reach the runner).
    const out = execFileSync(process.execPath, ['tools/send-test-notification.mjs', String(order.order), `${SHOP}/paynet/notification`], { cwd: path.join('examples', 'node-shop'), encoding: 'utf8' });
    note('shop:notification', { output: out.trim() });
    await new Promise((r) => setTimeout(r, 3000));
    const afterNotification = (await orders());
    note('shop:after-notification', { state: afterNotification.orders[0].state, paidAmount: afterNotification.orders[0].paidAmount, review: afterNotification.review });
    await page.goto(`${SHOP}/return/success?order=${order.order}`);
    await snap(page, 'shop-return-fulfilled');

    // 3. Partial refund, then a second refund that the shop must block.
    const refund1 = await fetch(`${SHOP}/orders/refund`, { method: 'POST', body: new URLSearchParams({ order: String(order.order), amount: '100' }) });
    const refund2 = await fetch(`${SHOP}/orders/refund`, { method: 'POST', body: new URLSearchParams({ order: String(order.order) }) });
    const after = (await orders()).orders[0];
    note('shop:refunds', { first: refund1.status, second: refund2.status, state: after.state, refund: after.refund });

    // 4. Cancel on the Paynet page → back to the shop's cancel page.
    await page.goto(SHOP);
    await page.fill('input[name=customer]', 'e2e-shop-customer');
    await page.click('button:has-text("Buy")');
    await page.waitForURL(/paynet\.md/, { timeout: 60000 });
    await page.waitForTimeout(2500);
    const cancel = page.locator('text=Cancel').first();
    if (await cancel.count()) {
      await cancel.click();
      await page.waitForURL(/localhost:3000\/return\/cancel/, { timeout: 60000 }).catch(() => {});
    }
    await page.waitForTimeout(1000);
    await snap(page, 'shop-return-cancel');
    note('shop:cancel', { url: page.url().replace(/\?.*/, ''), heading: await page.innerText('h1').catch(() => '') });
  } finally {
    await browser.close();
    shop.kill();
    fs.writeFileSync(path.join(outDir, 'shop.log'), shopLog);
  }
};

// ---- stage "contract": compare real test API responses with openapi.json ----------------
const spec = JSON.parse(fs.readFileSync(path.join('src', 'openapi', 'openapi.json'), 'utf8'));
const resolve = (schema) => (schema?.$ref ? schema.$ref.replace('#/', '').split('/').reduce((n, k) => n?.[k], spec) : schema);
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
function validate(value, schemaIn, at, problems) {
  const schema = resolve(schemaIn);
  if (!schema) return;
  if (schema.oneOf) {
    const attempts = schema.oneOf.map((option) => { const p = []; validate(value, option, at, p); return p; });
    if (!attempts.some((p) => p.length === 0)) problems.push(...attempts.sort((a, b) => a.length - b.length)[0]);
    return;
  }
  if (value === null) {
    if (!schema.nullable && schema.type) problems.push(`${at}: null, schema type ${schema.type} is not nullable`);
    return;
  }
  const t = typeOf(value);
  const ok = !schema.type || schema.type === t || (schema.type === 'number' && t === 'integer');
  if (!ok) { problems.push(`${at}: ${t}, schema says ${schema.type}`); return; }
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${at}: ${JSON.stringify(value)} not in enum`);
  if (t === 'object') {
    for (const key of schema.required || []) if (!(key in value)) problems.push(`${at}.${key}: required by schema, missing in response`);
    for (const [key, sub] of Object.entries(schema.properties || {})) if (key in value) validate(value[key], sub, `${at}.${key}`, problems);
    const extra = Object.keys(value).filter((k) => schema.properties && !(k in schema.properties));
    if (extra.length) problems.push(`${at}: fields not in schema: ${extra.join(', ')}`);
  }
  if (t === 'array' && schema.items) value.slice(0, 3).forEach((item, i) => validate(item, schema.items, `${at}[${i}]`, problems));
}
const check = (label, apiPath, method, response) => {
  const op = spec.paths[apiPath]?.[method];
  const documented = op?.responses?.[String(response.status)];
  const problems = [];
  if (!documented) problems.push(`HTTP ${response.status} is not documented for ${method.toUpperCase()} ${apiPath}`);
  const schema = (documented || op?.responses?.default)?.content?.['application/json']?.schema;
  if (schema) validate(response.body, schema, 'body', problems);
  else if (documented) problems.push(`no JSON schema for HTTP ${response.status}`);
  note(`contract:${label}`, { http: response.status, ok: problems.length === 0, problems, sample: JSON.stringify(response.body).slice(0, 300) });
};

const contractStage = async (token) => {
  const order = Date.now();
  const created = await call('POST', '/api/order', orderBody(order, 300), token);
  check('create-order', '/api/order', 'post', created);
  check('get-by-id', '/api/order/{id}', 'get', await call('GET', `/api/order/${created.body?.paymentId}`, null, token));
  check('get-by-merchant', '/api/order/merchant/{id}', 'get', await call('GET', `/api/order/merchant/${order}`, null, token));
  check('get-unknown', '/api/order/{id}', 'get', await call('GET', '/api/order/999999999', null, token));
  check('no-token', '/api/order', 'post', await call('POST', '/api/order', orderBody(order + 1, 300)));
  const noServices = orderBody(order + 2, 300); delete noServices.Services;
  check('missing-services', '/api/order', 'post', await call('POST', '/api/order', noServices, token));
  check('invalid-json-unlink', '/api/linked-cards/unlink', 'post', await call('POST', '/api/linked-cards/unlink', {}, token));
  check('refund-unpaid', '/api/order/refund', 'post', await call('POST', '/api/order/refund', { PaymentId: created.body?.paymentId, SaleAreaCode: SALE_AREA, RefundType: 'full', Amount: 300, Currency: 498, Reason: 'contract check' }, token));
  const to = new Date(); const from = new Date(Date.now() - 2 * 24 * 3600 * 1000);
  check('search', '/api/order/search', 'get', await call('GET', `/api/order/search?from=${from.toISOString()}&to=${to.toISOString()}`, null, token));
  const day = (d) => d.toISOString().slice(0, 10);
  check('statement', '/api/statement', 'get', await call('GET', `/api/statement?dateStart=${day(from)}&dateFinish=${day(to)}`, null, token));
  check('auth-wrong-password', '/auth', 'post', await call('POST', '/auth', { grantType: 'password', username: '771064', password: 'wrong' }));
  const summary = log.filter((e) => e.step.startsWith('contract:'));
  note('contract:summary', { checks: summary.length, failed: summary.filter((e) => !e.ok).map((e) => e.step) });
};

// ---- stage "cards": saved card (CardLinkHash) checks ----------------------------------------
const cardsStage = async (token) => {
  const browser = await chromium.launch();
  const getPayment = async (order) => (await call('GET', `/api/order/merchant/${order}`, null, token)).body;
  try {
    for (const moneyType of ['Card', 'All']) {
      const order = Date.now();
      const created = await call('POST', '/api/order', orderBody(order, 300, { MoneyType: moneyType }), token);
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await p.goto(created.body.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
      const checkbox = await p.$$eval('input[type=checkbox]', (els) => els.map((e) => ({ name: e.name, checked: e.checked })));
      note(`cards:checkbox-${moneyType}`, { checkbox });
      if (moneyType === 'All') {
        await fillAndPay(p, 'cards-pay');
        await p.waitForURL(/morfikozik\.github\.io/, { timeout: 90000 }).catch(() => {});
        await snap(p, 'cards-after-pay');
        let paid = await getPayment(order);
        for (let i = 0; i < 20 && paid.status !== 4; i++) { await new Promise((r) => setTimeout(r, 3000)); paid = await getPayment(order); }
        note('cards:after-pay', { status: paid.status, cardLinkHash: paid.cardLinkHash, customerCardLinkHash: paid.customer?.cardLinkHash });
        const hash = paid.cardLinkHash || paid.customer?.cardLinkHash;
        if (hash) {
          // Same customer + token → the payment page should offer the saved card.
          const sameOrder = order + 11;
          const same = await call('POST', '/api/order', orderBody(sameOrder, 300, { CardLinkHash: hash }), token);
          note('cards:same-customer', { http: same.status, cardLinkHash: same.body?.cardLinkHash, status: same.body?.status, message: same.body?.message ?? same.body?.details });
          if (same.body?.paymentLink) {
            const q = await browser.newPage({ viewport: { width: 1280, height: 900 } });
            await q.goto(same.body.paymentLink, { waitUntil: 'load', timeout: 60000 });
            await q.waitForTimeout(8000);
            await snap(q, 'cards-saved-card-page');
            note('cards:saved-card-visible', { text: (await q.innerText('body')).match(/411111[\*•x]*1111|\*{2,}\s*1111|•{2,}\s*1111/i)?.[0] || null });
            await q.close();
          }
          // Another customer + the same token → should be refused or not show the card.
          const otherOrder = order + 12;
          const otherBody = orderBody(otherOrder, 300, { CardLinkHash: hash });
          otherBody.Customer = { ...otherBody.Customer, Code: 'e2e-other-customer' };
          const other = await call('POST', '/api/order', otherBody, token);
          note('cards:other-customer', { http: other.status, body: other.body && { cardLinkHash: other.body.cardLinkHash, status: other.body.status, code: other.body.code, details: other.body.details } });
          if (other.body?.paymentLink) {
            const q = await browser.newPage({ viewport: { width: 1280, height: 900 } });
            await q.goto(other.body.paymentLink, { waitUntil: 'load', timeout: 60000 });
            await q.waitForTimeout(8000);
            await snap(q, 'cards-other-customer-page');
            note('cards:other-customer-card-visible', { text: (await q.innerText('body')).match(/411111[\*•x]*1111|\*{2,}\s*1111|•{2,}\s*1111/i)?.[0] || null });
            await q.close();
          }
          // Unknown token for the same customer.
          const fakeOrder = order + 13;
          const fake = await call('POST', '/api/order', orderBody(fakeOrder, 300, { CardLinkHash: '0000000_00000000000000000000000000000000' }), token);
          note('cards:unknown-token', { http: fake.status, body: fake.body && { cardLinkHash: fake.body.cardLinkHash, code: fake.body.code, details: fake.body.details } });
        }
      }
      await p.close();
    }
  } finally {
    await browser.close();
  }
};


// Portal check on the published site: an order created with "Test API Request" in one tab
// is pre-filled in the notification simulator opened in another tab.
const portalStage = async () => {
  const SITE = 'https://morfikozik.github.io/paynet-docs/';
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const simulator = await context.newPage();
    await simulator.goto(SITE + '#/page/notification-simulator', { waitUntil: 'networkidle' });
    const orderInput = simulator.locator('input[placeholder="317184"]');
    note('portal-simulator-before', { value: await orderInput.inputValue() });

    const api = await context.newPage();
    await api.goto(SITE + '#/api/post-auth', { waitUntil: 'networkidle' });
    await api.click('button:has-text("Test API Request")');
    await api.waitForFunction(() => !!localStorage.getItem('tps_api_token'), null, { timeout: 60000 });
    note('portal-auth', { ok: true });
    await api.goto(SITE + '#/api/post-api-order', { waitUntil: 'networkidle' });
    await api.waitForTimeout(800);
    const requestText = await api.locator('textarea').first().inputValue();
    const sentOrder = String(JSON.parse(requestText).Order);
    await api.click('button:has-text("Test API Request")');
    await api.waitForFunction(() => !!localStorage.getItem('paynet_last_order'), null, { timeout: 60000 }).catch(async (error) => {
      await snap(api, 'portal-00-api-failed');
      throw error;
    });
    const stored = await api.evaluate(() => localStorage.getItem('paynet_last_order'));
    note('portal-order-created', { sentOrder, stored });
    await snap(api, 'portal-01-api');

    await simulator.bringToFront();
    await simulator.waitForTimeout(1000);
    const after = await orderInput.inputValue();
    note('portal-simulator-after', { value: after, matches: after === sentOrder });
    await orderInput.scrollIntoViewIfNeeded();
    await snap(simulator, 'portal-02-simulator');

    await simulator.getByRole('button', { name: 'Get', exact: true }).click();
    await simulator.waitForTimeout(4000);
    await snap(simulator, 'portal-03-get');
    if (after !== sentOrder) throw new Error(`simulator shows ${after}, expected ${sentOrder}`);
  } finally {
    await browser.close();
  }
};

// Error probes on the test API: which HTTP codes Paynet really returns (415, 405, 404, 429...).
const probeErrorsStage = async (token) => {
  const raw = async (name, method, url, { headers = {}, body } = {}) => {
    const started = Date.now();
    const response = await fetch(API + url, { method, headers, body });
    const text = await response.text();
    const result = {
      status: response.status,
      ms: Date.now() - started,
      contentType: response.headers.get('content-type'),
      retryAfter: response.headers.get('retry-after'),
      body: text.slice(0, 600),
    };
    note(`probe:${name}`, result);
    return result;
  };
  const auth = { Authorization: `Bearer ${token}` };
  const json = JSON.stringify(orderBody(Date.now(), 300));
  await raw('order-text-plain', 'POST', '/api/order', { headers: { ...auth, 'Content-Type': 'text/plain' }, body: json });
  await raw('order-no-content-type', 'POST', '/api/order', { headers: auth, body: json });
  await raw('order-xml', 'POST', '/api/order', { headers: { ...auth, 'Content-Type': 'application/xml' }, body: '<Order>1</Order>' });
  await raw('order-form-urlencoded', 'POST', '/api/order', { headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'Order=1' });
  await raw('auth-text-plain', 'POST', '/auth', { headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ grantType: 'password', username: '771064', password: 'sLgMnGWJ' }) });
  await raw('order-wrong-method-get', 'GET', '/api/order', { headers: auth });
  await raw('order-wrong-method-put', 'PUT', '/api/order', { headers: { ...auth, 'Content-Type': 'application/json' }, body: json });
  await raw('unknown-path', 'GET', '/api/does-not-exist', { headers: auth });
  await raw('payment-not-numeric', 'GET', '/api/order/abc', { headers: auth });
  await raw('payment-not-found', 'GET', '/api/order/999999999', { headers: auth });
  await raw('order-empty-json', 'POST', '/api/order', { headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
  await raw('order-broken-json', 'POST', '/api/order', { headers: { ...auth, 'Content-Type': 'application/json' }, body: '{"Order": ' });

  // Rate limit: 3 bursts of parallel read-only requests.
  const created = await call('POST', '/api/order', orderBody(Date.now(), 300), token);
  const id = created.body?.paymentId;
  for (const size of [20, 50, 100]) {
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: size }, () =>
      fetch(`${API}/api/order/${id}`, { headers: auth }).then(async (r) => ({ status: r.status, retryAfter: r.headers.get('retry-after'), body: r.status === 200 ? '' : (await r.text()).slice(0, 300) })).catch((e) => ({ status: 'network', body: String(e) }))
    ));
    const counts = {};
    results.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    note(`probe:burst-${size}`, { ms: Date.now() - started, counts, sampleNon200: results.find((r) => r.status !== 200) || null });
  }
  // Auth burst (token endpoint).
  const authResults = await Promise.all(Array.from({ length: 30 }, () =>
    fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantType: 'password', username: '771064', password: 'sLgMnGWJ' }) }).then((r) => r.status).catch(() => 'network')
  ));
  const authCounts = {};
  authResults.forEach((st) => { authCounts[st] = (authCounts[st] || 0) + 1; });
  note('probe:auth-burst-30', { counts: authCounts });
};

// Postman collection check with newman: create order -> pay with the test card -> the rest of the collection.
const postmanStage = async () => {
  const { execFileSync } = await import('node:child_process');
  execFileSync('node', ['scripts/build-postman.mjs'], { stdio: 'inherit' });
  const newman = (await import('newman')).default;
  const run = (folders, envVar = []) => new Promise((resolve, reject) => {
    newman.run({
      collection: 'public/postman/paynet-ecom.postman_collection.json',
      environment: 'public/postman/paynet-test.postman_environment.json',
      folder: folders,
      envVar,
      reporters: [],
    }, (error, summary) => (error ? reject(error) : resolve(summary)));
  });
  const report = (label, summary) => {
    const rows = summary.run.executions.map((e) => ({
      name: e.item.name,
      code: e.response?.code,
      url: e.request?.url?.toString(),
      failed: (e.assertions || []).filter((a) => a.error).map((a) => `${a.assertion}: ${a.error.message}`),
    }));
    note(`postman:${label}`, { rows, failures: summary.run.failures.map((f) => `${f.source?.name || ''} ${f.at || ''}: ${f.error?.name || ''} ${f.error?.message || ''}`) });
    return rows;
  };

  // Run 1: the whole "Payments" folder in one run — create order, then the next requests reuse paymentId / Order.
  const first = await run(['1. Payments']);
  const rows1 = report('payments-before-pay', first);
  const createExec = first.run.executions.find((e) => e.item.name === 'Create order');
  const created = JSON.parse(createExec.response.stream.toString());
  const sentBody = JSON.parse(createExec.request.body.raw);
  note('postman:created', { order: sentBody.Order, expiryDate: sentBody.ExpiryDate, paymentId: created.paymentId });
  const chained = rows1.filter((r) => r.name.startsWith('Get payment')).every((r) => r.code === 200 && r.url.includes(String(r.name.includes('Order') ? sentBody.Order : created.paymentId)));
  note('postman:chaining', { ok: chained });
  const searchExec = first.run.executions.find((e) => e.item.name.startsWith('Search payments'));
  const searchFound = String(searchExec?.response?.stream || '').includes(String(created.paymentId));
  note('postman:search-finds-new-payment', { code: searchExec?.response?.code, found: searchFound });
  if (!searchFound) throw new Error('Search did not find the payment just created');
  if (!chained) throw new Error('Variables were not passed between requests');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(created.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
    await fillAndPay(page, 'postman-pay');
    // Wait until the payment page finishes and returns the customer to LinkUrlSuccess.
    await page.waitForURL(/shop\.example/, { timeout: 120000 }).catch(() => {});
    note('postman:after-pay-url', { url: page.url() });
  } finally {
    await browser.close();
  }
  const auth = await call('POST', '/auth', { grantType: 'password', username: '771064', password: 'sLgMnGWJ' });
  let status;
  for (let i = 0; i < 20; i++) {
    status = (await call('GET', `/api/order/merchant/${sentBody.Order}`, null, auth.body.access_token)).body?.status;
    if (status === 4) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  note('postman:paid', { status });

  // Run 2: after payment — refund, statements, authorization, error examples.
  const rest = await run([
    'Get payment by Order (merchant order number)',
    'Refund (pay the order first)',
    '3. Statements',
    '4. Authorization',
    '5. Error examples (fail on purpose)',
  ], [
    { key: 'paymentId', value: String(created.paymentId) },
    { key: 'lastOrder', value: String(sentBody.Order) },
  ]);
  const rows = report('rest', rest);
  const bad = rows.filter((r) => r.failed.length);
  if (bad.length) throw new Error('Postman assertions failed: ' + JSON.stringify(bad));
};

// Quantity units check: Products[].Quantity = 300 with UnitPrice 100 and Amount 300.
const quantityStage = async (token) => {
  const order = Date.now();
  const body = orderBody(order, 300);
  body.Services[0].Products = [{ LineNo: 1, Code: 'SKU-1', Name: 'Demo product', Description: 'Demo product', UnitPrice: 100, Quantity: 300, Amount: 300, TotalAmount: 300 }];
  const created = await call('POST', '/api/order', body, token);
  note('quantity:create', { status: created.status, body: created.body });
  const got = await call('GET', `/api/order/merchant/${order}`, null, token);
  note('quantity:get', { status: got.status, products: got.body?.services?.[0]?.products });
};

// SDK check: every SDK creates its OWN order, the order is paid with the test card, then the SDK
// runs the rest (status, search, refund rules, saved card, statements, errors). Report per language.
const sdkStage = async (token) => {
  const { execFileSync } = await import('node:child_process');
  const runners = {
    node: (args) => execFileSync('node', ['sdk/node/e2e/check.mjs', ...args], { encoding: 'utf8', timeout: 180000 }),
    php: (args) => execFileSync('php', ['sdk/php/e2e/check.php', ...args], { encoding: 'utf8', timeout: 180000 }),
  };
  const report = {};
  const lastJson = (out) => JSON.parse(out.trim().split('\n').filter((l) => l.startsWith('{')).pop());
  for (const [lang, run] of Object.entries(runners)) {
    const entry = { checks: [], environment: 'ok' };
    report[lang] = entry;
    try {
      const created = lastJson(run(['create']));
      entry.order = created.order;
      entry.paymentId = created.paymentId;
      entry.checks.push(...created.checks.map((c) => ({ ...c, phase: 'before payment' })));
      if (!created.paymentLink) throw new Error('no paymentLink');

      // Keep the payment page open on the result screen while polling: closing it early
      // has left test payments in status 3 ("Result in progress").
      const browser = await chromium.launch();
      let status;
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(created.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
        await fillAndPay(page, `sdk-${lang}-pay`);
        await page.waitForURL(/shop\.example|receipt/, { timeout: 120000 }).catch(() => {});
        for (let i = 0; i < 60; i++) {
          status = (await call('GET', `/api/order/merchant/${created.order}`, null, token)).body?.status;
          if (status === 4) break;
          await page.waitForTimeout(3000);
        }
        entry.afterPayUrl = page.url();
        await snap(page, `sdk-${lang}-after-pay`);
      } finally {
        await browser.close();
      }
      entry.paidStatus = status;
      if (status !== 4) {
        entry.environment = `payment did not reach status 4 (status ${status}) — test environment problem, not the SDK`;
      } else {
        const after = lastJson(run(['after-pay', String(created.order)]));
        entry.checks.push(...after.checks.map((c) => ({ ...c, phase: 'after payment' })));
      }
    } catch (error) {
      entry.checks.push({ name: 'runner', ok: false, detail: String(error?.stdout || error?.stderr || error?.message || error).slice(0, 2000), phase: '-' });
    }
    note(`sdk:${lang}`, entry);
  }

  // Human-readable report.
  const lines = ['# SDK check on the Paynet test environment', '', `Date: ${new Date().toISOString()}`, ''];
  for (const [lang, e] of Object.entries(report)) {
    const ok = e.checks.filter((c) => c.ok).length;
    lines.push(`## ${lang === 'node' ? 'Node.js' : 'PHP'} — ${ok} / ${e.checks.length} passed`, '');
    lines.push(`Order \`${e.order}\`, paymentId \`${e.paymentId}\`. Environment: ${e.environment}.`, '');
    lines.push('| Phase | Check | Result | Detail |', '|---|---|---|---|');
    for (const c of e.checks) lines.push(`| ${c.phase} | ${c.name} | ${c.ok ? '✓' : '✗'} | ${String(c.detail).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300)} |`);
    lines.push('');
  }
  fs.writeFileSync(path.join(outDir, 'sdk-report.md'), lines.join('\n'));
  const failed = Object.values(report).some((e) => e.environment !== 'ok' || e.checks.some((c) => !c.ok));
  if (failed) throw new Error('SDK check has failures — see sdk-report.md');
};

// Search probe: how /api/order/search interprets from/to (UTC "Z" vs Chișinău local time) and what an empty result looks like.
const searchProbeStage = async (token) => {
  const created = await call('POST', '/api/order', orderBody(Date.now(), 300), token);
  const id = created.body?.paymentId;
  note('search:created', { id, registered: created.body?.registered });
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const local = (ms) => { const d = new Date(ms + 2 * 3600e3); return d.toISOString().slice(0, 19); }; // Chișinău winter time (UTC+2)
  const variants = {
    'utc-Z last hour': [iso(now - 3600e3), iso(now + 60e3)],
    'utc-Z last 3 hours': [iso(now - 3 * 3600e3), iso(now + 60e3)],
    'local no-Z last hour': [local(now - 3600e3), local(now + 60e3)],
    'utc no-Z last hour': [iso(now - 3600e3).slice(0, 19), iso(now + 60e3).slice(0, 19)],
    'utc-Z +3h future window': [iso(now - 3600e3), iso(now + 3 * 3600e3)],
    'empty period 2020': ['2020-01-01T00:00:00', '2020-01-02T00:00:00'],
  };
  for (const [name, [from, to]] of Object.entries(variants)) {
    const r = await call('GET', `/api/order/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, null, token);
    const text = JSON.stringify(r.body);
    note(`search:${name}`, { from, to, status: r.status, found: text.includes(String(id)), count: Array.isArray(r.body) ? r.body.length : (r.body?.items?.length ?? null), sample: text.slice(0, 300) });
  }
};

// Full site audit of the PUBLISHED site: every route × 3 languages × desktop/mobile, links, files,
// search, language switch, mobile menu, bundle secrets scan, npm audit. Writes site-audit.md + site-audit.json.
const siteAuditStage = async () => {
  const SITE = 'https://morfikozik.github.io/paynet-docs/';
  const { execFileSync } = await import('node:child_process');
  const LANGS = ['en', 'ru', 'ro'];
  const results = { routes: [], links: {}, files: [], interactions: [], bundle: {}, npm: {}, timing: {} };
  const problems = [];

  // Routes: guides (from content/), tools, API methods (same id formula as the portal), home, legacy redirects.
  const guideTitles = {};
  for (const lang of LANGS) {
    for (const section of fs.readdirSync(`content/${lang}`)) {
      for (const f of fs.readdirSync(`content/${lang}/${section}`).filter((x) => /^\d+-.+\.md$/.test(x))) {
        const slug = f.replace(/^\d+-/, '').replace(/\.md$/, '');
        const title = (fs.readFileSync(`content/${lang}/${section}/${f}`, 'utf8').match(/^# (.+)$/m) || [])[1];
        (guideTitles[slug] ||= {})[lang] = title;
      }
    }
  }
  const spec = JSON.parse(fs.readFileSync('src/openapi/openapi.json', 'utf8'));
  const apiIds = {};
  for (const [p, ops] of Object.entries(spec.paths)) for (const m of Object.keys(ops)) apiIds[`${m}-${p}`.replace(/[{}\/]/g, '-').replace(/-+/g, '-')] = { method: m.toUpperCase(), path: p };
  const tools = ['plugins', 'checkout-form', 'notification-simulator'];
  const routes = [{ hash: '#/', kind: 'home' }]
    .concat(Object.keys(guideTitles).map((slug) => ({ hash: `#/guides/${slug}`, kind: 'guide', slug })))
    .concat(tools.map((t) => ({ hash: `#/page/${t}`, kind: 'tool' })))
    .concat(Object.entries(apiIds).map(([id, op]) => ({ hash: `#/api/${id}`, kind: 'api', op })));
  const legacy = { ecommerce: '#/guides/integration-options', 'order-request-v06': '#/page/checkout-form', notifications: '#/page/notification-simulator' };

  const browser = await chromium.launch();
  const linkTargets = new Map(); // href -> first page
  try {
    for (const [device, viewport, isMobile] of [['desktop', { width: 1366, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      for (const lang of LANGS) {
        const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
        await context.addInitScript((l) => localStorage.setItem('tps-api-language', l), lang);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
        page.on('requestfailed', (r) => { if (r.url().startsWith(SITE)) errors.push(`requestfailed: ${r.url()}`); });
        const t0 = Date.now();
        await page.goto(SITE, { waitUntil: 'networkidle' });
        if (device === 'desktop' && lang === 'en') results.timing.firstLoadMs = Date.now() - t0;
        for (const route of routes) {
          errors.length = 0;
          const started = Date.now();
          await page.evaluate((h) => { window.location.hash = h; }, route.hash);
          await page.waitForTimeout(route.kind === 'api' ? 900 : 500);
          const info = await page.evaluate(() => {
            const main = document.querySelector('main') || document.body;
            const h1 = (main.querySelector('h1')?.textContent || '').trim();
            const text = main.innerText || '';
            const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            const links = [...main.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
            return { h1, textLength: text.length, overflow, links, hasCode: !!main.querySelector('pre'), sample: text.slice(0, 200) };
          });
          const entry = { device, lang, hash: route.hash, ms: Date.now() - started, h1: info.h1, textLength: info.textLength, overflow: info.overflow, errors: [...errors] };
          const issues = [];
          if (errors.length) issues.push(`JS errors: ${errors.join(' | ').slice(0, 300)}`);
          if (info.overflow > 2) issues.push(`horizontal overflow ${info.overflow}px`);
          if (info.textLength < 80) issues.push(`almost empty page (${info.textLength} chars)`);
          if (route.kind === 'guide') {
            const expected = guideTitles[route.slug]?.[lang];
            if (expected && info.h1 !== expected) issues.push(`title "${info.h1}" ≠ "${expected}"`);
          }
          if (route.kind === 'api' && !info.sample.includes(route.op.path) && !(await page.evaluate((p) => document.body.innerText.includes(p), route.op.path))) issues.push(`API path ${route.op.path} not shown`);
          entry.issues = issues;
          results.routes.push(entry);
          if (issues.length) problems.push(`${device}/${lang} ${route.hash}: ${issues.join('; ')}`);
          if (device === 'desktop') for (const href of info.links) if (!linkTargets.has(href)) linkTargets.set(href, `${lang} ${route.hash}`);
        }
        // Legacy redirects
        if (device === 'desktop' && lang === 'en') {
          for (const [old, target] of Object.entries(legacy)) {
            await page.evaluate((h) => { window.location.hash = h; }, `#/page/${old}`);
            await page.waitForTimeout(500);
            const now = await page.evaluate(() => window.location.hash);
            const ok = now === target;
            results.interactions.push({ name: `legacy redirect #/page/${old}`, ok, detail: now });
            if (!ok) problems.push(`legacy redirect #/page/${old} → ${now}, expected ${target}`);
          }
        }
        // Interactions per language (desktop): search; (mobile): menu open/close
        if (device === 'desktop') {
          await page.evaluate(() => { window.location.hash = '#/'; });
          await page.waitForTimeout(400);
          const search = page.locator('input[type="text"], input[type="search"]').first();
          let ok = false;
          let detail = '';
          try {
            await search.fill('refund');
            await page.waitForTimeout(700);
            const count = await page.evaluate(() => document.querySelectorAll('aside button, aside a, [role="listbox"] *').length);
            const text = await page.evaluate(() => (document.querySelector('aside') || document.body).innerText);
            ok = /refund|возврат|rambursare/i.test(text);
            detail = `results visible: ${ok}, items ${count}`;
            await search.fill('');
          } catch (e) { detail = String(e.message || e); }
          results.interactions.push({ name: `search "refund" (${lang})`, ok, detail });
          if (!ok) problems.push(`search does not work in ${lang}: ${detail}`);
        } else {
          let ok = false;
          let detail = '';
          try {
            await page.evaluate(() => { window.location.hash = '#/guides/notifications'; });
            await page.waitForTimeout(400);
            await page.getByRole('button', { name: /open menu/i }).click();
            await page.waitForTimeout(400);
            await page.getByRole('button', { name: /close menu/i }).first().click();
            await page.waitForTimeout(300);
            ok = true;
            detail = 'opened and closed';
          } catch (e) { detail = String(e.message || e).slice(0, 200); }
          results.interactions.push({ name: `mobile menu (${lang})`, ok, detail });
          if (!ok) problems.push(`mobile menu (${lang}): ${detail}`);
        }
        await context.close();
      }
    }
    // Language switch through the UI
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      await page.goto(SITE + '#/guides/notifications', { waitUntil: 'networkidle' });
      let ok = false;
      let detail = '';
      try {
        const before = await page.locator('h1').first().textContent();
        await page.locator('header button').filter({ hasText: /English|Русский|Română/ }).first().click();
        await page.waitForTimeout(300);
        await page.getByText('Русский').last().click();
        await page.waitForTimeout(600);
        const after = await page.locator('h1').first().textContent();
        ok = before !== after && /Уведомления/.test(after || '');
        detail = `${before} → ${after}`;
      } catch (e) { detail = String(e.message || e).slice(0, 200); }
      results.interactions.push({ name: 'language switch EN → RU', ok, detail });
      if (!ok) problems.push(`language switch: ${detail}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Links
  const guideSlugs = new Set(Object.keys(guideTitles));
  const linkProblems = [];
  const external = [];
  for (const [href, from] of linkTargets) {
    if (href.startsWith('mailto:')) continue;
    let m;
    if ((m = href.match(/^#\/guides\/([^#?]+)$/))) { if (!guideSlugs.has(m[1])) linkProblems.push(`${from}: broken guide link ${href}`); continue; }
    if ((m = href.match(/^#\/api\/(.+)$/))) { if (!apiIds[m[1]]) linkProblems.push(`${from}: broken API link ${href}`); continue; }
    if ((m = href.match(/^#\/page\/(.+)$/))) { if (!tools.includes(m[1]) && !legacy[m[1]]) linkProblems.push(`${from}: broken page link ${href}`); continue; }
    if (href.startsWith('#')) continue; // in-page anchors
    const url = /^https?:/.test(href) ? href : new URL(href, SITE).toString();
    if (url.startsWith(SITE)) {
      const r = await fetch(url).catch((e) => ({ status: `network: ${e.message}` }));
      results.files.push({ href, status: r.status, from });
      if (r.status !== 200) linkProblems.push(`${from}: file ${href} → ${r.status}`);
    } else external.push({ href: url, from });
  }
  for (const { href, from } of external) {
    let status;
    try {
      const r = await fetch(href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      status = r.status;
    } catch (e) { status = `network: ${e.message}`; }
    results.links[href] = { status, from };
    if (!(typeof status === 'number' && status < 400)) linkProblems.push(`${from}: external ${href} → ${status}`);
  }
  results.linkProblems = linkProblems;

  // Published files (AI docs, OpenAPI, Postman, SDK, mocks)
  for (const f of ['llms.txt', 'llms-full.txt', 'llms-ecom.txt', 'openapi.json', 'postman/paynet-ecom.postman_collection.json', 'postman/paynet-test.postman_environment.json', 'postman/paynet-production.postman_environment.json', 'sdk/paynet-ecom-sdk-php-1.0.0.zip', 'sdk/paynet-ecom-sdk-node-1.0.0.zip', 'mocks/index.json', 'docs/sdk.md', 'docs/ru/sdk.md', 'docs/ro/mobile-apps.md', 'docs/api/post-api-order.md']) {
    const r = await fetch(SITE + f);
    const body = Buffer.from(await r.arrayBuffer());
    results.files.push({ href: f, status: r.status, bytes: body.length });
    if (r.status !== 200 || body.length < 50) problems.push(`file ${f} → ${r.status} (${body.length} bytes)`);
  }

  // Bundle: size and secrets scan
  const html = await (await fetch(SITE)).text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => new URL(m[1], SITE).toString());
  let bundle = '';
  for (const u of scripts) bundle += await (await fetch(u)).text();
  results.bundle.bytes = bundle.length;
  results.bundle.knownPublicTestValues = Object.fromEntries(['771064', 'sLgMnGWJ', 'F90D6485-9CCC-458B-96A3-8958AF9B4458', 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7'].map((v) => [v, bundle.includes(v)]));
  const suspicious = [];
  for (const [name, re] of [['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/], ['AWS key', /AKIA[0-9A-Z]{16}/], ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36}/], ['Google API key', /AIza[0-9A-Za-z_-]{35}/], ['Slack token', /xox[baprs]-[0-9A-Za-z-]{10,}/], ['JWT', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/]]) if (re.test(bundle)) suspicious.push(name);
  results.bundle.suspicious = suspicious;
  if (suspicious.length) problems.push(`bundle contains: ${suspicious.join(', ')}`);

  // npm audit
  for (const [key, args] of [['all', ['audit', '--json']], ['runtimeOnly', ['audit', '--omit=dev', '--json']]]) {
    let out;
    try { out = execFileSync('npm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { out = e.stdout || '{}'; }
    try {
      const j = JSON.parse(out);
      results.npm[key] = { counts: j.metadata?.vulnerabilities, packages: Object.entries(j.vulnerabilities || {}).map(([n, v]) => `${n} (${v.severity}${v.isDirect ? ', direct' : ''})`) };
    } catch { results.npm[key] = { error: out.slice(0, 300) }; }
  }

  const routeCount = results.routes.length;
  const failedRoutes = results.routes.filter((r) => r.issues.length).length;
  results.summary = { routeChecks: routeCount, failedRoutes, internalLinks: [...linkTargets.keys()].length, externalLinks: external.length, linkProblems: linkProblems.length, interactionsFailed: results.interactions.filter((i) => !i.ok).length, problems: problems.length };
  fs.writeFileSync(path.join(outDir, 'site-audit.json'), JSON.stringify(results, null, 2));
  const md = ['# Site audit', '', '```json', JSON.stringify(results.summary, null, 2), '```', '', '## Problems', ...problems.map((p) => `- ${p}`), '', '## Link problems', ...linkProblems.map((p) => `- ${p}`), '', '## Interactions', ...results.interactions.map((i) => `- ${i.ok ? '✓' : '✗'} ${i.name}: ${i.detail}`), '', '## Bundle', '```json', JSON.stringify(results.bundle, null, 2), '```', '', '## npm audit', '```json', JSON.stringify(results.npm, null, 2), '```', '', `First load (desktop, en): ${results.timing.firstLoadMs} ms`];
  fs.writeFileSync(path.join(outDir, 'site-audit.md'), md.join('\n'));
  note('site-audit', results.summary);
};

// Language switch through the UI (standalone check).
const langSwitchStage = async () => {
  const SITE = 'https://morfikozik.github.io/paynet-docs/';
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await context.addInitScript(() => { if (!sessionStorage.getItem('init')) { localStorage.setItem('tps-api-language', 'en'); sessionStorage.setItem('init', '1'); } });
    const page = await context.newPage();
    await page.goto(SITE + '#/guides/notifications', { waitUntil: 'networkidle' });
    const before = (await page.locator('h1').first().textContent())?.trim();
    await page.locator('header button').filter({ hasText: /English|Русский|Română/ }).first().click();
    await page.waitForTimeout(300);
    await page.getByText('Русский', { exact: false }).last().click();
    await page.waitForTimeout(700);
    const after = (await page.locator('h1').first().textContent())?.trim();
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = (await page.locator('h1').first().textContent())?.trim();
    const ok = before?.startsWith('Notifications') && after?.startsWith('Уведомления') && afterReload?.startsWith('Уведомления');
    note('lang-switch', { ok, before, after, afterReload });
    await snap(page, 'lang-switch-ru');
    if (!ok) throw new Error(`language switch: ${before} → ${after} → ${afterReload}`);
  } finally {
    await browser.close();
  }
};

// Suite: runs the checks one after another and writes suite-report.md.
const suiteStage = async () => {
  const getToken = async () => (await call('POST', '/auth', { grantType: 'password', username: '771064', password: 'sLgMnGWJ' })).body?.access_token;
  const plan = [
    ['contract', 'API reference matches real responses', async () => contractStage(await getToken())],
    ['lang-switch', 'Language switch in the UI', langSwitchStage],
    ['portal', 'Try-it console: order created in one tab is pre-filled in the notification simulator', portalStage],
    ['shop', 'Example shop (Node.js): purchase → payment → notification → fulfilment → refund', shopStage],
    ['cards', 'Saved cards: shown to the same customer only', async () => {
      const before = log.length;
      await cardsStage(await getToken());
      const notes = log.slice(before);
      const visible = notes.find((n) => n.step === 'cards:saved-card-visible')?.text;
      const otherVisible = notes.find((n) => n.step === 'cards:other-customer-card-visible')?.text;
      if (!visible) throw new Error('saved card is not shown to the same customer');
      if (otherVisible) throw new Error('saved card is shown to another customer');
    }],
    ['postman', 'Postman collection (newman): full run with payment and refund', postmanStage],
    ['sdk', 'SDKs (PHP, Node.js): 20 checks each on the test API', async () => sdkStage(await getToken())],
    ['probe-errors', 'Real HTTP error codes (415, 405, 404, 400, rate)', async () => probeErrorsStage(await getToken())],
    ['search-probe', 'Search period time zone and empty result', async () => searchProbeStage(await getToken())],
    ['quantity', 'Products Quantity units', async () => quantityStage(await getToken())],
  ];
  const rows = [];
  for (const [name, title, fn] of plan) {
    const started = Date.now();
    const before = log.length;
    let ok = true;
    let error = '';
    try {
      await fn();
    } catch (e) {
      ok = false;
      error = String(e?.message || e).slice(0, 400);
    }
    // a note with ok:false or problems also counts as a failure
    const notes = log.slice(before);
    const failedNotes = notes.filter((n) => n.ok === false || (Array.isArray(n.problems) && n.problems.length) || n.step === 'error');
    if (failedNotes.length) ok = false;
    rows.push({ name, title, ok, seconds: Math.round((Date.now() - started) / 1000), error, failedNotes: failedNotes.map((n) => n.step).slice(0, 10) });
    note(`suite:${name}`, rows.at(-1));
  }
  const md = ['# E2E suite', '', `Date: ${new Date().toISOString()}`, '', '| Check | What | Result | Time | Notes |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.name} | ${r.title} | ${r.ok ? '✓' : '✗'} | ${r.seconds} s | ${(r.error + ' ' + r.failedNotes.join(', ')).trim().replace(/\|/g, '\\|')} |`)];
  fs.writeFileSync(path.join(outDir, 'suite-report.md'), md.join('\n'));
};

const main = async () => {
  if (stage === 'suite') return suiteStage();
  if (stage === 'lang-switch') return langSwitchStage();
  if (stage === 'site-audit') return siteAuditStage();
  if (stage === 'postman') return postmanStage();
  if (stage === 'portal') return portalStage();
  if (stage === 'shop') return shopStage();
  const auth = await call('POST', '/auth', { grantType: 'password', username: '771064', password: 'sLgMnGWJ' });
  const token = auth.body?.access_token;
  note('auth', { status: auth.status, tokenLength: token?.length });
  if (!token) throw new Error('no token');
  check('auth', '/auth', 'post', auth);
  if (stage === 'contract') return contractStage(token);
  if (stage === 'cards') return cardsStage(token);
  if (stage === 'probe-errors') return probeErrorsStage(token);
  if (stage === 'quantity') return quantityStage(token);
  if (stage === 'sdk') return sdkStage(token);
  if (stage === 'search-probe') return searchProbeStage(token);

  const order1 = Date.now();
  const created = await call('POST', '/api/order', orderBody(order1, 300), token);
  note('create-order-1', { order: order1, status: created.status, body: created.body });
  const status0 = await call('GET', `/api/order/merchant/${order1}`, null, token);
  note('status-after-create', { status: status0.status, body: status0.body });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(created.body.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await snap(page, '01-payment-page');

  if (stage === 'explore') {
    await browser.close();
    return;
  }

  // ---- full stage -------------------------------------------------------
  const pay = async (paymentLink, name) => {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(2500);
    const numberFrame = p.frames().find((f) => f.url().includes('microform') && f.url().includes('%22fieldType%22:%22number%22'));
    const cvvFrame = p.frames().find((f) => f.url().includes('microform') && f.url().includes('securityCode'));
    note(`${name}:frames`, { number: !!numberFrame, cvv: !!cvvFrame, saveCardCheckbox: await p.$$eval('input[type=checkbox]', (els) => els.map((e) => ({ id: e.id, name: e.name, checked: e.checked, label: e.closest('label')?.innerText || e.parentElement?.innerText?.slice(0, 80) }))) });
    if (numberFrame) await numberFrame.fill('#number', CARD.number);
    if (cvvFrame) await cvvFrame.fill('#securityCode', CARD.cvv);
    await p.click('#CardExp');
    await p.keyboard.type(CARD.month + CARD.year, { delay: 80 });
    await p.waitForTimeout(800);
    await snap(p, `${name}-filled`);
    await p.click('#submit-default');
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(2000);
      if (p.url().includes('morfikozik.github.io')) break;
    }
    await snap(p, `${name}-after-pay`);
    note(`${name}:final-url`, { url: p.url() });
    await p.close();
  };

  const status = async (order, label) => {
    const r = await call('GET', `/api/order/merchant/${order}`, null, token);
    note(`status:${label}`, { http: r.status, status: r.body?.status, paidDate: r.body?.paidDate, cardLinkHash: r.body?.cardLinkHash, amount: r.body?.amount });
    return r.body;
  };
  const refund = async (paymentId, type, amount, label) => {
    const r = await call('POST', '/api/order/refund', { PaymentId: paymentId, SaleAreaCode: SALE_AREA, RefundType: type, Amount: amount, Currency: 498, Reason: `docs e2e ${label}` }, token);
    note(`refund:${label}`, { http: r.status, body: r.body });
    return r;
  };

  // Payment 1: pay, partial refund, second refund.
  await pay(created.body.paymentLink, 'pay1');
  const p1 = await status(order1, 'p1-after-pay');
  if (p1?.status === 4) {
    await refund(p1.paymentId, 'partial', 100, 'p1-partial-100');
    await status(order1, 'p1-after-partial');
    await refund(p1.paymentId, 'partial', 50, 'p1-second-refund');
    await refund(p1.paymentId, 'full', 200, 'p1-second-full');
  }

  // Refund of an unpaid order.
  const order0 = order1 + 7;
  const unpaid = await call('POST', '/api/order', orderBody(order0, 300), token);
  note('create-unpaid', { http: unpaid.status, paymentId: unpaid.body?.paymentId });
  if (unpaid.body?.paymentId) await refund(unpaid.body.paymentId, 'full', 300, 'unpaid');

  // Payment 2: refund above the paid amount, then full refund.
  const order2 = order1 + 1;
  const created2 = await call('POST', '/api/order', orderBody(order2, 400), token);
  note('create-order-2', { http: created2.status, paymentId: created2.body?.paymentId });
  if (created2.body?.paymentLink) {
    await pay(created2.body.paymentLink, 'pay2');
    const p2 = await status(order2, 'p2-after-pay');
    if (p2?.status === 4) {
      await refund(p2.paymentId, 'partial', 1000, 'p2-above-paid');
      await refund(p2.paymentId, 'full', 400, 'p2-full');
      await status(order2, 'p2-after-full');
      // Same Order again after status 5.
      const again = await call('POST', '/api/order', orderBody(order2, 400), token);
      note('repeat-order-after-5', { http: again.status, body: again.body });
    }
  }

  // Saved card: if payment 1 produced a CardLinkHash, use it.
  if (p1?.cardLinkHash) {
    const order3 = order1 + 2;
    const created3 = await call('POST', '/api/order', orderBody(order3, 200, { CardLinkHash: p1.cardLinkHash }), token);
    note('create-order-saved-card', { http: created3.status, body: created3.body });
    if (created3.body?.paymentLink) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await p.goto(created3.body.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(2500);
      await snap(p, 'saved-card-page');
      await p.close();
    }
  } else {
    note('saved-card', { result: 'no CardLinkHash after payment 1' });
  }
  await browser.close();
};

main().catch((error) => {
  note('error', { message: String(error?.stack || error) });
  process.exitCode = 1;
});
