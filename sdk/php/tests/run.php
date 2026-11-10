<?php
// Offline tests: signatures (test vectors from the documentation), errors, token refresh, refund rules, time.
// Run: php tests/run.php

declare(strict_types=1);

require __DIR__ . '/../autoload.php';

use Paynet\Ecom\Checkout;
use Paynet\Ecom\Notification;
use Paynet\Ecom\PaymentStatus;
use Paynet\Ecom\PaynetClient;
use Paynet\Ecom\PaynetException;
use Paynet\Ecom\Signature;
use Paynet\Ecom\Time;

$passed = 0;
$failed = [];
function check(string $name, callable $fn): void
{
    global $passed, $failed;
    try {
        $fn();
        $passed++;
        echo "ok - $name\n";
    } catch (\Throwable $e) {
        $failed[] = $name;
        echo "not ok - $name: " . get_class($e) . ': ' . $e->getMessage() . "\n";
    }
}
function eq($actual, $expected, string $what = ''): void
{
    if ($actual !== $expected) {
        throw new \RuntimeException(($what ? "$what: " : '') . 'expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}
function throwsKind(callable $fn, string $kind, string $pattern = ''): PaynetException
{
    try {
        $fn();
    } catch (PaynetException $e) {
        eq($e->kind, $kind, 'kind (' . $e->getMessage() . ')');
        if ($pattern !== '' && !preg_match($pattern, $e->getMessage())) {
            throw new \RuntimeException('message "' . $e->getMessage() . '" does not match ' . $pattern);
        }
        return $e;
    }
    throw new \RuntimeException("expected PaynetException $kind");
}

const CHECKOUT_KEY = 'F90D6485-9CCC-458B-96A3-8958AF9B4458';
const NOTIFY_KEY = 'D9873689-E5F8-4272-A67F-0D8BA3F9BAA7';
$FORM = [
    'Order' => 1762444800000, 'Currency' => '498', 'Merchant' => '265505', 'SaleAreaCode' => 'onlidocumentation_md', 'Amount' => '1235',
    'Description' => 'Test&Co SRL', 'CustomerCode' => '5555', 'CustomerNameFirst' => 'First name', 'CustomerNameLast' => 'Last name',
    'CustomerPhoneNumber' => '060000000', 'CustomerEmail' => 'test@gmail.com', 'ExpiryDate' => '2026-12-31T23:59:59',
    'LinkUrlCancel' => 'https://test.oplta.md/cancel', 'LinkUrlSuccess' => 'https://test.oplta.md/ok', 'Lang' => 'ro', 'MoneyType' => 'Card',
];
$NOTIFICATION = [
    'Eventid' => 1000001, 'EventType' => 'PAID', 'EventDate' => '2026-11-09T12:00:00',
    'Payment' => ['Id' => 1234567, 'ExternalId' => 1762444800000, 'Merchant' => '265505', 'Customer' => '37369XXX111', 'StatusDate' => '2026-11-09T12:00:00', 'Amount' => 1235, 'PaidAmount' => 1235],
];

// ---- signatures: test vectors from the Signatures page ----
check('checkout RawData and Signature match the documented test vector', function () use ($FORM) {
    eq(Signature::checkoutRawData($FORM), '12354985555test%40gmail.comFirst%20nameLast%20name060000000Test%26Co%20SRL2026-12-31T23%3A59%3A59rohttps%3A%2F%2Ftest.oplta.md%2Fcancelhttps%3A%2F%2Ftest.oplta.md%2Fok265505Card1762444800000onlidocumentation_md');
    eq(Signature::checkout($FORM, CHECKOUT_KEY), 'cxr/+yLYZp34aR0KXLkb2A==');
});

check('notification PreparedString and Hash match the documented test vector', function () use ($NOTIFICATION) {
    eq(Signature::notificationPreparedString($NOTIFICATION), '2026-11-09T12:00:001000001PAID123537369XXX111176244480000012345672655052026-11-09T12:00:00');
    eq(Signature::notification($NOTIFICATION, NOTIFY_KEY), 'lq3+OCn0J/zSyNF5iAoShg==');
    eq(Signature::verifyNotification($NOTIFICATION, 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY), true);
    eq(Signature::verifyNotification($NOTIFICATION, 'lq3+OCn0J/zSyNF5iAoShg==', CHECKOUT_KEY), false, 'checkout key must not verify');
});

check('Notification::parse: valid, wrong hash, unsigned field changed, bad JSON', function () use ($NOTIFICATION) {
    $raw = json_encode($NOTIFICATION);
    eq(Notification::parse($raw, 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY)['Payment']['Id'], 1234567);
    throwsKind(function () use ($raw) { Notification::parse($raw, 'wrong', NOTIFY_KEY); }, PaynetException::VALIDATION);
    $tampered = $NOTIFICATION;
    $tampered['Payment']['PaidAmount'] = 1; // not signed: the hash still matches — that is why confirm() exists
    Notification::parse(json_encode($tampered), 'lq3+OCn0J/zSyNF5iAoShg==', NOTIFY_KEY);
    throwsKind(function () { Notification::parse('{not json', 'x', NOTIFY_KEY); }, PaynetException::VALIDATION);
});

check('Checkout::buildForm signs the form, escapes HTML, checks required fields', function () use ($FORM) {
    $form = Checkout::buildForm($FORM, CHECKOUT_KEY);
    eq($form['action'], 'https://test.paynet.md/ecom/checkout');
    eq($form['fields']['Signature'], 'cxr/+yLYZp34aR0KXLkb2A==');
    if (strpos($form['html'], 'value="Test&amp;Co SRL"') === false) {
        throw new \RuntimeException('Description not escaped');
    }
    eq(Checkout::buildForm($FORM, CHECKOUT_KEY, 'production')['action'], 'https://paynet.md/ecom/checkout');
    throwsKind(function () { Checkout::buildForm(['Order' => 1], CHECKOUT_KEY); }, PaynetException::RULE, '/Missing required/');
});

// ---- time ----
check('Chișinău time: winter UTC+2, summer UTC+3, DST switch', function () {
    $t = static function (string $utc): string { return Time::chisinauDateTime(new \DateTimeImmutable($utc)); };
    eq($t('2026-01-15T10:00:00Z'), '2026-01-15T12:00:00');
    eq($t('2026-07-01T21:30:00Z'), '2026-07-02T00:30:00');
    eq($t('2026-10-25T00:59:59Z'), '2026-10-25T03:59:59');
    eq($t('2026-10-25T01:00:00Z'), '2026-10-25T03:00:00');
    eq($t('2026-03-29T00:59:59Z'), '2026-03-29T02:59:59');
    eq($t('2026-03-29T01:00:00Z'), '2026-03-29T04:00:00');
    eq(Time::chisinauDate(new \DateTimeImmutable('2026-12-31T22:30:00Z')), '2027-01-01');
    eq(Time::expiryInHours(24, new \DateTimeImmutable('2026-11-10T10:00:00Z')), '2026-11-11T12:00:00');
});

// ---- client with a fake API ----
/** @return array{0: PaynetClient, 1: \ArrayObject} */
function fakeClient(array $handlers, ?callable $auth = null, string $password = 'p'): array
{
    $calls = new \ArrayObject();
    $transport = function (string $method, string $url, array $headers, ?string $body) use ($handlers, $auth, $calls) {
        $path = substr($url, strlen('https://ecom-api-test.paynet.md'));
        $calls->append(['method' => $method, 'path' => $path, 'headers' => $headers, 'body' => $body === null ? null : json_decode($body, true)]);
        if ($path === '/auth') {
            if ($auth) {
                return $auth();
            }
            $n = count(array_filter($calls->getArrayCopy(), static function ($c) { return $c['path'] === '/auth'; }));
            return ['status' => 200, 'body' => json_encode(['access_token' => 'token-' . $n, 'expires_in' => 14400])];
        }
        $key = $method . ' ' . explode('?', $path)[0];
        if (!isset($handlers[$key])) {
            return ['status' => 404, 'body' => ''];
        }
        return $handlers[$key]($body);
    };
    return [new PaynetClient(['username' => 'u', 'password' => $password, 'transport' => $transport]), $calls];
}
function resp(int $status, $body): array
{
    return ['status' => $status, 'body' => $body === null ? '' : json_encode($body)];
}
function authCalls(\ArrayObject $calls): int
{
    return count(array_filter($calls->getArrayCopy(), static function ($c) { return $c['path'] === '/auth'; }));
}

check('client caches the token and refreshes it once on 401', function () {
    $n = 0;
    [$client, $calls] = fakeClient(['GET /api/order/1' => function () use (&$n) {
        return ++$n === 1 ? resp(401, ['Status' => 401, 'Code' => 'UNAUTHORIZED', 'Message' => 'Unauthorized', 'TraceId' => 't1']) : resp(200, ['paymentId' => 1, 'status' => 4]);
    }]);
    eq($client->getPayment(1)['status'], 4);
    eq(authCalls($calls), 2, 'new token after 401');
    $last = $calls[count($calls) - 1];
    eq(in_array('Authorization: Bearer token-2', $last['headers'], true), true, 'new token used');
    $client->getPayment(1);
    eq(authCalls($calls), 2, 'token is cached');
});

check('errors: all response formats become PaynetException with kind, code, traceId', function () {
    [$client] = fakeClient([
        'POST /api/order' => function () { return resp(400, ['status' => 400, 'code' => 'INVALID_PARAMETER', 'message' => 'Invalid parameter', 'details' => 'Amount', 'traceId' => 'tr-1']); },
        'GET /api/order/abc' => function () { return resp(400, ['errorInfo' => ['ppResponseCodeText' => 'TECHNICAL_ERROR', 'ppResponseCodeDescription' => 'We are sorry, this service is temporarily unavailable', 'errors' => [['field' => 'id', 'message' => 'The value is not valid']]]]); },
        'GET /api/order/999' => function () { return resp(404, ['status' => 404, 'code' => 'NOT_FOUND_RECORD', 'message' => 'Not found', 'traceId' => 'tr-2']); },
        'GET /api/order/500' => function () { return resp(500, ['status' => 500, 'code' => 'TECHNICAL_ERROR', 'message' => 'Error', 'traceId' => 'tr-3']); },
    ]);
    $e = throwsKind(function () use ($client) { $client->createOrder(['Order' => 1]); }, PaynetException::VALIDATION);
    eq([$e->errorCode, $e->details, $e->traceId, $e->httpStatus], ['INVALID_PARAMETER', 'Amount', 'tr-1', 400]);
    $e = throwsKind(function () use ($client) { $client->getPayment('abc'); }, PaynetException::VALIDATION, '/not valid/');
    eq(strpos($e->getMessage(), 'temporarily unavailable'), false, 'misleading text not used');
    eq(throwsKind(function () use ($client) { $client->getPayment(999); }, PaynetException::NOT_FOUND)->errorCode, 'NOT_FOUND_RECORD');
    eq(throwsKind(function () use ($client) { $client->getPayment(500); }, PaynetException::SERVER)->traceId, 'tr-3');
    throwsKind(function () use ($client) { $client->request('GET', '/api/nope'); }, PaynetException::WRONG_ADDRESS);
});

check('wrong credentials → AUTHENTICATION error', function () {
    [$client] = fakeClient([], function () { return resp(401, ['status' => 401, 'code' => 'AUTHENTICATION_FAILED', 'message' => 'Bad credentials']); }, 'bad');
    eq(throwsKind(function () use ($client) { $client->getPayment(1); }, PaynetException::AUTHENTICATION)->errorCode, 'AUTHENTICATION_FAILED');
});

check('createOrder repeats the same body once after a network error', function () {
    $n = 0;
    [$client, $calls] = fakeClient(['POST /api/order' => function () use (&$n) {
        if (++$n === 1) {
            throw new PaynetException('timeout', PaynetException::NETWORK, null, null, null, null, true);
        }
        return resp(200, ['paymentId' => 7, 'paymentLink' => 'https://x']);
    }]);
    $body = ['Order' => 42, 'Services' => [['Name' => 'a', 'Description' => 'b', 'Amount' => 300]]];
    eq($client->createOrder($body)['paymentId'], 7);
    $sent = array_values(array_filter($calls->getArrayCopy(), static function ($c) { return $c['path'] === '/api/order'; }));
    eq(count($sent), 2);
    eq($sent[0]['body'], $sent[1]['body'], 'identical body on retry');
});

check('refund rules are checked before calling the API', function () {
    $payments = [
        1 => ['paymentId' => 1, 'status' => 4, 'amount' => ['amount' => 300, 'paidAmount' => 300], 'moneyType' => 'CARD'],
        2 => ['paymentId' => 2, 'status' => 1, 'amount' => ['amount' => 300, 'paidAmount' => null]],
        3 => ['paymentId' => 3, 'status' => 6, 'amount' => ['amount' => 300, 'paidAmount' => 300], 'paidDate' => '2026-11-10'],
        4 => ['paymentId' => 4, 'status' => 5, 'amount' => ['amount' => 300, 'paidAmount' => 300], 'paidDate' => '2026-11-10'],
        5 => ['paymentId' => 5, 'status' => 4, 'amount' => ['amount' => 300, 'paidAmount' => 300], 'moneyType' => 'CASH_INVOICE'],
    ];
    $handlers = ['POST /api/order/refund' => function ($body) { return resp(200, json_decode($body, true) + ['ok' => true]); }];
    foreach ($payments as $id => $p) {
        $handlers['GET /api/order/' . $id] = function () use ($p) { return resp(200, $p); };
    }
    [$client] = fakeClient($handlers);
    eq($client->refund(1, 's', 300)['RefundType'], 'full');
    eq($client->refund(1, 's', 100)['RefundType'], 'partial');
    throwsKind(function () use ($client) { $client->refund(1, 's', 301); }, PaynetException::RULE, '/more than the paid/');
    throwsKind(function () use ($client) { $client->refund(2, 's', 300); }, PaynetException::RULE, '/not paid/');
    throwsKind(function () use ($client) { $client->refund(3, 's', 100); }, PaynetException::RULE, '/already refunded/');
    throwsKind(function () use ($client) { $client->refund(4, 's', 100); }, PaynetException::RULE, '/already refunded/');
    throwsKind(function () use ($client) { $client->refund(5, 's', 300); }, PaynetException::RULE, '/CASH_INVOICE/');
    throwsKind(function () use ($client) { $client->refund(1, 's', 0); }, PaynetException::RULE);
});

check('Notification::confirm compares the notification with the API and your order', function () use ($NOTIFICATION) {
    [$client] = fakeClient(['GET /api/order/merchant/1762444800000' => function () {
        return resp(200, ['paymentId' => 1234567, 'status' => 4, 'amount' => ['amount' => 1235, 'paidAmount' => 1235], 'customer' => ['code' => 'c1']]);
    }]);
    $ok = Notification::confirm($client, $NOTIFICATION, ['amount' => 1235, 'customerCode' => 'c1']);
    eq($ok['ok'], true, implode(', ', $ok['problems']));
    $bad = $NOTIFICATION;
    $bad['Payment']['PaidAmount'] = 1;
    $res = Notification::confirm($client, $bad, ['amount' => 1235, 'customerCode' => 'c1']);
    eq($res['ok'], false);
});

check('statuses and constructor', function () {
    eq(PaymentStatus::PAID, 4);
    eq(PaymentStatus::isFinal(5), true);
    eq(PaymentStatus::isFinal(3), false);
    throwsKind(function () { new PaynetClient(['username' => 'u']); }, PaynetException::RULE);
    throwsKind(function () { new PaynetClient(['username' => 'u', 'password' => 'p', 'environment' => 'prod']); }, PaynetException::RULE, '/Unknown environment/');
    eq((new PaynetClient(['username' => 'u', 'password' => 'p', 'environment' => 'production']))->apiUrl, 'https://ecom-api.paynet.md');
});

echo "\n# pass $passed\n# fail " . count($failed) . "\n";
exit($failed ? 1 : 0);
