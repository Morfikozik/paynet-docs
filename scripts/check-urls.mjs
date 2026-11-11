// Fails the build if an old or wrong site address is left anywhere.
//
// Usage:
//   node scripts/check-urls.mjs                      — check the sources (whole repository)
//   node scripts/check-urls.mjs dist                 — check the built site, including files inside .zip archives
//   node scripts/check-urls.mjs dist --forbid-pages  — also forbid the GitHub Pages copy
//                                                      (for the archive given to Paynet IT: only docs.paynet.md/api/)
//
// Always forbidden: the personal account the repository was moved from (site and GitHub links).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const forbidPages = args.includes('--forbid-pages');
const root = args.find((a) => !a.startsWith('--')) || '.';

const rules = [
  { name: 'old personal site (morfikozik.github.io)', re: /morfikozik\.github\.io/i },
  { name: 'old personal GitHub account (github.com/Morfikozik)', re: /github\.com\/morfikozik/i },
];
if (forbidPages) rules.push({ name: 'GitHub Pages copy (paynet-business.github.io)', re: /paynet-business\.github\.io/i });

const SKIP_DIRS = new Set(['.git', 'node_modules']);
// In the source check these are outputs of the build (checked separately with "dist").
if (root === '.') ['dist', 'public/docs', 'public/sdk', 'public/postman'].forEach((d) => SKIP_DIRS.add(d));
const SELF = path.resolve(process.argv[1]);
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|otf|pdf)$/i;

// Minimal .zip reader (central directory + stored/deflated entries), no dependencies.
const zipEntries = (buf) => {
  const out = [];
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip archive');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('broken zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error(`${name}: unsupported compression method ${method}`);
    out.push({ name, data });
  }
  return out;
};

const problems = [];
let checked = 0;
const scan = (label, text) => {
  checked++;
  const lines = text.split('\n');
  for (const rule of rules) {
    lines.forEach((line, i) => { if (rule.re.test(line)) problems.push(`${label}:${i + 1}: ${rule.name}`); });
  }
};

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative('.', full).split(path.sep).join('/');
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name) && !SKIP_DIRS.has(rel)) walk(full); continue; }
    if (path.resolve(full) === SELF || BINARY.test(entry.name)) continue;
    const buf = fs.readFileSync(full);
    if (/\.zip$/i.test(entry.name)) {
      try {
        for (const e of zipEntries(buf)) if (!BINARY.test(e.name)) scan(`${rel}!${e.name}`, e.data.toString('utf8'));
      } catch (err) { problems.push(`${rel}: cannot read archive (${err.message})`); }
    } else {
      scan(rel, buf.toString('utf8'));
    }
  }
};

if (!fs.existsSync(root)) { console.error(`check-urls: ${root} does not exist`); process.exit(1); }
walk(root);

if (problems.length) {
  console.error(`check-urls: ${problems.length} problem(s) in ${root}:`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`check-urls: OK — ${checked} files checked in ${root}${forbidPages ? ' (GitHub Pages address also forbidden)' : ''}`);
