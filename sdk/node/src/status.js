/** Payment statuses (field `status`). 5 and 6 are final. */
export const PaymentStatus = Object.freeze({
  REGISTERED: 1, // created, not paid yet (the same paymentLink can be opened again)
  PROCESSING: 3, // payment in progress — wait, do not create a new order (can last up to about a day)
  PAID: 4,
  CANCELLED: 5, // final: bank decline, antifraud, 3-D Secure failed, or full refund. A new attempt needs a new Order.
  PARTIALLY_REFUNDED: 6, // final
});

export const isFinalStatus = (status) => status === PaymentStatus.CANCELLED || status === PaymentStatus.PARTIALLY_REFUNDED;

export function describeStatus(status) {
  switch (status) {
    case PaymentStatus.REGISTERED: return 'registered, not paid';
    case PaymentStatus.PROCESSING: return 'processing — wait';
    case PaymentStatus.PAID: return 'paid';
    case PaymentStatus.CANCELLED: return 'cancelled (final)';
    case PaymentStatus.PARTIALLY_REFUNDED: return 'partially refunded (final)';
    default: return `unknown status ${status}`;
  }
}
