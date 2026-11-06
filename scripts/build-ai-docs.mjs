#!/usr/bin/env node
// Builds the machine-readable documentation from the single source of truth:
//   content/en/*.md            → guides
//   src/openapi/openapi.json   → API reference
//   src/data/api_paths.json    → endpoint names, descriptions and response examples
//
// Output (copied by Vite into the site root):
//   public/llms.txt            short index for AI assistants (llmstxt.org format)
//   public/llms-full.txt       the whole documentation in one Markdown file
//   public/docs/<slug>.md      every guide + api-reference.md as separate files
//   public/openapi.json        the OpenAPI specification
//
// Usage: node scripts/build-ai-docs.mjs   (SITE_URL=https://… for absolute links)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content', 'en');
const publicDir = path.join(root, 'public');
const docsOut = path.join(publicDir, 'docs');
const siteUrl = (process.env.SITE_URL || '').replace(/\/?$/, process.env.SITE_URL ? '/' : '');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'src/openapi/openapi.json'), 'utf8'));
const apiPaths = JSON.parse(fs.readFileSync(path.join(root, 'src/data/api_paths.json'), 'utf8'));

// ---------- guides ----------
const guides = fs
  .readdirSync(contentDir)
  .filter((file) => /^\d+-.+\.md$/.test(file))
  .sort()
  .map((file) => {
    const slug = file.replace(/^\d+-/, '').replace(/\.md$/, '');
    const source = fs.readFileSync(path.join(contentDir, file), 'utf8');
    const title = (source.match(/^#\s+(.+)$/m) || [null, slug])[1].trim();
    const summary = (source.split('\n').find((line) => line.trim() && !line.startsWith('#')) || '').trim();
    return { slug, title, summary, source };
  });

/** Portal-internal links (#/guides/x) become links to the Markdown files. */
const rewriteLinks = (markdown, mode) =>
  markdown.replace(/\]\(#\/guides\/([a-z0-9-]+)\)/g, (_, slug) =>
    mode === 'full' ? `](#${slug})` : `](${siteUrl}docs/${slug}.md)`
  );

// ---------- API reference from OpenAPI ----------
const resolveRef = (ref) => ref.replace('#/', '').split('/').reduce((node, key) => node?.[key], spec);

const englishInfo = (apiPath, method) => {
  for (const group of apiPaths.paths) {
    const methods = group[apiPath];
    if (!methods) continue;
    const entry = methods.find((m) => m.method.toLowerCase() === method);
    if (!entry) continue;
    const en = entry.info.find((info) => info.language === 'en');
    return { name: en?.name, description: en?.description, responses: entry.responses || {} };
  }
  return { responses: {} };
};

const schemaTable = (schema, prefix = '') => {
  if (!schema) return [];
  if (schema.$ref) return schemaTable(resolveRef(schema.$ref), prefix);
  const rows = [];
  const required = new Set(schema.required || []);
  for (const [name, prop] of Object.entries(schema.properties || {})) {
    const resolved = prop.$ref ? resolveRef(prop.$ref) : prop;
    const type = resolved.type === 'array' ? 'array' : resolved.type || 'object';
    const enumText = resolved.enum ? ` Values: ${resolved.enum.map((v) => `\`${v}\``).join(', ')}.` : '';
    rows.push(`| \`${prefix}${name}\` | ${type}${resolved.format ? ` (${resolved.format})` : ''} | ${required.has(name) ? 'yes' : 'no'} | ${(resolved.description || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|')}${enumText} |`);
    if (resolved.type === 'object' || resolved.properties) rows.push(...schemaTable(resolved, `${prefix}${name}.`));
    if (resolved.type === 'array' && resolved.items) rows.push(...schemaTable(resolved.items, `${prefix}${name}[].`));
  }
  return rows;
};

const findBodySchema = (example) => {
  // The spec has examples without direct schema refs; match by property names.
  const keys = Object.keys(example || {}).map((k) => k.toLowerCase());
  let best = null;
  let bestScore = 0;
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    const props = Object.keys(schema.properties || {}).map((k) => k.toLowerCase());
    const score = keys.filter((k) => props.includes(k)).length / Math.max(keys.length, 1);
    if (score > bestScore) {
      best = { name, schema };
      bestScore = score;
    }
  }
  return bestScore >= 0.6 ? best : null;
};

const json = (value) => '```json\n' + JSON.stringify(value, null, 2) + '\n```';

