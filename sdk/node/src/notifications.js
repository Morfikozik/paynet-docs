// Payment notifications (Paynet → your callback URL).
//
// Rules (confirmed by Paynet):
// - answer HTTP 200 (only 200 counts; 204 and other 2xx cause retries), quickly — Paynet waits about 30 seconds;
// - retries: 9 attempts within about 25 minutes, then Paynet stops;
// - only PAID events are sent;
// - the Hash header covers 9 fields; PaidAmount, MoneyType, CardLinkHash are NOT signed → confirm through the API.
import { PaynetError, ErrorKind } from './errors.js';
import { verifyNotificationHash } from './signatures.js';
import { PaymentStatus } from './status.js';

/**
 * Parses the raw body and checks the Hash header. Throws PaynetError (kind 'validation') if invalid.
 * Answer 400 to Paynet in that case; otherwise store the notification and answer 200.
 */
export function parseNotification(rawBody, hashHeader, secretKey) {
  let notification;
  try {
    notification = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) ? JSON.parse(String(rawBody)) : rawBody;
  } catch (cause) {
    throw new PaynetError({ message: 'Notification body is not valid JSON', kind: ErrorKind.VALIDATION, cause });
  }
  if (!notification || typeof notification !== 'object' || !notification.Payment) {
    throw new PaynetError({ message: 'Notification has no Payment object', kind: ErrorKind.VALIDATION });
  }
  if (!verifyNotificationHash(notification, hashHeader, secretKey)) {
    throw new PaynetError({ message: 'Notification Hash does not match (wrong secret key, or the body was changed)', kind: ErrorKind.VALIDATION, hint: 'Use the NOTIFICATION secret key (not the checkout key) and the raw body as received.' });
  }
  return notification;
}

/**
 * Confirms a verified notification through the API and against your order.
 * Returns { ok, payment, problems }. When ok is false, do not fulfil the order — send it to manual review.
 *
 * @param {import('./client.js').PaynetClient} client
 * @param {object} notification   result of parseNotification
 * @param {object} expected       what your shop knows about the order
 * @param {number} expected.amount         Amount you sent when creating the order
 * @param {string} [expected.customerCode]  Customer.Code you sent
 * @param {boolean} [expected.promotionAgreed=false]  PaidAmount may differ from Amount only with an agreed promotion
 */
export async function confirmNotification(client, notification, expected) {
  const p = notification.Payment;
  const problems = [];
  if (notification.EventType !== 'PAID') problems.push(`EventType ${notification.EventType}`);
  const payment = await client.getPaymentByOrder(p.ExternalId);
  if (payment.paymentId !== p.Id) problems.push('paymentId differs from Payment.Id');
  if (payment.status !== PaymentStatus.PAID) problems.push(`status is ${payment.status}, not 4`);
  if (expected?.amount !== undefined && (payment.amount?.amount !== expected.amount || p.Amount !== expected.amount)) problems.push('Amount differs from your order');
  if (payment.amount?.paidAmount !== p.PaidAmount) problems.push('PaidAmount in the notification differs from the API');
  if (p.PaidAmount !== p.Amount && !expected?.promotionAgreed) problems.push('PaidAmount differs from Amount');
  if (expected?.customerCode !== undefined && payment.customer?.code !== expected.customerCode) problems.push('customer differs from your order');
  if (p.CardLinkHash && payment.cardLinkHash && payment.cardLinkHash !== p.CardLinkHash) problems.push('CardLinkHash differs from the API');
  return { ok: problems.length === 0, payment, problems };
}
