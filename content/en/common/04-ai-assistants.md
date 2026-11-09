# Integrate with an AI assistant

You can hand this documentation to any AI coding assistant (Claude, ChatGPT, Gemini, Copilot, Cursor and others) and ask it to write the integration.

## Files for AI

| File | What it contains | When to use |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | The whole documentation in one plain-text file: all products, guides, API reference, signatures with test vectors, test data | Give this one file to the assistant. |
| [`llms-ecom.txt`](llms-ecom.txt) | E-commerce only, plus the general topics it needs (notifications, signatures, errors) | When you integrate only e-commerce payments. |
| [`llms.txt`](llms.txt) | Short index with links to every page | For assistants that browse links themselves. |
| [`openapi.json`](openapi.json) | OpenAPI 3 specification of the server-to-server API | For code generators and typed clients. |
| `docs/<page>.md`, `docs/ru/<page>.md`, `docs/ro/<page>.md` | Each guide as a separate Markdown file (English, Russian, Romanian) | When you need only one topic. |
| `docs/api/<method>.md` | Each API method as a separate Markdown file | When you work on one endpoint. |

Every guide and API method page has a **Copy for AI** button. It copies the page as Markdown; its menu (the arrow next to it) also opens the page as Markdown or in ChatGPT, Claude or Gemini with a ready question.

> **Note:** most assistants cannot read this portal by opening its address, because the pages are rendered with JavaScript. Give them `llms-full.txt` or `llms-ecom.txt` (upload the file or paste its link). The AI files are in English, the language models work with best; the assistant can answer you in any language.

## Connect an assistant in your editor

Coding assistants in the editor work best when the documentation is part of the project or added as a source:

| Assistant | How to add the documentation |
|---|---|
| Cursor | Chat → `@Docs` → *Add new doc* → paste the `llms-full.txt` link. Then mention `@Docs` in your requests. |
| VS Code (GitHub Copilot) | In the chat, use `#fetch` with the `llms-ecom.txt` link, or save the file into the project and attach it. |
| Claude Code | Save `llms-ecom.txt` into the project (for example `docs/paynet.md`) and add to `CLAUDE.md`: *Paynet integration: follow docs/paynet.md*. |
| Codex | Save `llms-ecom.txt` into the project and reference it in `AGENTS.md` the same way. |

Keeping the file in the project also lets you see in code review which version of the documentation was used. Download it again when the documentation changes.

## Prompt template

Copy, fill in the brackets, and attach `llms-ecom.txt`:

```text
You are integrating Paynet e-commerce payments into my project.
Use ONLY the attached Paynet documentation as the source of truth.

My stack: [e.g. Node.js 20 + Express / PHP 8.2 + Laravel / Python 3.12 + Django]
Integration type: [server-to-server API | hosted checkout form]
What to build:
1. Create a payment for a cart and redirect the customer to Paynet.
2. A notification endpoint that verifies the Hash header and marks the order paid exactly once.
3. A status check by paymentId used before fulfilment.

Requirements:
- Read credentials and secret keys from environment variables.
- One shop order = one unique Order number; ExpiryDate in the future, in Europe/Chisinau time.
- Amounts are integers in minor units (100 = 1.00 MDL).
- Implement signatures exactly as documented and add unit tests that reproduce
  the test vectors from the "Signatures" section.
- Do not invent endpoints, fields or status values that are not in the documentation.
  If something is missing, list it as an open question instead of guessing.
```

## Rules for the assistant

These rules are also included at the top of the AI files:

1. Test API: `https://ecom-api-test.paynet.md`; production API: `https://ecom-api.paynet.md` (same paths: `/auth`, `/api/...`). Hosted checkout form: `https://test.paynet.md/ecom/checkout` (test), `https://paynet.md/ecom/checkout` (production).
2. Authenticate with `POST /auth` (JSON), then send `Authorization: Bearer <token>`.
3. One shop order = one `Order`. Repeating an `Order` with the same data returns the same payment; with different data, or after payment, it fails with `500 TECHNICAL_ERROR`.
4. `ExpiryDate` is `YYYY-MM-DDTHH:mm:ss` in Chișinău local time (`Europe/Chisinau`) and must be in the future.
5. Amounts are integers in minor units; `Currency` is `498` for MDL.
6. Signatures are `Base64(MD5(UTF8(string + secretKey)))`, Base64 of the raw digest. The checkout secret key and the notification secret key are different.
7. Notifications are sent only for paid payments (`EventType` = `PAID`). Keys are `Payment.Id` and `Payment.ExternalId` (case-sensitive). A failed payment only redirects the customer to `LinkUrlCancel`.
8. `PaidAmount` must equal `Amount` unless the merchant has an agreed promotion with Paynet; otherwise do not fulfil automatically.
9. Never trust the redirect to `LinkUrlSuccess`; confirm with a verified notification or the status API.
10. Secrets never go to browser code.
