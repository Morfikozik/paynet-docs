// Type definitions for paynet-ecom-sdk (official Paynet e-commerce SDK for Node.js).

export type EnvironmentName = 'test' | 'production';

export declare const Environment: Readonly<Record<EnvironmentName, { apiUrl: string; checkoutUrl: string }>>;

export declare const ErrorKind: Readonly<{
  VALIDATION: 'validation';
  AUTHENTICATION: 'authentication';
  UNAUTHORIZED: 'unauthorized';
  NOT_FOUND: 'not_found';
  WRONG_ADDRESS: 'wrong_address';
  METHOD_NOT_ALLOWED: 'method_not_allowed';
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type';
  SERVER: 'server';
  NETWORK: 'network';
  RULE: 'rule';
}>;
export type ErrorKindValue = (typeof ErrorKind)[keyof typeof ErrorKind];

export declare class PaynetError extends Error {
  kind: ErrorKindValue;
  httpStatus: number | null;
  code: string | null;
  details: unknown;
  traceId: string | null;
  retryable: boolean;
  hint: string;
  body: unknown;
}

export declare const PaymentStatus: Readonly<{
  REGISTERED: 1;
  PROCESSING: 3;
  PAID: 4;
  CANCELLED: 5;
  PARTIALLY_REFUNDED: 6;
}>;
export declare function isFinalStatus(status: number): boolean;
export declare function describeStatus(status: number): string;

export interface OrderProduct {
  LineNo: number;
  Code: string;
  Name: string;
  Description: string;
  /** minor units */
  UnitPrice: number;
  /** in hundredths: 100 = 1 pc */
  Quantity: number;
  Amount: number;
  TotalAmount: number;
  [key: string]: unknown;
}

export interface OrderRequest {
  /** Your order number (integer). One shop order = one Order. */
  Order: number;
  SaleAreaCode: string;
  LinkUrlSuccess: string;
  LinkUrlCancel: string;
  Customer?: { Code?: string; NameFirst?: string; NameLast?: string; PhoneNumber?: string; email?: string; Country?: string; City?: string; Address?: string; [key: string]: unknown };
  /** Payment deadline, Chișinău time: YYYY-MM-DDTHH:mm:ss (see expiryInHours) */
  ExpiryDate: string;
  Currency?: number;
  Services: Array<{ Name: string; Description: string; Amount: number; Products?: OrderProduct[] }>;
  MoneyType?: 'All' | 'Card' | 'Paynet' | 'MIA' | 'CashInvoice' | string;
  Lang?: string;
  CardLinkHash?: string;
  [key: string]: unknown;
}

export interface Payment {
  paymentId: number;
  paymentLink: string;
  status: number;
  order: number;
  cardLinkHash: string | null;
  amount: { requestAmount?: number; requestCurrency?: number; amount: number; paidAmount: number | null };
  customer?: { code?: string; cardLinkHash?: string | null; [key: string]: unknown };
  paidDate?: string | null;
  moneyType?: string | null;
  [key: string]: unknown;
}

export interface ClientOptions {
  username: string;
  password: string;
  environment?: EnvironmentName;
  apiUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export declare class PaynetClient {
  constructor(options: ClientOptions);
  readonly apiUrl: string;
  getToken(force?: boolean): Promise<string>;
  request<T = unknown>(method: string, path: string, options?: { body?: unknown; binary?: boolean }): Promise<T>;
  createOrder(order: OrderRequest): Promise<Payment>;
  getPayment(paymentId: number | string): Promise<Payment>;
  getPaymentByOrder(order: number | string): Promise<Payment>;
  searchPayments(period: { from: Date | string; to: Date | string }): Promise<unknown>;
  isPaid(order: number | string): Promise<boolean>;
  refund(params: {
    paymentId: number;
    saleAreaCode: string;
    /** minor units */
    amount: number;
    type?: 'full' | 'partial';
    reason?: string;
    currency?: number;
    checkFirst?: boolean;
  }): Promise<Record<string, unknown>>;
  unlinkCard(params: { cardLinkHash: string; saleAreaCode: string; customerCode: string }): Promise<unknown>;
  getStatement(params: { dateStart: Date | string; dateFinish: Date | string; accountId?: string | number }): Promise<unknown>;
  downloadStatement(params: { dateStart: Date | string; dateFinish: Date | string }): Promise<Buffer>;
}

export interface Notification {
  Eventid: number;
  EventType: string;
  EventDate: string;
  Payment: {
    Id: number;
    ExternalId: number;
    Merchant: string;
    Customer: string;
    StatusDate: string;
    Amount: number;
    PaidAmount?: number;
    MoneyType?: string;
    CardLinkHash?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export declare function parseNotification(rawBody: string | Buffer | object, hashHeader: string | undefined | null, secretKey: string): Notification;
export declare function confirmNotification(
  client: PaynetClient,
  notification: Notification,
  expected: { amount?: number; customerCode?: string; promotionAgreed?: boolean }
): Promise<{ ok: boolean; payment: Payment; problems: string[] }>;

export declare function buildCheckoutForm(params: {
  fields: Record<string, string | number | null | undefined>;
  secretKey: string;
  environment?: EnvironmentName;
  autoSubmit?: boolean;
}): { action: string; fields: Record<string, string | number>; html: string };

export declare const CHECKOUT_SIGNED_FIELDS: readonly string[];
export declare function checkoutRawData(fields: Record<string, unknown>): string;
export declare function checkoutSignature(fields: Record<string, unknown>, secretKey: string): string;
export declare function notificationPreparedString(notification: object): string;
export declare function notificationHash(notification: object, secretKey: string): string;
export declare function verifyNotificationHash(notification: object, hashHeader: string | undefined | null, secretKey: string): boolean;

export declare function chisinauDateTime(date?: Date): string;
export declare function chisinauDate(date?: Date): string;
export declare function expiryInHours(hours?: number, now?: Date): string;
