// Paynet signatures: Base64( MD5( <string> + secretKey ) ) over UTF-8.
import crypto from 'node:crypto';

export const md5Base64 = (text) => crypto.createHash('md5').update(text, 'utf8').digest('base64');

/** Signed fields of the hosted checkout form (sorted by name when signing). */
export const CHECKOUT_SIGNED_FIELDS = Object.freeze([
  'Amount', 'Currency', 'CustomerCode', 'CustomerEmail', 'CustomerNameFirst', 'CustomerNameLast',
  'CustomerPhoneNumber', 'Description', 'ExpiryDate', 'Lang', 'LinkUrlCancel', 'LinkUrlSuccess',
  'Merchant', 'MoneyType', 'Order', 'SaleAreaCode',
]);

/** RFC 3986 percent-encoding (encodeURIComponent plus ! ' ( ) *). */
export const rfc3986 = (value) =>
  encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** RawData of the checkout form: signed values that are present, sorted by field name, encoded, concatenated. */
export function checkoutRawData(fields) {
  return [...CHECKOUT_SIGNED_FIELDS]
    .sort()
    .filter((name) => fields[name] !== undefined && fields[name] !== null)
    .map((name) => rfc3986(fields[name]))
    .join('');
}

export function checkoutSignature(fields, secretKey) {
  return md5Base64(checkoutRawData(fields) + secretKey);
}

/** PreparedString of a notification: 9 values in this exact order (do not sort). */
export function notificationPreparedString(notification) {
  const p = notification?.Payment || {};
  return [notification?.EventDate, notification?.Eventid, notification?.EventType, p.Amount, p.Customer, p.ExternalId, p.Id, p.Merchant, p.StatusDate]
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join('');
}

export function notificationHash(notification, secretKey) {
  return md5Base64(notificationPreparedString(notification) + secretKey);
}

/** Constant-time comparison of the Hash header with the expected hash. */
export function verifyNotificationHash(notification, hashHeader, secretKey) {
  const expected = Buffer.from(notificationHash(notification, secretKey));
  const received = Buffer.from(String(hashHeader || ''));
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
