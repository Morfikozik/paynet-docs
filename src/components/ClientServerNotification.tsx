import React from 'react';
import { Bell, ChevronDown, ChevronRight, Copy, Check, FileText } from 'lucide-react';
import { getAuthToken, setAuthToken } from '../utils/apiTester';
import CryptoJS from 'crypto-js';
import { Language } from '../types/language';
import ParamList from './ParamList';
import { useLastOrder } from '../utils/lastOrder';

type NotificationFieldRow = {
  name: string;
  type: string;
  input: 'body' | 'header';
  required: boolean;
  description: string;
};

interface ClientServerNotificationProps {
  language: Language;
}

export const ClientServerNotification: React.FC<ClientServerNotificationProps> = ({ language }) => {
  const isRu = language === 'ru';
  const isRo = language === 'ro';
  const tDesc = (en: string, ru: string, ro: string) => (isRu ? ru : isRo ? ro : en);
  const parameterDescriptionTranslations: Record<string, { ru: string; ro: string }> = {
    Eventid: {
      ru: 'Уникальный идентификатор callback-события для трассировки и дедупликации.',
      ro: 'Identificator unic al evenimentului callback pentru trasabilitate și deduplicare.',
    },
    EventType: {
      ru: 'Всегда PAID: уведомления приходят только об успешных платежах.',
      ro: 'Mereu PAID: se notifică doar plățile reușite.',
    },
    Message: {
      ru: 'Текстовое сообщение о результате обработки в контексте callback.',
      ro: 'Mesaj text despre rezultatul procesării în contextul callback-ului.',
    },
    EventDate: {
      ru: 'Время создания уведомления в Paynet (ISO 8601).',
      ro: 'Momentul creării notificării în Paynet (ISO 8601).',
    },
    'Payment.Id': {
      ru: 'Идентификатор платежа в Paynet; используйте как idempotency key.',
      ro: 'Identificatorul plății în Paynet; folosește-l ca cheie de idempotență.',
    },
    'Payment.ExternalId': {
      ru: 'Идентификатор заказа мерчанта, изначально отправленный вашей системой.',
      ro: 'Identificatorul comenzii merchantului trimis inițial de sistemul tău.',
    },
    'Payment.SaleAreaCode': {
      ru: 'Код торговой зоны, связанной с платежом.',
      ro: 'Codul zonei de vânzare asociate plății.',
    },
    'Payment.Merchant': {
      ru: 'Код мерчанта, которому принадлежит платеж.',
      ro: 'Codul merchantului care deține această operațiune de plată.',
    },
    'Payment.Customer': {
      ru: 'Идентификатор клиента из вашей системы, если передавался при создании заказа.',
      ro: 'Referința clientului din sistemul tău, dacă a fost transmisă la crearea comenzii.',
    },
    'Payment.StatusDate': {
      ru: 'Время, когда платеж получил указанный статус.',
      ro: 'Momentul în care plata a atins statusul raportat.',
    },
    'Payment.Amount': {
      ru: 'Сумма заказа в минимальных единицах, как её передал мерчант.',
      ro: 'Suma comenzii în unități minime, așa cum a trimis-o comerciantul.',
    },
    'Payment.PaidAmount': {
      ru: 'Фактически оплаченная сумма. Должна совпадать с Amount, кроме согласованных с Paynet акций.',
      ro: 'Suma plătită efectiv. Trebuie să fie egală cu Amount, cu excepția promoțiilor convenite cu Paynet.',
    },
    'Payment.CardMask': {
      ru: 'Маскированный PAN для карточных платежей.',
      ro: 'PAN mascat returnat pentru plățile cu card.',
    },
    'Payment.CardExpireMonth': {
      ru: 'Месяц срока действия карты (если доступен).',
      ro: 'Luna expirării cardului (dacă este disponibilă).',
    },
    'Payment.CardExpireYear': {
      ru: 'Год срока действия карты (если доступен).',
      ro: 'Anul expirării cardului (dacă este disponibil).',
    },
    'Payment.CardIssuer': {
      ru: 'Название или идентификатор эмитента карты.',
      ro: 'Numele sau identificatorul emitentului cardului.',
    },
    'Payment.CardLinkHash': {
      ru: 'Хеш связанной карты для сценариев linked-card.',
      ro: 'Hash-ul cardului legat pentru scenarii linked-card.',
    },
    'Payment.MoneyType': {
      ru: 'Чем заплатил покупатель: CARD, APPLEPAY, GOOGLEPAY, MIA_QR, PAYNET, CASH_INVOICE.',
      ro: 'Cum a plătit clientul: CARD, APPLEPAY, GOOGLEPAY, MIA_QR, PAYNET, CASH_INVOICE.',
    },
    'Payment.PayerName': {
      ru: 'Имя плательщика из данных карты/платежа.',
      ro: 'Prenumele plătitorului din datele cardului/plății.',
    },
    'Payment.PayerSurname': {
      ru: 'Фамилия плательщика из данных карты/платежа.',
      ro: 'Numele de familie al plătitorului din datele cardului/plății.',
    },
    'Payment.PayerIDNP': {
      ru: 'Персональный идентификатор плательщика, если передан.',
      ro: 'Identificatorul personal al plătitorului, dacă este furnizat.',
    },
    'Payment.RRN': {
      ru: 'RRN эквайера для отслеживания транзакции.',
      ro: 'RRN-ul achizitorului pentru urmărirea tranzacției.',
    },
    'Header.Hash': {
      ru: 'Подпись уведомления, передаваемая в HTTP-заголовке `Hash`.',
      ro: 'Semnătura notificării transmisă în antetul HTTP `Hash`.',
    },
  };
  const getLocalizedParameterDescription = (name: string, fallback: string) => {
    const localized = parameterDescriptionTranslations[name];
    if (!localized) return fallback;
    return tDesc(fallback, localized.ru, localized.ro);
  };
  const authUrl = 'https://ecom-api-test.paynet.md/auth';
  const paymentsApiBaseUrl = 'https://ecom-api-test.paynet.md';
  const defaultAuthPayload = {
    grantType: 'password',
    username: '771064',
    password: 'sLgMnGWJ',
  };

  const [isExpanded, setIsExpanded] = React.useState(true);
  // Public test notification key of the shared test merchant (265505); replace it with your own key.
  const [notificationSecretKey, setNotificationSecretKey] = React.useState('D9873689-E5F8-4272-A67F-0D8BA3F9BAA7');
  const [notificationCallbackUrl, setNotificationCallbackUrl] = React.useState('https://your-domain.com/paynet/notification');
  const [isSendingNotification, setIsSendingNotification] = React.useState(false);
  const [notificationResult, setNotificationResult] = React.useState('');
  const [notificationError, setNotificationError] = React.useState('');
  const [sentNotificationPayloadText, setSentNotificationPayloadText] = React.useState('');
  const [sentNotificationHash, setSentNotificationHash] = React.useState('');
  const [sentPreparedString, setSentPreparedString] = React.useState('');
  const [transactionId, setTransactionId] = React.useState('');
  // Pre-fill Order with the last order created on this portal (any tab), unless the user typed their own.
  const lastOrder = useLastOrder();
  const autoOrderRef = React.useRef('');
  const transactionIdRef = React.useRef(transactionId);
  transactionIdRef.current = transactionId;
  React.useEffect(() => {
    if (!lastOrder) return;
    const current = transactionIdRef.current;
    if (current.trim() !== '' && current !== autoOrderRef.current) return;
    autoOrderRef.current = lastOrder.order;
    if (current === lastOrder.order) return;
    setTransactionId(lastOrder.order);
    setHasCompletedGet(false);
    setPaymentInfoForNotification(null);
  }, [lastOrder]);
  const [isGettingPaymentStatus, setIsGettingPaymentStatus] = React.useState(false);
  const [paymentStatusResult, setPaymentStatusResult] = React.useState('');
  const [paymentStatusError, setPaymentStatusError] = React.useState('');
  const [paymentInfoForNotification, setPaymentInfoForNotification] = React.useState<any | null>(null);
  const [hasCompletedGet, setHasCompletedGet] = React.useState(false);
  const [verifierLanguage, setVerifierLanguage] = React.useState<'node' | 'php'>('node');
  const [copiedVerifierCode, setCopiedVerifierCode] = React.useState(false);
  const fieldRows: NotificationFieldRow[] = [
    { name: 'Eventid', type: 'long', input: 'body', required: true, description: 'Unique callback event identifier for traceability and deduplication.' },
    { name: 'EventType', type: 'string', input: 'body', required: true, description: 'Always PAID: only successful payments are notified.' },
    { name: 'Message', type: 'string', input: 'body', required: false, description: 'Human-readable processing message for callback context.' },
    { name: 'EventDate', type: 'datetime', input: 'body', required: true, description: 'When Paynet created this notification event (ISO 8601).' },
    { name: 'Payment.Id', type: 'long', input: 'body', required: true, description: 'Paynet payment identifier; use as idempotency key on your side.' },
    { name: 'Payment.ExternalId', type: 'long', input: 'body', required: true, description: 'Merchant order identifier originally sent by your system.' },
    { name: 'Payment.SaleAreaCode', type: 'string', input: 'body', required: false, description: 'Sale area code associated with the payment.' },
    { name: 'Payment.Merchant', type: 'string', input: 'body', required: true, description: 'Merchant code that owns this payment operation.' },
    { name: 'Payment.Customer', type: 'string', input: 'body', required: false, description: 'Customer reference from your system, if provided at order creation.' },
    { name: 'Payment.StatusDate', type: 'datetime', input: 'body', required: true, description: 'Timestamp when payment reached the reported status.' },
    { name: 'Payment.Amount', type: 'long', input: 'body', required: true, description: 'Order amount in minor units, as sent by the merchant.' },
    { name: 'Payment.PaidAmount', type: 'long', input: 'body', required: false, description: 'Amount actually paid. Must equal Amount unless a promotion is agreed with Paynet.' },
    { name: 'Payment.CardMask', type: 'string', input: 'body', required: false, description: 'Masked PAN returned for card payments.' },
    { name: 'Payment.CardExpireMonth', type: 'string', input: 'body', required: false, description: 'Card expiration month (if available).' },
    { name: 'Payment.CardExpireYear', type: 'string', input: 'body', required: false, description: 'Card expiration year (if available).' },
    { name: 'Payment.CardIssuer', type: 'string', input: 'body', required: false, description: 'Card issuer name or identifier.' },
    { name: 'Payment.CardLinkHash', type: 'string', input: 'body', required: false, description: 'Card link hash for linked-card scenarios.' },
    { name: 'Payment.MoneyType', type: 'string', input: 'body', required: false, description: 'How the customer paid: CARD, APPLEPAY, GOOGLEPAY, MIA_QR, PAYNET, CASH_INVOICE.' },
    { name: 'Payment.PayerName', type: 'string', input: 'body', required: false, description: 'Payer first name from card/payment data.' },
    { name: 'Payment.PayerSurname', type: 'string', input: 'body', required: false, description: 'Payer surname from card/payment data.' },
    { name: 'Payment.PayerIDNP', type: 'string', input: 'body', required: false, description: 'Payer personal identifier when provided.' },
    { name: 'Payment.RRN', type: 'string', input: 'body', required: false, description: 'Acquirer retrieval reference number for transaction tracking.' },
    { name: 'Header.Hash', type: 'string', input: 'header', required: true, description: 'Notification signature sent in `Hash` HTTP header.' },
  ];

  const toIsoLike = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    if (!text) return '';
    return text.includes('T') ? text : text.replace(' ', 'T');
  };

  const sendNotification = async () => {
    if (!hasCompletedGet) {
      setNotificationError('Please run Get first to load transaction data before sending notification.');
      return;
    }

    if (!notificationSecretKey.trim()) {
      setNotificationError('Secret key for notification is required.');
      return;
    }

    if (!notificationCallbackUrl.trim()) {
      setNotificationError('Notification URL is required.');
      return;
    }

    setIsSendingNotification(true);
    setNotificationError('');
    setNotificationResult('');
    setSentNotificationHash('');
    setSentPreparedString('');

    const resolvedStatus = paymentStatusResult || resolvePaymentStatus(paymentInfoForNotification);
    if (resolvedStatus !== 'paid') {
      // Paynet notifies only paid payments; the simulator behaves the same way.
      setNotificationError(
        tDesc(
          'This order is not paid. Paynet sends notifications only for paid payments (EventType = PAID), so nothing is sent.',
          'Этот заказ не оплачен. Paynet отправляет уведомления только об оплаченных платежах (EventType = PAID), поэтому ничего не отправлено.',
          'Această comandă nu este plătită. Paynet trimite notificări doar pentru plățile achitate (EventType = PAID), deci nu se trimite nimic.'
        )
      );
      setIsSendingNotification(false);
      return;
    }
    const firstDefined = (...values: any[]) => values.find((value) => value !== undefined && value !== null);
    const paymentData = firstDefined(paymentInfoForNotification?.payment, paymentInfoForNotification?.Payment) ?? {};
    const payerData = firstDefined(paymentInfoForNotification?.payer, paymentInfoForNotification?.Payer, paymentData?.payer, paymentData?.Payer) ?? {};

    const paymentId = Number(
      firstDefined(
        paymentInfoForNotification?.paymentId,
        paymentInfoForNotification?.id,
        paymentData?.Id,
        paymentData?.id,
        transactionId
      )
    );
    const externalId = Number(
      firstDefined(
        paymentInfoForNotification?.order,
        paymentInfoForNotification?.externalID,
        paymentInfoForNotification?.externalId,
        paymentData?.ExternalId,
        paymentData?.externalId,
        paymentId
      )
    );
    const amountValue = Number(
      firstDefined(
        paymentData?.Amount,
        paymentData?.amount,
        paymentInfoForNotification?.amount?.amount,
        paymentInfoForNotification?.amount?.requestAmount,
        paymentInfoForNotification?.amount,
        0
      )
    );
    const normalize = (value: unknown) => (value === null || value === undefined ? '' : String(value));
    const maskCustomerCode = (value: unknown) => {
      if (value === null || value === undefined) return null;
      const text = String(value);
      if (text.length < 9) return null;
      return `${text.slice(0, 4)}XXXX${text.slice(8)}`;
    };
    const paymentStatusDateRaw =
      firstDefined(
        paymentData?.StatusDate,
        paymentData?.statusDate,
        paymentInfoForNotification?.paidDate,
        paymentInfoForNotification?.statusDate,
        paymentInfoForNotification?.registered,
        new Date().toISOString()
      );
    const paymentStatusDate = toIsoLike(paymentStatusDateRaw);
    const rawPaymentCustomer =
      firstDefined(
        paymentData?.Customer,
        paymentData?.customer,
        paymentInfoForNotification?.customer?.code,
        typeof paymentInfoForNotification?.customer === 'string' ? paymentInfoForNotification.customer : undefined,
        paymentInfoForNotification?.customerCode
      ) ?? null;
    const paymentCustomer = maskCustomerCode(rawPaymentCustomer);
    const paymentMerchant = String(
      firstDefined(
        paymentData?.Merchant,
        paymentData?.merchant,
        paymentInfoForNotification?.merchantCode,
        '265505'
      )
    );
    const paymentAmount = Number.isFinite(amountValue) ? amountValue : 0;
    const normalizedPaymentId = Number.isFinite(paymentId) ? paymentId : Date.now();
    const normalizedExternalId = Number.isFinite(externalId) ? externalId : Date.now();
    const eventIdCandidate = Number(
      paymentInfoForNotification?.eventid ??
        paymentInfoForNotification?.eventId ??
        paymentInfoForNotification?.paymentEventId
    );
    const eventId = Number.isFinite(eventIdCandidate) ? eventIdCandidate : Date.now();
    const eventDate = toIsoLike(paymentInfoForNotification?.paidDate ?? paymentStatusDate);

    const mockNotification = {
      Eventid: eventId,
      EventType: 'PAID',
      Message: 'Request processed successfully',
      EventDate: eventDate,
      Payment: {
        // Same key spelling as real Paynet notifications (Id / ExternalId).
        Id: normalizedPaymentId,
        ExternalId: normalizedExternalId,
        SaleAreaCode: String(
          firstDefined(paymentData?.SaleAreaCode, paymentData?.saleAreaCode, paymentInfoForNotification?.saleAreaCode, 'onlidocumentation_md')
        ),
        Merchant: paymentMerchant,
        Customer: paymentCustomer,
        StatusDate: paymentStatusDate,
        Amount: paymentAmount,
        PaidAmount: paymentAmount,
        CardMask:
          firstDefined(
            paymentData?.CardMask,
            paymentData?.cardMask,
            payerData?.cardMask,
            payerData?.CardMask,
            paymentInfoForNotification?.cardMask
          ) ?? null,
        CardExpireMonth:
          firstDefined(
            paymentData?.CardExpireMonth,
            paymentData?.cardExpireMonth,
            payerData?.cardExpireMonth,
            payerData?.CardExpireMonth,
            paymentInfoForNotification?.cardExpireMonth
          ) ?? null,
        CardExpireYear:
          firstDefined(
            paymentData?.CardExpireYear,
            paymentData?.cardExpireYear,
            payerData?.cardExpireYear,
            payerData?.CardExpireYear,
            paymentInfoForNotification?.cardExpireYear
          ) ?? null,
        CardIssuer:
          firstDefined(
            paymentData?.CardIssuer,
            paymentData?.cardIssuer,
            payerData?.cardIssuer,
            payerData?.CardIssuer,
            paymentInfoForNotification?.cardIssuer,
            ''
          ) ?? '',
        CardLinkHash:
          firstDefined(
            paymentData?.CardLinkHash,
            paymentData?.cardLinkHash,
            payerData?.cardLinkHash,
            payerData?.CardLinkHash,
            paymentInfoForNotification?.cardLinkHash
          ) ?? null,
        MoneyType:
          firstDefined(
            paymentData?.MoneyType,
            paymentData?.moneyType,
            payerData?.moneyType,
            payerData?.MoneyType,
            paymentInfoForNotification?.moneyType
          ) ?? null,
        PayerName:
          firstDefined(
            paymentData?.PayerName,
            paymentData?.payerName,
            payerData?.payerName,
            payerData?.PayerName,
            paymentInfoForNotification?.payerName
          ) ?? null,
        PayerSurname:
          firstDefined(
            paymentData?.PayerSurname,
            paymentData?.payerSurname,
            payerData?.payerSurname,
            payerData?.PayerSurname,
            paymentInfoForNotification?.payerSurname
          ) ?? null,
        PayerIDNP:
          firstDefined(
            paymentData?.PayerIDNP,
            paymentData?.payerIDNP,
            payerData?.payerIDNP,
            payerData?.PayerIDNP,
            paymentInfoForNotification?.payerIDNP
          ) ?? null,
        RRN:
          firstDefined(
            paymentData?.RRN,
            paymentData?.rrn,
            payerData?.rrn,
            payerData?.RRN,
            paymentInfoForNotification?.rrn
          ) ?? null,
      },
    };

    const preparedString =
      normalize(mockNotification.EventDate) +
      normalize(mockNotification.Eventid) +
      normalize(mockNotification.EventType) +
      normalize(mockNotification.Payment.Amount) +
      normalize(mockNotification.Payment.Customer) +
      normalize(mockNotification.Payment.ExternalId) +
      normalize(mockNotification.Payment.Id) +
      normalize(mockNotification.Payment.Merchant) +
      normalize(mockNotification.Payment.StatusDate);
    const hash = CryptoJS.enc.Base64.stringify(CryptoJS.MD5(preparedString + notificationSecretKey.trim()));
    setSentNotificationHash(hash);
    setSentPreparedString(preparedString);

    setSentNotificationPayloadText(JSON.stringify(mockNotification, null, 2));

    try {
      const response = await fetch(notificationCallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Hash: hash,
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

  const getVerifierCode = () => {
    if (verifierLanguage === 'php') {
      return `<?php
function normalize($value) {
  return ($value === null) ? '' : strval($value);
}

function buildPreparedString($notification) {
  return
    normalize($notification['EventDate'] ?? null) .
    normalize($notification['Eventid'] ?? null) .
    normalize($notification['EventType'] ?? null) .
    normalize($notification['Payment']['Amount'] ?? null) .
    normalize($notification['Payment']['Customer'] ?? null) .
    normalize($notification['Payment']['ExternalId'] ?? null) .
    normalize($notification['Payment']['Id'] ?? null) .
    normalize($notification['Payment']['Merchant'] ?? null) .
    normalize($notification['Payment']['StatusDate'] ?? null);
}

function verifyNotificationHash($notification, $secretKey, $headerHash) {
  $prepared = buildPreparedString($notification);
  $expected = base64_encode(md5($prepared . $secretKey, true));
  return hash_equals($expected, $headerHash);
}`;
    }

    return `import crypto from 'crypto';

const normalize = (value) => (value === null || value === undefined ? '' : String(value));

function buildPreparedString(notification) {
  return (
    normalize(notification.EventDate) +
    normalize(notification.Eventid) +
    normalize(notification.EventType) +
    normalize(notification.Payment?.Amount) +
    normalize(notification.Payment?.Customer) +
    normalize(notification.Payment?.ExternalId) +
    normalize(notification.Payment?.Id) +
    normalize(notification.Payment?.Merchant) +
    normalize(notification.Payment?.StatusDate)
  );
}

function verifyNotificationHash(notification, secretKey, headerHash) {
  const prepared = buildPreparedString(notification);
  const expected = crypto
    .createHash('md5')
    .update(prepared + secretKey, 'utf8')
    .digest('base64');
  return expected === headerHash;
}`;
  };

  const handleCopyVerifierCode = async () => {
    await navigator.clipboard.writeText(getVerifierCode());
    setCopiedVerifierCode(true);
    setTimeout(() => setCopiedVerifierCode(false), 2000);
  };

  const getPaymentInfoById = async () => {
    if (!transactionId.trim()) {
      setPaymentStatusError('Merchant order number (Order) is required.');
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
        setPaymentStatusResult(notFound ? "Fail - transaction doesn't exist" : 'fail');
        return;
      }

      if (normalizedData?.code === 'NOT_FOUND_RECORD') {
        setPaymentStatusResult("Fail - transaction doesn't exist");
        return;
      }

      setPaymentStatusResult(resolvePaymentStatus(normalizedData));
    } catch (error) {
      const errText = error instanceof Error ? error.message : 'Unknown error';
      const unauthorized = errText.includes('Auth failed with status 401');
      setPaymentStatusError(
        `${unauthorized ? 'No token / unauthorized. ' : ''}Get payment info failed: ${errText}. ` +
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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{tDesc('Notification simulator', 'Симулятор уведомлений', 'Simulator notificări')}</h1>
        </div>
      </div>

      <div className="bg-gradient-to-r from-paynet-light to-paynet-gray-50 rounded-paynet border border-paynet-gray-200 overflow-hidden w-full max-w-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-paynet-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-paynet-primary" />
            <h2 className="text-lg sm:text-xl font-semibold text-paynet-primary">{tDesc('Notification simulator', 'Симулятор уведомлений', 'Simulator notificări')}</h2>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-paynet-primary transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 text-paynet-primary transition-transform" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4 sm:p-6 pt-0">
            <div className="xl:flex xl:items-start xl:gap-6">
              <div className="xl:flex-1 min-w-0">
                <div className="bg-white p-4 rounded-lg border border-paynet-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Method Description</h3>
                  <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                    {tDesc(
                      'Paynet sends a callback when a payment is paid. Notifications are server-to-server requests to your backend callback URL and must be processed reliably.',
                      'Paynet отправляет callback, когда платёж оплачен. Уведомления — это server-to-server запросы на callback URL вашего бэкенда, их нужно обрабатывать надёжно.',
                      'Paynet trimite un callback când plata este achitată. Notificările sunt cereri server-to-server către URL-ul de callback al backend-ului dvs. și trebuie procesate fiabil.',
                    )}
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-paynet-gray-700">
                    <li>{tDesc('Paynet sends a callback only when a payment is paid (EventType = PAID). A failed payment produces no callback: the customer is redirected to LinkUrlCancel.', 'Paynet отправляет callback только когда платёж оплачен (EventType = PAID). При неуспешной оплате callback нет: покупатель перенаправляется на LinkUrlCancel.', 'Paynet trimite callback doar când plata este achitată (EventType = PAID). La o plată eșuată nu există callback: clientul este redirecționat la LinkUrlCancel.')}</li>
                    <li>{tDesc('Flow is server-to-server, so callback endpoint must be implemented on backend side.', 'Поток server-to-server, поэтому callback endpoint должен быть реализован на backend.', 'Fluxul este server-to-server, deci endpoint-ul de callback trebuie implementat pe backend.')}</li>
                    <li>{tDesc('Use `Payment.Id` as idempotency key to prevent duplicate business processing. Keys are case-sensitive: `Id`, `ExternalId`.', 'Используйте `Payment.Id` как ключ идемпотентности, чтобы избежать повторной обработки. Ключи чувствительны к регистру: `Id`, `ExternalId`.', 'Folosește `Payment.Id` ca cheie de idempotență pentru a preveni procesarea dublă. Cheile țin cont de majuscule: `Id`, `ExternalId`.')}</li>
                    <li>{tDesc('Return HTTP `200` only after signature validation and successful internal processing.', 'Возвращайте HTTP `200` только после проверки подписи и успешной внутренней обработки.', 'Returnează HTTP `200` doar după validarea semnăturii și procesarea internă cu succes.')}</li>
                  </ul>
                </div>

                <div className="mt-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Merchant UX flow</h3>
                  <ol className="list-decimal pl-5 space-y-2 text-sm sm:text-base text-paynet-gray-700">
                    <li>{tDesc('Paste your callback URL into `MerchantSystemUrl (callback URL)`.', 'Вставьте ваш callback URL в `MerchantSystemUrl (callback URL)`.', 'Introdu URL-ul tău de callback în `MerchantSystemUrl (callback URL)`.')}</li>
                    <li>{tDesc('Enter the merchant order number (`Order`) you used when creating the payment.', 'Введите номер заказа мерчанта (`Order`), который вы указали при создании платежа.', 'Introdu numărul comenzii comerciantului (`Order`) folosit la crearea plății.')}</li>
                    <li>{tDesc("Click `Get` to load transaction state from `GET /api/order/merchant/{'{id}'}`.", "Нажмите `Get`, чтобы загрузить состояние транзакции через `GET /api/order/merchant/{'{id}'}`.", "Apasă `Get` pentru a încărca starea tranzacției din `GET /api/order/merchant/{'{id}'}`.")}</li>
                    <li>{tDesc("Check business status (`paid` / `fail` / `Fail - transaction doesn't exist`).", "Проверьте бизнес-статус (`paid` / `fail` / `Fail - transaction doesn't exist`).", "Verifică statusul business (`paid` / `fail` / `Fail - transaction doesn't exist`).")}</li>
                    <li>{tDesc('Click `Send notification` to post callback payload to your URL and verify signature.', 'Нажмите `Send notification`, чтобы отправить callback payload на ваш URL и проверить подпись.', 'Apasă `Send notification` pentru a trimite payload-ul callback către URL-ul tău și a verifica semnătura.')}</li>
                    <li>{tDesc('CORS is needed only here, because the simulator posts from your browser. Real Paynet notifications come from the Paynet server and do not need CORS; confirm real delivery with a test payment.', 'CORS нужен только здесь, потому что симулятор отправляет запрос из браузера. Настоящие уведомления приходят с сервера Paynet, CORS им не нужен; реальную доставку проверьте тестовым платежом.', 'CORS este necesar doar aici, deoarece simulatorul trimite din browser. Notificările reale Paynet vin de la serverul Paynet și nu au nevoie de CORS; verificați livrarea reală cu o plată de test.')}</li>
                  </ol>
                </div>

                <div className="mt-6">
                  <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-1">Parameters - Description</h3>
                  <ParamList
                items={fieldRows.map((row) => ({
                  name: row.name,
                  type: row.type,
                  in: row.input,
                  required: !!row.required,
                  description: String(getLocalizedParameterDescription(row.name, row.description) ?? ''),
                }))}
                labels={{ required: 'Required', optional: 'Optional', name: 'Name', description: 'Description' }}
              />
                </div>

                <div className="mt-6 bg-white p-4 rounded-lg border border-paynet-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Signature validation</h3>
                  <p className="text-sm sm:text-base text-paynet-gray-700 leading-relaxed mb-3">
                    {tDesc(
                      'Verify every notification before trusting business status. Build `PreparedString` in strict order and compare expected hash with `Header.Hash`.',
                      'Проверяйте каждое уведомление до принятия бизнес-статуса. Формируйте `PreparedString` в строгом порядке и сравнивайте ожидаемый hash с `Header.Hash`.',
                      'Verifică fiecare notificare înainte de a accepta statusul business. Construiește `PreparedString` în ordine strictă și compară hash-ul așteptat cu `Header.Hash`.',
                    )}
                  </p>
                  <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3 whitespace-pre-wrap">
{`ExpectedHash = Base64(MD5(PreparedString + SecretKey))
Accept notification only if ExpectedHash === Header.Hash`}
                  </pre>
                  <pre className="bg-paynet-gray-900 text-paynet-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto mb-3 whitespace-pre-wrap">
{`PreparedString =
EventDate + Eventid + EventType + Payment.Amount + Payment.Customer +
Payment.ExternalId + Payment.Id + Payment.Merchant + Payment.StatusDate`}
                  </pre>
                  <p className="text-xs sm:text-sm text-paynet-gray-600 mb-3">
                    {tDesc(
                      'Order is strict. Empty fields must be treated as empty strings.',
                      'Порядок строго фиксирован. Пустые поля нужно обрабатывать как пустые строки.',
                      'Ordinea este strictă. Câmpurile goale trebuie tratate ca șiruri goale.',
                    )}
                  </p>
                  <ol className="list-decimal pl-5 space-y-2 text-sm sm:text-base text-paynet-gray-700 mb-3">
                    <li>{tDesc('Parse notification and normalize missing fields to empty strings.', 'Распарсьте уведомление и нормализуйте отсутствующие поля как пустые строки.', 'Parsează notificarea și normalizează câmpurile lipsă la șiruri goale.')}</li>
                    <li>{tDesc('Build `PreparedString` in exact order and append `SecretKey`.', 'Соберите `PreparedString` в точном порядке и добавьте `SecretKey`.', 'Construiește `PreparedString` în ordinea exactă și adaugă `SecretKey`.')}</li>
                    <li>{tDesc('Compute hash and compare with `Header.Hash` (constant-time comparison).', 'Вычислите hash и сравните с `Header.Hash` (сравнение constant-time).', 'Calculează hash-ul și compară-l cu `Header.Hash` (comparație constant-time).')}</li>
                  </ol>

                  <div className="border border-paynet-gray-200 rounded-md p-3 bg-paynet-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setVerifierLanguage('node')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            verifierLanguage === 'node'
                              ? 'bg-paynet-primary text-white'
                              : 'bg-white text-paynet-gray-700 border border-paynet-gray-300'
                          }`}
                        >
                          Node.js
                        </button>
                        <button
                          onClick={() => setVerifierLanguage('php')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            verifierLanguage === 'php'
                              ? 'bg-paynet-primary text-white'
                              : 'bg-white text-paynet-gray-700 border border-paynet-gray-300'
                          }`}
                        >
                          PHP
                        </button>
                      </div>
                      <button
                        onClick={handleCopyVerifierCode}
                        className="flex items-center gap-2 px-3 py-1.5 bg-paynet-primary hover:bg-paynet-secondary text-white text-xs font-medium rounded-paynet transition-all duration-200"
                      >
                        {copiedVerifierCode ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy sample verifier code
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded-md text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap">
                      {getVerifierCode()}
                    </pre>
                  </div>
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
                      <div className="bg-white p-4 rounded-lg border border-paynet-gray-200">
                        <h3 className="text-base sm:text-lg font-semibold text-paynet-primary mb-2">Notification endpoint</h3>
                        <div className="mb-2">
                          <div className="max-w-2xl">
                            <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Secret key for notification</label>
                            <input
                              value={notificationSecretKey}
                              onChange={(e) => setNotificationSecretKey(e.target.value)}
                              className="w-full px-3 py-2 border border-paynet-gray-300 rounded-md text-sm font-mono mb-3"
                              placeholder="Enter secret key used for signature validation"
                            />
                            <p className="-mt-2 mb-3 text-xs text-paynet-gray-500">
                              {tDesc(
                                'Pre-filled with the public test key of the shared test merchant. Replace it with your own test key if you have one. Never enter a production key here.',
                                'Уже заполнен публичным тестовым ключом общего тестового мерчанта. Если у вас есть свой тестовый ключ, замените его. Боевой ключ сюда не вводите.',
                                'Completat deja cu cheia publică de test a comerciantului de test comun. Dacă aveți propria cheie de test, înlocuiți-o. Nu introduceți aici cheia de producție.'
                              )}
                            </p>
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
                          {tDesc(
                            'Set the public HTTPS endpoint that will receive Paynet notification payloads.',
                            'Укажите публичный HTTPS endpoint, который будет получать payload уведомлений Paynet.',
                            'Setează endpoint-ul public HTTPS care va primi payload-urile de notificare Paynet.',
                          )}
                        </p>
                        <div className="mt-4 max-w-xl">
                          <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Merchant order number (Order)</label>
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
                          {lastOrder && transactionId === lastOrder.order && (
                            <p className="mt-1 text-xs text-paynet-gray-500">
                              {tDesc(
                                `Filled in automatically: the last order created on this site${lastOrder.source === 'checkout-form' ? ' (sent via the checkout form)' : ''}, ${new Date(lastOrder.createdAt).toLocaleTimeString()}. You can enter another number.`,
                                `Подставлен автоматически: последний заказ, созданный на этом сайте${lastOrder.source === 'checkout-form' ? ' (отправлен через форму checkout)' : ''}, ${new Date(lastOrder.createdAt).toLocaleTimeString()}. Можно ввести другой номер.`,
                                `Completat automat: ultima comandă creată pe acest site${lastOrder.source === 'checkout-form' ? ' (trimisă prin formularul checkout)' : ''}, ${new Date(lastOrder.createdAt).toLocaleTimeString()}. Puteți introduce alt număr.`
                              )}
                            </p>
                          )}
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
                        {sentNotificationPayloadText && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Sent notification payload</label>
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                              {sentNotificationPayloadText}
                            </pre>
                          </div>
                        )}
                        {sentNotificationHash && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Sent Hash header</label>
                            <code className="block bg-paynet-gray-50 border border-paynet-gray-200 px-3 py-2 rounded-md text-sm break-all">
                              {sentNotificationHash}
                            </code>
                          </div>
                        )}
                        {sentPreparedString && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-paynet-gray-700 mb-1">Sent PreparedString</label>
                            <code className="block bg-paynet-gray-50 border border-paynet-gray-200 px-3 py-2 rounded-md text-sm break-all">
                              {sentPreparedString}
                            </code>
                          </div>
                        )}
                        <p className="mt-4 text-xs sm:text-sm text-paynet-gray-600">
                          {tDesc(
                            'This tool sends a test callback simulation from documentation UI. It is not a live production push from Paynet systems.',
                            'Этот инструмент отправляет тестовую симуляцию callback из UI документации. Это не боевая отправка из систем Paynet.',
                            'Acest instrument trimite o simulare de callback de test din UI-ul documentației. Nu este un push live de producție din sistemele Paynet.',
                          )}
                        </p>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
