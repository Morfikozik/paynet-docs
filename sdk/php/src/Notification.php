<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/**
 * Payment notifications (Paynet → your callback URL).
 *
 * Rules (confirmed by Paynet):
 * - answer HTTP 200 (only 200 counts; 204 and other 2xx cause retries), quickly — Paynet waits about 30 seconds;
 * - retries: 9 attempts within about 25 minutes, then Paynet stops;
 * - only PAID events are sent;
 * - the Hash header covers 9 fields; PaidAmount, MoneyType, CardLinkHash are NOT signed → confirm through the API.
 *
 * $notification = Notification::parse(file_get_contents('php://input'), $_SERVER['HTTP_HASH'] ?? null, $secret);
 */
final class Notification
{
    /**
     * Parses the raw body and checks the Hash header. Throws PaynetException (kind 'validation') if invalid:
     * answer 400 to Paynet in that case; otherwise store the notification and answer 200.
     */
    public static function parse(string $rawBody, ?string $hashHeader, string $secretKey): array
    {
        $notification = json_decode($rawBody, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($notification)) {
            throw new PaynetException('Notification body is not valid JSON', PaynetException::VALIDATION);
        }
        if (!isset($notification['Payment']) || !is_array($notification['Payment'])) {
            throw new PaynetException('Notification has no Payment object', PaynetException::VALIDATION);
        }
        if (!Signature::verifyNotification($notification, $hashHeader, $secretKey)) {
            throw new PaynetException(
                'Notification Hash does not match (wrong secret key, or the body was changed)',
                PaynetException::VALIDATION, null, null, null, null, false,
                'Use the NOTIFICATION secret key (not the checkout key) and the raw body as received.'
            );
        }
        return $notification;
    }

    /**
     * Confirms a verified notification through the API and against your order.
     * Returns ['ok' => bool, 'payment' => array, 'problems' => string[]]. When ok is false, do not fulfil
     * the order — send it to manual review.
     *
     * @param array{amount?:int, customerCode?:string, promotionAgreed?:bool} $expected what your shop knows about the order
     */
    public static function confirm(PaynetClient $client, array $notification, array $expected): array
    {
        $p = $notification['Payment'];
        $problems = [];
        if (($notification['EventType'] ?? null) !== 'PAID') {
            $problems[] = 'EventType ' . ($notification['EventType'] ?? 'missing');
        }
        $payment = $client->getPaymentByOrder($p['ExternalId']);
        if (($payment['paymentId'] ?? null) !== ($p['Id'] ?? null)) {
            $problems[] = 'paymentId differs from Payment.Id';
        }
        if (($payment['status'] ?? null) !== PaymentStatus::PAID) {
            $problems[] = 'status is ' . var_export($payment['status'] ?? null, true) . ', not 4';
        }
        if (isset($expected['amount']) && (($payment['amount']['amount'] ?? null) !== $expected['amount'] || ($p['Amount'] ?? null) !== $expected['amount'])) {
            $problems[] = 'Amount differs from your order';
        }
        if (($payment['amount']['paidAmount'] ?? null) !== ($p['PaidAmount'] ?? null)) {
            $problems[] = 'PaidAmount in the notification differs from the API';
        }
        if (($p['PaidAmount'] ?? null) !== ($p['Amount'] ?? null) && empty($expected['promotionAgreed'])) {
            $problems[] = 'PaidAmount differs from Amount';
        }
        if (isset($expected['customerCode']) && ($payment['customer']['code'] ?? null) !== $expected['customerCode']) {
            $problems[] = 'customer differs from your order';
        }
        if (!empty($p['CardLinkHash']) && !empty($payment['cardLinkHash']) && $payment['cardLinkHash'] !== $p['CardLinkHash']) {
            $problems[] = 'CardLinkHash differs from the API';
        }
        return ['ok' => count($problems) === 0, 'payment' => $payment, 'problems' => $problems];
    }
}
