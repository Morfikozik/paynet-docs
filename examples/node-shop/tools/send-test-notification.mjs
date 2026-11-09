// send-test-notification.mjs — send a signed PAID notification for a real, paid TEST payment
// to your notification endpoint. Use it while Paynet cannot reach your local machine.
//
//   node tools/send-test-notification.mjs <Order> [endpoint]
//   endpoint defaults to http://localhost:3000/paynet/notification
//
// The notification is built from GET /api/order/merchant/{Order} and signed with the TEST
// notification key, exactly like Paynet signs it (9 fields, fixed order).
import crypto from 'node:crypto';
import { createPaynetClient } from '../paynet-client.mjs';

const [order, endpoint = 'http://localhost:3000/paynet/notification'] = process.argv.slice(2);
if (!order) {
  console.error('Usage: node tools/send-test-notification.mjs <Order> [endpoint]');
  process.exit(1);
}

const apiUrl = process.env.PAYNET_API_URL || 'https://ecom-api-test.paynet.md';
const secret = process.env.PAYNET_NOTIFICATION_SECRET || 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
const paynet = createPaynetClient({
  apiUrl,
  username: process.env.PAYNET_USERNAME || '771064',
  password: process.env.PAYNET_PASSWORD || 'sLgMnGWJ',
});

const { status, body: payment } = await paynet.getPaymentByOrder(order);
if (status !== 200) throw new Error(`Payment lookup failed: HTTP ${status}`);
if (payment.status !== 4) throw new Error(`Payment is not paid (status ${payment.status}); Paynet sends notifications only for paid payments.`);

// Payment dates come as "YYYY-MM-DD HH:mm:ss"; notification dates use "YYYY-MM-DDTHH:mm:ss".
const isoLocal = (d) => String(d).replace(' ', 'T');
const notification = {
  Eventid: Math.floor(Math.random() * 9e6) + 1e6,
  EventType: 'PAID',
  Message: 'Request processed successfully',
  EventDate: isoLocal(payment.paidDate),
  Payment: {
    Id: payment.paymentId,
    ExternalId: payment.order,
    SaleAreaCode: payment.saleAreaCode,
    Customer: payment.customer?.code ?? null,
    StatusDate: isoLocal(payment.paidDate),
    Amount: payment.amount.amount,
    PaidAmount: payment.amount.paidAmount,
    Merchant: payment.merchantCode,
    MoneyType: 'CARD',
    CardLinkHash: payment.cardLinkHash ?? null,
  },
};

const p = notification.Payment;
const prepared = [notification.EventDate, notification.Eventid, notification.EventType, p.Amount, p.Customer, p.ExternalId, p.Id, p.Merchant, p.StatusDate]
  .map((v) => (v === null || v === undefined ? '' : String(v))).join('');
const hash = crypto.createHash('md5').update(prepared + secret, 'utf8').digest('base64');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8', Hash: hash },
  body: JSON.stringify(notification),
});
console.log(`POST ${endpoint} → HTTP ${response.status} ${await response.text()}`);
