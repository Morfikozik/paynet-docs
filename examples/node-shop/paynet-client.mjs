// paynet-client.mjs — minimal Paynet e-commerce API client (Node.js 18+, no dependencies).
// Covers: token caching, create order (with safe retry), payment lookup, refund.

export function createPaynetClient({ apiUrl, username, password, fetch = globalThis.fetch }) {
  let token = null;
  let tokenExpiresAt = 0;

  async function getToken(force = false) {
    if (!force && token && Date.now() < tokenExpiresAt) return token;
    const response = await fetch(`${apiUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grantType: 'password', username, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.access_token) throw new Error(`Paynet auth failed: HTTP ${response.status}`);
    token = body.access_token;
    // Refresh 5 minutes before the token expires (expires_in is in seconds, about 4 hours).
    tokenExpiresAt = Date.now() + Math.max(60, (body.expires_in || 3600) - 300) * 1000;
    return token;
  }

  // Calls the API with the cached token; on 401 gets a new token and retries once.
  async function call(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await getToken(attempt > 0)}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status === 401 && attempt === 0) continue;
      const text = await response.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      return { status: response.status, body: json };
    }
  }

  return {
    getToken,

    // Create an order. requestBody must be stored with the order: a retry must resend it
    // unchanged (Paynet returns the same payment only for exactly the same data).
    async createOrder(requestBody) {
      try {
        return await call('POST', '/api/order', requestBody);
      } catch (networkError) {
        // Timeout or connection error: safe to retry once with the very same body.
        return await call('POST', '/api/order', requestBody);
      }
    },

    getPaymentByOrder(order) {
      return call('GET', `/api/order/merchant/${order}`);
    },

    refund({ paymentId, saleAreaCode, type, amount, reason }) {
      return call('POST', '/api/order/refund', {
        PaymentId: paymentId,
        SaleAreaCode: saleAreaCode,
        RefundType: type, // 'full' or 'partial'
        Amount: amount,
        Currency: 498,
        Reason: reason,
      });
    },
  };
}

// ExpiryDate in Chișinău local time (Europe/Chisinau), format YYYY-MM-DDTHH:mm:ss.
export function chisinauDateTime(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Chisinau', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