const apiReference = () => {
  const base = spec.servers?.[0]?.url || '';
  const out = [
    '# API reference (server-to-server)',
    '',
    `Base URL (test): \`${base}\`. All endpoints except \`/auth\` require \`Authorization: Bearer <access_token>\`.`,
    '',
  ];
  for (const [apiPath, ops] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(ops)) {
      const info = englishInfo(apiPath, method);
      out.push(`## ${method.toUpperCase()} ${apiPath} — ${(info.name || op.summary || '').replace(/\.$/, '')}`, '');
      if (info.description || op.description) out.push(info.description || op.description, '');
      if (op.parameters?.length) {
        out.push('| Parameter | In | Type | Required | Description |', '|---|---|---|---|---|');
        for (const p of op.parameters) {
          out.push(`| \`${p.name}\` | ${p.in} | ${p.schema?.type || ''}${p.schema?.format ? ` (${p.schema.format})` : ''} | ${p.required ? 'yes' : 'no'} | ${(p.description || '').replace(/\|/g, '\\|')} |`);
        }
        out.push('');
      }
      const body = op.requestBody?.content?.['application/json'];
      if (body?.example) {
        const match = findBodySchema(body.example);
        if (match) {
          out.push(`Request body (\`${match.name}\`):`, '', '| Field | Type | Required | Description |', '|---|---|---|---|', ...schemaTable(match.schema), '');
        }
        out.push('Request example:', '', json(body.example), '');
      }
      for (const [code, response] of Object.entries(info.responses)) {
        const example = response.content?.object;
        out.push(`Response \`${code}\`${response.description ? ` — ${response.description}` : ''}:`, '');
        if (example && !(typeof example === 'object' && Object.keys(example).length === 0)) out.push(json(example), '');
      }
    }
  }
  out.push('## Schemas', '');
  for (const [name, schema] of Object.entries(spec.components?.schemas || {})) {
    out.push(`### ${name}`, '');
    if (schema.description) out.push(schema.description, '');
    out.push('| Field | Type | Required | Description |', '|---|---|---|---|', ...schemaTable(schema), '');
  }
  return out.join('\n');
};

// ---------- outputs ----------
const rules = `## Rules for AI assistants

- Use only this document as the source of truth. Do not invent endpoints, fields or status values; list missing information as open questions.
- Test API base URL: \`https://ecom-api-test.paynet.md\`. Hosted checkout test URL: \`https://test.paynet.md/ecom/checkout\`.
- Authenticate with \`POST /auth\` (JSON \`grantType\`, \`username\`, \`password\`), then send \`Authorization: Bearer <access_token>\`.
- \`Order\` must be unique for every payment. \`ExpiryDate\` must be in the future, format \`YYYY-MM-DDTHH:mm:ss\`.
- Amounts are integers in minor units (100 = 1.00 MDL). \`Currency\` is ISO 4217 numeric (\`498\` = MDL).
- Signatures: \`Base64(MD5(stringToSign + secretKey))\` over UTF-8; Base64 of the raw 16-byte digest. Reproduce the test vectors in "Signatures" in unit tests.
- The hosted checkout secret key and the notification secret key are different. Secrets never go to browser code.
- Never treat the redirect to \`LinkUrlSuccess\` as proof of payment. Use a verified notification or the status API.
- Sections marked **Draft** are not confirmed by Paynet yet.`;

const reference = apiReference();
const intro = guides[0];

const full = [
  '# Paynet E-commerce API — complete documentation',
  '',
  '> Single-file documentation for developers and AI assistants. Generated from the same sources as the documentation portal.',
  '',
  rules,
  '',
  '## Contents',
  '',
  ...guides.map((g) => `- [${g.title}](#${g.slug})`),
  '- [API reference](#api-reference)',
  '',
  ...guides.flatMap((g) => [
    '---',
    '',
    `<a id="${g.slug}"></a>`,
    '',
    // demote headings by one level so the file has a single H1
    rewriteLinks(g.source, 'full').replace(/^(#{1,5}) /gm, '#$1 '),
    '',
  ]),
  '---',
  '',
  '<a id="api-reference"></a>',
  '',
  reference.replace(/^(#{1,5}) /gm, '#$1 '),
  '',
].join('\n');

const index = [
  '# Paynet E-commerce API',
  '',
  '> Accept card, Paynet wallet and MIA payments on a Paynet-hosted payment page (Moldova). Server-to-server REST API with Bearer tokens, a signed hosted-checkout form, and signed webhook notifications.',
  '',
  `Start with ${siteUrl}llms-full.txt — it contains everything below in one file.`,
  '',
  rules,
  '',
  '## Guides',
  '',
  ...guides.map((g) => `- [${g.title}](${siteUrl}docs/${g.slug}.md): ${g.summary.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}`),
  '',
  '## API',
  '',
  `- [API reference](${siteUrl}docs/api-reference.md): every server-to-server endpoint with fields and examples`,
  `- [OpenAPI specification](${siteUrl}openapi.json): machine-readable OpenAPI 3 file`,
  '',
  '## Optional',
  '',
  `- [Complete documentation](${siteUrl}llms-full.txt): all guides and the API reference in one file`,
  '',
].join('\n');

fs.mkdirSync(docsOut, { recursive: true });
for (const g of guides) fs.writeFileSync(path.join(docsOut, `${g.slug}.md`), rewriteLinks(g.source, 'file'));
fs.writeFileSync(path.join(docsOut, 'api-reference.md'), reference);
fs.writeFileSync(path.join(publicDir, 'llms.txt'), index);
fs.writeFileSync(path.join(publicDir, 'llms-full.txt'), full);
fs.copyFileSync(path.join(root, 'src/openapi/openapi.json'), path.join(publicDir, 'openapi.json'));

console.log(`✓ AI docs: ${guides.length} guides, llms.txt (${index.length} B), llms-full.txt (${full.length} B)` + (intro ? '' : ''));
