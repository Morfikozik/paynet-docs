#!/usr/bin/env node
// Guards the documentation against silent mistakes. Fails the build if:
//  - the signature test vectors published in any language do not match the reference algorithm;
//  - the Node.js sample code in the guides produces a different signature;
//  - a guide exists in one language but not in the others;
//  - a guide links to a guide page that does not exist.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkoutRawData, checkoutSignature, notificationPreparedString, notificationHash } from './lib/signatures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const languages = (process.env.CHECK_LANGS || 'en,ru,ro').split(',');
const CHECKOUT_KEY = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
const NOTIFICATION_KEY = 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
const errors = [];
const fail = (message) => errors.push(message);

// Guides live in content/<lang>/<section>/NN-slug.md; "file" below is "<section>/NN-slug.md".
const read = (lang, file) => fs.readFileSync(path.join(root, 'content', lang, file), 'utf8');
const listGuides = (lang) =>
  fs.readdirSync(path.join(root, 'content', lang), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      fs.readdirSync(path.join(root, 'content', lang, dir.name))
        .filter((f) => /^\d+-.+\.md$/.test(f))
        .map((f) => `${dir.name}/${f}`)
    )
    .sort();
const files = Object.fromEntries(languages.map((lang) => [lang, listGuides(lang)]));

// 1. Same set of guides in every language.
for (const lang of languages) {
  if (files[lang].join() !== files.en.join()) fail(`content/${lang} has different guide files than content/en`);
}
const slugOf = (f) => f.split('/').pop().replace(/^\d+-/, '').replace(/\.md$/, '');
const slugs = new Set(files.en.map(slugOf));
if (slugs.size !== files.en.length) fail('guide slugs must be unique across sections');

// 1b. No mentions of the retired v0.5 protocol.
for (const lang of languages) {
  for (const file of files[lang]) {
    if (/v0\.5|SetEcom|SignVersion|\bv05\b/.test(read(lang, file))) fail(`content/${lang}/${file}: mentions the retired v0.5 protocol`);
  }
}

// 1c. Facts confirmed by Paynet that must not regress.
for (const lang of languages) {
  for (const file of files[lang]) {
    const text = read(lang, file);
    if (/sorted alphabetically by full name|отсортированные по алфавиту по полному имени|sortate alfabetic după numele complet/.test(text)) fail(`content/${lang}/${file}: notification fields must not be described as sorted alphabetically (Eventid comes before EventType)`);
    if (/up to 3 times|до 3 раз|până la 3 ori/.test(text)) fail(`content/${lang}/${file}: notifications are retried more than 3 times (7 attempts observed)`);
    if (/description of all `status` values will be published later|описание всех значений `status` будет опубликовано позже|descrierea tuturor valorilor `status` va fi publicată/.test(text)) fail(`content/${lang}/${file}: status values are confirmed, remove the draft note`);
  }
}

