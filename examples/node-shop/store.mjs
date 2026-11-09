// store.mjs — tiny JSON-file storage for the example. Replace it with your database.
import fs from 'node:fs';

export function createStore(file) {
  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { orders: {}, notifications: {}, cards: {}, review: [] };
    }
  };
  let data = load();
  const save = () => fs.writeFileSync(file, JSON.stringify(data, null, 2));

  return {
    // ---- orders -----------------------------------------------------------
    createOrder(order) {
      data.orders[order.order] = { ...order, state: 'created', createdAt: new Date().toISOString() };
      save();
      return data.orders[order.order];
    },
    getOrder(order) {
      return data.orders[order] || null;
    },
    updateOrder(order, changes) {
      data.orders[order] = { ...data.orders[order], ...changes };
      save();
      return data.orders[order];
    },
    listOrders() {
      return Object.values(data.orders).sort((a, b) => b.order - a.order);
    },
    reviewList() {
      return data.review;
    },

    // ---- interface used by the notification handler (paynet-notifications.mjs) ----
    async saveNotificationOnce(paymentId, notification) {
      if (data.notifications[paymentId]) return false;
      data.notifications[paymentId] = { receivedAt: new Date().toISOString(), notification };
      save();
      return true;
    },
    async findOrder(order) {
      const o = data.orders[order];
      return o ? { amount: o.amount, customerCode: o.customerCode, promotionAgreed: false } : null;
    },
    async markPaid(order, paidAmount) {
      if (data.orders[order]) data.orders[order] = { ...data.orders[order], state: 'paid', paidAmount, paidAt: new Date().toISOString() };
      save();
    },
    async saveCard(customerCode, cardLinkHash) {
      data.cards[customerCode] = { cardLinkHash, savedAt: new Date().toISOString() };
      save();
    },
    async sendToReview(order, problems) {
      data.review.push({ order, problems, at: new Date().toISOString() });
      if (data.orders[order]) data.orders[order] = { ...data.orders[order], state: 'review', problems };
      save();
    },
    getCard(customerCode) {
      return data.cards[customerCode]?.cardLinkHash || null;
    },
  };
}
