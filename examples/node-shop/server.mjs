// server.mjs — minimal Paynet e-commerce shop (server-to-server integration).
// Run: node server.mjs   (Node.js 18+, no dependencies)   then open http://localhost:3000
//
// Flow: product → POST /checkout (create order) → Paynet payment page →
//       /return/success | /return/cancel (status check) → POST /paynet/notification (fulfilment)
//       → /orders (refund).
import http from 'node:http';
import { createPaynetClient, chisinauDateTime } from './paynet-client.mjs';
import { createPaynetHandler } from './paynet-notifications.mjs';
import { createStore } from './store.mjs';

// Defaults are the public TEST environment values from the documentation.
const config = {
  port: Number(process.env.PORT || 3000),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  apiUrl: process.env.PAYNET_API_URL || 'https://ecom-api-test.paynet.md',
  username: process.env.PAYNET_USERNAME || '771064',
  password: process.env.PAYNET_PASSWORD || 'sLgMnGWJ',
  saleAreaCode: process.env.PAYNET_SALE_AREA || 'onlidocumentation_md',
  notificationSecret: process.env.PAYNET_NOTIFICATION_SECRET || 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7',
  storeFile: process.env.STORE_FILE || './shop-data.json',
};

const paynet = createPaynetClient(config);
const store = createStore(config.storeFile);
const handleNotification = createPaynetHandler({
  secret: config.notificationSecret,
  apiUrl: config.apiUrl,
  getToken: () => paynet.getToken(),
  fetch: globalThis.fetch,
  db: store,
});

const PRODUCT = { name: 'Demo product', amount: 300 }; // 3.00 MDL, minor units