// 2. Internal links point to existing guides.
for (const lang of languages) {
  for (const file of files[lang]) {
    for (const [, slug] of read(lang, file).matchAll(/\(#\/guides\/([a-z0-9-]+)\)/g)) {
      if (!slugs.has(slug)) fail(`content/${lang}/${file}: link to unknown guide "${slug}"`);
    }
  }
}

// 3. Signature test vectors.
const codeBlocks = (source, lang) => [...source.matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1].trim());
for (const lang of languages) {
  const file = files[lang].find((f) => f.endsWith('-signatures.md'));
  if (!file) {
    fail(`content/${lang}: signatures guide missing`);
    continue;
  }
  const source = read(lang, file);
  const [checkoutInput, notificationInput] = codeBlocks(source, 'json').map((block) => JSON.parse(block));
  const texts = codeBlocks(source, 'text');
  const expect = (label, value) => {
    if (!texts.includes(value)) fail(`content/${lang}/${file}: ${label} should be "${value}"`);
  };
  expect('checkout RawData', checkoutRawData(checkoutInput));
  expect('checkout Signature', checkoutSignature(checkoutInput, CHECKOUT_KEY));
  expect('notification PreparedString', notificationPreparedString(notificationInput));
  expect('notification Hash', notificationHash(notificationInput, NOTIFICATION_KEY));
}

// 4. Sample code in the guides reproduces the vectors.
const signaturesSource = read('en', files.en.find((f) => f.endsWith('-signatures.md')));
const [checkoutInput, notificationInput] = codeBlocks(signaturesSource, 'json').map((block) => JSON.parse(block));
const expectedCheckout = checkoutSignature(checkoutInput, CHECKOUT_KEY);
const expectedNotification = notificationHash(notificationInput, NOTIFICATION_KEY);

for (const lang of languages) {
  const checkoutFile = files[lang].find((f) => f.endsWith('-hosted-checkout.md'));
  const sample = codeBlocks(read(lang, checkoutFile), 'javascript').find((code) => code.includes('function checkoutSignature'));
  if (!sample) {
    fail(`content/${lang}/${checkoutFile}: Node.js checkoutSignature sample not found`);
    continue;
  }
  const tmp = path.join(os.tmpdir(), `paynet-sample-${lang}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, sample);
  const mod = await import(pathToFileURL(tmp).href);
  const actual = mod.checkoutSignature(checkoutInput, CHECKOUT_KEY);
  if (actual !== expectedCheckout) fail(`content/${lang}/${checkoutFile}: Node.js sample gives ${actual}, expected ${expectedCheckout}`);
  fs.rmSync(tmp);

  // HTML form example must carry the signature that matches its own fields.
  const html = codeBlocks(read(lang, checkoutFile), 'html')[0] || '';
  const fields = Object.fromEntries(
    [...html.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map(([, name, value]) => [name, value.replace(/&amp;/g, '&')])
  );
  const { Signature, ...signedFields } = fields;
  if (Signature !== checkoutSignature(signedFields, CHECKOUT_KEY)) fail(`content/${lang}/${checkoutFile}: HTML form Signature does not match its fields`);

  const notificationFile = files[lang].find((f) => f.endsWith('-notifications.md'));
  const notificationDoc = read(lang, notificationFile);
  if (!notificationDoc.includes(`Hash: ${expectedNotification}`)) fail(`content/${lang}/${notificationFile}: example Hash header should be ${expectedNotification}`);
}

// 4b. Every JavaScript sample must at least parse.
const { execFileSync } = await import('node:child_process');
for (const lang of languages) {
  for (const file of files[lang]) {
    codeBlocks(read(lang, file), 'javascript').forEach((code, index) => {
      const tmp = path.join(os.tmpdir(), `paynet-syntax-${lang}-${index}-${process.pid}.mjs`);
      fs.writeFileSync(tmp, code);
      try {
        execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
      } catch (error) {
        fail(`content/${lang}/${file}: JavaScript sample #${index + 1} does not parse: ${String(error.stderr).split('\n').find((l) => l.includes('Error')) || ''}`);
      }
      fs.rmSync(tmp);
    });
  }
}

