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
for (const file of ['llms.txt', 'llms-full.txt', 'llms-ecom.txt', 'openapi.json', 'docs/signatures.md', 'legacy/']) {
  const res = await fetch(baseUrl + file);
  log.push(`GET ${file} → ${res.status} (${(await res.text()).length} bytes)`);
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
