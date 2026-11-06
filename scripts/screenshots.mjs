#!/usr/bin/env node
// CI helper: opens the built portal in Chromium and saves screenshots of key pages,
// plus a log of browser console errors. Usage: node scripts/screenshots.mjs <baseUrl> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseUrl = 'http://localhost:4173/', outDir = 'screenshots'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  ['en', '', '01-home'],
  ['en', '#/guides/getting-started', '02-getting-started'],
  ['en', '#/guides/hosted-checkout', '03-hosted-checkout'],
  ['en', '#/guides/signatures', '04-signatures'],
  ['en', '#/guides/statuses-and-errors', '05-statuses'],
  ['en', '#/api/post-api-order', '06-api-create-order'],
  ['en', '#/page/notifications', '07-notifications-tool'],
  ['en', '#/page/order-request-v06', '08-order-request-v06'],
  ['ru', '#/guides/getting-started', '09-ru-getting-started'],
  ['ro', '#/guides/notifications', '10-ro-notifications'],
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
for (const file of ['llms.txt', 'llms-full.txt', 'openapi.json', 'docs/signatures.md', 'legacy/']) {
  const res = await fetch(baseUrl + file);
  log.push(`GET ${file} → ${res.status} (${(await res.text()).length} bytes)`);
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'report.txt'), log.join('\n') + '\n');
console.log(log.join('\n'));
