ПОРТАЛ ДОКУМЕНТАЦИИ PAYNET API — ИНСТРУКЦИЯ ДЛЯ ИТ
===================================================

Версия:   v3.5
Архив:    paynet-docs-api-v3.5-a97e545.zip  (0.9 МБ, 99 файлов)
SHA-256:  c5163d33f2f6646805da4c6268c10d05590dff71af64ea59560d8ac17e21c441
Коммит:   a97e545937e3bea3e4abf01d36efe4b22e512350
Исходный код этой версии: https://github.com/paynet-business/paynet-docs/tree/a97e545937e3bea3e4abf01d36efe4b22e512350
Собран:   2026-11-13 14:38 UTC
Адрес:    https://docs.paynet.md/api/

Что изменилось в этой версии
----------------------------
- **Пример магазина: пошаговый запуск для Windows, macOS и Linux** (найдено при запуске примера «как новичок»): проверка Node.js, `tar -xf` вместо `unzip` (работает в Windows 10/11), почему заказ остаётся `pending` и как отправить тестовое уведомление, таблица «Если что-то не получилось». Страница заказов и страница возврата в магазине теперь показывают готовую команду для отправки уведомления. См. [Пример магазина](#/guides/example-shop).

1. РАЗМЕЩЕНИЕ
-------------
1) Распакуйте архив в папку, которая отдаётся по адресу https://docs.paynet.md/api/
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
    Sitemap: https://docs.paynet.md/api/sitemap.xml
  и убедитесь, что там нет запрета на /api/.

3. ПРОВЕРКА ПОСЛЕ РАЗМЕЩЕНИЯ
----------------------------
Откройте в браузере:
  https://docs.paynet.md/api/                          → портал, внизу «Documentation v3» и «Previous portal version»
  https://docs.paynet.md/api/#/guides/signatures       → раздел «Signatures» (переключатель языка EN/RU/RO вверху)
  https://docs.paynet.md/api/llms.txt                  → текст, строка «Start with https://docs.paynet.md/api/llms-full.txt …»
  https://docs.paynet.md/api/openapi.json              → JSON (не скачивается, не HTML)
  https://docs.paynet.md/api/docs/signatures.md        → текст Markdown
  https://docs.paynet.md/api/sitemap.xml               → XML со списком адресов
  https://docs.paynet.md/api/sdk/paynet-ecom-sdk-php-1.0.0.zip → скачивается архив
  Кнопка «Previous portal version» → https://docs.paynet.md/psp/

Проверка заголовков из командной строки (пример):
  curl -sI https://docs.paynet.md/api/llms.txt | grep -i -E "content-type|content-encoding"

4. ОТКАТ
--------
Сохраните предыдущую версию папки (или предыдущий архив). Если с новой версией что-то
не так — верните предыдущие файлы на место. Каждая версия собирается целиком,
файлы разных версий не смешивайте (сначала очистите папку, затем распакуйте).

5. СБОРКА СВОИМИ СИЛАМИ (по желанию)
------------------------------------
Архив собирается автоматически из репозитория https://github.com/paynet-business/paynet-docs.
Чтобы собрать ту же версию самостоятельно (Node.js 22, команда zip):
  git clone https://github.com/paynet-business/paynet-docs && cd paynet-docs && git checkout a97e545937e3bea3e4abf01d36efe4b22e512350
  npm ci
  node scripts/check-docs.mjs
  node scripts/build-site.mjs --site-url https://docs.paynet.md/api/ --out dist-it --strict
Результат — папка dist-it (то же содержимое, что в архиве).

6. СБОРКА В GITLAB И DOCKER
--------------------------
В репозитории есть всё для сборки в GitLab и запуска в контейнере:
  .gitlab-ci.yml        — задачи GitLab CI: docs-build (проверки + сборка в dist), docs-docker (образ, запуск вручную)
  Dockerfile            — nginx + готовая папка dist, сайт по пути /api/ (/ → /api/)
  deploy/nginx.conf     — типы файлов (UTF-8), gzip, кэш
GitLab подхватывает .gitlab-ci.yml из корня проекта сам — ничего подключать не нужно.
Адрес сборки — переменная DOCS_SITE_URL (по умолчанию https://docs.paynet.md/api/; для тестовой площадки задайте свой).
Раннеру нужен интернет (npm, репозитории Debian для утилиты zip) или внутренние зеркала.
Вручную:
  node scripts/build-site.mjs --site-url https://docs.paynet.md/api/ --out dist --strict
  docker build -t paynet-docs .
  docker run -d -p 8080:80 paynet-docs      → http://<сервер>:8080/api/
Перед контейнером — ваш прокси с HTTPS для https://docs.paynet.md/api/ (на путь /api/ контейнера).

Вопросы по содержанию документации — владельцу проекта (Paynet, B2B-продукты).
