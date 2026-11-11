#!/usr/bin/env node
// Guards the documentation against silent mistakes. Fails the build if:
//  - the signature test vectors published in any language do not match the reference algorithm;
//  - the Node.js sample code in the guides produces a different signature;
//  - a guide exists in one language but not in the others;
//  - a guide links to a guide page that does not exist.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
    if (/up to 3 times|до 3 раз|până la 3 ori/.test(text)) fail(`content/${lang}/${file}: notifications are retried 9 times within about 25 minutes, not 3`);
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
  const [checkoutInput, notificationInput, specialInput] = codeBlocks(source, 'json').map((block) => JSON.parse(block));
  const texts = codeBlocks(source, 'text');
  const expect = (label, value) => {
    if (!texts.includes(value)) fail(`content/${lang}/${file}: ${label} should be "${value}"`);
  };
  expect('checkout RawData', checkoutRawData(checkoutInput));
  expect('checkout Signature', checkoutSignature(checkoutInput, CHECKOUT_KEY));
  expect('notification PreparedString', notificationPreparedString(notificationInput));
  expect('notification Hash', notificationHash(notificationInput, NOTIFICATION_KEY));
  // Vector 3 (special characters) was accepted by the real test environment on 11.11.2026.
  if (!specialInput) fail(`content/${lang}/${file}: test vector 3 (special characters) missing`);
  else {
    expect('vector 3 RawData', checkoutRawData(specialInput));
    expect('vector 3 Signature', checkoutSignature(specialInput, CHECKOUT_KEY));
    if (checkoutSignature(specialInput, CHECKOUT_KEY) !== 'fm47qWzVzqPQQ+huHgWVZw==') fail('vector 3: reference algorithm no longer gives the signature accepted by the test environment');
  }
}

// 4. Sample code in the guides reproduces the vectors.
const signaturesSource = read('en', files.en.find((f) => f.endsWith('-signatures.md')));
const [checkoutInput, notificationInput, specialInput] = codeBlocks(signaturesSource, 'json').map((block) => JSON.parse(block));
const expectedCheckout = checkoutSignature(checkoutInput, CHECKOUT_KEY);
const expectedSpecial = checkoutSignature(specialInput, CHECKOUT_KEY);
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
  const actualSpecial = mod.checkoutSignature(specialInput, CHECKOUT_KEY);
  if (actualSpecial !== expectedSpecial) fail(`content/${lang}/${checkoutFile}: Node.js sample gives ${actualSpecial} for vector 3, expected ${expectedSpecial}`);
  fs.rmSync(tmp);

  // PHP and Python samples must reproduce vectors 1 and 3 too (skipped if the interpreter is missing).
  const runSample = (cmd, code, label) => {
    const file = path.join(os.tmpdir(), `paynet-sample-${lang}-${process.pid}.${cmd === 'php' ? 'php' : 'py'}`);
    fs.writeFileSync(file, code);
    try {
      const out = execFileSync(cmd, [file], { encoding: 'utf8' }).trim().split('\n');
      if (out[0] !== expectedCheckout || out[1] !== expectedSpecial) fail(`${label}: gives ${out.join(' / ')}, expected ${expectedCheckout} / ${expectedSpecial}`);
    } catch (e) {
      if (e.code === 'ENOENT') console.log(`  (skipped: ${cmd} not installed)`);
      else fail(`${label}: ${String(e.message).split('\n')[0]}`);
    } finally { fs.rmSync(file, { force: true }); }
  };
  const phpSample = (read(lang, checkoutFile).match(/```php\n([\s\S]*?)```/) || [])[1];
  if (!phpSample || !phpSample.includes('function checkoutSignature')) fail(`content/${lang}/${checkoutFile}: PHP checkoutSignature sample not found`);
  else runSample('php', phpSample + `\necho checkoutSignature(json_decode(${JSON.stringify(JSON.stringify(checkoutInput))}, true), '${CHECKOUT_KEY}'), "\\n", checkoutSignature(json_decode(${JSON.stringify(JSON.stringify(specialInput))}, true), '${CHECKOUT_KEY}'), "\\n";\n`, `content/${lang}/${checkoutFile}: PHP sample`);
  const pySample = codeBlocks(read(lang, files[lang].find((f) => f.endsWith('-signatures.md'))), 'python')[0];
  if (!pySample) fail(`content/${lang}: Python signature sample not found`);
  else runSample('python3', pySample + `\nimport json\nprint(checkout_signature(json.loads(${JSON.stringify(JSON.stringify(checkoutInput))}), '${CHECKOUT_KEY}'))\nprint(checkout_signature(json.loads(${JSON.stringify(JSON.stringify(specialInput))}), '${CHECKOUT_KEY}'))\n`, `content/${lang}: Python sample in signatures`);

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

