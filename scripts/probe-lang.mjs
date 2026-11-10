// Probe: which Lang values does POST /api/order accept, and which page language results?
import fs from 'node:fs';
import { chromium } from 'playwright';
const API = 'https://ecom-api-test.paynet.md';
const out = process.argv[2] || 'e2e-out'; fs.mkdirSync(out, { recursive: true });
const tok = (await (await fetch(API + '/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grantType: 'password', username: '771064', password: 'sLgMnGWJ' }) })).json()).access_token;
const exp = new Date(Date.now() + 26 * 3600e3).toISOString().slice(0, 19);
const browser = await chromium.launch();
const rows = []; let n = Date.now();
for (const lang of ['EN', 'en', 'RO', 'ro', 'RU', 'ru', 'Ro', '(missing)', 'XX']) {
  const body = { Order: n++, SaleAreaCode: 'onlidocumentation_md', LinkUrlSuccess: 'https://shop.example/s', LinkUrlCancel: 'https://shop.example/c',
    Customer: { Code: 'probe-lang', NameFirst: 'Probe', NameLast: 'Lang', email: 'probe@example.com', PhoneNumber: '37360000000' }, Currency: 498, ExpiryDate: exp, MoneyType: 'Card',
    Services: [{ Name: 'Probe', Description: 'Probe', Amount: 300 }] };
  if (lang !== '(missing)') body.Lang = lang;
  const r = await fetch(API + '/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  let pageText = '';
  if (j?.paymentLink) {
    const p = await browser.newPage();
    await p.goto(j.paymentLink, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(3000);
    pageText = (await p.innerText('body').catch(() => '')).slice(0, 120).replace(/\s+/g, ' ');
    await p.close();
  }
  const row = { lang, http: r.status, paymentId: j?.paymentId ?? null, page: pageText, err: j?.paymentId ? null : JSON.stringify(j).slice(0, 200) };
  rows.push(row); console.log(JSON.stringify(row));
}
await browser.close();
fs.writeFileSync(out + '/probe-lang.json', JSON.stringify(rows, null, 2));
