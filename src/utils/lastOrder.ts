/**
 * Remembers the last order created from this portal (in this browser only),
 * so other tools can pre-fill it. Works across browser tabs via the `storage` event.
 */
import React from 'react';

const KEY = 'paynet_last_order';
const EVENT = 'paynet-last-order';

export type LastOrder = { order: string; paymentId?: string; source: 'api' | 'checkout-form'; createdAt: number };

export function saveLastOrder(order: unknown, source: LastOrder['source'], paymentId?: unknown) {
  const value = String(order ?? '').trim();
  if (!/^\d+$/.test(value)) return;
  const record: LastOrder = {
    order: value,
    paymentId: paymentId === undefined || paymentId === null ? undefined : String(paymentId),
    source,
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable: nothing to remember */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function readLastOrder(): LastOrder | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastOrder;
    return parsed && typeof parsed.order === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Current last order; updates when an order is created in this tab or in another tab. */
export function useLastOrder(): LastOrder | null {
  const [lastOrder, setLastOrder] = React.useState<LastOrder | null>(() => readLastOrder());
  React.useEffect(() => {
    const refresh = () => setLastOrder(readLastOrder());
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) refresh();
    };
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return lastOrder;
}
