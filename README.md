# Paynet Documentation Portal (v2)

Портал документации Paynet E-commerce API: руководства на трёх языках (EN/RU/RO), справочник API с онлайн-тестером и машиночитаемая документация для ИИ-ассистентов.

Превью: https://morfikozik.github.io/paynet-docs/ · предыдущая версия: https://morfikozik.github.io/paynet-docs/legacy/

## Где что лежит

| Путь | Что это |
|---|---|
| `content/<en\|ru\|ro>/NN-slug.md` | **Руководства.** Единый источник текста и для портала, и для файлов ИИ. Номер `NN` задаёт порядок в меню. |
| `src/openapi/openapi.json` | Спецификация server-to-server API (тестер, справочник, `openapi.json`). |
| `src/data/api_paths.json` | Названия и описания методов на трёх языках, примеры ответов. |
| `scripts/build-ai-docs.mjs` | Генерирует `llms.txt`, `llms-full.txt`, `docs/*.md`, `openapi.json` в `public/`. |
| `scripts/check-docs.mjs` | Проверки: тестовые векторы подписей, примеры кода, HTML-форма, ссылки, одинаковый набор страниц во всех языках. |
| `scripts/lib/signatures.mjs` | Эталонные алгоритмы подписи (checkout v0.6 и уведомления). |
| `src/components/GuidePage.tsx`, `Markdown.tsx` | Отображение руководств на портале. |
| `.github/workflows/deploy.yml` | Сборка, проверки, скриншоты и публикация на GitHub Pages. |

## Как изменить текст

1. Отредактируйте нужный файл в `content/en/`, затем ту же страницу в `content/ru/` и `content/ro/`.
2. Новая страница — новый файл `NN-slug.md` **во всех трёх папках** (иначе сборка упадёт).
3. Ссылка на другую страницу: `[текст](#/guides/slug)`.
4. Неподтверждённые факты помечайте блоком `> **Draft:** …` (`**Черновик:**`, `**Ciornă:**`).
5. После push сайт пересобирается сам за 2–3 минуты.

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

Список вопросов, которые нужно подтвердить перед публикацией, — в [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md).
