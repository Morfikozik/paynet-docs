// Reference implementations of the Paynet signature algorithms.
// Used by scripts/check-signature-vectors.mjs to prove that the test vectors
// published in the documentation are correct. Pure Node.js, no dependencies.
import crypto from 'node:crypto';

const normalize = (value) => (value === null || value === undefined ? '' : String(value));
const md5Base64 = (text) => crypto.createHash('md5').update(text, 'utf8').digest('base64');

/** RFC 3986 percent-encoding (same as encodeURIComponent plus ! ' ( ) *). */
export const encodeRfc3986 = (value) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Fields that take part in the hosted checkout (v0.6) signature. */
export const CHECKOUT_SIGNED_FIELDS = [
  'Order', 'Currency', 'Merchant', 'SaleAreaCode', 'CustomerCode', 'CustomerNameFirst',
  'CustomerNameLast', 'CustomerPhoneNumber', 'CustomerEmail', 'ExpiryDate', 'Description',
  'Amount', 'LinkUrlCancel', 'LinkUrlSuccess', 'Lang', 'MoneyType',
];

/** Hosted checkout v0.6: sort signed field names A→Z, RFC 3986-encode each value, concatenate. */
export const checkoutRawData = (payload) =>
  CHECKOUT_SIGNED_FIELDS
    .filter((key) => payload[key] !== undefined && payload[key] !== null)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => encodeRfc3986(normalize(payload[key])))
    .join('');

export const checkoutSignature = (payload, secretKey) => md5Base64(checkoutRawData(payload) + secretKey);

/** Notification: fixed field order (alphabetical by full field path). */
export const notificationPreparedString = (n) =>
  normalize(n.EventDate) +
  normalize(n.Eventid) +
  normalize(n.EventType) +
  normalize(n.Payment?.Amount) +
  normalize(n.Payment?.Customer) +
  normalize(n.Payment?.ExternalId) +
  normalize(n.Payment?.Id) +
  normalize(n.Payment?.Merchant) +
  normalize(n.Payment?.StatusDate);

export const notificationHash = (notification, secretKey) =>
  md5Base64(notificationPreparedString(notification) + secretKey);
