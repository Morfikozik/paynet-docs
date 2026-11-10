// Paynet e-commerce API client (Node.js 18+, no dependencies).
import { PaynetError, ErrorKind, errorFromResponse } from './errors.js';
import { chisinauDate } from './time.js';
import { PaymentStatus } from './status.js';

export const Environment = Object.freeze({
  test: { apiUrl: 'https://ecom-api-test.paynet.md', checkoutUrl: 'https://test.paynet.md/ecom/checkout' },
  production: { apiUrl: 'https://ecom-api.paynet.md', checkoutUrl: 'https://paynet.md/ecom/checkout' },
});

export class PaynetClient {
  /**
   * @param {object} options
   * @param {string} options.username     API username
   * @param {string} options.password     API password
   * @param {'test'|'production'} [options.environment='test']
   * @param {string} [options.apiUrl]     overrides the environment URL
   * @param {number} [options.timeoutMs=30000]
   * @param {typeof fetch} [options.fetch]
   */
  constructor({ username, password, environment = 'test', apiUrl, timeoutMs = 30000, fetch: fetchImpl } = {}) {
    if (!username || !password) throw new PaynetError({ message: 'username and password are required', kind: ErrorKind.RULE });
    if (!apiUrl && !Environment[environment]) throw new PaynetError({ message: `Unknown environment "${environment}" (use "test" or "production")`, kind: ErrorKind.RULE });
    this.username = username;
    this.password = password;
    this.apiUrl = (apiUrl || Environment[environment].apiUrl).replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl || globalThis.fetch;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  // ---------- low level ----------

  async #send(method, path, { body, auth = true, binary = false } = {}) {
    const headers = {};
    if (auth) headers.Authorization = `Bearer ${await this.getToken()}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await this.fetch(this.apiUrl + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      throw new PaynetError({
        message: `No response from Paynet (${method} ${path}): ${cause?.message || cause}`,
        kind: ErrorKind.NETWORK,
        retryable: true,
        hint: 'Network problem or timeout. For createOrder: check the order with getPaymentByOrder(Order), then repeat the same request unchanged.',
        cause,
      });
    }
    if (binary && response.ok) return { status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: response.headers };
    const text = await response.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: response.status, body: json, headers: response.headers };
  }

  /** Calls the API; on 401 gets a new token and repeats the request once. */
  async request(method, path, { body, binary = false } = {}) {
    let result = await this.#send(method, path, { body, binary });
    if (result.status === 401) {
      this.token = null;
      result = await this.#send(method, path, { body, binary });
    }
    if (result.status < 200 || result.status >= 300) throw errorFromResponse(result.status, result.body);
    return result.body;
  }

  /** Returns a valid token (cached; refreshed 5 minutes before it expires). */
  async getToken(force = false) {
    if (!force && this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const result = await this.#send('POST', '/auth', { auth: false, body: { grantType: 'password', username: this.username, password: this.password } });
    if (result.status !== 200 || !result.body?.access_token) throw errorFromResponse(result.status, result.body, { isAuth: true });
    this.token = result.body.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(60, (result.body.expires_in || 3600) - 300) * 1000;
    return this.token;
  }

  // ---------- payments ----------

  /**
   * Creates an order (POST /api/order) and returns { paymentId, paymentLink, ... }.
   * Store `order` (the request body) with your order: to retry, send exactly the same body —
   * Paynet then returns the same payment. Any change in the data, or a repeat after payment, gives 500.
   * After a network error the request is repeated once with the same body.
   */
  async createOrder(order) {
    if (!order || typeof order !== 'object') throw new PaynetError({ message: 'order must be an object', kind: ErrorKind.RULE });
    try {
      return await this.request('POST', '/api/order', { body: order });
    } catch (error) {
      if (error instanceof PaynetError && error.kind === ErrorKind.NETWORK) return this.request('POST', '/api/order', { body: order });
      throw error;
    }
  }

  /** GET /api/order/{paymentId} */
  getPayment(paymentId) {
    return this.request('GET', `/api/order/${encodeURIComponent(paymentId)}`);
  }

  /** GET /api/order/merchant/{Order} — by your order number. Paid when status = 4. */
  getPaymentByOrder(order) {
    return this.request('GET', `/api/order/merchant/${encodeURIComponent(order)}`);
  }

  /** GET /api/order/search — payments in a period. Dates: Date objects or ISO strings. */
  searchPayments({ from, to }) {
    const iso = (d) => (d instanceof Date ? d.toISOString() : String(d));
    return this.request('GET', `/api/order/search?from=${encodeURIComponent(iso(from))}&to=${encodeURIComponent(iso(to))}`);
  }

  /** True when the payment for this Order is paid (status 4). */
  async isPaid(order) {
    const payment = await this.getPaymentByOrder(order);
    return payment?.status === PaymentStatus.PAID;
  }

  // ---------- refunds ----------

  /**
   * Refund (POST /api/order/refund). The result comes in the response — there is no callback.
   * Production rules: ONE refund per payment (full or partial), within 180 days, at most PaidAmount,
   * not for CASH_INVOICE. With checkFirst (default) the SDK reads the payment first and refuses a refund
   * that would break these rules, so you get a clear error instead of an API error.
   *
   * @param {object} p
   * @param {number} p.paymentId
   * @param {string} p.saleAreaCode
   * @param {number} p.amount            minor units (300 = 3.00 MDL)
   * @param {'full'|'partial'} [p.type]  default: 'full' when amount equals PaidAmount, otherwise 'partial'
   * @param {string} [p.reason]
   * @param {boolean} [p.checkFirst=true]
   */
  async refund({ paymentId, saleAreaCode, amount, type, reason = 'Refund', currency = 498, checkFirst = true }) {
    if (!Number.isInteger(amount) || amount <= 0) throw new PaynetError({ message: 'amount must be a positive integer in minor units (300 = 3.00 MDL)', kind: ErrorKind.RULE });
    if (type && type !== 'full' && type !== 'partial') throw new PaynetError({ message: 'type must be "full" or "partial"', kind: ErrorKind.RULE });
    let refundType = type;
    if (checkFirst) {
      const payment = await this.getPayment(paymentId);
      const paid = payment?.amount?.paidAmount ?? payment?.amount?.amount;
      const rule = (message) => new PaynetError({ message, kind: ErrorKind.RULE, hint: 'Production rule: one refund per payment, within 180 days, at most PaidAmount, not for CASH_INVOICE.' });
      if (payment?.status === PaymentStatus.PARTIALLY_REFUNDED || (payment?.status === PaymentStatus.CANCELLED && payment?.paidDate)) throw rule(`Payment ${paymentId} was already refunded (status ${payment.status}). Only one refund per payment is allowed.`);
      if (payment?.status !== PaymentStatus.PAID) throw rule(`Payment ${paymentId} is not paid (status ${payment?.status}). Only paid payments (status 4) can be refunded.`);
      if (String(payment?.moneyType || '').toUpperCase().includes('CASH')) throw rule('Refunds are not available for CASH_INVOICE payments.');
      if (paid !== undefined && amount > paid) throw rule(`Refund amount ${amount} is more than the paid amount ${paid}.`);
      if (!refundType) refundType = paid !== undefined && amount === paid ? 'full' : 'partial';
    }
    return this.request('POST', '/api/order/refund', {
      body: { PaymentId: paymentId, SaleAreaCode: saleAreaCode, RefundType: refundType || 'full', Amount: amount, Currency: currency, Reason: reason },
    });
  }

  // ---------- saved cards ----------

  /** Deletes a saved card (POST /api/linked-cards/unlink). The token works only with the same customerCode. */
  unlinkCard({ cardLinkHash, saleAreaCode, customerCode }) {
    return this.request('POST', '/api/linked-cards/unlink', { body: { CardLinkHash: cardLinkHash, SaleAreaCode: saleAreaCode, CustomerCode: customerCode } });
  }

  // ---------- statements ----------

  /** GET /api/statement. Dates: Date objects (converted to Chișinău date) or 'YYYY-MM-DD'. */
  getStatement({ dateStart, dateFinish, accountId } = {}) {
    const d = (v) => (v instanceof Date ? chisinauDate(v) : String(v));
    const account = accountId !== undefined ? `&accountId=${encodeURIComponent(accountId)}` : '';
    return this.request('GET', `/api/statement?dateStart=${d(dateStart)}&dateFinish=${d(dateFinish)}${account}`);
  }

  /** GET /api/statement/download — returns the .xlsx file as a Buffer. Period of at most 31 days. */
  downloadStatement({ dateStart, dateFinish }) {
    const d = (v) => (v instanceof Date ? chisinauDate(v) : String(v));
    return this.request('GET', `/api/statement/download?dateStart=${d(dateStart)}&dateFinish=${d(dateFinish)}`, { binary: true });
  }
}
