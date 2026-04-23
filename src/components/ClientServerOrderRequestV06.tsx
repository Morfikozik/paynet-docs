import React from 'react';
import { FileText, AlertCircle, CheckCircle, Copy, Check, Send } from 'lucide-react';
import CryptoJS from 'crypto-js';

type FieldRow = {
  name: string;
  type: string;
  input: 'body';
  required: boolean;
  description: string;
};

export const ClientServerOrderRequestV06: React.FC = () => {
  const requestUrl = 'https://test.paynet.md/ecom/checkout';
  const liveRequestUrl = 'https://paynet.md/ecom/checkout';
  const merchantCode = '265505';
  const userLogin = '771064';
  const password = 'sLgMnGWJ';
  const secretKey = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
  const saleAreaCode = 'onlidocumentation_md';
  const defaultPayload = {
    Order: 20160622010101,
    Currency: '498',
    Merchant: merchantCode,
    SaleAreaCode: saleAreaCode,
    CustomerCode: '5555',
    CustomerNameFirst: 'Kolesnikova',
    CustomerNameLast: 'Victoria',
    CustomerPhoneNumber: '079700414',
    CustomerEmail: 'viktoria.invalc@gmail.com',
    ExpiryDate: '2026-12-31T23:59:59',
    Description: 'Tovis & Co SRL@',
    Amount: '1235',
    LinkUrlCancel: 'https://test.oplta.md/cancel',
    LinkUrlSuccess: 'https://test.oplta.md/ok',
    Lang: 'ro',
    MoneyType: 'Mia',
  };

  const [payloadText, setPayloadText] = React.useState(JSON.stringify(defaultPayload, null, 2));
  const [signature, setSignature] = React.useState('');
  const [signedPayloadText, setSignedPayloadText] = React.useState('');
  const [responseText, setResponseText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [activeCodeLanguage, setActiveCodeLanguage] = React.useState<'json' | 'html'>('html');
  const [copiedCode, setCopiedCode] = React.useState(false);
  const fieldRows: FieldRow[] = [
    { name: 'Order', type: 'long', input: 'body', required: true, description: 'Partner order identifier in your system.' },
    { name: 'Currency', type: 'string', input: 'body', required: true, description: 'ISO 4217 numeric currency code (example: 498).' },
    { name: 'Merchant', type: 'string', input: 'body', required: true, description: 'PartnerID / MerchantCode.' },
    { name: 'SaleAreaCode', type: 'string', input: 'body', required: true, description: 'Partner sale area code.' },
    { name: 'Amount', type: 'string', input: 'body', required: true, description: 'Payment amount.' },
    { name: 'Description', type: 'string', input: 'body', required: true, description: 'Order/service description.' },
    { name: 'CustomerCode', type: 'string', input: 'body', required: false, description: 'Customer code in partner system.' },
    { name: 'CustomerNameFirst', type: 'string', input: 'body', required: false, description: 'Customer first name.' },
    { name: 'CustomerNameLast', type: 'string', input: 'body', required: false, description: 'Customer last name.' },
    { name: 'CustomerPhoneNumber', type: 'string', input: 'body', required: false, description: 'Customer phone number.' },
    { name: 'CustomerEmail', type: 'string', input: 'body', required: false, description: 'Customer email address.' },
    { name: 'ExpiryDate', type: 'datetime', input: 'body', required: true, description: 'Payment expiration timestamp (ISO 8601).' },
    { name: 'ProductAmount', type: 'long', input: 'body', required: false, description: 'Product amount.' },
    { name: 'ProductBarcode', type: 'long', input: 'body', required: false, description: 'Product barcode.' },
    { name: 'ProductCode', type: 'string', input: 'body', required: false, description: 'Partner product code.' },
    { name: 'ProductDescription', type: 'string', input: 'body', required: false, description: 'Product description.' },
    { name: 'ProductGroupId', type: 'string', input: 'body', required: false, description: 'Product group identifier.' },
    { name: 'ProductGroupName', type: 'string', input: 'body', required: false, description: 'Product group name.' },
    { name: 'ProductLineNo', type: 'int', input: 'body', required: false, description: 'Product line number.' },
    { name: 'ProductName', type: 'string', input: 'body', required: false, description: 'Product name.' },
    { name: 'ProductUnitPrice', type: 'long', input: 'body', required: false, description: 'Product unit price.' },
    { name: 'ProductQuantity', type: 'int', input: 'body', required: false, description: 'Product quantity.' },
    { name: 'ProductUnitProduct', type: 'string', input: 'body', required: false, description: 'Product unit type / measure.' },
    { name: 'LinkUrlCancel', type: 'string', input: 'body', required: true, description: 'Redirect URL when payment is canceled.' },
    { name: 'LinkUrlSuccess', type: 'string', input: 'body', required: true, description: 'Redirect URL after successful payment flow.' },
    { name: 'Lang', type: 'string', input: 'body', required: true, description: 'UI language for payment page (example: ro).' },
    { name: 'MoneyType', type: 'string', input: 'body', required: true, description: 'Payment instrument code.' },
    { name: 'Signature', type: 'string', input: 'body', required: true, description: 'Base64(MD5(RawData + SecretKey), raw bytes).' },
  ];

  const normalize = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  const signatureFields = [
    'Order',
    'Currency',
    'Merchant',
    'SaleAreaCode',
    'CustomerCode',
    'CustomerNameFirst',
    'CustomerNameLast',
    'CustomerPhoneNumber',
    'CustomerEmail',
    'ExpiryDate',
    'Description',
    'Amount',
    'LinkUrlCancel',
    'LinkUrlSuccess',
    'Lang',
    'MoneyType',
  ] as const;

  const encodeRfc3986 = (value: string) =>
    encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

  const buildRawData = (payload: Record<string, unknown>) => {
    const sortedKeys = signatureFields
      .filter((key) => payload[key] !== undefined && payload[key] !== null)
      .sort((a, b) => a.localeCompare(b));

    return sortedKeys.map((key) => encodeRfc3986(normalize(payload[key]))).join('');
  };

  const generateSignature = () => {
    try {
      setErrorText('');
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      payload.Merchant = merchantCode;
      payload.SaleAreaCode = saleAreaCode;
      const rawData = buildRawData(payload);
      const generatedSignature = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(rawData + secretKey));

      payload.Signature = generatedSignature;
      setSignature(generatedSignature);
      setSignedPayloadText(JSON.stringify(payload, null, 2));
      setResponseText('');
    } catch (error) {
      setErrorText(`Cannot generate signature: ${error instanceof Error ? error.message : 'Invalid input'}`);
    }
  };

  const sendSignedRequest = () => {
    if (!signedPayloadText) {
      setErrorText('Generate signature first.');
      return;
    }

    setErrorText('');
    setResponseText('');

    try {
      const payload = JSON.parse(signedPayloadText) as Record<string, any>;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = requestUrl;
      form.target = '_blank';
      form.style.display = 'none';

      buildHiddenInputs(payload).forEach(({ name, value }) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      form.remove();

      setResponseText('Payment form submitted in a new browser tab.');
    } catch (error) {
      setErrorText(`Cannot open payment page: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getPayloadForExamples = () => {
    const source = signedPayloadText || payloadText;
    try {
      return JSON.stringify(JSON.parse(source), null, 2);
    } catch {
      return source;
    }
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const buildHiddenInputs = (payload: Record<string, any>) => {
    const rows: Array<{ name: string; value: string }> = [];

    const walk = (value: unknown, path: string, parentType: 'root' | 'array' | 'object') => {
      if (value === null || value === undefined) {
        rows.push({ name: path, value: '' });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          walk(item, `${path}[${index}]`, 'array');
        });
        return;
      }

      if (typeof value === 'object') {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
          const nextPath =
            parentType === 'array'
              ? `${path}[${key}]`
              : path
                ? `${path}.${key}`
                : key;
          walk(child, nextPath, 'object');
        });
        return;
      }

      rows.push({ name: path, value: String(value) });
    };

    Object.entries(payload).forEach(([key, value]) => {
      walk(value, key, 'root');
    });

    return rows;
  };

  const getHtmlExample = () => {
    const source = signedPayloadText || payloadText;
    let payload: Record<string, any>;

    try {
      payload = JSON.parse(source);
    } catch {
      return '<!-- Invalid JSON payload. Please fix Request Body first. -->';
    }

    const inputs = buildHiddenInputs(payload)
      .map(
        ({ name, value }) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paynet Ecom Checkout Form (v0.6)</title>
</head>
<body>
  <form method="POST" action="${escapeHtml(requestUrl)}">
${inputs}
    <input type="submit" value="GO to a payment gateway of paynet" />
  </form>
</body>
</html>`;
  };

  const handleCopyCode = async () => {
    const code = activeCodeLanguage === 'html' ? getHtmlExample() : getPayloadForExamples();
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <div className="flex items-center gap-3 mb-2 sm:mb-3">
          <span className="text-xs font-mono px-2 py-1 rounded bg-blue-100 text-blue-700 font-semibold">POST</span>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Order request v0.6</h1>
        </div>
      </div>

      <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
        <div className="w-full p-4 sm:p-6 flex items-center gap-3">
          <FileText className="w-5 h-5 text-paynet-primary" />
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">Order request v0.6</h2>
        </div>

        <div className="p-4 sm:p-6 pt-0">
            <div className="xl:flex xl:items-start xl:gap-6">
              <div className="xl:flex-1 min-w-0">
            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Method Description</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
                Creates a client-server payment request for Paynet `SetEcom` flow, generates a `v05` signature
                from the payload and secret key, and allows you to send the signed request for integration testing.
              </p>
            </div>

            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Test credentials</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">TEST Request URL</label>
                  <input value={requestUrl} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Live Request URL</label>
                  <input value={liveRequestUrl} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">MerchantCode</label>
                  <input value={merchantCode} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">User login</label>
                  <input value={userLogin} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Password</label>
                  <input value={password} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">SaleAreaCode</label>
                  <input value={saleAreaCode} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-paynet-gray-700 mb-1">SecretKey</label>
                  <input value={secretKey} readOnly className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm bg-paynet-gray-50 font-mono" />
                </div>
              </div>
            </div>

            <div className="mb-6">
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

            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Signature generation</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                Signature is generated using sorted parameters, RFC3986 URL encoding, and MD5 (raw bytes):
              </p>
              <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3">
{`RawData = concat(rawurlencode(value) for all signing fields sorted by key)
Signature = Base64(MD5(RawData + SecretKey))`}
              </pre>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-2">
                Signing fields used in v0.6:
              </p>
              <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3 whitespace-pre-wrap">
{`Order, Currency, Merchant, SaleAreaCode, CustomerCode, CustomerNameFirst,
CustomerNameLast, CustomerPhoneNumber, CustomerEmail, ExpiryDate, Description,
Amount, LinkUrlCancel, LinkUrlSuccess, Lang, MoneyType`}
              </pre>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
                Keys are sorted alphabetically before concatenation. Any field not present in JSON is skipped.
              </p>
            </div>

              </div>

            <div className="xl:w-144 w-full mt-4 xl:mt-0">
            <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
              <div className="w-full p-4 sm:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-paynet-primary" />
                  <h3 className="text-base sm:text-lg font-semibold text-paynet-primary">Code Examples</h3>
                </div>
              </div>

                <div className="p-4 sm:p-6 pt-0">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Request Body (JSON)</label>
                    <textarea
                      rows={12}
                      value={payloadText}
                      onChange={(e) => {
                        setPayloadText(e.target.value);
                        // Prevent showing stale signed payload after manual JSON edits.
                        setSignedPayloadText('');
                        setSignature('');
                      }}
                      className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <button
                      onClick={generateSignature}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
                    >
                      Generate Signature
                    </button>
                    <button
                      onClick={sendSignedRequest}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send Test Request
                    </button>
                  </div>

                  {signature && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Generated Signature</label>
                      <code className="block bg-paynet-gray-50 border border-paynet-gray-200 px-3 py-2 rounded-md text-sm break-all">
                        {signature}
                      </code>
                    </div>
                  )}

                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveCodeLanguage('html')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            activeCodeLanguage === 'html'
                              ? 'bg-paynet-primary text-white'
                              : 'bg-paynet-gray-100 text-paynet-gray-700 hover:bg-paynet-gray-200'
                          }`}
                        >
                          HTML
                        </button>
                        <button
                          onClick={() => setActiveCodeLanguage('json')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            activeCodeLanguage === 'json'
                              ? 'bg-paynet-primary text-white'
                              : 'bg-paynet-gray-100 text-paynet-gray-700 hover:bg-paynet-gray-200'
                          }`}
                        >
                          JSON
                        </button>
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="flex items-center gap-2 px-3 py-1.5 bg-paynet-primary hover:bg-paynet-secondary text-white text-xs font-medium rounded-paynet transition-all duration-200"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                      {activeCodeLanguage === 'html' ? getHtmlExample() : getPayloadForExamples()}
                    </pre>
                  </div>

                  {errorText && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{errorText}</div>
                  )}

                  {responseText && (
                    <div>
                      <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Response</label>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                        {responseText}
                      </pre>
                    </div>
                  )}
                </div>
            </div>
            </div>
            </div>
          </div>
      </div>
    </div>
  );
};
