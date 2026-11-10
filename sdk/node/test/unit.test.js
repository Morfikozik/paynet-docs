// Offline tests: signatures (test vectors from the documentation), errors, token refresh, refund rules, time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PaynetClient, PaynetError, ErrorKind, PaymentStatus, isFinalStatus,
  checkoutRawData, checkoutSignature, notificationPreparedString, notificationHash, verifyNotificationHash,
  parseNotification, confirmNotification, buildCheckoutForm, chisinauDateTime, chisinauDate, expiryInHours,
} from '../src/index.js';

const CHECKOUT_KEY = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
const NOTIFY_KEY = 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
const FORM = {
  Order: 1762444800000, Currency: '498', Merchant: '265505', SaleAreaCode: 'onlidocumentation_md', Amount: '1235',
  Description: 'Test&Co SRL', CustomerCode: '5555', CustomerNameFirst: 'First name', CustomerNameLast: 'Last name',
  CustomerPhoneNumber: '060000000', CustomerEmail: 'test@gmail.com', ExpiryDate: '2026-12-31T23:59:59',
  LinkUrlCancel: 'https://test.oplta.md/cancel', LinkUrlSuccess: 'https://test.oplta.md/ok', Lang: 'ro', MoneyType: 'Card',
};
const NOTIFICATION = {
  Eventid: 1000001, EventType: 'PAID', EventDate: '2026-11-09T12:00:00',
  Payment: { Id: 1234567, ExternalId: 1762444800000, Merchant: '265505', Customer: '37369XXX111', StatusDate: '2026-11-09T12:00:00', Amount: 1235, PaidAmount: 1235 },
};

// ---- signatures: test vectors from the Signatures page ----
test('checkout RawData and Signature match the documented test vector', () => {
  assert.equal(checkoutRawData(FORM), '12354985555test%40gmail.comFirst%20nameLast%20name060000000Test%26Co%20SRL2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800000onlidocumentation_md');
  assert.equal(checkoutSignature(FORM, CHECKOUT_KEY), 'cxr/+yLYZp34aR0KXLkb2A==');
});

test('notification PreparedString and Hash match the documented test vector', () => {
  assert.equal(notificationPreparedString(NOTIFICATION), '2026-11-09T12:00:001000001PAID123537369XXX111176244480000012345672655052026-11-09T12:00:00');
  assert.equal(notificationHash(NOTIFICATION, NOTIFY_KEY), 'lq3+OCn0J/zSyNF5iAoShg==');
  assert.equal(verifyNotificationHash(NOTIFICATION, 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY), true);
  assert.equal(verifyNotificationHash(NOTIFICATION, 'lq3+OCn0J/zSyNF5iAoShg==', CHECKOUT_KEY), false, 'checkout key must not verify');
});

test('parseNotification: valid, wrong hash, unsigned field changed, bad JSON', () => {
  const raw = JSON.stringify(NOTIFICATION);
  assert.equal(parseNotification(raw, 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY).Payment.Id, 1234567);
  assert.throws(() => parseNotification(raw, 'wrong', NOTIFY_KEY), (e) => e instanceof PaynetError && e.kind === ErrorKind.VALIDATION);
  // PaidAmount is not signed: the hash still matches — that is why confirmNotification exists.
  const tampered = JSON.stringify({ ...NOTIFICATION, Payment: { ...NOTIFICATION.Payment, PaidAmount: 1 } });
  assert.doesNotThrow(() => parseNotification(tampered, 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY));
  assert.throws(() => parseNotification('{not json', 'x', NOTIFY_KEY), (e) => e.kind === ErrorKind.VALIDATION);
});

test('buildCheckoutForm signs the form, escapes HTML, checks required fields', () => {
  const form = buildCheckoutForm({ fields: FORM, secretKey: CHECKOUT_KEY });
  assert.equal(form.action, 'https://test.paynet.md/ecom/checkout');
  assert.equal(form.fields.Signature, 'cxr/+yLYZp34aR0KXLkb2A==');
  assert.match(form.html, /value="Test&amp;Co SRL"/);
  assert.equal(buildCheckoutForm({ fields: FORM, secretKey: CHECKOUT_KEY, environment: 'production' }).action, 'https://paynet.md/ecom/checkout');
  assert.throws(() => buildCheckoutForm({ fields: { Order: 1 }, secretKey: CHECKOUT_KEY }), (e) => e.kind === ErrorKind.RULE && /Missing required/.test(e.message));
});