// ---------------------------------------------------------------- helpers
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (minor) => `${(Number(minor || 0) / 100).toFixed(2)} MDL`;
const page = (title, body, refreshSeconds) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : ''}
<title>${escapeHtml(title)}</title><style>
body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#334155}
h1{color:#406C6F}a,button{color:#fff;background:#6AB4B8;border:0;border-radius:6px;padding:10px 16px;text-decoration:none;cursor:pointer;display:inline-block}
a.secondary{background:#559094}.box{border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0}
input{padding:8px;border:1px solid #cbd5e1;border-radius:6px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left;font-size:14px}
.ok{color:#00a050}.warn{color:#cc7a00}.err{color:#cc0000}</style></head><body>${body}
<p style="margin-top:40px;font-size:13px"><a class="secondary" href="/">Shop</a> <a class="secondary" href="/orders">Orders</a></p></body></html>`;

const readBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
  req.on('end', () => resolve(data));
  req.on('error', reject);
});
const send = (res, status, html, headers = {}) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers }); res.end(html); };
const redirect = (res, location) => { res.writeHead(303, { Location: location }); res.end(); };

// ---------------------------------------------------------------- create an order at Paynet
async function createPaynetOrder({ customerCode, useSavedCard }) {
  const order = Date.now(); // one shop order = one unique Order
  const cardLinkHash = useSavedCard ? store.getCard(customerCode) : null;
  const requestBody = {
    Order: order,
    SaleAreaCode: config.saleAreaCode,
    LinkUrlSuccess: `${config.publicUrl}/return/success?order=${order}`,
    LinkUrlCancel: `${config.publicUrl}/return/cancel?order=${order}`,
    Customer: { Code: customerCode, NameFirst: 'Demo', NameLast: 'Customer', email: 'customer@example.com', PhoneNumber: '37360000000' },
    ...(cardLinkHash ? { CardLinkHash: cardLinkHash } : {}),
    Currency: 498,
    ExpiryDate: chisinauDateTime(new Date(Date.now() + 24 * 3600 * 1000)), // +1 day, Chișinău time
    Services: [{ Name: PRODUCT.name, Description: `Order #${order}`, Amount: PRODUCT.amount }],
    MoneyType: 'All',
    Lang: 'EN',
  };
  // Store the order (with the exact request body) BEFORE calling Paynet.
  store.createOrder({ order, amount: PRODUCT.amount, customerCode, requestBody });
  const result = await paynet.createOrder(requestBody);
  if (result.status !== 200 || !result.body?.paymentLink) {
    store.updateOrder(order, { state: 'error', error: result.body });
    throw new Error(`Create order failed: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  }
  return store.updateOrder(order, { paymentId: result.body.paymentId, paymentLink: result.body.paymentLink, state: 'pending' });
}

// ---------------------------------------------------------------- what to show after the customer returns
async function returnPage(orderNumber, from) {
  const order = store.getOrder(orderNumber);
  if (!order) return page('Unknown order', `<h1>Unknown order</h1>`);
  // The redirect itself proves nothing: always check the status with the API.
  const { status: http, body: payment } = await paynet.getPaymentByOrder(orderNumber);
  if (http !== 200) return page('Status unavailable', `<h1>Status unavailable</h1><p>HTTP ${http}. Try again later.</p>`, 5);

  switch (payment.status) {
    case 4:
      return page('Paid', `<h1 class="ok">Payment received</h1>
        <p>Order <b>${orderNumber}</b>, paid ${money(payment.amount?.paidAmount)}.</p>
        <p>${order.state === 'paid' ? 'The order is confirmed by the Paynet notification and fulfilled.' : 'Waiting for the Paynet notification to fulfil the order…'}</p>`,
        order.state === 'paid' ? 0 : 5);
    case 3:
      return page('Processing', `<h1 class="warn">Payment is being processed</h1><p>The bank has not answered yet. This page refreshes automatically. Do not pay again.</p>`, 5);
    case 1:
      return page('Not paid', `<h1>Not paid yet</h1>
        <p>${from === 'cancel' ? 'You left the payment page.' : 'The payment is not completed.'} You can continue with the same payment link.</p>
        <p><a href="${escapeHtml(order.paymentLink)}">Continue to payment</a></p>`);
    case 5:
      return page('Payment declined', `<h1 class="err">The payment was declined</h1>
        <p>This order is closed. A new attempt needs a new order.</p>
        <form method="post" action="/retry"><input type="hidden" name="order" value="${orderNumber}"><button>Try again</button></form>`);
    case 6:
      return page('Partially refunded', `<h1>Partially refunded</h1>`);
    default:
      return page('Unknown status', `<h1>Unknown status ${escapeHtml(payment.status)}</h1>`);
  }
}

// ---------------------------------------------------------------- refund (one per payment)
async function refund(orderNumber, amountMinor) {
  const order = store.getOrder(orderNumber);
  if (!order) return { ok: false, message: 'Unknown order' };
  if (order.refund) return { ok: false, message: 'This payment was already refunded (one refund per payment).' };
  const { body: payment } = await paynet.getPaymentByOrder(orderNumber);
  if (payment?.status !== 4) return { ok: false, message: `Only a paid payment (status 4) can be refunded; current status ${payment?.status}.` };
  const paid = payment.amount.paidAmount;
  const amount = amountMinor || paid;
  if (amount <= 0 || amount > paid) return { ok: false, message: `Amount must be between 1 and ${paid} (PaidAmount).` };

  const result = await paynet.refund({
    paymentId: payment.paymentId, saleAreaCode: config.saleAreaCode,
    type: amount === paid ? 'full' : 'partial', amount, reason: 'Customer request',
  });
  if (result.status !== 200) return { ok: false, message: `Refund failed: HTTP ${result.status} ${JSON.stringify(result.body)}` };
  store.updateOrder(orderNumber, { refund: result.body, state: amount === paid ? 'refunded' : 'partially refunded' });
  return { ok: true, message: `Refunded ${money(amount)}.` };
}

// ---------------------------------------------------------------- HTTP routes
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, config.publicUrl);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, page('Demo shop', `<h1>Demo shop</h1>
        <div class="box"><b>${PRODUCT.name}</b> — ${money(PRODUCT.amount)}
        <form method="post" action="/checkout" style="margin-top:12px">
          Customer code <input name="customer" value="demo-customer-1">
          <label><input type="checkbox" name="saved" value="1"> pay with my saved card</label><br><br>
          <button>Buy</button></form></div>
        <p>Test card: 4111 1111 1111 1111, 12/27, CVV 777.</p>`));
    }

    if (req.method === 'POST' && url.pathname === '/checkout') {
      const form = new URLSearchParams(await readBody(req));
      const order = await createPaynetOrder({ customerCode: form.get('customer') || 'demo-customer-1', useSavedCard: form.get('saved') === '1' });
      return redirect(res, order.paymentLink);
    }

    if (req.method === 'POST' && url.pathname === '/retry') {
      const old = store.getOrder(new URLSearchParams(await readBody(req)).get('order'));
      const order = await createPaynetOrder({ customerCode: old?.customerCode || 'demo-customer-1', useSavedCard: false });
      return redirect(res, order.paymentLink);
    }

    if (req.method === 'GET' && (url.pathname === '/return/success' || url.pathname === '/return/cancel')) {
      return send(res, 200, await returnPage(url.searchParams.get('order'), url.pathname.endsWith('cancel') ? 'cancel' : 'success'));
    }

    if (req.method === 'POST' && url.pathname === '/paynet/notification') {
      const { status, processing } = await handleNotification(await readBody(req), req.headers.hash);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200 ? { ResultCode: 'SUCCESS' } : { error: 'Invalid notification' }));
      processing?.catch((error) => console.error('Notification processing failed:', error.message));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/orders') {
      const rows = store.listOrders().map((o) => `<tr><td>${o.order}</td><td>${money(o.amount)}</td><td>${escapeHtml(o.state)}</td>
        <td>${o.state === 'paid' ? `<form method="post" action="/orders/refund"><input type="hidden" name="order" value="${o.order}">
        <input name="amount" placeholder="all" size="5"> <button>Refund</button></form>` : ''}</td></tr>`).join('');
      return send(res, 200, page('Orders', `<h1>Orders</h1><table><tr><th>Order</th><th>Amount</th><th>State</th><th></th></tr>${rows}</table>
        <h2>Manual review</h2><pre>${escapeHtml(JSON.stringify(store.reviewList(), null, 2))}</pre>`));
    }

    if (req.method === 'POST' && url.pathname === '/orders/refund') {
      const form = new URLSearchParams(await readBody(req));
      const amount = form.get('amount') ? Math.round(Number(form.get('amount'))) : null;
      const result = await refund(form.get('order'), amount);
      return send(res, result.ok ? 200 : 400, page('Refund', `<h1 class="${result.ok ? 'ok' : 'err'}">${escapeHtml(result.message)}</h1>`));
    }

    if (req.method === 'GET' && url.pathname === '/api/orders') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ orders: store.listOrders(), review: store.reviewList() }));
    }

    send(res, 404, page('Not found', '<h1>Not found</h1>'));
  } catch (error) {
    console.error(error);
    send(res, 500, page('Error', `<h1 class="err">Error</h1><pre>${escapeHtml(error.message)}</pre>`));
  }
});

server.listen(config.port, () => console.log(`Demo shop on ${config.publicUrl} (Paynet API ${config.apiUrl})`));
