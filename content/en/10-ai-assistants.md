# Integrate with an AI assistant

You can hand this documentation to any AI coding assistant (Claude, ChatGPT, Gemini, Copilot, Cursor and others) and ask it to write the integration.

## Files for AI

| File | What it contains | When to use |
|---|---|---|
| [`llms-full.txt`](llms-full.txt) | The whole documentation in one plain-text file: guides, API reference, signatures with test vectors, test data | Give this one file to the assistant. |
| [`llms.txt`](llms.txt) | Short index with links to every page | For assistants that browse links themselves. |
| [`openapi.json`](openapi.json) | OpenAPI 3 specification of the server-to-server API | For code generators and typed clients. |
| `docs/<page>.md` | Each guide as a separate Markdown file | When you need only one topic. |

Every guide page on this portal also has a **Copy for AI** button that copies the page as Markdown.

> **Note:** most assistants cannot read this portal by opening its address, because the pages are rendered with JavaScript. Give them `llms-full.txt` (upload the file or paste its link).

## Prompt template

Copy, fill in the brackets, and attach `llms-full.txt`:

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
```

## Rules for the assistant

These rules are also included at the top of `llms-full.txt`:

1. Test base URL is `https://ecom-api-test.paynet.md`; hosted checkout test URL is `https://test.paynet.md/ecom/checkout`.
2. Authenticate with `POST /auth` (JSON), then send `Authorization: Bearer <token>`.
3. `Order` must be unique per payment; `ExpiryDate` must be in the future (`YYYY-MM-DDTHH:mm:ss`).
4. Amounts are integers in minor units; `Currency` is `498` for MDL.
5. Signatures are `Base64(MD5(string + secretKey))` over UTF-8, Base64 of the raw digest.
6. Never trust the redirect to `LinkUrlSuccess`; confirm with a verified notification or the status API.
7. The checkout secret key and the notification secret key are different.
8. Secrets never go to browser code.