// ---- time ----
test('Chișinău time: winter UTC+2, summer UTC+3, DST switch', () => {
  assert.equal(chisinauDateTime(new Date('2026-01-15T10:00:00Z')), '2026-01-15T12:00:00');
  assert.equal(chisinauDateTime(new Date('2026-07-01T21:30:00Z')), '2026-07-02T00:30:00');
  assert.equal(chisinauDateTime(new Date('2026-10-25T00:59:59Z')), '2026-10-25T03:59:59');
  assert.equal(chisinauDateTime(new Date('2026-10-25T01:00:00Z')), '2026-10-25T03:00:00');
  assert.equal(chisinauDateTime(new Date('2026-03-29T00:59:59Z')), '2026-03-29T02:59:59');
  assert.equal(chisinauDateTime(new Date('2026-03-29T01:00:00Z')), '2026-03-29T04:00:00');
  assert.equal(chisinauDate(new Date('2026-12-31T22:30:00Z')), '2027-01-01');
  assert.equal(expiryInHours(24, new Date('2026-11-10T10:00:00Z')), '2026-11-11T12:00:00');
});

// ---- client with a fake API ----
const json = (status, body) => new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function fakeApi(handlers) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.replace('https://ecom-api-test.paynet.md', '');
    calls.push({ method: init.method, path, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    if (path === '/auth') return handlers.auth ? handlers.auth(init) : json(200, { access_token: `token-${calls.filter((c) => c.path === '/auth').length}`, expires_in: 14400 });
    const h = handlers[`${init.method} ${path.split('?')[0]}`];
    return h ? h(init, calls) : json(404, undefined);
  };
  return { fetch, calls };
}

test('client caches the token and refreshes it once on 401', async () => {
  let n = 0;
  const api = fakeApi({ 'GET /api/order/1': (init) => (++n === 1 ? json(401, { Status: 401, Code: 'UNAUTHORIZED', Message: 'Unauthorized', TraceId: 't1' }) : json(200, { paymentId: 1, status: 4 })) });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  const payment = await client.getPayment(1);
  assert.equal(payment.status, 4);
  assert.equal(api.calls.filter((c) => c.path === '/auth').length, 2, 'new token after 401');
  assert.equal(api.calls.at(-1).headers.Authorization, 'Bearer token-2');
  await client.getPayment(1);
  assert.equal(api.calls.filter((c) => c.path === '/auth').length, 2, 'token is cached');
});

test('errors: all response formats become PaynetError with kind, code, traceId', async () => {
  const api = fakeApi({
    'POST /api/order': () => json(400, { status: 400, code: 'INVALID_PARAMETER', message: 'Invalid parameter', details: 'Amount', traceId: 'tr-1' }),
    'GET /api/order/abc': () => json(400, { errorInfo: { ppResponseCodeText: 'TECHNICAL_ERROR', ppResponseCodeDescription: 'We are sorry, this service is temporarily unavailable', errors: [{ field: 'id', message: 'The value is not valid' }] } }),
    'GET /api/order/999': () => json(404, { status: 404, code: 'NOT_FOUND_RECORD', message: 'Not found', traceId: 'tr-2' }),
    'GET /api/order/500': () => json(500, { status: 500, code: 'TECHNICAL_ERROR', message: 'Error', traceId: 'tr-3' }),
  });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  await assert.rejects(client.createOrder({ Order: 1 }), (e) => e.kind === ErrorKind.VALIDATION && e.code === 'INVALID_PARAMETER' && e.details === 'Amount' && e.traceId === 'tr-1' && e.httpStatus === 400);
  await assert.rejects(client.getPayment('abc'), (e) => e.kind === ErrorKind.VALIDATION && /not valid/.test(e.message) && !/temporarily unavailable/.test(e.message));
  await assert.rejects(client.getPayment(999), (e) => e.kind === ErrorKind.NOT_FOUND && e.code === 'NOT_FOUND_RECORD');
  await assert.rejects(client.getPayment(500), (e) => e.kind === ErrorKind.SERVER && e.traceId === 'tr-3');
  await assert.rejects(client.request('GET', '/api/nope'), (e) => e.kind === ErrorKind.WRONG_ADDRESS);
});

test('wrong credentials → AUTHENTICATION error', async () => {
  const api = fakeApi({ auth: () => json(401, { status: 401, code: 'AUTHENTICATION_FAILED', message: 'Bad credentials' }) });
  const client = new PaynetClient({ username: 'u', password: 'bad', fetch: api.fetch });
  await assert.rejects(client.getPayment(1), (e) => e.kind === ErrorKind.AUTHENTICATION && e.code === 'AUTHENTICATION_FAILED');
});

test('createOrder repeats the same body once after a network error', async () => {
  let n = 0;
  const api = fakeApi({ 'POST /api/order': () => { if (++n === 1) throw new TypeError('fetch failed'); return json(200, { paymentId: 7, paymentLink: 'https://x' }); } });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  const body = { Order: 42, Services: [{ Name: 'a', Description: 'b', Amount: 300 }] };
  const result = await client.createOrder(body);
  assert.equal(result.paymentId, 7);
  const sent = api.calls.filter((c) => c.path === '/api/order').map((c) => JSON.stringify(c.body));
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1], 'identical body on retry');
});

