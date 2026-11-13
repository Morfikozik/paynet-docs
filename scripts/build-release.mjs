// Packs the docs.paynet.md/api/ build into an archive for Paynet IT and writes README-IT.txt next to it.
//
//   node scripts/build-release.mjs --dir dist-it --out release
//
// Output: release/paynet-docs-api-v<version>-<commit>.zip (contents of --dir at the archive root) + release/README-IT.txt.
// The version is the top entry of the changelog (content/en/common/06-changelog.md); the commit comes from GITHUB_SHA or git.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const value = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const dir = path.resolve(value('--dir', 'dist-it'));
const out = path.resolve(value('--out', 'release'));
const SITE = 'https://docs.paynet.md/api/';
const REPO = 'https://github.com/paynet-business/paynet-docs';

if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`build-release: ${dir}/index.html not found — run build-site.mjs first`); process.exit(1); }

const version = (fs.readFileSync('content/en/common/06-changelog.md', 'utf8').match(/^## Documentation v([\d.]+)/m) || [])[1];
if (!version) { console.error('build-release: no "## Documentation vX.Y" entry in the changelog'); process.exit(1); }
const commit = (process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim();
const short = commit.slice(0, 7);
const ru = fs.readFileSync('content/ru/common/06-changelog.md', 'utf8');
const changes = (ru.match(/^## [^\n]*v[\d.]+[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m) || [])[1]?.trim() || '(см. журнал изменений на портале)';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const name = `paynet-docs-api-v${version}-${short}`;
const zip = path.join(out, `${name}.zip`);
execFileSync('zip', ['-qr', '-X', zip, '.'], { cwd: dir });
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
const sizeMb = (fs.statSync(zip).size / 1024 / 1024).toFixed(1);
const count = execFileSync('zipinfo', ['-1', zip], { encoding: 'utf8' }).trim().split('\n').filter((l) => !l.endsWith('/')).length;

const readme = `ПОРТАЛ ДОКУМЕНТАЦИИ PAYNET API — ИНСТРУКЦИЯ ДЛЯ ИТ
===================================================

Версия:   v${version}
Архив:    ${name}.zip  (${sizeMb} МБ, ${count} файлов)
SHA-256:  ${sha256}
Коммит:   ${commit}
Исходный код этой версии: ${REPO}/tree/${commit}
Собран:   ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
Адрес:    ${SITE}

Что изменилось в этой версии
----------------------------
${changes}

1. РАЗМЕЩЕНИЕ
-------------
1) Распакуйте архив в папку, которая отдаётся по адресу ${SITE}
   (в корне архива лежит index.html — он должен открываться по адресу /api/).
2) Папку /psp/ (старая документация) НЕ трогайте — на неё ведёт кнопка
   «Previous portal version» внизу портала.
3) Перенаправлений (rewrite) не нужно: портал — статические файлы,
   страницы открываются через # в адресе (например /api/#/guides/signatures).

2. НАСТРОЙКИ ВЕБ-СЕРВЕРА
------------------------
- Только HTTPS (HTTP → редирект на HTTPS).
- Типы файлов (Content-Type):
    .html → text/html; charset=utf-8
    .js   → text/javascript; charset=utf-8
    .css  → text/css; charset=utf-8
    .md   → text/markdown; charset=utf-8
    .txt  → text/plain; charset=utf-8
    .json → application/json; charset=utf-8
    .xml  → application/xml; charset=utf-8
    .zip  → application/zip
    .svg  → image/svg+xml
  Важно: .md, .txt и .json должны открываться в браузере как текст, а не скачиваться
  и не отдаваться как text/html. Кодировка UTF-8 обязательна (кириллица, румынские буквы).
- Сжатие gzip или brotli для .html, .js, .css, .md, .txt, .json, .xml, .svg.
- Кэш: index.html — без кэша (Cache-Control: no-cache); папка assets/ — можно надолго
  (имена файлов меняются при каждой сборке).
- Не закрывайте от роботов и ИИ-ассистентов: /api/llms.txt, /api/llms-full.txt,
  /api/llms-ecom.txt, /api/docs/, /api/openapi.json, /api/sitemap.xml.
- Поисковики читают robots.txt только в корне домена. Добавьте в https://docs.paynet.md/robots.txt строку:
    Sitemap: ${SITE}sitemap.xml
  и убедитесь, что там нет запрета на /api/.

3. ПРОВЕРКА ПОСЛЕ РАЗМЕЩЕНИЯ
----------------------------
Откройте в браузере:
  ${SITE}                          → портал, внизу «Documentation v3» и «Previous portal version»
  ${SITE}#/guides/signatures       → раздел «Signatures» (переключатель языка EN/RU/RO вверху)
  ${SITE}llms.txt                  → текст, строка «Start with ${SITE}llms-full.txt …»
  ${SITE}openapi.json              → JSON (не скачивается, не HTML)
  ${SITE}docs/signatures.md        → текст Markdown
  ${SITE}sitemap.xml               → XML со списком адресов
  ${SITE}sdk/paynet-ecom-sdk-php-1.0.0.zip → скачивается архив
  Кнопка «Previous portal version» → https://docs.paynet.md/psp/

Проверка заголовков из командной строки (пример):
  curl -sI ${SITE}llms.txt | grep -i -E "content-type|content-encoding"

4. ОТКАТ
--------
Сохраните предыдущую версию папки (или предыдущий архив). Если с новой версией что-то
не так — верните предыдущие файлы на место. Каждая версия собирается целиком,
файлы разных версий не смешивайте (сначала очистите папку, затем распакуйте).

5. СБОРКА СВОИМИ СИЛАМИ (по желанию)
------------------------------------
Архив собирается автоматически из репозитория ${REPO}.
Чтобы собрать ту же версию самостоятельно (Node.js 22, команда zip):
  git clone ${REPO} && cd paynet-docs && git checkout ${commit}
  npm ci
  node scripts/check-docs.mjs
  node scripts/build-site.mjs --site-url ${SITE} --out dist-it --strict
Результат — папка dist-it (то же содержимое, что в архиве).

6. СБОРКА В GITLAB И DOCKER
--------------------------
В репозитории есть всё для сборки в GitLab и запуска в контейнере:
  .gitlab-ci.yml        — задачи GitLab CI: docs-build (проверки + сборка в dist), docs-docker (образ, запуск вручную)
  Dockerfile            — nginx + готовая папка dist, сайт по пути /api/ (/ → /api/)
  deploy/nginx.conf     — типы файлов (UTF-8), gzip, кэш
GitLab подхватывает .gitlab-ci.yml из корня проекта сам — ничего подключать не нужно.
Адрес сборки — переменная DOCS_SITE_URL (по умолчанию ${SITE}; для тестовой площадки задайте свой).
Раннеру нужен интернет (npm, репозитории Debian для утилиты zip) или внутренние зеркала.
Вручную:
  node scripts/build-site.mjs --site-url ${SITE} --out dist --strict
  docker build -t paynet-docs .
  docker run -d -p 8080:80 paynet-docs      → http://<сервер>:8080/api/
Перед контейнером — ваш прокси с HTTPS для https://docs.paynet.md/api/ (на путь /api/ контейнера).

Вопросы по содержанию документации — владельцу проекта (Paynet, B2B-продукты).
`;
fs.writeFileSync(path.join(out, 'README-IT.txt'), readme);
console.log(`✓ ${path.relative(process.cwd(), zip)} (${sizeMb} MB, ${count} files, sha256 ${sha256.slice(0, 12)}…) + README-IT.txt`);
