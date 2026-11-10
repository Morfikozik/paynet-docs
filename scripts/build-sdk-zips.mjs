// Packs the SDKs and the example shop into downloadable archives in public/sdk/ (SDK: paynet-ecom-sdk-{node,php}-<version>.zip).
// Each archive contains one folder "paynet-ecom-sdk" (code, README, LICENSE, offline tests).
// The live-check scripts (e2e/) are not included.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, 'sdk/node/package.json'), 'utf8')).version;
const outDir = path.join(root, 'public', 'sdk');
fs.mkdirSync(outDir, { recursive: true });

const packages = {
  node: ['src', 'test', 'package.json', 'README.md', 'LICENSE'],
  php: ['src', 'tests', 'autoload.php', 'composer.json', 'README.md', 'LICENSE'],
};

for (const [lang, entries] of Object.entries(packages)) {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), `paynet-sdk-${lang}-`));
  const target = path.join(stage, 'paynet-ecom-sdk');
  fs.mkdirSync(target);
  for (const entry of entries) fs.cpSync(path.join(root, 'sdk', lang, entry), path.join(target, entry), { recursive: true });
  const zip = path.join(outDir, `paynet-ecom-sdk-${lang}-${version}.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', zip, 'paynet-ecom-sdk'], { cwd: stage });
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`${path.relative(root, zip)} (${fs.statSync(zip).size} bytes)`);
}

// Example shop (Node.js): public/sdk/paynet-example-shop-node.zip, one folder "node-shop".
{
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'paynet-shop-'));
  fs.cpSync(path.join(root, 'examples', 'node-shop'), path.join(stage, 'node-shop'), {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|data|\.orders\.json)$/.test(src),
  });
  const zip = path.join(outDir, 'paynet-example-shop-node.zip');
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', zip, 'node-shop'], { cwd: stage });
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`${path.relative(root, zip)} (${fs.statSync(zip).size} bytes)`);
}