// 4c. The complete notification handlers: run the Node.js one against mocked Paynet/API/storage, lint the PHP one.
for (const lang of languages) {
  const notificationFile = files[lang].find((f) => f.endsWith('-notifications.md'));
  const doc = read(lang, notificationFile);
  const nodeHandler = codeBlocks(doc, 'javascript').find((code) => code.includes('export function createPaynetHandler'));
  if (!nodeHandler) {
    fail(`content/${lang}/${notificationFile}: complete Node.js handler not found`);
  } else {
    const tmp = path.join(os.tmpdir(), `paynet-handler-${lang}-${process.pid}.mjs`);
    fs.writeFileSync(tmp, nodeHandler);
    const { createPaynetHandler } = await import(pathToFileURL(tmp).href);
    fs.rmSync(tmp);

    const notification = { ...notificationInput, Payment: { ...notificationInput.Payment, PaidAmount: notificationInput.Payment.Amount, CardLinkHash: null } };
    const apiPayment = (overrides = {}) => ({
      paymentId: notification.Payment.Id, status: 4, cardLinkHash: null, customer: { code: 'C-1' },
      amount: { amount: notification.Payment.Amount, paidAmount: notification.Payment.Amount }, ...overrides,
    });
    const makeDb = () => {
      const seen = new Set();
      const calls = { paid: 0, review: [] };
      return {
        calls,
        saveNotificationOnce: async (id) => (seen.has(id) ? false : (seen.add(id), true)),
        findOrder: async () => ({ amount: notification.Payment.Amount, customerCode: 'C-1', promotionAgreed: false }),
        markPaid: async () => { calls.paid += 1; },
        saveCard: async () => {},
        sendToReview: async (order, problems) => { calls.review.push(problems.join(',')); },
      };
    };
    const run = async (apiResponse, body = notification, hash = expectedNotification, db = makeDb()) => {
      const handle = createPaynetHandler({
        secret: NOTIFICATION_KEY, apiUrl: 'https://ecom-api-test.paynet.md', getToken: async () => 't', db,
        fetch: async () => ({ ok: true, status: 200, json: async () => apiResponse }),
      });
      const result = await handle(JSON.stringify(body), hash);
      await result.processing;
      return { result, db, handle };
    };

    const ok = await run(apiPayment());
    if (ok.result.status !== 200 || ok.db.calls.paid !== 1) fail(`content/${lang}/${notificationFile}: handler must answer 200 and fulfil a valid notification once`);
    const again = await ok.handle(JSON.stringify(notification), expectedNotification);
    await again.processing;
    if (again.status !== 200 || ok.db.calls.paid !== 1) fail(`content/${lang}/${notificationFile}: handler must answer 200 to a repeated notification without fulfilling it again`);
    const bad = await run(apiPayment(), notification, 'AAAAAAAAAAAAAAAAAAAAAA==');
    if (bad.result.status !== 400 || bad.db.calls.paid !== 0) fail(`content/${lang}/${notificationFile}: handler must reject a wrong Hash with 400`);
    const tampered = await run(apiPayment({ amount: { amount: notification.Payment.Amount, paidAmount: 1 } }));
    if (tampered.db.calls.paid !== 0 || !tampered.db.calls.review.join().includes('PaidAmount')) fail(`content/${lang}/${notificationFile}: handler must send a PaidAmount mismatch to review`);
  }

  const phpHandler = (doc.match(/```php\n([\s\S]*?)```/g) || []).map((b) => b.slice(7, -3)).find((code) => code.includes('function paynetHandleRequest'));
  if (!phpHandler) {
    fail(`content/${lang}/${notificationFile}: complete PHP handler not found`);
  } else {
    try {
      const tmp = path.join(os.tmpdir(), `paynet-handler-${lang}-${process.pid}.php`);
      fs.writeFileSync(tmp, phpHandler);
      try {
        execFileSync('php', ['-l', tmp], { stdio: 'pipe' });
      } catch (error) {
        if (error.code !== 'ENOENT') fail(`content/${lang}/${notificationFile}: PHP handler has a syntax error: ${String(error.stdout || error.stderr).trim()}`);
      }
      fs.rmSync(tmp);
    } catch (error) {
      fail(`content/${lang}/${notificationFile}: PHP check failed: ${error.message}`);
    }
  }
}

// 5. Notification code samples must use the real key spelling (Id / ExternalId).
for (const lang of languages) {
  for (const file of files[lang]) {
    const code = [...read(lang, file).matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
    if (/\bExternalID\b|\.ID\b|\['ID'\]|"ID"\s*:|get\("ID"\)/.test(code)) fail(`content/${lang}/${file}: code uses ID/ExternalID instead of Id/ExternalId`);
  }
}

if (errors.length) {
  console.error('✗ Documentation checks failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`✓ Documentation checks passed (${languages.length} languages, ${files.en.length} guides, signature vectors verified)`);
