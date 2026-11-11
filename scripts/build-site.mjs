// Builds the whole portal for one site address. The same command is used for both copies:
//
//   node scripts/build-site.mjs --site-url https://paynet-business.github.io/paynet-docs/ --out dist
//   node scripts/build-site.mjs --site-url https://docs.paynet.md/api/ --out dist-it --strict
//
// Steps: AI files (llms*.txt, docs/*.md, mocks) → Postman → SDK and example-shop archives → robots.txt + sitemap.xml
// → vite build into --out → address check of the result (check-urls; --strict also forbids the GitHub Pages copy).
// Run `npm ci` and `node scripts/check-docs.mjs` before it. Requires Node.js 22 and the `zip` command.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const siteUrl = value('--site-url');
const out = value('--out') || 'dist';
const strict = args.includes('--strict');
if (!siteUrl || !/^https:\/\/.+/.test(siteUrl)) {
  console.error('Usage: node scripts/build-site.mjs --site-url https://…/ --out <dir> [--strict]');
  process.exit(1);
}
const SITE_URL = siteUrl.replace(/\/?$/, '/');
const env = { ...process.env, SITE_URL };
const run = (cmd, cmdArgs, opts = {}) => {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
  execFileSync(cmd, cmdArgs, { stdio: 'inherit', env, ...opts });
};

console.log(`Building the portal for ${SITE_URL} into ${out}${strict ? ' (strict address check)' : ''}`);
run(process.execPath, ['scripts/build-ai-docs.mjs']);
run(process.execPath, ['scripts/build-postman.mjs']);
run(process.execPath, ['scripts/build-sdk-zips.mjs']);
run(process.execPath, ['scripts/build-sitemap.mjs']);
run('npx', ['vite', 'build', '--outDir', out, '--emptyOutDir'], { shell: process.platform === 'win32' });
run(process.execPath, ['scripts/check-urls.mjs', out, ...(strict ? ['--forbid-pages'] : [])]);
console.log(`\n✓ ${out} is ready for ${SITE_URL}`);
