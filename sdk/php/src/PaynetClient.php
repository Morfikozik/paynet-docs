<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/**
 * Paynet e-commerce API client (PHP 7.4+, ext-curl, ext-json; no other dependencies).
 *
 * $paynet = new PaynetClient(['username' => '...', 'password' => '...', 'environment' => 'test']);
 * $payment = $paynet->createOrder([...]);  // ['paymentId' => ..., 'paymentLink' => ...]
 */
class PaynetClient
{
    public const ENVIRONMENTS = [
        'test' => ['apiUrl' => 'https://ecom-api-test.paynet.md', 'checkoutUrl' => 'https://test.paynet.md/ecom/checkout'],
        'production' => ['apiUrl' => 'https://ecom-api.paynet.md', 'checkoutUrl' => 'https://paynet.md/ecom/checkout'],
    ];

    /** @var string */
    public $apiUrl;
    /** @var string */
    private $username;
    /** @var string */
    private $password;
    /** @var int */
    private $timeout;
    /** @var callable|null fn(string $method, string $url, array $headers, ?string $body, int $timeout): array{status:int, body:string} */
    private $transport;
    /** @var string|null */
    private $token;
    /** @var int */
    private $tokenExpiresAt = 0;

    /**
     * @param array{username:string,password:string,environment?:string,apiUrl?:string,timeout?:int,transport?:callable} $options
     */
    public function __construct(array $options)
    {
        if (empty($options['username']) || empty($options['password'])) {
            throw PaynetException::rule('username and password are required');
        }
        $environment = $options['environment'] ?? 'test';
        if (empty($options['apiUrl']) && !isset(self::ENVIRONMENTS[$environment])) {
            throw PaynetException::rule('Unknown environment "' . $environment . '" (use "test" or "production")');
        }
        $this->username = (string) $options['username'];
        $this->password = (string) $options['password'];
        $this->apiUrl = rtrim((string) ($options['apiUrl'] ?? self::ENVIRONMENTS[$environment]['apiUrl']), '/');
        $this->timeout = (int) ($options['timeout'] ?? 30);
        $this->transport = $options['transport'] ?? null;
    }

    // ---------- low level ----------

