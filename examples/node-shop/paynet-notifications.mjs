// paynet-notifications.mjs — complete notification handler, no dependencies (Node.js 18+).
import crypto from 'node:crypto';

// The 9 signed fields, in this exact order. Do not sort.
const signedValues = (n) => {
  const p = n.Payment || {};
  return [n.EventDate, n.Eventid, n.EventType, p.Amount, p.Customer, p.ExternalId, p.Id, p.Merchant, p.StatusDate];
};

export function verifyHash(notification, hashHeader, secret) {
  const prepared = signedValues(notification).map((v) => (v === null || v === undefined ? '' : String(v))).join('');
  const expected = crypto.createHash('md5').update(prepared + secret, 'utf8').digest('base64');
  const received = String(hashHeader || '');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * deps.secret      notification secret key
 * deps.apiUrl      https://ecom-api.paynet.md (test: https://ecom-api-test.paynet.md)
 * deps.getToken()  returns a valid Bearer token (POST /auth, cached)
 * deps.fetch       fetch implementation (globalThis.fetch)
 * deps.db          your storage:
 *   saveNotificationOnce(paymentId, notification) -> true if new, false if already stored
 *   findOrder(order) -> { amount, customerCode, promotionAgreed } or null
 *   markPaid(order, paidAmount), saveCard(customerCode, cardLinkHash), sendToReview(order, problems)
 *
 * handle(rawBody, hashHeader) -> { status, processing }
 *   status: HTTP status to answer Paynet; processing: promise of the work done after answering.
 */
export function createPaynetHandler(deps) {
  const { db } = deps;

  async function confirmWithApi(n, order) {
    const p = n.Payment;
    const response = await deps.fetch(`${deps.apiUrl}/api/order/merchant/${p.ExternalId}`, {
      headers: { Authorization: `Bearer ${await deps.getToken()}` },
    });
    if (!response.ok) throw new Error(`Status check failed: HTTP ${response.status}`);
    const payment = await response.json();

    const problems = [];
    if (payment.paymentId !== p.Id) problems.push('paymentId');
    if (payment.status !== 4) problems.push('status');
    if (payment.amount?.amount !== p.Amount || p.Amount !== order.amount) problems.push('Amount');
    if (payment.amount?.paidAmount !== p.PaidAmount) problems.push('PaidAmount');
    if (payment.customer?.code !== order.customerCode) problems.push('customer');
    if (p.CardLinkHash && payment.cardLinkHash && payment.cardLinkHash !== p.CardLinkHash) problems.push('CardLinkHash');
    return problems;
  }

  async function process(n) {
    const p = n.Payment;
    if (n.EventType !== 'PAID') return db.sendToReview(p.ExternalId, ['EventType']);
    const order = await db.findOrder(p.ExternalId);
    if (!order) return db.sendToReview(p.ExternalId, ['unknown order']);

    const problems = await confirmWithApi(n, order);
    if (p.PaidAmount !== p.Amount && !order.promotionAgreed) problems.push('PaidAmount differs from Amount');
    if (problems.length) return db.sendToReview(p.ExternalId, problems);

    await db.markPaid(p.ExternalId, p.PaidAmount);
    if (p.CardLinkHash) await db.saveCard(order.customerCode, p.CardLinkHash);
  }

  return async function handle(rawBody, hashHeader) {
    let n;
    try {
      n = JSON.parse(rawBody);
    } catch {
      return { status: 400, processing: null };
    }
    if (!verifyHash(n, hashHeader, deps.secret)) return { status: 400, processing: null };

    const isNew = await db.saveNotificationOnce(n.Payment?.Id, n); // idempotency by Payment.Id
    if (!isNew) return { status: 200, processing: null }; // a retry: already stored
    // Answer 200 now; confirm and fulfil after the answer. If this work fails, the stored
    // notification stays unprocessed and a background job can retry it.
    return { status: 200, processing: process(n) };
  };
}
