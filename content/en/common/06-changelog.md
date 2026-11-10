# Changelog

## Documentation v3.1 — 10.11.2026

- **New Postman collection** with TEST and PRODUCTION environments: the token is obtained automatically, every order is unique, data is passed between requests. Checked by a run on the test environment. See [Testing → Postman](#/guides/testing).
- **Error cheat sheet** with a "retry the request?" column; `405`, `415` and `404` with an empty body added (checked on the test environment). See [Errors and statuses](#/guides/errors-and-statuses).
- **Notification retry schedule:** 9 attempts within about 25 minutes. Paynet **IP addresses** for your firewall. See [Notifications](#/guides/notifications).
- 3-D Secure and the decline reason in the statuses section; a "Contacting support" section.
- Sidebar with icons; parameter tables are readable on phones.

## Documentation v3 — 09.11.2026

- **Example shop in Node.js** — a complete integration with no dependencies. Checked by an end-to-end test on the test environment: purchase, payment, notification, refund. See [Example shop](#/guides/example-shop).
- **Mock responses for failure tests**: statuses `3`, `5`, `6`, refund errors, `401`, `errorInfo`, signed notifications. See [Testing](#/guides/testing).
- **API specification checked against real responses** of the test environment: `/auth` with a wrong password returns `401` (not `500`); the token `401` format and the `errorInfo` format are described; `amount.paidAmount` is added; refund, search and statement response schemas are added.
- **Saved cards checked on the test environment:** the same customer sees the card, another customer does not. See [Saved cards](#/guides/saved-cards).
- **Complete notification handlers** in Node.js and PHP; the Node.js logic is tested on every build.

## Documentation v2 — 09.11.2026

- Multi-product portal: home page, site-wide search, "General" and "E-commerce" sections.
- API rules confirmed by Paynet: payment statuses, failed payments, refunds, notification retries, saved cards, production access.
- What the notification signature protects and how to confirm unsigned fields with the API.
- FAQ, "Copy for AI" menu, AI files in three languages.
- The description of the retired protocol from the old documentation removed.
- This version is kept in the `documentation-v2` branch of the repository.

## Documentation v1

The original portal. Available via the "Previous portal version" link at the bottom of the page.
