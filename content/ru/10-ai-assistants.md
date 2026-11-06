# Интеграция с помощью ИИ

Эту документацию можно передать любому ИИ-ассистенту для программирования (Claude, ChatGPT, Gemini, Copilot, Cursor и другим) и попросить написать интеграцию.

## Файлы для ИИ

| Файл | Что внутри | Когда использовать |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | Вся документация одним текстовым файлом: руководства, справочник API, подписи с тестовыми векторами, тестовые данные | Дайте ассистенту этот один файл. |
| [`llms.txt`](llms.txt) | Короткое оглавление со ссылками на все страницы | Для ассистентов, которые сами ходят по ссылкам. |
| [`openapi.json`](openapi.json) | Спецификация OpenAPI 3 для server-to-server API | Для генераторов кода и типизированных клиентов. |
| `docs/<page>.md` | Каждое руководство отдельным файлом Markdown | Когда нужна только одна тема. |

На каждой странице руководства есть кнопка **Копировать для ИИ**, которая копирует страницу в Markdown.

> **Примечание:** большинство ассистентов не могут прочитать портал по ссылке, потому что страницы рисуются JavaScript. Давайте им `llms-full.txt` (загрузите файл или вставьте ссылку на него). Файлы для ИИ написаны на английском: модели лучше всего работают с ним, а отвечать вам могут на любом языке.

## Шаблон запроса

Скопируйте, заполните скобки и приложите `llms-full.txt`:

```text
You are integrating Paynet e-commerce payments into my project.
Use ONLY the attached Paynet documentation (llms-full.txt) as the source of truth.

My stack: [e.g. Node.js 20 + Express / PHP 8.2 + Laravel / Python 3.12 + Django]
Integration type: [server-to-server API | hosted checkout v0.6]
What to build:
1. Create a payment for a cart and redirect the customer to Paynet.
2. A notification endpoint that verifies the Hash header and marks the order paid exactly once.
3. A status check by paymentId used before fulfilment.

Requirements:
- Read credentials and secret keys from environment variables.
- Use a new unique Order number for every payment and an ExpiryDate in the future.
- Amounts are integers in minor units (100 = 1.00 MDL).
- Implement signatures exactly as documented and add unit tests that reproduce
  the test vectors from the "Signatures" section.
- Do not invent endpoints, fields or status values that are not in the documentation.
  If something is missing, list it as an open question instead of guessing.
- Answer me in Russian.
```

## Правила для ассистента

Эти правила также включены в начало `llms-full.txt`:

1. Тестовый базовый URL — `https://ecom-api-test.paynet.md`; тестовый URL hosted checkout — `https://test.paynet.md/ecom/checkout`.
2. Аутентификация через `POST /auth` (JSON), затем заголовок `Authorization: Bearer <token>`.
3. `Order` уникален для каждого платежа; `ExpiryDate` в будущем (`YYYY-MM-DDTHH:mm:ss`).
4. Суммы — целые числа в минимальных единицах; `Currency` — `498` для MDL.
5. Подписи: `Base64(MD5(строка + secretKey))` по UTF-8, Base64 от «сырого» дайджеста.
6. Не доверяйте возврату на `LinkUrlSuccess`; подтверждайте проверенным уведомлением или API статуса.
7. Секретный ключ checkout и ключ уведомлений — разные.
8. Секреты никогда не попадают в код браузера.
