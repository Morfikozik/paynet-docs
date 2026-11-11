# Paynet Documentation Portal (v2)

Портал разработчика Paynet: каталог продуктов (сейчас E-commerce; позже Payouts, Cashout, Marketplace и др.), руководства на трёх языках (EN/RU/RO), справочник API с онлайн-тестером, полнотекстовый поиск и документация для ИИ-ассистентов.

Превью: https://paynet-business.github.io/paynet-docs/ · предыдущая версия: https://paynet-business.github.io/paynet-docs/legacy/

## Где что лежит

| Путь | Что это |
|---|---|
| `content/<en\|ru\|ro>/<раздел>/NN-slug.md` | **Руководства.** Разделы: `common` (общее для всех продуктов) и по папке на продукт (`ecom`). Единый источник для портала и файлов ИИ. `NN` — порядок в меню. |
| `src/openapi/openapi.json` | Спецификация server-to-server API (тестер, справочник, `openapi.json`). |
| `src/data/api_paths.json` | Названия и описания методов на трёх языках, примеры ответов. |
| `scripts/build-ai-docs.mjs` | Генерирует `llms.txt`, `llms-full.txt`, `llms-ecom.txt`, `docs/*.md`, `openapi.json` в `public/`. |
| `scripts/check-docs.mjs` | Проверки: тестовые векторы подписей, примеры кода, HTML-форма, ссылки, одинаковый набор страниц во всех языках. |
| `scripts/lib/signatures.mjs` | Эталонные алгоритмы подписи (checkout v0.6 и уведомления). |
| `src/content/guides.ts` | Список разделов (`SECTIONS`) и подписи интерфейса на трёх языках. |
| `src/components/HomePage.tsx`, `Sidebar.tsx`, `GuidePage.tsx`, `Markdown.tsx` | Главная, меню с поиском, страницы руководств. |
| `.github/workflows/deploy.yml` | Сборка, проверки, скриншоты и публикация на GitHub Pages. |

## Как изменить текст

1. Отредактируйте нужный файл в `content/en/…`, затем ту же страницу в `content/ru/…` и `content/ro/…`.
2. Новая страница — новый файл `NN-slug.md` **во всех трёх языках** (иначе сборка упадёт). Slug должен быть уникальным на весь портал.
3. Новый продукт — новая папка (например `content/<lang>/payouts/`), запись в `SECTIONS` в `src/content/guides.ts` и в `scripts/build-ai-docs.mjs`, карточка на главной (`HomePage.tsx`).
4. Ссылка на другую страницу: `[текст](#/guides/slug)`.
5. Неподтверждённые факты помечайте блоком `> **Draft:** …` (`**Черновик:**`, `**Ciornă:**`).
6. После push сайт пересобирается сам за 2–3 минуты.

## Локальный запуск (для разработчиков)

```bash
npm ci
node scripts/check-docs.mjs
node scripts/build-ai-docs.mjs
npm run dev
```

## Откат

- Исходная версия, полученная в архиве, сохранена в ветке `backup/v1-original` и всегда доступна по адресу `/legacy/`.
- Вернуть сайт целиком к исходной версии: `git checkout main && git reset --hard backup/v1-original && git push --force` (потребуется вернуть и `.github/workflows/deploy.yml` из `main`, чтобы публикация продолжала работать). Проще — попросить Claude выполнить откат.
- Откатить отдельное изменение: `git revert <commit>`.

## Открытые вопросы к Paynet

