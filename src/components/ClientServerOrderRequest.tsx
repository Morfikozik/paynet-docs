import React from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import CryptoJS from 'crypto-js';

type FieldRow = {
  name: string;
  type: string;
  input: 'body';
  required: 'Yes' | 'No';
  description: string;
};

export const ClientServerOrderRequest: React.FC = () => {
  const defaultPayload = {
    ExternalID: 20160622010101,
    Currency: 498,
    Merchant: '265505',
    SaleAreaCode: '',
    Customer: {
      Code: 'CUSTOMER001',
      NameFirst: 'Test',
      NameLast: 'Customer',
      PhoneNumber: '37360000000',
      email: 'test@example.com',
      Country: 'MD',
      City: 'Chisinau',
      Address: 'Main street 1',
    },
    ExpiryDate: '2026-12-31T23:59:59',
    Services: [
      {
        Name: 'Demo service',
        Description: 'Demo service description',
        Amount: 100,
        Products: [
          {
            Amount: 100,
            Barcode: 13243546,
            Code: 'PRODUCT1',
            Description: 'Demo product',
            GroupId: '22',
            GroupName: 'Demo group',
            LineNo: 1,
            Name: 'Demo product',
            UnitPrice: 100,
            UnitProduct: 1,
          },
        ],
      },
    ],
    MoneyType: {
      Code: 'PAYNET',
    },
    LinkUrlCancel: 'https://example.com/cancel',
    LinkUrlSuccess: 'https://example.com/success',
    Lang: 'en-US',
    SignVersion: 'v05',
  };

  const [requestUrl, setRequestUrl] = React.useState('https://test.paynet.md/acquiring/SetEcom');
  const [merchantCode, setMerchantCode] = React.useState('265505');
  const [userLogin, setUserLogin] = React.useState('771064');
  const [password, setPassword] = React.useState('sLgMnGWJ');
  const [secretKey, setSecretKey] = React.useState('F90D6485-9CCC-458B-96A3-8958AF9B4458');
  const [payloadText, setPayloadText] = React.useState(JSON.stringify(defaultPayload, null, 2));
  const [signature, setSignature] = React.useState('');
  const [signedPayloadText, setSignedPayloadText] = React.useState('');
  const [responseText, setResponseText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState('');
  const [isExpanded, setIsExpanded] = React.useState(true);
  const fieldRows: FieldRow[] = [
    { name: 'ExternalID', type: 'long', input: 'body', required: 'Yes', description: 'Partner order identifier in your system.' },
    { name: 'Currency', type: 'int', input: 'body', required: 'Yes', description: 'ISO 4217 numeric currency code (example: 498).' },
    { name: 'Merchant', type: 'string', input: 'body', required: 'Yes', description: 'PartnerID / MerchantCode.' },
    { name: 'SaleAreaCode', type: 'string', input: 'body', required: 'No', description: 'Partner sale area code; may be empty.' },
    { name: 'Customer.Code', type: 'string', input: 'body', required: 'Yes', description: 'Customer code in partner system.' },
    { name: 'Customer.NameFirst', type: 'string', input: 'body', required: 'No', description: 'Customer first name.' },
    { name: 'Customer.NameLast', type: 'string', input: 'body', required: 'No', description: 'Customer last name.' },
    { name: 'Customer.PhoneNumber', type: 'string', input: 'body', required: 'No', description: 'Customer phone number.' },
    { name: 'Customer.email', type: 'string', input: 'body', required: 'No', description: 'Customer email address.' },
    { name: 'Customer.Country', type: 'string', input: 'body', required: 'No', description: 'Customer country code/name.' },
    { name: 'Customer.City', type: 'string', input: 'body', required: 'No', description: 'Customer city.' },
    { name: 'Customer.Address', type: 'string', input: 'body', required: 'No', description: 'Customer street address.' },
    { name: 'ExpiryDate', type: 'datetime', input: 'body', required: 'Yes', description: 'Payment expiration timestamp (ISO 8601).' },
    { name: 'Services[].Name', type: 'string', input: 'body', required: 'Yes', description: 'Service name.' },
    { name: 'Services[].Description', type: 'string', input: 'body', required: 'Yes', description: 'Service description.' },
    { name: 'Services[].Amount', type: 'long', input: 'body', required: 'Yes', description: 'Service amount in integer format.' },
    { name: 'Services[].Products[]', type: 'array', input: 'body', required: 'No', description: 'List of products included in service.' },
    { name: 'MoneyType.Code', type: 'string', input: 'body', required: 'Yes', description: 'Payment instrument code (example: PAYNET).' },
    { name: 'LinkUrlSuccess', type: 'string', input: 'body', required: 'Yes', description: 'Redirect URL after successful payment flow.' },
    { name: 'LinkUrlCancel', type: 'string', input: 'body', required: 'Yes', description: 'Redirect URL when payment is canceled.' },
    { name: 'Lang', type: 'string', input: 'body', required: 'No', description: 'UI language for payment page (example: en-US).' },
    { name: 'SignVersion', type: 'string', input: 'body', required: 'Yes', description: 'Signature algorithm version, use v05.' },
    { name: 'Signature', type: 'string', input: 'body', required: 'Yes', description: 'Base64(MD5(PreparedString + SecretKey)).' },
  ];

  const normalize = (value: unknown) => (value === null || value === undefined ? '' : String(value));

  const buildPreparedString = (payload: any) => {
    let preparedString =
      normalize(payload.Currency) +
      normalize(payload.Customer?.Address) +
      normalize(payload.Customer?.City) +
      normalize(payload.Customer?.Code) +
      normalize(payload.Customer?.Country) +
      normalize(payload.Customer?.email) +
      normalize(payload.Customer?.NameFirst) +
      normalize(payload.Customer?.NameLast) +
      normalize(payload.Customer?.PhoneNumber) +
      normalize(payload.ExpiryDate) +
      normalize(payload.ExternalID) +
      normalize(payload.Merchant) +
      normalize(payload.MoneyType?.Code);

    const services = Array.isArray(payload.Services) ? payload.Services : [];
    services.forEach((service: any) => {
      preparedString += normalize(service?.Amount) + normalize(service?.Description) + normalize(service?.Name);

      const products = Array.isArray(service?.Products) ? service.Products : [];
      products.forEach((product: any) => {
        preparedString +=
          normalize(product?.Amount) +
          normalize(product?.Barcode) +
          normalize(product?.Code) +
          normalize(product?.Description) +
          normalize(product?.GroupId) +
          normalize(product?.GroupName) +
          normalize(product?.LineNo) +
          normalize(product?.Name) +
          normalize(product?.UnitPrice) +
          normalize(product?.UnitProduct);
      });
    });

    return preparedString;
  };

  const generateSignature = () => {
    try {
      setErrorText('');
      const payload = JSON.parse(payloadText);
      payload.Merchant = merchantCode;
      payload.SignVersion = 'v05';

      const preparedString = buildPreparedString(payload);
      const generatedSignature = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(preparedString + secretKey));

      payload.Signature = generatedSignature;
      setSignature(generatedSignature);
      setSignedPayloadText(JSON.stringify(payload, null, 2));
      setResponseText('');
    } catch (error) {
      setErrorText(`Cannot generate signature: ${error instanceof Error ? error.message : 'Invalid input'}`);
    }
  };

  const sendSignedRequest = async () => {
    if (!signedPayloadText) {
      setErrorText('Generate signature first.');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');
    setResponseText('');

    try {
      const start = Date.now();
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: signedPayloadText,
      });

      const elapsed = Date.now() - start;
      const rawText = await response.text();
      let formatted = rawText;

      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        // Keep raw when not JSON.
      }

      setResponseText(`Status: ${response.status} ${response.statusText}\nTime: ${elapsed}ms\n\n${formatted}`);
    } catch (error) {
      setErrorText(
        `Request failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Browser CORS restrictions may block direct calls.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-none">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Order request</h1>
      </div>

      <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-paynet-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-paynet-primary" />
            <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">Order request</h2>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-paynet-primary transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 text-paynet-primary transition-transform" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4 sm:p-6 pt-0">
            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Method Description</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
                Creates a client-server payment request for Paynet `SetEcom` flow, generates a `v05` signature
                from the payload and secret key, and allows you to send the signed request for integration testing.
              </p>
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
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">{row.required}</td>
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Request URL</label>
                <input
                  value={requestUrl}
                  onChange={(e) => setRequestUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">MerchantCode</label>
                <input
                  value={merchantCode}
                  onChange={(e) => setMerchantCode(e.target.value)}
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">User login</label>
                <input
                  value={userLogin}
                  onChange={(e) => setUserLogin(e.target.value)}
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">SecretKey</label>
                <input
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Unsigned payload (JSON)</label>
              <textarea
                rows={14}
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
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
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-md"
              >
                {isSubmitting ? 'Sending...' : 'Send Test Request'}
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

            {signedPayloadText && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Signed payload (JSON)</label>
                <textarea
                  rows={14}
                  value={signedPayloadText}
                  readOnly
                  className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono bg-paynet-gray-50"
                />
              </div>
            )}

            {errorText && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{errorText}</div>
            )}

            {responseText && (
              <div>
                <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Response</label>
                <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-4 rounded-md text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap">
                  {responseText}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
