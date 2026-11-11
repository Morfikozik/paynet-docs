# Example shop (Node.js)

A ready, minimal server-to-server integration: one Node.js 18+ server with no dependencies. Source code: [paynet-example-shop-node.zip](sdk/paynet-example-shop-node.zip).

> **Important:** this example is checked by an end-to-end test on the Paynet test environment: a robot buys a product in the example, pays with the test card, sends the notification and makes a refund. So the example code is known to work.

## Run

The example is a working online shop connected to the Paynet test environment. It runs on your computer; besides Node.js nothing has to be installed or configured.

### Before you start: Node.js

You need **Node.js 18 or newer**. Open a command line:

| System | How to open it |
|---|---|
| Windows | **Win+R** → type `cmd` → **Enter** |
| macOS | **Terminal** app (Applications → Utilities) |
| Linux | **Terminal** (usually **Ctrl+Alt+T**) |

Type the command and press **Enter**:

```
node --version
```

If a version number appears (for example `v22.11.0`), you are ready. If you get an error, install Node.js from https://nodejs.org (the **LTS** button), then close the command line and open it again.

### Step 1. Download the archive and start the shop

Download [paynet-example-shop-node.zip](sdk/paynet-example-shop-node.zip). In the command line type these commands one by one, pressing **Enter** after each line:

```
cd Downloads
tar -xf paynet-example-shop-node.zip
cd node-shop
node server.mjs
```

| Command | What it does |
|---|---|
| `cd Downloads` | goes to the Downloads folder where the browser saved the archive |
| `tar -xf …zip` | unpacks the archive (Windows 10/11, macOS); a `node-shop` folder appears |
| `cd node-shop` | goes to the shop folder |
| `node server.mjs` | starts the shop |

**Linux:** instead of `tar -xf paynet-example-shop-node.zip` type `unzip paynet-example-shop-node.zip` (the standard Linux `tar` does not open `.zip`; if `unzip` is missing: `sudo apt install unzip`).

The line `Demo shop on http://localhost:3000 …` appears. **Do not close this window**: the shop runs while it is open. To stop the shop press **Ctrl+C**.

> The archive was not saved to Downloads? Instead of `cd Downloads` type `cd ` with a space (on Windows `cd /d ` with a space) and drag **the folder that contains the archive** from your file manager into the command-line window — its path is inserted automatically. Drag a folder, not the `.zip` archive itself. On Linux with a non-English interface the folder may have a localised name.

### Step 2. Pay a test order

Open http://localhost:3000 in your browser, click **Buy** and pay with the test card: number `4111 1111 1111 1111`, expiry `12/27`, CVV `777`. After the payment you return to the shop.

### Step 3. Send the payment notification

Open http://localhost:3000/orders. The order is **`pending`**, and that is expected: the shop marks an order as paid **only after the Paynet notification**, the same way your real shop must work. Paynet sends notifications to your merchant's callback URL, and they cannot reach `localhost`. So while developing you send the notification yourself: the script checks the payment with the API, builds the notification and signs it the same way Paynet does.

Open a **second** command line and type, with the number of your order from the **Order** column:

```
cd Downloads/node-shop
node tools/send-test-notification.mjs <Order>
```

For example: `node tools/send-test-notification.mjs 1794411831126`. The shop page shows the ready command for each `pending` order.

### Step 4. Check the result

Refresh http://localhost:3000/orders: the order is now **`paid`**, and next to it there is a refund button — try a refund.

### If something does not work

| Message | Cause and fix |
|---|---|
| `'node' is not recognized…` / `command not found: node` | Node.js is not installed, or the command line was opened before installing it. Install Node.js and open the command line again |
| `The system cannot find the path specified` / `No such file or directory` after `cd Downloads` | The archive is in another folder. Use the tip under Step 1 |
| `The directory name is invalid` | You dragged the `.zip` archive instead of a folder. Drag the folder that contains the archive |
| `tar: This does not look like a tar archive` | You are on Linux: use `unzip paynet-example-shop-node.zip` instead of `tar -xf` |
| `Cannot find module …server.mjs` | The command line is not in the `node-shop` folder. Repeat Step 1 |
| `EADDRINUSE … 3000` | The shop is already running in another window. Close that window (or press **Ctrl+C** in it) and start again |
| `Payment is not paid (status 1)` | The payment of this order was not completed. Create a new order and finish the payment |
| The order stays `pending` | The notification was not sent. Do Step 3 |

## What is inside

| File | What it does |
|---|---|
| `server.mjs` | Shop: product, create order, redirect to payment, return pages, notification endpoint, refunds |
| `paynet-client.mjs` | API client: token caching, create order with a safe retry, payment lookup, refund |
| `paynet-notifications.mjs` | Notification handler — the same code as in [Notifications](#/guides/notifications) |
| `store.mjs` | JSON-file storage — replace with your database |
| `tools/send-test-notification.mjs` | Sends a signed `PAID` notification to your endpoint |

## Rules the example demonstrates

| Step | How the example does it | Rule |
|---|---|---|
| Create order | Unique `Order`; the request body is stored before calling Paynet | Retry only with the same body ([Repeated order number](#/guides/errors-and-statuses)) |
| Payment deadline | `ExpiryDate` = now + 1 day in Chișinău time | `Europe/Chisinau` |
| Customer returns | The page checks `status` with the API instead of trusting the redirect | The redirect to `LinkUrlSuccess` is not proof of payment |
| `status` = `1` | "Continue to payment" with the same link | The customer did not pay |
| `status` = `3` | The page waits and refreshes | The bank is still answering; do not create a new order |
| `status` = `5` | "Try again" creates a new order with a new `Order` | The order is closed after a decline |
| Notification | Signature, once per `Payment.Id`, `200` first, then API confirmation | [What the signature protects](#/guides/notifications) |
| Refund | Only for `status` = `4`, at most `PaidAmount`, once | [Refunds](#/guides/errors-and-statuses) |
| Saved card | `CardLinkHash` from a confirmed notification is stored for the customer | [Saved cards](#/guides/saved-cards) |

## Going live

Set the environment variables to production values — they differ from the test ones — and keep them out of the code:

| Variable | Value |
|---|---|
| `PAYNET_API_URL` | `https://ecom-api.paynet.md` |
| `PAYNET_USERNAME`, `PAYNET_PASSWORD` | production API credentials |
| `PAYNET_SALE_AREA` | your sale area code |
| `PAYNET_NOTIFICATION_SECRET` | production notification key |
| `PUBLIC_URL` | your shop address (for `LinkUrlSuccess` / `LinkUrlCancel`) |

Replace `store.mjs` with your database and go through the [go-live checklist](#/guides/go-live).
