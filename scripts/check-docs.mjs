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
const languages = ['en', 'ru', 'ro'];
const CHECKOUT_KEY = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
const NOTIFICATION_KEY = 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
const errors = [];
const fail = (message) => errors.push(message);

const read = (lang, file) => fs.readFileSync(path.join(root, 'content', lang, file), 'utf8');
const files = Object.fromEntries(
  languages.map((lang) => [lang, fs.readdirSync(path.join(root, 'content', lang)).filter((f) => /^\d+-.+\.md$/.test(f)).sort()])
);

// 1. Same set of guides in every language.
for (const lang of languages) {
  if (files[lang].join() !== files.en.join()) fail(`content/${lang} has different guide files than content/en`);
}
const slugs = new Set(files.en.map((f) => f.replace(/^\d+-/, '').replace(/\.md$/, '')));

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

if (errors.length) {
  console.error('✗ Documentation checks failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log(`✓ Documentation checks passed (${languages.length} languages, ${files.en.length} guides, signature vectors verified)`);
