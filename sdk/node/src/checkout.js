// Hosted checkout (client-server): a signed HTML form the customer's browser posts to Paynet.
// Compute the signature on YOUR SERVER — the secret key must never reach the browser.
import { PaynetError, ErrorKind } from './errors.js';
import { checkoutSignature, CHECKOUT_SIGNED_FIELDS } from './signatures.js';
import { Environment } from './client.js';
import { expiryInHours } from './time.js';

const REQUIRED = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'Amount', 'Description', 'ExpiryDate', 'LinkUrlSuccess', 'LinkUrlCancel', 'Lang', 'MoneyType'];
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Builds the checkout form.
 * @param {object} p
 * @param {object} p.fields       form fields (see the Hosted checkout guide). Currency defaults to 498,
 *                                ExpiryDate to now + 24 h (Chișinău time).
 * @param {string} p.secretKey    hosted checkout secret key (not the notification key)
 * @param {'test'|'production'} [p.environment='test']
 * @returns {{ action: string, fields: object, html: string }}
 */
export function buildCheckoutForm({ fields, secretKey, environment = 'test', autoSubmit = false }) {
  if (!secretKey) throw new PaynetError({ message: 'secretKey (hosted checkout key) is required', kind: ErrorKind.RULE });
  const all = { Currency: 498, ExpiryDate: expiryInHours(24), ...fields };
  const missing = REQUIRED.filter((name) => all[name] === undefined || all[name] === null || all[name] === '');
  if (missing.length) throw new PaynetError({ message: `Missing required checkout fields: ${missing.join(', ')}`, kind: ErrorKind.RULE });
  const signed = { ...all, Signature: checkoutSignature(all, secretKey) };
  const action = Environment[environment]?.checkoutUrl;
  if (!action) throw new PaynetError({ message: `Unknown environment "${environment}"`, kind: ErrorKind.RULE });
  const inputs = Object.entries(signed)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `  <input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`)
    .join('\n');
  const html = `<form id="paynet-checkout" method="POST" action="${escapeHtml(action)}">\n${inputs}\n  <button type="submit">Pay</button>\n</form>${autoSubmit ? '\n<script>document.getElementById("paynet-checkout").submit();</script>' : ''}`;
  return { action, fields: signed, html };
}

export { CHECKOUT_SIGNED_FIELDS };
