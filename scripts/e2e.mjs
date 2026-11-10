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
            await q.goto(same.body.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
            await q.waitForTimeout(2000);
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
            await q.goto(other.body.paymentLink, { waitUntil: 'networkidle', timeout: 60000 });
            await q.waitForTimeout(2000);
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

const main = async () => {
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
