<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/** Paynet signatures: Base64( MD5( <string> + secretKey ) ) over UTF-8. */
final class Signature
{
    /** Signed fields of the hosted checkout form (sorted by name when signing). */
    public const CHECKOUT_SIGNED_FIELDS = [
        'Amount', 'Currency', 'CustomerCode', 'CustomerEmail', 'CustomerNameFirst', 'CustomerNameLast',
        'CustomerPhoneNumber', 'Description', 'ExpiryDate', 'Lang', 'LinkUrlCancel', 'LinkUrlSuccess',
        'Merchant', 'MoneyType', 'Order', 'SaleAreaCode',
    ];

    public static function md5Base64(string $text): string
    {
        return base64_encode(md5($text, true));
    }

    /** RawData: signed values that are present, sorted by field name, RFC 3986-encoded, concatenated. */
    public static function checkoutRawData(array $fields): string
    {
        $names = self::CHECKOUT_SIGNED_FIELDS;
        sort($names, SORT_STRING);
        $raw = '';
        foreach ($names as $name) {
            if (array_key_exists($name, $fields) && $fields[$name] !== null) {
                $raw .= rawurlencode((string) $fields[$name]); // rawurlencode = RFC 3986
            }
        }
        return $raw;
    }

    public static function checkout(array $fields, string $secretKey): string
    {
        return self::md5Base64(self::checkoutRawData($fields) . $secretKey);
    }

    /** PreparedString of a notification: 9 values in this exact order (do not sort). */
    public static function notificationPreparedString(array $notification): string
    {
        $p = $notification['Payment'] ?? [];
        $values = [
            $notification['EventDate'] ?? null, $notification['Eventid'] ?? null, $notification['EventType'] ?? null,
            $p['Amount'] ?? null, $p['Customer'] ?? null, $p['ExternalId'] ?? null, $p['Id'] ?? null,
            $p['Merchant'] ?? null, $p['StatusDate'] ?? null,
        ];
        $s = '';
        foreach ($values as $v) {
            $s .= $v === null ? '' : (is_bool($v) ? ($v ? 'true' : 'false') : (string) $v);
        }
        return $s;
    }

    public static function notification(array $notification, string $secretKey): string
    {
        return self::md5Base64(self::notificationPreparedString($notification) . $secretKey);
    }

    public static function verifyNotification(array $notification, ?string $hashHeader, string $secretKey): bool
    {
        return hash_equals(self::notification($notification, $secretKey), (string) $hashHeader);
    }
}