    /** @return array{status:int, body:string} */
    private function send(string $method, string $path, ?array $body = null, bool $auth = true): array
    {
        $headers = ['Accept: application/json'];
        if ($auth) {
            $headers[] = 'Authorization: Bearer ' . $this->getToken();
        }
        $json = null;
        if ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $url = $this->apiUrl . $path;
        if ($this->transport !== null) {
            return ($this->transport)($method, $url, $headers, $json, $this->timeout);
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => min(10, $this->timeout),
        ]);
        if ($json !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        }
        $response = curl_exec($ch);
        if ($response === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new PaynetException(
                'No response from Paynet (' . $method . ' ' . $path . '): ' . $error,
                PaynetException::NETWORK, null, null, null, null, true,
                'Network problem or timeout. For createOrder: check the order with getPaymentByOrder(Order), then repeat the same request unchanged.'
            );
        }
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => (string) $response];
    }

    /** @return mixed */
    private static function decode(string $raw)
    {
        if ($raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : $raw;
    }

    /**
     * Calls the API; on 401 gets a new token and repeats the request once.
     * @return mixed decoded JSON (or raw string when $binary)
     */
    public function request(string $method, string $path, ?array $body = null, bool $binary = false)
    {
        $result = $this->send($method, $path, $body);
        if ($result['status'] === 401) {
            $this->token = null;
            $result = $this->send($method, $path, $body);
        }
        if ($result['status'] < 200 || $result['status'] >= 300) {
            throw PaynetException::fromResponse($result['status'], self::decode($result['body']));
        }
        return $binary ? $result['body'] : self::decode($result['body']);
    }

    /** Returns a valid token (cached; refreshed 5 minutes before it expires). */
    public function getToken(bool $force = false): string
    {
        if (!$force && $this->token !== null && time() < $this->tokenExpiresAt) {
            return $this->token;
        }
        $result = $this->send('POST', '/auth', ['grantType' => 'password', 'username' => $this->username, 'password' => $this->password], false);
        $body = self::decode($result['body']);
        if ($result['status'] !== 200 || !is_array($body) || empty($body['access_token'])) {
            throw PaynetException::fromResponse($result['status'], $body, true);
        }
        $this->token = (string) $body['access_token'];
        $this->tokenExpiresAt = time() + max(60, (int) ($body['expires_in'] ?? 3600) - 300);
        return $this->token;
    }

    // ---------- payments ----------

    /**
     * Creates an order (POST /api/order) and returns ['paymentId' => ..., 'paymentLink' => ..., ...].
     * Store the request body with your order: to retry, send exactly the same body — Paynet then returns
     * the same payment. Any change in the data, or a repeat after payment, gives 500.
     * After a network error the request is repeated once with the same body.
     */
    public function createOrder(array $order): array
    {
        try {
            return $this->request('POST', '/api/order', $order);
        } catch (PaynetException $e) {
            if ($e->kind === PaynetException::NETWORK) {
                return $this->request('POST', '/api/order', $order);
            }
            throw $e;
        }
    }

    /** GET /api/order/{paymentId} */
    public function getPayment($paymentId): array
    {
        return $this->request('GET', '/api/order/' . rawurlencode((string) $paymentId));
    }

    /** GET /api/order/merchant/{Order} — by your order number. Paid when status = 4. */
    public function getPaymentByOrder($order): array
    {
        return $this->request('GET', '/api/order/merchant/' . rawurlencode((string) $order));
    }

    /** True when the payment for this Order is paid (status 4). */
    public function isPaid($order): bool
    {
        return ($this->getPaymentByOrder($order)['status'] ?? null) === PaymentStatus::PAID;
    }

    /**
     * GET /api/order/search — payments in a period.
     * @param \DateTimeInterface|string $from
     * @param \DateTimeInterface|string $to
     * @return mixed
     */
    public function searchPayments($from, $to)
    {
        $iso = static function ($d): string {
            return $d instanceof \DateTimeInterface
                ? (new \DateTimeImmutable('@' . $d->getTimestamp()))->format('Y-m-d\TH:i:s.v\Z')
                : (string) $d;
        };
        return $this->request('GET', '/api/order/search?from=' . rawurlencode($iso($from)) . '&to=' . rawurlencode($iso($to)));
    }

    // ---------- refunds ----------

    /**
     * Refund (POST /api/order/refund). The result comes in the response — there is no callback.
     * Production rules: ONE refund per payment (full or partial), within 180 days, at most PaidAmount,
     * not for CASH_INVOICE. With $checkFirst (default) the SDK reads the payment first and refuses a refund
     * that would break these rules, so you get a clear error instead of an API error.
     *
     * @param string|null $type 'full' | 'partial' | null (null: 'full' when amount equals PaidAmount, else 'partial')
     */
    public function refund(int $paymentId, string $saleAreaCode, int $amount, ?string $type = null, string $reason = 'Refund', int $currency = 498, bool $checkFirst = true): array
    {
        if ($amount <= 0) {
            throw PaynetException::rule('amount must be a positive integer in minor units (300 = 3.00 MDL)');
        }
        if ($type !== null && $type !== 'full' && $type !== 'partial') {
            throw PaynetException::rule('type must be "full" or "partial"');
        }
        if ($checkFirst) {
            $payment = $this->getPayment($paymentId);
            $status = $payment['status'] ?? null;
            $paid = $payment['amount']['paidAmount'] ?? ($payment['amount']['amount'] ?? null);
            $hint = 'Production rule: one refund per payment, within 180 days, at most PaidAmount, not for CASH_INVOICE.';
            if ($status === PaymentStatus::PARTIALLY_REFUNDED || ($status === PaymentStatus::CANCELLED && !empty($payment['paidDate']))) {
                throw PaynetException::rule('Payment ' . $paymentId . ' was already refunded (status ' . $status . '). Only one refund per payment is allowed.', $hint);
            }
            if ($status !== PaymentStatus::PAID) {
                throw PaynetException::rule('Payment ' . $paymentId . ' is not paid (status ' . var_export($status, true) . '). Only paid payments (status 4) can be refunded.', $hint);
            }
            if (stripos((string) ($payment['moneyType'] ?? ''), 'CASH') !== false) {
                throw PaynetException::rule('Refunds are not available for CASH_INVOICE payments.', $hint);
            }
            if ($paid !== null && $amount > $paid) {
                throw PaynetException::rule('Refund amount ' . $amount . ' is more than the paid amount ' . $paid . '.', $hint);
            }
            if ($type === null) {
                $type = ($paid !== null && $amount === (int) $paid) ? 'full' : 'partial';
            }
        }
        return $this->request('POST', '/api/order/refund', [
            'PaymentId' => $paymentId,
            'SaleAreaCode' => $saleAreaCode,
            'RefundType' => $type ?? 'full',
            'Amount' => $amount,
            'Currency' => $currency,
            'Reason' => $reason,
        ]);
    }

    // ---------- saved cards ----------

    /** Deletes a saved card (POST /api/linked-cards/unlink). The token works only with the same customer code. */
    public function unlinkCard(string $cardLinkHash, string $saleAreaCode, string $customerCode)
    {
        return $this->request('POST', '/api/linked-cards/unlink', ['CardLinkHash' => $cardLinkHash, 'SaleAreaCode' => $saleAreaCode, 'CustomerCode' => $customerCode]);
    }

    // ---------- statements ----------

    /**
     * GET /api/statement. Dates: DateTimeInterface (converted to Chișinău date) or 'YYYY-MM-DD'.
     * @param \DateTimeInterface|string $dateStart
     * @param \DateTimeInterface|string $dateFinish
     * @return mixed
     */
    public function getStatement($dateStart, $dateFinish, $accountId = null)
    {
        $q = 'dateStart=' . self::date($dateStart) . '&dateFinish=' . self::date($dateFinish);
        if ($accountId !== null) {
            $q .= '&accountId=' . rawurlencode((string) $accountId);
        }
        return $this->request('GET', '/api/statement?' . $q);
    }

    /**
     * GET /api/statement/download — returns the .xlsx file contents (binary string). Period of at most 31 days.
     * @param \DateTimeInterface|string $dateStart
     * @param \DateTimeInterface|string $dateFinish
     */
    public function downloadStatement($dateStart, $dateFinish): string
    {
        return $this->request('GET', '/api/statement/download?dateStart=' . self::date($dateStart) . '&dateFinish=' . self::date($dateFinish), null, true);
    }

    /** @param \DateTimeInterface|string $d */
    private static function date($d): string
    {
        return $d instanceof \DateTimeInterface ? Time::chisinauDate($d) : rawurlencode((string) $d);
    }
}
