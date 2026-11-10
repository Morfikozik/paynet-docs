# Интеграция с помощью ИИ

Эту документацию можно передать любому ИИ-ассистенту для программирования (Claude, ChatGPT, Gemini, Copilot, Cursor и другим) и попросить написать интеграцию.

## Файлы для ИИ

| Файл | Что внутри | Когда использовать |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | Вся документация одним текстовым файлом: все продукты, руководства, справочник API, подписи с тестовыми векторами, тестовые данные | Дайте ассистенту этот один файл. |
| [`llms-ecom.txt`](llms-ecom.txt) | Только E-commerce и нужные ему общие темы (уведомления, подписи, ошибки) | Если интегрируете только приём платежей e-commerce. |
| [`llms.txt`](llms.txt) | Короткое оглавление со ссылками на все страницы | Для ассистентов, которые сами ходят по ссылкам. |
| [`openapi.json`](openapi.json) | Спецификация OpenAPI 3 для server-to-server API | Для генераторов кода и типизированных клиентов. |
| `docs/<page>.md`, `docs/ru/<page>.md`, `docs/ro/<page>.md` | Каждое руководство отдельным файлом Markdown (английский, русский, румынский) | Когда нужна только одна тема. |
| `docs/api/<method>.md` | Каждый API-метод отдельным файлом Markdown | Когда работаете с одним методом. |

На каждой странице руководства и API-метода есть кнопка **Копировать для ИИ**. Она копирует страницу в Markdown; её меню (стрелка рядом) также открывает страницу как Markdown или в ChatGPT, Claude и Gemini с готовым вопросом.

> **Примечание:** большинство ассистентов не могут прочитать портал по ссылке, потому что страницы рисуются JavaScript. Давайте им `llms-full.txt` или `llms-ecom.txt` (загрузите файл или вставьте ссылку). Файлы для ИИ написаны на английском: модели лучше всего работают с ним, а отвечать вам могут на любом языке.

## Подключение ассистента в редакторе кода

Ассистенты в редакторе работают лучше всего, когда документация лежит в проекте или добавлена как источник:

| Ассистент | Как добавить документацию |
|---|---|
| Cursor | Чат → `@Docs` → *Add new doc* → вставьте ссылку на `llms-full.txt`. Затем упоминайте `@Docs` в запросах. |
| VS Code (GitHub Copilot) | В чате используйте `#fetch` со ссылкой на `llms-ecom.txt` или сохраните файл в проект и прикрепите его. |
| Claude Code | Сохраните `llms-ecom.txt` в проект (например, `docs/paynet.md`) и добавьте в `CLAUDE.md`: *Интеграция Paynet: следуй docs/paynet.md*. |
| Codex | Сохраните `llms-ecom.txt` в проект и так же укажите его в `AGENTS.md`. |

Файл в проекте также показывает при ревью кода, по какой версии документации сделана интеграция. Скачайте его заново, когда документация изменится.

## Шаблон запроса

Скопируйте, заполните скобки и приложите `llms-ecom.txt`:

```text
You are integrating Paynet e-commerce payments into my project.
Use ONLY the attached Paynet documentation as the source of truth.

My stack: [e.g. Node.js 20 + Express / PHP 8.2 + Laravel / Python 3.12 + Django]
Integration type: [official Paynet SDK (PHP / Node.js) | server-to-server API | hosted checkout form]
What to build:
1. Create a payment for a cart and redirect the customer to Paynet.
2. A notification endpoint that verifies the Hash header and marks the order paid exactly once.
3. A status check by paymentId used before fulfilment.

Requirements:
- If my stack is PHP or Node.js, use the official Paynet SDK from the documentation
  (section "SDK for PHP and Node.js") instead of writing your own HTTP client.
- Read credentials and secret keys from environment variables.
- One shop order = one unique Order number; ExpiryDate in the future, in Europe/Chisinau time.
- Amounts are integers in minor units (100 = 1.00 MDL).
- Implement signatures exactly as documented and add unit tests that reproduce
  the test vectors from the "Signatures" section.
- Do not invent endpoints, fields or status values that are not in the documentation.
  If something is missing, list it as an open question instead of guessing.
- Answer me in Russian.
```

## Правила для ассистента

Эти правила также включены в начало файлов для ИИ:

1. Тестовый API: `https://ecom-api-test.paynet.md`; боевой API: `https://ecom-api.paynet.md` (пути те же: `/auth`, `/api/...`). Форма hosted checkout: `https://test.paynet.md/ecom/checkout` (тест), `https://paynet.md/ecom/checkout` (прод).
2. Аутентификация через `POST /auth` (JSON), затем заголовок `Authorization: Bearer <token>`.
3. Один заказ магазина = один `Order`. Повтор `Order` с теми же данными возвращает тот же платёж; с другими данными или после оплаты — ошибка `500 TECHNICAL_ERROR`.
4. `ExpiryDate` — `YYYY-MM-DDTHH:mm:ss` по местному времени Кишинёва (`Europe/Chisinau`), в будущем.
5. Суммы — целые числа в минимальных единицах; `Currency` — `498` для MDL.
6. Подписи: `Base64(MD5(UTF8(строка + secretKey)))`, Base64 от «сырого» дайджеста. Ключ checkout и ключ уведомлений — разные.
7. Уведомления приходят только об оплаченных платежах (`EventType` = `PAID`). Ключи — `Payment.Id` и `Payment.ExternalId` (с учётом регистра). При неуспешной оплате покупатель только перенаправляется на `LinkUrlCancel`.
8. `PaidAmount` должен равняться `Amount`, если у мерчанта нет согласованной с Paynet акции; иначе не выполнять заказ автоматически.
9. Не доверяйте возврату на `LinkUrlSuccess`; подтверждайте проверенным уведомлением или API статуса.
10. Секреты никогда не попадают в код браузера и мобильного приложения.
11. Если стек — PHP или Node.js, ассистент предлагает [официальный SDK](#/guides/sdk) вместо собственного HTTP-клиента.
12. Поиск платежей: `from`/`to` — по времени Кишинёва; пустой период — `404 NOT_FOUND_RECORD`.
