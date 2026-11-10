<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/** Chișinău local time (Europe/Chisinau) — the time zone of ExpiryDate and statement dates. */
final class Time
{
    /** `YYYY-MM-DDTHH:mm:ss` in Chișinău time. */
    public static function chisinauDateTime(?\DateTimeInterface $date = null): string
    {
        $d = \DateTimeImmutable::createFromFormat('U', (string) ($date ? $date->getTimestamp() : time()));
        return $d->setTimezone(new \DateTimeZone('Europe/Chisinau'))->format('Y-m-d\TH:i:s');
    }

    /** `YYYY-MM-DD` in Chișinău time. */
    public static function chisinauDate(?\DateTimeInterface $date = null): string
    {
        return substr(self::chisinauDateTime($date), 0, 10);
    }

    /** ExpiryDate `hours` from now, in Chișinău time. */
    public static function expiryInHours(int $hours = 24, ?\DateTimeInterface $now = null): string
    {
        $base = $now ? $now->getTimestamp() : time();
        return self::chisinauDateTime((new \DateTimeImmutable('@' . ($base + $hours * 3600))));
    }
}
