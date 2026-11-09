// End-to-end check of the documentation against the Paynet TEST environment.
// Usage: node scripts/e2e.mjs <explore|full> <outDir>
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

const main = async () => {
  const auth = await call('POST', '/auth', { grantType: 'password', username: '771064', password: 'sLgMnGWJ' });
  const token = auth.body?.access_token;
  note('auth', { status: auth.status, tokenLength: token?.length });
  if (!token) throw new Error('no token');

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
