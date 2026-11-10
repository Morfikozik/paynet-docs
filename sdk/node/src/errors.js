// Paynet API errors in one shape, whatever format the API used.
//
// The API answers errors in several formats (checked on the test environment):
//   { status, code, message, details, traceId }            — most errors (lowercase keys)
//   { Status, Code, Message, TraceId }                      — 401 for a missing / invalid token
//   { errorInfo: { ppResponseCode, errors: [...] } }        — unreadable request, missing fields, wrong types
//   empty body                                              — 404 wrong path, 405 wrong method, 415 wrong Content-Type

/** What kind of problem it is — decides what the merchant should do. */
export const ErrorKind = Object.freeze({
  VALIDATION: 'validation', // 400: fix the request
  AUTHENTICATION: 'authentication', // 401 /auth: wrong username or password
  UNAUTHORIZED: 'unauthorized', // 401: token missing / expired (the client already retried once)
  NOT_FOUND: 'not_found', // 404 NOT_FOUND_RECORD: no such payment; refund of an unpaid payment
  WRONG_ADDRESS: 'wrong_address', // 404 with empty body: wrong path
  METHOD_NOT_ALLOWED: 'method_not_allowed', // 405
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type', // 415
  SERVER: 'server', // 500 TECHNICAL_ERROR: repeated Order with other data, or a Paynet failure
  NETWORK: 'network', // no response: timeout, DNS, connection
  RULE: 'rule', // rejected by the SDK before calling the API (for example, a second refund)
});

export class PaynetError extends Error {
  /**
   * @param {object} p
   * @param {string} p.message
   * @param {string} p.kind        one of ErrorKind
   * @param {number|null} [p.httpStatus]
   * @param {string|null} [p.code]  Paynet error code, e.g. INVALID_PARAMETER
   * @param {*} [p.details]         field name(s) or list of field errors
   * @param {string|null} [p.traceId]  send it to Paynet support
   * @param {boolean} [p.retryable] whether repeating the same request can succeed
   * @param {string} [p.hint]       what to do
   * @param {*} [p.body]            raw response body
   */
  constructor({ message, kind, httpStatus = null, code = null, details = null, traceId = null, retryable = false, hint = '', body = null, cause }) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PaynetError';
    this.kind = kind;
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
    this.traceId = traceId;
    this.retryable = retryable;
    this.hint = hint;
    this.body = body;
  }
}

const pick = (obj, key) => (obj ? obj[key] ?? obj[key.charAt(0).toUpperCase() + key.slice(1)] : undefined);

/** Builds a PaynetError from an HTTP error response. */
export function errorFromResponse(httpStatus, body, { isAuth = false } = {}) {
  const info = body && typeof body === 'object' ? body.errorInfo : null;
  const code = info ? info.ppResponseCodeText || 'errorInfo' : pick(body, 'code') || null;
  const message =
    (info && (info.errors?.map?.((e) => e.message || e.field || JSON.stringify(e)).join('; ') || info.ppResponseCodeText)) ||
    pick(body, 'message') ||
    pick(body, 'title') ||
    `HTTP ${httpStatus}`;
  const details = info ? info.errors ?? null : pick(body, 'details') ?? null;
  const traceId = pick(body, 'traceId') ?? info?.traceId ?? null;
  const empty = body === null || body === undefined || body === '';

  let kind;
  let retryable = false;
  let hint;
  if (httpStatus === 400) {
    kind = ErrorKind.VALIDATION;
    hint = 'Fix the request: see details. Repeat only after fixing.';
  } else if (httpStatus === 401 && (isAuth || code === 'AUTHENTICATION_FAILED')) {
    kind = ErrorKind.AUTHENTICATION;
    hint = 'Check username and password (test and production credentials are different).';
  } else if (httpStatus === 401) {
    kind = ErrorKind.UNAUTHORIZED;
    hint = 'The token was refreshed and the request repeated once, still 401: check the credentials.';
  } else if (httpStatus === 404 && empty) {
    kind = ErrorKind.WRONG_ADDRESS;
    hint = 'Wrong API address or path: check apiUrl.';
  } else if (httpStatus === 404) {
    kind = ErrorKind.NOT_FOUND;
    hint = 'No payment with this ID, or the payment is not paid (for a refund). Check paymentId / Order and the status.';
  } else if (httpStatus === 405) {
    kind = ErrorKind.METHOD_NOT_ALLOWED;
    hint = 'Wrong HTTP method.';
  } else if (httpStatus === 415) {
    kind = ErrorKind.UNSUPPORTED_MEDIA_TYPE;
    hint = 'Send JSON with Content-Type: application/json.';
  } else {
    kind = ErrorKind.SERVER;
    hint =
      'For POST /api/order: first check the order with getPaymentByOrder(Order). A repeated Order with different data or after payment gives 500; use a new Order. Otherwise retry later and send traceId to Paynet support.';
  }
  return new PaynetError({ message: `Paynet API error ${httpStatus}${code ? ' ' + code : ''}: ${message}`, kind, httpStatus, code, details, traceId, retryable, hint, body });
}
