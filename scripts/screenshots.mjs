#!/usr/bin/env node
// CI helper: opens the built portal in Chromium and saves screenshots of key pages,
// plus a log of browser console errors. Usage: node scripts/screenshots.mjs <baseUrl> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrl = 'http://localhost:4173/', outDir = 'screenshots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  ['en', '#/', '01-home'],
  ['en', '#/guides/getting-started', '02-quick-start'],
  ['en', '#/guides/notifications', '03-notifications'],
  ['en', '#/guides/errors-and-statuses', '04-errors'],
  ['en', '#/api/post-api-order', '05-api-create-order'],
  ['en', '#/page/notification-simulator', '06-notification-simulator'],
  ['en', '#/page/checkout-form', '07-checkout-form'],
  ['ru', '#/', '08-ru-home'],
  ['ro', '#/guides/hosted-checkout', '09-ro-hosted-checkout'],
  ['ru', '#/page/order-request-v05', '10-legacy-redirect'],
  ['ru', '#/api/post-auth', '12-ru-api-auth'],
  ['en', '#/api/post-api-linked-cards-unlink', '13-api-unlink'],
  ['ru', '#/guides/errors-and-statuses', '18-ru-statuses'],
  ['ru', '#/guides/saved-cards', '19-ru-saved-cards'],
  ['ro', '#/guides/faq', '20-ro-faq'],
  ['ru', '#/guides/example-shop', '21-ru-example-shop'],
  ['en', '#/guides/changelog', '22-en-changelog'],
  ['ru', '#/guides/testing', '23-ru-testing-mocks'],
];

const browser = await chromium.launch();
const log = [];
for (const [language, hash, name] of pages) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  await context.addInitScript((lang) => localStorage.setItem('tps-api-language', lang), language);
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') log.push(`[${name}] console: ${msg.text()}`); });
  page.on('pageerror', (err) => log.push(`[${name}] pageerror: ${err.message}`));
  await page.goto(baseUrl + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await context.close();
}
// Full-text search: type a field name that appears only inside guide texts.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => localStorage.setItem('tps-api-language', 'ru'));
  const page = await context.newPage();
  page.on('pageerror', (err) => log.push(`[search] pageerror: ${err.message}`));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.fill('input[type="search"]', 'PaidAmount');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, '11-ru-search.png') });
  await context.close();
}
// AI menu opened on a guide and on an API method; code tab of an API method.
for (const [hash, name, action] of [
  ['#/guides/signatures', '14-ru-ai-menu-guide', 'menu'],
  ['#/api/post-api-order', '15-ru-ai-menu-api', 'menu'],
  ['#/api/post-api-order', '17-ru-api-order-json', 'none'],
  ['#/api/post-api-order', '16-ru-api-code-tab', 'php'],
]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(() => localStorage.setItem('tps-api-language', 'ru'));
  const page = await context.newPage();
  page.on('pageerror', (err) => log.push(`[${name}] pageerror: ${err.message}`));
  await page.goto(baseUrl + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (action === 'menu') await page.click('button[aria-haspopup="menu"]');
  if (action === 'php') {
    await page.fill('textarea', '{\n  "Order": 42,\n  "MoneyType": "Card"\n}');
    await page.waitForTimeout(500);
    await page.click('button:text-is("PHP")');
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  await context.close();
}
for (const file of ['mocks/index.json', 'mocks/notification-paid.json', 'docs/example-shop.md', 'docs/saved-cards.md', 'docs/ru/faq.md', 'docs/ru/signatures.md', 'docs/ro/testing.md', 'docs/api/post-api-order.md', 'docs/api/get-api-order-id.md',
  'llms.txt', 'llms-full.txt', 'llms-ecom.txt', 'openapi.json', 'docs/signatures.md', 'legacy/']) {
  const res = await fetch(baseUrl + file);
  log.push(`GET ${file} → ${res.status} (${(await res.text()).length} bytes)`);
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
