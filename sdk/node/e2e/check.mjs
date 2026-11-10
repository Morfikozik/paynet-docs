// Live check of the Node.js SDK on the Paynet test environment (merchant 265505). Run manually only.
//   node check.mjs create                  → creates an order, prints { order, paymentId, paymentLink, checks }
//   node check.mjs after-pay <order>       → after the order was paid: status, search, refund rules, statements, errors
import {
  PaynetClient, PaynetError, ErrorKind, PaymentStatus, buildCheckoutForm, expiryInHours, chisinauDate,
} from '../src/index.js';

const SALE_AREA = 'onlidocumentation_md';
const client = new PaynetClient({ username: '771064', password: 'sLgMnGWJ', environment: 'test' });
const checks = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail: detail ?? '' });
  } catch (e) {
    checks.push({ name, ok: false, detail: e instanceof PaynetError ? `${e.kind} ${e.httpStatus ?? ''} ${e.code ?? ''} ${e.message}` : String(e?.stack || e) });
  }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const [, , phase, orderArg] = process.argv;

if (phase === 'create') {
  const order = Date.now();
  const customerCode = `sdk-node-${order}`;
  let created;
  let body;
  await check('getToken', async () => `${(await client.getToken()).length} chars`);
  await check('createOrder', async () => {
    body = {
      Order: order,
      SaleAreaCode: SALE_AREA,
      LinkUrlSuccess: 'https://shop.example/payment/success',
      LinkUrlCancel: 'https://shop.example/payment/cancel',
      Customer: { Code: customerCode, NameFirst: 'SDK', NameLast: 'Node', PhoneNumber: '37360000000', email: 'sdk-check@example.com' },
      ExpiryDate: expiryInHours(24),
      Currency: 498,
      Services: [{ Name: 'sdk-check', Description: `Node SDK check #${order}`, Amount: 300, Products: [{ LineNo: 1, Code: 'SKU-1', Name: 'Demo', Description: 'Demo', UnitPrice: 300, Quantity: 100, Amount: 300, TotalAmount: 300 }] }],
      MoneyType: 'Card',
      Lang: 'en',
    };
    created = await client.createOrder(body);
    assert(created.paymentId && created.paymentLink, 'no paymentId / paymentLink');
    return `paymentId ${created.paymentId}`;
  });
  await check('createOrder: the same body again returns the same payment (safe retry)', async () => {
    const again = await client.createOrder(body);
    assert(again.paymentId === created.paymentId, `paymentId ${again.paymentId} vs ${created.paymentId}`);
    return `same paymentId ${again.paymentId}`;
  });
  await check('getPaymentByOrder before payment → status 1', async () => {
    const p = await client.getPaymentByOrder(order);
    assert(p.status === PaymentStatus.REGISTERED, `status ${p.status}`);
    return 'status 1';
  });
  await check('refund of an unpaid payment is refused by the SDK', async () => {
    try {
      await client.refund({ paymentId: created.paymentId, saleAreaCode: SALE_AREA, amount: 300 });
    } catch (e) {
      assert(e.kind === ErrorKind.RULE && /not paid/.test(e.message), e.message);
      return e.message;
    }
    throw new Error('no error');
  });
  console.log(JSON.stringify({ order, customerCode, paymentId: created?.paymentId, paymentLink: created?.paymentLink, checks }));
} else if (phase === 'after-pay') {
  const order = Number(orderArg);
  let payment;
  await check('getPaymentByOrder after payment → status 4', async () => {
    payment = await client.getPaymentByOrder(order);
    assert(payment.status === PaymentStatus.PAID, `status ${payment.status}`);
    return `status 4, paidAmount ${payment.amount?.paidAmount}`;
  });
  await check('getPayment(paymentId)', async () => {
    const p = await client.getPayment(payment.paymentId);
    assert(p.order === order, 'order differs');
    return `order ${p.order}`;
  });
  await check('isPaid', async () => { assert(await client.isPaid(order), 'not paid'); return 'true'; });
  await check('searchPayments (last hour) finds the payment', async () => {
    const result = await client.searchPayments({ from: new Date(Date.now() - 3600e3), to: new Date(Date.now() + 60e3) });
    const text = JSON.stringify(result);
    assert(text.includes(String(payment.paymentId)), 'payment not in search result');
    return 'found';
  });
  await check('refund more than paid is refused by the SDK', async () => {
    try { await client.refund({ paymentId: payment.paymentId, saleAreaCode: SALE_AREA, amount: 301 }); } catch (e) { assert(e.kind === ErrorKind.RULE, e.message); return e.message; }
    throw new Error('no error');
  });
  await check('partial refund 1.00 MDL', async () => {
    const r = await client.refund({ paymentId: payment.paymentId, saleAreaCode: SALE_AREA, amount: 100, reason: 'SDK check' });
    assert(r.refundType === 'partial', JSON.stringify(r));
    return `refundType ${r.refundType}, amount ${r.amount}`;
  });
  await check('status after partial refund → 6', async () => {
    const p = await client.getPayment(payment.paymentId);
    assert(p.status === PaymentStatus.PARTIALLY_REFUNDED, `status ${p.status}`);
    return 'status 6';
  });
  await check('second refund is refused by the SDK (production rule: one refund per payment)', async () => {
    try { await client.refund({ paymentId: payment.paymentId, saleAreaCode: SALE_AREA, amount: 100 }); } catch (e) { assert(e.kind === ErrorKind.RULE && /already refunded/.test(e.message), e.message); return e.message; }
    throw new Error('no error');
  });
  await check('saved card: unlinkCard', async () => {
    const hash = payment.cardLinkHash || payment.customer?.cardLinkHash;
    if (!hash) return 'skipped: no card saved for this payment';
    await client.unlinkCard({ cardLinkHash: hash, saleAreaCode: SALE_AREA, customerCode: payment.customer?.code });
    return 'unlinked';
  });
  await check('getStatement (last 7 days)', async () => {
    const s = await client.getStatement({ dateStart: new Date(Date.now() - 7 * 864e5), dateFinish: new Date() });
    assert(s && typeof s === 'object', 'no statement');
    return Object.keys(s).join(',');
  });
  await check('downloadStatement (.xlsx)', async () => {
    const file = await client.downloadStatement({ dateStart: chisinauDate(new Date(Date.now() - 7 * 864e5)), dateFinish: chisinauDate() });
    assert(file.length > 100 && file.subarray(0, 2).toString() === 'PK', 'not an xlsx file');
    return `${file.length} bytes`;
  });
  await check('error: unknown payment → NOT_FOUND', async () => {
    try { await client.getPayment(999999999); } catch (e) { assert(e.kind === ErrorKind.NOT_FOUND, `${e.kind} ${e.message}`); return `${e.code}, traceId ${e.traceId ? 'yes' : 'no'}`; }
    throw new Error('no error');
  });
  await check('error: wrong password → AUTHENTICATION', async () => {
    const bad = new PaynetClient({ username: '771064', password: 'wrong', environment: 'test' });
    try { await bad.getPayment(payment.paymentId); } catch (e) { assert(e.kind === ErrorKind.AUTHENTICATION, `${e.kind} ${e.message}`); return e.code; }
    throw new Error('no error');
  });
  await check('error: invalid order → VALIDATION', async () => {
    try { await client.createOrder({ Order: Date.now() }); } catch (e) { assert(e.kind === ErrorKind.VALIDATION, `${e.kind} ${e.message}`); return e.message.slice(0, 120); }
    throw new Error('no error');
  });
  await check('hosted checkout form (test vector signature)', async () => {
    const form = buildCheckoutForm({ secretKey: 'F90D6485-9CCC-458B-96A3-8958AF9B4458', fields: { Order: 1762444800000, Currency: '498', Merchant: '265505', SaleAreaCode: SALE_AREA, Amount: '1235', Description: 'Test&Co SRL', CustomerCode: '5555', CustomerNameFirst: 'First name', CustomerNameLast: 'Last name', CustomerPhoneNumber: '060000000', CustomerEmail: 'test@gmail.com', ExpiryDate: '2026-12-31T23:59:59', LinkUrlCancel: 'https://test.oplta.md/cancel', LinkUrlSuccess: 'https://test.oplta.md/ok', Lang: 'ro', MoneyType: 'Card' } });
    assert(form.fields.Signature === 'cxr/+yLYZp34aR0KXLkb2A==', form.fields.Signature);
    return form.fields.Signature;
  });
  console.log(JSON.stringify({ order, checks }));
} else {
  console.error('usage: node check.mjs create | after-pay <order>');
  process.exit(2);
}
