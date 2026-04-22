import React from 'react';
import { Bell, ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { getAuthToken, setAuthToken } from '../utils/apiTester';

type NotificationFieldRow = {
  name: string;
  type: string;
  input: 'body';
  required: boolean;
  description: string;
};

export const ClientServerNotification: React.FC = () => {
  const authUrl = 'https://ecom-api-test.paynet.md/auth';
  const paymentsApiBaseUrl = 'https://ecom-api-test.paynet.md';
  const defaultAuthPayload = {
    grantType: 'password',
    username: '771064',
    password: 'sLgMnGWJ',
  };

  const [isExpanded, setIsExpanded] = React.useState(true);
  const [notificationCallbackUrl, setNotificationCallbackUrl] = React.useState('https://your-domain.com/paynet/notification');
  const [isSendingNotification, setIsSendingNotification] = React.useState(false);
  const [notificationResult, setNotificationResult] = React.useState('');
  const [notificationError, setNotificationError] = React.useState('');
  const [transactionId, setTransactionId] = React.useState('');
  const [isGettingPaymentStatus, setIsGettingPaymentStatus] = React.useState(false);
  const [paymentStatusResult, setPaymentStatusResult] = React.useState('');
  const [paymentStatusError, setPaymentStatusError] = React.useState('');
  const [paymentInfoForNotification, setPaymentInfoForNotification] = React.useState<any | null>(null);
  const [hasCompletedGet, setHasCompletedGet] = React.useState(false);
  const fieldRows: NotificationFieldRow[] = [
    { name: 'Eventid', type: 'long', input: 'body', required: true, description: 'Unique notification identifier.' },
    { name: 'EventType', type: 'string', input: 'body', required: true, description: 'Notification event type (for example: Paid).' },
    { name: 'EventDate', type: 'datetime', input: 'body', required: true, description: 'Notification timestamp (ISO 8601).' },
    { name: 'Payment.ID', type: 'long', input: 'body', required: true, description: 'Paynet payment identifier (use as idempotency key).' },
    { name: 'Payment.ExternalID', type: 'long', input: 'body', required: true, description: 'Partner payment/order identifier.' },
    { name: 'Payment.Merchant', type: 'string', input: 'body', required: true, description: 'Partner merchant code.' },
    { name: 'Payment.Customer', type: 'string', input: 'body', required: false, description: 'Customer identifier from partner side.' },
    { name: 'Payment.StatusDate', type: 'datetime', input: 'body', required: true, description: 'Date when payment reached reported status.' },
    { name: 'Payment.Amount', type: 'long', input: 'body', required: true, description: 'Payment amount in integer format.' },
    { name: 'Header.Authorization', type: 'string', input: 'body', required: true, description: 'Bearer token used by Paynet service call.' },
    { name: 'Header.Hash', type: 'string', input: 'body', required: true, description: 'Signature/hash header for notification verification.' },
  ];

  const sendNotification = async () => {
    if (!hasCompletedGet) {
      setNotificationError('Please run Get first to load transaction data before sending notification.');
      return;
    }

    if (!notificationCallbackUrl.trim()) {
      setNotificationError('Notification URL is required.');
      return;
    }

    setIsSendingNotification(true);
    setNotificationError('');
    setNotificationResult('');

    const resolvedStatus = paymentStatusResult || resolvePaymentStatus(paymentInfoForNotification);
    const paymentId = Number(paymentInfoForNotification?.paymentId ?? paymentInfoForNotification?.id ?? transactionId);
    const externalId = Number(paymentInfoForNotification?.order ?? paymentInfoForNotification?.externalID ?? paymentId);
    const amountValue = Number(
      paymentInfoForNotification?.amount?.amount ??
        paymentInfoForNotification?.amount?.requestAmount ??
        paymentInfoForNotification?.amount ??
        0
    );

    const mockNotification = {
      Eventid: Date.now(),
      EventType: resolvedStatus === 'paid' ? 'Paid' : 'Fail',
      EventDate: new Date().toISOString(),
      Payment: {
        ID: Number.isFinite(paymentId) ? paymentId : Date.now(),
        ExternalID: Number.isFinite(externalId) ? externalId : Date.now(),
        Merchant: String(paymentInfoForNotification?.merchantCode ?? '265505'),
        Customer: String(paymentInfoForNotification?.customer?.code ?? paymentInfoForNotification?.customerCode ?? ''),
        StatusDate: paymentInfoForNotification?.paidDate ?? paymentInfoForNotification?.registered ?? new Date().toISOString(),
        Amount: Number.isFinite(amountValue) ? amountValue : 0,
      },
      Header: {
        Authorization: 'Bearer test-notification-token',
        Hash: 'test-notification-hash',
      },
    };

    try {
      const response = await fetch(notificationCallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(mockNotification),
      });

      const rawText = await response.text();
      let formatted = rawText;
      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        // Keep raw response text when it is not JSON.
      }

      setNotificationResult(`Status: ${response.status} ${response.statusText}\n\n${formatted}`);
    } catch (error) {
      setNotificationError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Browser CORS restrictions may block direct calls.'
      );
    } finally {
      setIsSendingNotification(false);
    }
  };

  const resolvePaymentStatus = (data: any): 'paid' | 'fail' => {
    const statusTextCandidates = [
      data?.eventType,
      data?.paymentStatus,
      data?.statusText,
      typeof data?.status === 'string' ? data.status : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const paidByText =
      statusTextCandidates.includes('paid') ||
      statusTextCandidates.includes('success') ||
      statusTextCandidates.includes('approved') ||
      statusTextCandidates.includes('complete');
    if (paidByText) return 'paid';

    if (data?.paidDate) return 'paid';
    return 'fail';
  };

  const requestAuthToken = async () => {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(defaultAuthPayload),
    });

    if (!response.ok) {
      throw new Error(`Auth failed with status ${response.status}`);
    }

    const data = await response.json();
    const token =
      typeof data?.access_token === 'string'
        ? data.access_token
        : typeof data?.token === 'string'
          ? data.token
          : '';

    if (!token) {
      throw new Error('Auth response does not contain access token.');
    }

    setAuthToken(token);
    return token;
  };

  const getOrCreateAuthToken = async () => {
    const currentToken = getAuthToken();
    if (currentToken) return currentToken;
    return requestAuthToken();
  };

  const getPaymentInfoById = async () => {
    if (!transactionId.trim()) {
      setPaymentStatusError('Transaction ID is required.');
      return;
    }

    const trimmedTransactionId = transactionId.trim();
    const requestUrl = `${paymentsApiBaseUrl}/api/order/merchant/${encodeURIComponent(trimmedTransactionId)}`;

    setIsGettingPaymentStatus(true);
    setPaymentStatusError('');
    setPaymentStatusResult('');
    setHasCompletedGet(false);
    setPaymentInfoForNotification(null);

    try {
      let token = await getOrCreateAuthToken();

      let response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      // If cached token is expired/invalid, refresh token once and retry automatically.
      if (response.status === 401) {
        token = await requestAuthToken();
        response = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }

      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      const normalizedData =
        data && typeof data === 'object'
          ? { ...data, _httpStatus: response.status, _transactionId: trimmedTransactionId }
          : { _httpStatus: response.status, _transactionId: trimmedTransactionId };

      setPaymentInfoForNotification(normalizedData);
      setHasCompletedGet(true);

      if (!response.ok) {
        const notFound = response.status === 404 || normalizedData?.code === 'NOT_FOUND_RECORD';
        setPaymentStatusResult(notFound ? "Fail - transaction doesen't exist" : 'fail');
        return;
      }

      if (normalizedData?.code === 'NOT_FOUND_RECORD') {
        setPaymentStatusResult("Fail - transaction doesen't exist");
        return;
      }

      setPaymentStatusResult(resolvePaymentStatus(normalizedData));
    } catch (error) {
      setPaymentStatusError(
        `Get payment info failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
          'Browser CORS restrictions may block direct calls.'
      );
      setPaymentStatusResult('fail');
      setHasCompletedGet(false);
      setPaymentInfoForNotification(null);
    } finally {
      setIsGettingPaymentStatus(false);
    }
  };

  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-2 sm:mb-3">
          <span className="text-xs font-mono px-2 py-1 rounded bg-blue-100 text-blue-700 font-semibold">POST</span>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Notification</h1>
        </div>
      </div>

      <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-paynet-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-paynet-primary" />
            <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">Notification</h2>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-paynet-primary transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 text-paynet-primary transition-transform" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4 sm:p-6 pt-0">
            <div className="bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Method Description</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                Paynet sends payment status notifications to your callback endpoint after payment processing events.
                Notifications are server-to-server calls and should be handled by your backend.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-paynet-gray-700">
                <li>Use a dedicated `POST` endpoint in your system to receive notification payloads.</li>
                <li>Validate notification signature using the shared `SecretKey` before processing business logic.</li>
                <li>Treat Paynet `Payment.ID` as an idempotency key to avoid duplicate processing.</li>
                <li>Return HTTP `200` only after successful validation and processing.</li>
                <li>Store incoming payload and trace identifiers for audit and troubleshooting.</li>
              </ul>
            </div>

            <div className="mt-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Notification endpoint</h3>
              <div className="mb-2">
                <div className="max-w-2xl">
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">MerchantSystemUrl (callback URL)</label>
                  <input
                    value={notificationCallbackUrl}
                    onChange={(e) => setNotificationCallbackUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono"
                    placeholder="https://your-domain.com/paynet/notification"
                  />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-paynet-gray-600">
                Set the public HTTPS endpoint that will receive Paynet notification payloads.
              </p>
              <div className="mt-4 max-w-xl">
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Transaction ID</label>
                <div className="flex gap-2">
                  <input
                    value={transactionId}
                    onChange={(e) => {
                      setTransactionId(e.target.value);
                      setHasCompletedGet(false);
                      setPaymentInfoForNotification(null);
                    }}
                    className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono"
                    placeholder="317184"
                  />
                  <button
                    onClick={getPaymentInfoById}
                    disabled={isGettingPaymentStatus}
                    className="px-4 py-2 bg-paynet-primary hover:bg-paynet-secondary disabled:bg-gray-400 text-white text-sm font-medium rounded-md"
                  >
                    {isGettingPaymentStatus ? 'Getting...' : 'Get'}
                  </button>
                </div>
              </div>
              {paymentStatusError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {paymentStatusError}
                </div>
              )}
              {paymentStatusResult && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Payment status</label>
                  <div
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold ${
                      paymentStatusResult === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {paymentStatusResult}
                  </div>
                </div>
              )}
              <div className="mt-4">
                <button
                  onClick={sendNotification}
                  disabled={isSendingNotification || !hasCompletedGet}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md"
                >
                  {isSendingNotification ? 'Sending...' : 'Send notification'}
                </button>
              </div>
              {notificationError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {notificationError}
                </div>
              )}
              {notificationResult && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Notification response</label>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {notificationResult}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-1">Parameters - Description</h3>
              <div className="overflow-x-auto rounded-lg border border-paynet-gray-200 w-full">
                <table className="w-full">
                  <thead className="bg-paynet-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">In</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">Required</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-paynet-primary">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paynet-gray-200">
                    {fieldRows.map((row) => (
                      <tr key={row.name} className="hover:bg-paynet-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm font-mono text-paynet-gray-900 break-all">{row.name}</td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">{row.type}</td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">{row.input}</td>
                        <td className="px-4 py-3 text-sm">
                          {row.required ? (
                            <span className="flex items-center gap-1 text-paynet-error font-medium">
                              <AlertCircle className="w-4 h-4" />
                              Required
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-paynet-success">
                              <CheckCircle className="w-4 h-4" />
                              Optional
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Signature validation</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                Every notification must be verified before you trust the payment status. Rebuild the expected hash
                from the received payload and compare it with `Header.Hash` using your merchant `SecretKey`.
              </p>
              <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3 whitespace-pre-wrap">
{`ExpectedHash = Base64(MD5(PreparedString + SecretKey))
Accept notification only if ExpectedHash === Header.Hash`}
              </pre>
              <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-paynet-gray-700">
                <li>Read raw payload body exactly as received by your endpoint.</li>
                <li>Build the `PreparedString` in Paynet-defined field order and append your `SecretKey`.</li>
                <li>Compute `Base64(MD5(...))` and compare with `Header.Hash` in constant time.</li>
                <li>Reject the request with non-`200` status if hash or required fields are invalid.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