// 4d. The SDK guide calls only methods / exports that exist in the SDKs.
{
  const sdk = await import(path.join(root, 'sdk', 'node', 'src', 'index.js'));
  const nodeMethods = new Set(Object.getOwnPropertyNames(sdk.PaynetClient.prototype));
  const phpSources = fs.readdirSync(path.join(root, 'sdk', 'php', 'src')).map((f) => fs.readFileSync(path.join(root, 'sdk', 'php', 'src', f), 'utf8')).join('\n');
  for (const lang of languages) {
    const file = files[lang].find((f) => f.endsWith('-sdk.md'));
    if (!file) { fail(`content/${lang}: SDK guide not found`); continue; }
    const doc = read(lang, file);
    for (const code of codeBlocks(doc, 'javascript')) {
      for (const [, name] of code.matchAll(/paynet\.(\w+)\(/g)) if (!nodeMethods.has(name)) fail(`content/${lang}/${file}: Node.js example calls paynet.${name}() which the SDK does not have`);
      for (const [, names] of code.matchAll(/import \{([^}]+)\} from '\.\/paynet-ecom-sdk\/src\/index\.js'/g))
        for (const name of names.split(',').map((n) => n.trim()).filter(Boolean)) if (!(name in sdk)) fail(`content/${lang}/${file}: Node.js example imports ${name} which the SDK does not export`);
    }
    for (const code of (doc.match(/```php\n([\s\S]*?)```/g) || [])) {
      for (const [, name] of code.matchAll(/\$paynet->(\w+)\(/g)) if (!new RegExp(`public function ${name}\\(`).test(phpSources)) fail(`content/${lang}/${file}: PHP example calls $paynet->${name}() which the SDK does not have`);
      for (const [, cls, name] of code.matchAll(/\b(\w+)::(\w+)\(/g)) if (!new RegExp(`class ${cls}\\b[\\s\\S]*public static function ${name}\\(`).test(phpSources)) fail(`content/${lang}/${file}: PHP example calls ${cls}::${name}() which the SDK does not have`);
    }
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

// 4d. The example shop: its notification handler is the documented one, and every file parses.
{
  const exampleDir = path.join(root, 'examples', 'node-shop');
  const docHandler = codeBlocks(read('en', files.en.find((f) => f.endsWith('-notifications.md'))), 'javascript').find((code) => code.includes('export function createPaynetHandler'));
  const exampleHandler = fs.readFileSync(path.join(exampleDir, 'paynet-notifications.mjs'), 'utf8').trim();
  if (docHandler && docHandler.trim() !== exampleHandler) fail('examples/node-shop/paynet-notifications.mjs differs from the handler in the Notifications guide');
  for (const file of ['server.mjs', 'paynet-client.mjs', 'paynet-notifications.mjs', 'store.mjs', 'tools/send-test-notification.mjs']) {
    try {
      execFileSync(process.execPath, ['--check', path.join(exampleDir, file)], { stdio: 'pipe' });
    } catch (error) {
      fail(`examples/node-shop/${file} does not parse: ${String(error.stderr).split('\n').find((l) => l.includes('Error')) || ''}`);
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
