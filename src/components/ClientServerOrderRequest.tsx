import React from 'react';
import { FileText, AlertCircle, CheckCircle, Copy, Check, Send } from 'lucide-react';
import CryptoJS from 'crypto-js';
import { Language } from '../types/language';

// Default order expiry: end of tomorrow (local time), so the sample request never ships already expired.
const getDefaultExpiryDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T23:59:59`;
};

type FieldRow = {
  name: string;
  type: string;
  input: 'body';
  required: boolean;
  description: string;
};

interface ClientServerOrderRequestProps {
  language: Language;
}

export const ClientServerOrderRequest: React.FC<ClientServerOrderRequestProps> = ({ language }) => {
  const isRu = language === 'ru';
  const isRo = language === 'ro';
  const tDesc = (en: string, ru: string, ro: string) => (isRu ? ru : isRo ? ro : en);
  const parameterDescriptionTranslations: Record<string, { ru: string; ro: string }> = {
    ExternalID: {
      ru: 'Идентификатор заказа партнера в вашей системе.',
      ro: 'Identificatorul comenzii partenerului în sistemul tău.',
    },
    Currency: {
      ru: 'Числовой код валюты ISO 4217 (пример: 498).',
      ro: 'Cod numeric valută ISO 4217 (exemplu: 498).',
    },
    Merchant: {
      ru: 'PartnerID / MerchantCode.',
      ro: 'PartnerID / MerchantCode.',
    },
    SaleAreaCode: {
      ru: 'Код торговой зоны партнера; может быть пустым.',
      ro: 'Codul zonei de vânzare al partenerului; poate fi gol.',
    },
    'Customer.Code': {
      ru: 'Код клиента в системе партнера.',
      ro: 'Codul clientului în sistemul partenerului.',
    },
    'Customer.NameFirst': {
      ru: 'Имя клиента.',
      ro: 'Prenumele clientului.',
    },
    'Customer.NameLast': {
      ru: 'Фамилия клиента.',
      ro: 'Numele de familie al clientului.',
    },
    'Customer.PhoneNumber': {
      ru: 'Номер телефона клиента.',
      ro: 'Numărul de telefon al clientului.',
    },
    'Customer.email': {
      ru: 'Email адрес клиента.',
      ro: 'Adresa de email a clientului.',
    },
    ExpiryDate: {
      ru: 'Время истечения оплаты (ISO 8601).',
      ro: 'Data/ora expirării plății (ISO 8601).',
    },
    'Services[].Name': {
      ru: 'Название услуги.',
      ro: 'Denumirea serviciului.',
    },
    'Services[].Description': {
      ru: 'Описание услуги.',
      ro: 'Descrierea serviciului.',
    },
    'Services[].Amount': {
      ru: 'Сумма услуги в целочисленном формате.',
      ro: 'Suma serviciului în format întreg.',
    },
    'Services[].Products[]': {
      ru: 'Список товаров, включенных в услугу.',
      ro: 'Lista produselor incluse în serviciu.',
    },
    'Services[].Products[].Amount': {
      ru: 'Сумма товара в целочисленном формате.',
      ro: 'Suma produsului în format întreg.',
    },
    'Services[].Products[].Barcode': {
      ru: 'Штрихкод товара.',
      ro: 'Codul de bare al produsului.',
    },
    'Services[].Products[].Code': {
      ru: 'Код товара у партнера.',
      ro: 'Codul produsului în sistemul partenerului.',
    },
    'Services[].Products[].Description': {
      ru: 'Расширенное описание товара.',
      ro: 'Descriere extinsă a produsului.',
    },
    'Services[].Products[].GroupId': {
      ru: 'Идентификатор группы товара.',
      ro: 'Identificatorul grupului de produse.',
    },
    'Services[].Products[].GroupName': {
      ru: 'Название группы товара.',
      ro: 'Denumirea grupului de produse.',
    },
    'Services[].Products[].LineNo': {
      ru: 'Порядковый номер строки товара.',
      ro: 'Numărul de ordine al liniei de produs.',
    },
    'Services[].Products[].Name': {
      ru: 'Название товара.',
      ro: 'Denumirea produsului.',
    },
    'Services[].Products[].UnitPrice': {
      ru: 'Цена одной единицы в целочисленном формате.',
      ro: 'Prețul unei unități în format întreg.',
    },
    'Services[].Products[].Quantity': {
      ru: 'Количество единиц товара.',
      ro: 'Cantitatea unităților de produs.',
    },
    'Services[].Products[].UnitProduct': {
      ru: 'Тип / единица измерения товара.',
      ro: 'Tipul / unitatea de măsură a produsului.',
    },
    'MoneyType.Code': {
      ru: 'Код платежного инструмента (пример: PAYNET).',
      ro: 'Codul instrumentului de plată (exemplu: PAYNET).',
    },
    LinkUrlSuccess: {
      ru: 'URL для редиректа после успешной оплаты.',
      ro: 'URL de redirecționare după plata reușită.',
    },
    LinkUrlCancel: {
      ru: 'URL для редиректа при отмене оплаты.',
      ro: 'URL de redirecționare la anularea plății.',
    },
    Lang: {
      ru: 'Язык интерфейса платежной страницы (пример: RO или RU или EN).',
      ro: 'Limba interfeței paginii de plată (exemplu: RO sau RU sau EN).',
    },
    SignVersion: {
      ru: 'Версия алгоритма подписи, используйте v05.',
      ro: 'Versiunea algoritmului de semnare, folosește v05.',
    },
    Signature: {
      ru: 'Base64(MD5(PreparedString + SecretKey)).',
      ro: 'Base64(MD5(PreparedString + SecretKey)).',
    },
  };
  const getLocalizedParameterDescription = (name: string, fallback: string) => {
    const localized = parameterDescriptionTranslations[name];
    if (!localized) return fallback;
    return tDesc(fallback, localized.ru, localized.ro);
  };
  const requestUrl = 'https://test.paynet.md/acquiring/SetEcom';
  const liveRequestUrl = 'https://paynet.md/acquiring/SetEcom';
  const merchantCode = '265505';
  const userLogin = '771064';
  const password = 'sLgMnGWJ';
  const secretKey = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
  const saleAreaCode = 'onlidocumentation_md';
  const defaultPayload = {
    ExternalID: 20160622010101,
    Currency: 498,
    Merchant: merchantCode,
    SaleAreaCode: saleAreaCode,
    Customer: {
      Code: 'CUSTOMER001',
      NameFirst: 'Test',
      NameLast: 'Customer',
      PhoneNumber: '37360000000',
      email: 'test@example.com',
    },
    ExpiryDate: getDefaultExpiryDate(),
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
            Quantity: 1,
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

  const [payloadText, setPayloadText] = React.useState(JSON.stringify(defaultPayload, null, 2));
  const [signature, setSignature] = React.useState('');
  const [signedPayloadText, setSignedPayloadText] = React.useState('');
  const [responseText, setResponseText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [activeCodeLanguage, setActiveCodeLanguage] = React.useState<'json' | 'html'>('html');
  const [copiedCode, setCopiedCode] = React.useState(false);
  const fieldRows: FieldRow[] = [
    { name: 'ExternalID', type: 'long', input: 'body', required: true, description: 'Partner order identifier in your system.' },
    { name: 'Currency', type: 'int', input: 'body', required: true, description: 'ISO 4217 numeric currency code (example: 498).' },
    { name: 'Merchant', type: 'string', input: 'body', required: true, description: 'PartnerID / MerchantCode.' },
    { name: 'SaleAreaCode', type: 'string', input: 'body', required: false, description: 'Partner sale area code; may be empty.' },
    { name: 'Customer.Code', type: 'string', input: 'body', required: true, description: 'Customer code in partner system.' },
    { name: 'Customer.NameFirst', type: 'string', input: 'body', required: false, description: 'Customer first name.' },
    { name: 'Customer.NameLast', type: 'string', input: 'body', required: false, description: 'Customer last name.' },
    { name: 'Customer.PhoneNumber', type: 'string', input: 'body', required: false, description: 'Customer phone number.' },
    { name: 'Customer.email', type: 'string', input: 'body', required: false, description: 'Customer email address.' },
    { name: 'ExpiryDate', type: 'datetime', input: 'body', required: true, description: 'Payment expiration timestamp (ISO 8601).' },
    { name: 'Services[].Name', type: 'string', input: 'body', required: true, description: 'Service name.' },
    { name: 'Services[].Description', type: 'string', input: 'body', required: true, description: 'Service description.' },
    { name: 'Services[].Amount', type: 'long', input: 'body', required: true, description: 'Service amount in integer format.' },
    { name: 'Services[].Products[]', type: 'array', input: 'body', required: false, description: 'List of products included in service.' },
    { name: 'Services[].Products[].Amount', type: 'long', input: 'body', required: true, description: 'Product amount in integer format.' },
    { name: 'Services[].Products[].Barcode', type: 'long', input: 'body', required: false, description: 'Product barcode.' },
    { name: 'Services[].Products[].Code', type: 'string', input: 'body', required: false, description: 'Partner product code.' },
    { name: 'Services[].Products[].Description', type: 'string', input: 'body', required: false, description: 'Extended product description.' },
    { name: 'Services[].Products[].GroupId', type: 'string', input: 'body', required: false, description: 'Product group identifier.' },
    { name: 'Services[].Products[].GroupName', type: 'string', input: 'body', required: false, description: 'Product group name.' },
    { name: 'Services[].Products[].LineNo', type: 'int', input: 'body', required: true, description: 'Product line sequence number.' },
    { name: 'Services[].Products[].Name', type: 'string', input: 'body', required: true, description: 'Product name.' },
    { name: 'Services[].Products[].UnitPrice', type: 'long', input: 'body', required: true, description: 'Single unit price in integer format.' },
    { name: 'Services[].Products[].Quantity', type: 'int', input: 'body', required: false, description: 'Quantity of product units.' },
    { name: 'Services[].Products[].UnitProduct', type: 'string', input: 'body', required: false, description: 'Product unit type / measure.' },
    { name: 'MoneyType.Code', type: 'string', input: 'body', required: true, description: 'Payment instrument code (example: PAYNET).' },
    { name: 'LinkUrlSuccess', type: 'string', input: 'body', required: true, description: 'Redirect URL after successful payment flow.' },
    { name: 'LinkUrlCancel', type: 'string', input: 'body', required: true, description: 'Redirect URL when payment is canceled.' },
    { name: 'Lang', type: 'string', input: 'body', required: false, description: 'UI language for payment page (example: RO or RU or EN).' },
    { name: 'SignVersion', type: 'string', input: 'body', required: true, description: 'Signature algorithm version, use v05.' },
    { name: 'Signature', type: 'string', input: 'body', required: true, description: 'Base64(MD5(PreparedString + SecretKey)).' },
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
      payload.SaleAreaCode = saleAreaCode;
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
  <title>Paynet SetEcom Form</title>
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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Order request v0.5 (old)</h1>
        </div>
      </div>

      <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
        <div className="w-full p-4 sm:p-6 flex items-center gap-3">
          <FileText className="w-5 h-5 text-paynet-primary" />
          <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">Order request v0.5 (old)</h2>
        </div>

        <div className="p-4 sm:p-6 pt-0">
            <div className="xl:flex xl:items-start xl:gap-6">
              <div className="xl:flex-1 min-w-0">
            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Method Description</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
                {tDesc(
                  'Creates a client-server payment request for Paynet `SetEcom` flow, generates a `v05` signature from the payload and secret key, and allows you to send the signed request for integration testing.',
                  'Создаёт client-server платёжный запрос для сценария Paynet `SetEcom`, генерирует подпись `v05` на основе payload и secret key и позволяет отправить подписанный запрос для интеграционного тестирования.',
                  'Creează o cerere de plată client-server pentru fluxul Paynet `SetEcom`, generează semnătura `v05` din payload și cheia secretă și permite trimiterea cererii semnate pentru testarea integrării.',
                )}
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
                        <td className="px-4 py-3 text-sm text-paynet-gray-700">
                          {getLocalizedParameterDescription(row.name, row.description)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Signature generation</h3>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                {tDesc(
                  'Signature for `v05` is generated using formula:',
                  'Подпись для `v05` формируется по формуле:',
                  'Semnătura pentru `v05` se generează după formula:',
                )}
              </p>
              <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3">
{`Signature = Base64(MD5(PreparedString + SecretKey))`}
              </pre>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-2">
                {tDesc(
                  '`PreparedString` is formed in a strict order:',
                  '`PreparedString` формируется в строгом порядке:',
                  '`PreparedString` este format în ordine strictă:',
                )}
              </p>
              <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3 whitespace-pre-wrap">
{`Currency +
Customer.Address + Customer.City + Customer.Code + Customer.Country +
Customer.email + Customer.NameFirst + Customer.NameLast + Customer.PhoneNumber +
ExpiryDate + ExternalID + Merchant + MoneyType.Code +
for each Service: Service.Amount + Service.Description + Service.Name +
for each Product: Product.Amount + Product.Barcode + Product.Code + Product.Description +
Product.GroupId + Product.GroupName + Product.LineNo + Product.Name + Product.UnitPrice + Product.UnitProduct`}
              </pre>
              <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed">
                {tDesc(
                  'Field order must not be changed. Empty fields are treated as empty strings.',
                  'Порядок полей нельзя изменять. Пустые поля обрабатываются как пустые строки.',
                  'Ordinea câmpurilor nu trebuie schimbată. Câmpurile goale sunt tratate ca șiruri goale.',
                )}
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
