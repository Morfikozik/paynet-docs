// Writes public/robots.txt and public/sitemap.xml for the site address in SITE_URL.
// Run after build-ai-docs.mjs (the sitemap lists the generated llms*.txt and docs/*.md files).
//
// Note: search engines read robots.txt only at the root of a domain. For docs.paynet.md/api/
// the file /api/robots.txt is informational; README-IT asks IT to add the Sitemap line to the root robots.txt.
import fs from 'node:fs';
import path from 'node:path';

const siteUrl = (process.env.SITE_URL || 'https://paynet-business.github.io/paynet-docs/').replace(/\/?$/, '/');
const publicDir = path.join(process.cwd(), 'public');
const today = new Date().toISOString().slice(0, 10);

const urls = [siteUrl];
for (const f of ['llms.txt', 'llms-full.txt', 'llms-ecom.txt', 'openapi.json']) {
  if (fs.existsSync(path.join(publicDir, f))) urls.push(siteUrl + f);
}
const walk = (dir, rel) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), r);
    else if (entry.name.endsWith('.md')) urls.push(`${siteUrl}docs/${r}`);
  }
};
const docsDir = path.join(publicDir, 'docs');
if (fs.existsSync(docsDir)) walk(docsDir, '');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => `  <url><loc>${escape(u)}</loc><lastmod>${today}</lastmod></url>`),
  '</urlset>',
  '',
].join('\n');
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

const robots = [
  '# Paynet Developer Documentation',
  '# All crawlers and AI assistants are welcome.',
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${siteUrl}sitemap.xml`,
  '',
].join('\n');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

console.log(`✓ robots.txt and sitemap.xml (${urls.length} URLs) for ${siteUrl}`);
