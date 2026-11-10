<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/**
 * Paynet API error in one shape, whatever format the API used.
 *
 * The API answers errors in several formats (checked on the test environment):
 *   { status, code, message, details, traceId }       — most errors (lowercase keys)
 *   { Status, Code, Message, TraceId }                 — 401 for a missing / invalid token
 *   { errorInfo: { ppResponseCode, errors: [...] } }   — unreadable request, missing fields, wrong types
 *   empty body                                         — 404 wrong path, 405 wrong method, 415 wrong Content-Type
 */
class PaynetException extends \RuntimeException
{
    public const VALIDATION = 'validation';               // 400: fix the request
    public const AUTHENTICATION = 'authentication';       // 401 /auth: wrong username or password
    public const UNAUTHORIZED = 'unauthorized';           // 401: token missing / expired (already retried once)
    public const NOT_FOUND = 'not_found';                 // 404 NOT_FOUND_RECORD
    public const WRONG_ADDRESS = 'wrong_address';         // 404 with empty body
    public const METHOD_NOT_ALLOWED = 'method_not_allowed'; // 405
    public const UNSUPPORTED_MEDIA_TYPE = 'unsupported_media_type'; // 415
    public const SERVER = 'server';                       // 500 TECHNICAL_ERROR
    public const NETWORK = 'network';                     // no response
    public const RULE = 'rule';                           // rejected by the SDK before calling the API

    /** @var string */
    public $kind;
    /** @var int|null */
    public $httpStatus;
    /** @var string|null Paynet error code, e.g. INVALID_PARAMETER */
    public $errorCode;
    /** @var mixed */
    public $details;
    /** @var string|null send it to Paynet support */
    public $traceId;
    /** @var bool whether repeating the same request can succeed */
    public $retryable;
    /** @var string what to do */
    public $hint;
    /** @var mixed raw response body */
    public $body;

    public function __construct(
        string $message,
        string $kind,
        ?int $httpStatus = null,
        ?string $errorCode = null,
        $details = null,
        ?string $traceId = null,
        bool $retryable = false,
        string $hint = '',
        $body = null,
        ?\Throwable $previous = null
    ) {
        parent::__construct($message, $httpStatus ?? 0, $previous);
        $this->kind = $kind;
        $this->httpStatus = $httpStatus;
        $this->errorCode = $errorCode;
        $this->details = $details;
        $this->traceId = $traceId;
        $this->retryable = $retryable;
        $this->hint = $hint;
        $this->body = $body;
    }

    public static function rule(string $message, string $hint = ''): self
    {
        return new self($message, self::RULE, null, null, null, null, false, $hint);
    }

    /** @param mixed $body decoded JSON (array) or raw string or null */
    public static function fromResponse(int $httpStatus, $body, bool $isAuth = false): self
    {
        $pick = static function ($obj, string $key) {
            if (!is_array($obj)) {
                return null;
            }
            return $obj[$key] ?? $obj[ucfirst($key)] ?? null;
        };
        $info = is_array($body) && isset($body['errorInfo']) && is_array($body['errorInfo']) ? $body['errorInfo'] : null;
        if ($info !== null) {
            $code = $info['ppResponseCodeText'] ?? 'errorInfo';
            $messages = [];
            foreach (($info['errors'] ?? []) as $e) {
                $messages[] = is_array($e) ? ($e['message'] ?? $e['field'] ?? json_encode($e)) : (string) $e;
            }
            $message = $messages ? implode('; ', $messages) : (string) ($info['ppResponseCodeText'] ?? 'error');
            $details = $info['errors'] ?? null;
            $traceId = $info['traceId'] ?? null;
        } else {
            $code = $pick($body, 'code');
            $message = $pick($body, 'message') ?? $pick($body, 'title') ?? ('HTTP ' . $httpStatus);
            $details = $pick($body, 'details');
            $traceId = $pick($body, 'traceId');
        }
        $empty = $body === null || $body === '';

        if ($httpStatus === 400) {
            $kind = self::VALIDATION;
            $hint = 'Fix the request: see details. Repeat only after fixing.';
        } elseif ($httpStatus === 401 && ($isAuth || $code === 'AUTHENTICATION_FAILED')) {
            $kind = self::AUTHENTICATION;
            $hint = 'Check username and password (test and production credentials are different).';
        } elseif ($httpStatus === 401) {
            $kind = self::UNAUTHORIZED;
            $hint = 'The token was refreshed and the request repeated once, still 401: check the credentials.';
        } elseif ($httpStatus === 404 && $empty) {
            $kind = self::WRONG_ADDRESS;
            $hint = 'Wrong API address or path: check apiUrl.';
        } elseif ($httpStatus === 404) {
            $kind = self::NOT_FOUND;
            $hint = 'No payment with this ID, or the payment is not paid (for a refund). Check paymentId / Order and the status.';
        } elseif ($httpStatus === 405) {
            $kind = self::METHOD_NOT_ALLOWED;
            $hint = 'Wrong HTTP method.';
        } elseif ($httpStatus === 415) {
            $kind = self::UNSUPPORTED_MEDIA_TYPE;
            $hint = 'Send JSON with Content-Type: application/json.';
        } else {
            $kind = self::SERVER;
            $hint = 'For POST /api/order: first check the order with getPaymentByOrder(Order). A repeated Order with different data or after payment gives 500; use a new Order. Otherwise retry later and send traceId to Paynet support.';
        }
        $full = 'Paynet API error ' . $httpStatus . ($code ? ' ' . $code : '') . ': ' . $message;
        return new self($full, $kind, $httpStatus, $code !== null ? (string) $code : null, $details, $traceId !== null ? (string) $traceId : null, false, $hint, $body);
    }
}
