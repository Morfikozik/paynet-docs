<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/** Payment statuses (field `status`). 5 and 6 are final. */
final class PaymentStatus
{
    public const REGISTERED = 1;          // created, not paid yet (the same paymentLink can be opened again)
    public const PROCESSING = 3;          // in progress — wait, do not create a new order (can last up to about a day)
    public const PAID = 4;
    public const CANCELLED = 5;           // final: bank decline, antifraud, 3-D Secure failed, or full refund
    public const PARTIALLY_REFUNDED = 6;  // final

    public static function isFinal(int $status): bool
    {
        return $status === self::CANCELLED || $status === self::PARTIALLY_REFUNDED;
    }

    public static function describe(int $status): string
    {
        switch ($status) {
            case self::REGISTERED: return 'registered, not paid';
            case self::PROCESSING: return 'processing — wait';
            case self::PAID: return 'paid';
            case self::CANCELLED: return 'cancelled (final)';
            case self::PARTIALLY_REFUNDED: return 'partially refunded (final)';
            default: return 'unknown status ' . $status;
        }
    }
}