test('network error after the retry → NETWORK error, retryable', async () => {
  const api = fakeApi({ 'POST /api/order': () => { throw new TypeError('fetch failed'); } });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  await assert.rejects(client.createOrder({ Order: 1 }), (e) => e.kind === ErrorKind.NETWORK && e.retryable === true);
});

test('refund rules are checked before calling the API', async () => {
  const payments = {
    1: { paymentId: 1, status: 4, amount: { amount: 300, paidAmount: 300 }, moneyType: 'CARD' },
    2: { paymentId: 2, status: 1, amount: { amount: 300, paidAmount: null } },
    3: { paymentId: 3, status: 6, amount: { amount: 300, paidAmount: 300 }, paidDate: '2026-11-10' },
    4: { paymentId: 4, status: 5, amount: { amount: 300, paidAmount: 300 }, paidDate: '2026-11-10' },
    5: { paymentId: 5, status: 4, amount: { amount: 300, paidAmount: 300 }, moneyType: 'CASH_INVOICE' },
  };
  const handlers = { 'POST /api/order/refund': (init) => json(200, { ...JSON.parse(init.body), ok: true }) };
  for (const id of Object.keys(payments)) handlers[`GET /api/order/${id}`] = () => json(200, payments[id]);
  const api = fakeApi(handlers);
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  const r = await client.refund({ paymentId: 1, saleAreaCode: 's', amount: 300 });
  assert.equal(r.RefundType, 'full');
  assert.equal((await client.refund({ paymentId: 1, saleAreaCode: 's', amount: 100 })).RefundType, 'partial');
  await assert.rejects(client.refund({ paymentId: 1, saleAreaCode: 's', amount: 301 }), (e) => e.kind === ErrorKind.RULE && /more than the paid/.test(e.message));
  await assert.rejects(client.refund({ paymentId: 2, saleAreaCode: 's', amount: 300 }), (e) => e.kind === ErrorKind.RULE && /not paid/.test(e.message));
  await assert.rejects(client.refund({ paymentId: 3, saleAreaCode: 's', amount: 100 }), (e) => e.kind === ErrorKind.RULE && /already refunded/.test(e.message));
  await assert.rejects(client.refund({ paymentId: 4, saleAreaCode: 's', amount: 100 }), (e) => /already refunded/.test(e.message));
  await assert.rejects(client.refund({ paymentId: 5, saleAreaCode: 's', amount: 300 }), (e) => /CASH_INVOICE/.test(e.message));
  await assert.rejects(client.refund({ paymentId: 1, saleAreaCode: 's', amount: 1.5 }), (e) => e.kind === ErrorKind.RULE);
});

test('confirmNotification compares the notification with the API and your order', async () => {
  const api = fakeApi({ 'GET /api/order/merchant/1762444800000': () => json(200, { paymentId: 1234567, status: 4, amount: { amount: 1235, paidAmount: 1235 }, customer: { code: 'c1' } }) });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  const ok = await confirmNotification(client, NOTIFICATION, { amount: 1235, customerCode: 'c1' });
  assert.equal(ok.ok, true, ok.problems.join(', '));
  const bad = await confirmNotification(client, { ...NOTIFICATION, Payment: { ...NOTIFICATION.Payment, PaidAmount: 1 } }, { amount: 1235, customerCode: 'c1' });
  assert.equal(bad.ok, false);
  assert.ok(bad.problems.some((p) => /PaidAmount/.test(p)));
});

test('statuses', () => {
  assert.equal(PaymentStatus.PAID, 4);
  assert.equal(isFinalStatus(5), true);
  assert.equal(isFinalStatus(3), false);
});

test('constructor validates options', () => {
  assert.throws(() => new PaynetClient({ username: 'u' }), (e) => e.kind === ErrorKind.RULE);
  assert.throws(() => new PaynetClient({ username: 'u', password: 'p', environment: 'prod' }), (e) => /Unknown environment/.test(e.message));
  assert.equal(new PaynetClient({ username: 'u', password: 'p', environment: 'production' }).apiUrl, 'https://ecom-api.paynet.md');
});

test('searchPayments sends Chișinău time and returns [] for an empty period', async () => {
  let query = '';
  const api = fakeApi({ 'GET /api/order/search': (init, calls) => { query = calls.at(-1).path; return json(404, { status: 404, code: 'NOT_FOUND_RECORD', message: 'Record not found' }); } });
  const client = new PaynetClient({ username: 'u', password: 'p', fetch: api.fetch });
  const result = await client.searchPayments({ from: new Date('2026-11-10T10:00:00Z'), to: new Date('2026-11-10T11:00:00Z') });
  assert.deepEqual(result, { payments: [] });
  assert.equal(decodeURIComponent(query), '/api/order/search?from=2026-11-10T12:00:00&to=2026-11-10T13:00:00');
});
