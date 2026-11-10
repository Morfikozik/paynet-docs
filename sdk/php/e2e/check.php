<?php
// Live check of the PHP SDK on the Paynet test environment (merchant 265505). Run manually only.
//   php check.php create              → creates an order, prints { order, paymentId, paymentLink, checks }
//   php check.php after-pay <order>   → after the order was paid: status, search, refund rules, statements, errors

declare(strict_types=1);

require __DIR__ . '/../autoload.php';

use Paynet\Ecom\Checkout;
use Paynet\Ecom\PaymentStatus;
use Paynet\Ecom\PaynetClient;
use Paynet\Ecom\PaynetException;
use Paynet\Ecom\Time;

const SALE_AREA = 'onlidocumentation_md';
$client = new PaynetClient(['username' => '771064', 'password' => 'sLgMnGWJ', 'environment' => 'test']);
$checks = [];
function check(string $name, callable $fn): void
{
    global $checks;
    try {
        $detail = $fn();
        $checks[] = ['name' => $name, 'ok' => true, 'detail' => (string) ($detail ?? '')];
    } catch (\Throwable $e) {
        $detail = $e instanceof PaynetException
            ? $e->kind . ' ' . ($e->httpStatus ?? '') . ' ' . ($e->errorCode ?? '') . ' ' . $e->getMessage()
            : get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine();
        $checks[] = ['name' => $name, 'ok' => false, 'detail' => $detail];
    }
}
function ensure(bool $cond, string $msg): void
{
    if (!$cond) {
        throw new \RuntimeException($msg);
    }
}
/** Runs $fn expecting a PaynetException of $kind; returns its message. */
function expectError(callable $fn, string $kind, string $pattern = ''): string
{
    try {
        $fn();
    } catch (PaynetException $e) {
        ensure($e->kind === $kind, $e->kind . ' ' . $e->getMessage());
        ensure($pattern === '' || preg_match($pattern, $e->getMessage()) === 1, $e->getMessage());
        return $e->getMessage();
    }
    throw new \RuntimeException('no error');
}

$phase = $argv[1] ?? '';

if ($phase === 'create') {
    $order = (int) floor(microtime(true) * 1000);
    $customerCode = 'sdk-php-' . $order;
    $created = null;
    $body = [
        'Order' => $order,
        'SaleAreaCode' => SALE_AREA,
        'LinkUrlSuccess' => 'https://shop.example/payment/success',
        'LinkUrlCancel' => 'https://shop.example/payment/cancel',
        'Customer' => ['Code' => $customerCode, 'NameFirst' => 'SDK', 'NameLast' => 'PHP', 'PhoneNumber' => '37360000000', 'email' => 'sdk-check@example.com'],
        'ExpiryDate' => Time::expiryInHours(24),
        'Currency' => 498,
        'Services' => [['Name' => 'sdk-check', 'Description' => 'PHP SDK check #' . $order, 'Amount' => 300,
            'Products' => [['LineNo' => 1, 'Code' => 'SKU-1', 'Name' => 'Demo', 'Description' => 'Demo', 'UnitPrice' => 300, 'Quantity' => 100, 'Amount' => 300, 'TotalAmount' => 300]]]],
        'MoneyType' => 'Card',
        'Lang' => 'en',
    ];
    check('getToken', function () use ($client) { return strlen($client->getToken()) . ' chars'; });
    check('createOrder', function () use ($client, $body, &$created) {
        $created = $client->createOrder($body);
        ensure(!empty($created['paymentId']) && !empty($created['paymentLink']), 'no paymentId / paymentLink');
        return 'paymentId ' . $created['paymentId'];
    });
    check('createOrder: the same body again returns the same payment (safe retry)', function () use ($client, $body, &$created) {
        $again = $client->createOrder($body);
        ensure($again['paymentId'] === $created['paymentId'], 'paymentId ' . $again['paymentId'] . ' vs ' . $created['paymentId']);
        return 'same paymentId ' . $again['paymentId'];
    });
    check('getPaymentByOrder before payment → status 1', function () use ($client, $order) {
        $p = $client->getPaymentByOrder($order);
        ensure($p['status'] === PaymentStatus::REGISTERED, 'status ' . $p['status']);
        return 'status 1';
    });
    check('refund of an unpaid payment is refused by the SDK', function () use ($client, &$created) {
        return expectError(function () use ($client, $created) { $client->refund((int) $created['paymentId'], SALE_AREA, 300); }, PaynetException::RULE, '/not paid/');
    });
    echo json_encode(['order' => $order, 'customerCode' => $customerCode, 'paymentId' => $created['paymentId'] ?? null, 'paymentLink' => $created['paymentLink'] ?? null, 'checks' => $checks], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
} elseif ($phase === 'after-pay') {
    $order = (int) ($argv[2] ?? 0);
    $payment = null;
    check('getPaymentByOrder after payment → status 4', function () use ($client, $order, &$payment) {
        $payment = $client->getPaymentByOrder($order);
        ensure($payment['status'] === PaymentStatus::PAID, 'status ' . $payment['status']);
        return 'status 4, paidAmount ' . ($payment['amount']['paidAmount'] ?? 'null');
    });
    $paymentId = (int) ($payment['paymentId'] ?? 0);
    check('getPayment(paymentId)', function () use ($client, $paymentId, $order) {
        $p = $client->getPayment($paymentId);
        ensure($p['order'] === $order, 'order differs');
        return 'order ' . $p['order'];
    });
    check('isPaid', function () use ($client, $order) { ensure($client->isPaid($order), 'not paid'); return 'true'; });
    check('searchPayments (last hour) finds the payment', function () use ($client, $paymentId) {
        $result = $client->searchPayments(new \DateTimeImmutable('-1 hour'), new \DateTimeImmutable('+1 minute'));
        ensure(strpos(json_encode($result), (string) $paymentId) !== false, 'payment not in search result');
        return 'found';
    });
    check('refund more than paid is refused by the SDK', function () use ($client, $paymentId) {
        return expectError(function () use ($client, $paymentId) { $client->refund($paymentId, SALE_AREA, 301); }, PaynetException::RULE, '/more than the paid/');
    });
    check('partial refund 1.00 MDL', function () use ($client, $paymentId) {
        $r = $client->refund($paymentId, SALE_AREA, 100, null, 'SDK check');
        ensure(($r['refundType'] ?? null) === 'partial', json_encode($r));
        return 'refundType ' . $r['refundType'] . ', amount ' . $r['amount'];
    });
    check('status after partial refund → 6', function () use ($client, $paymentId) {
        $p = $client->getPayment($paymentId);
        ensure($p['status'] === PaymentStatus::PARTIALLY_REFUNDED, 'status ' . $p['status']);
        return 'status 6';
    });
    check('second refund is refused by the SDK (production rule: one refund per payment)', function () use ($client, $paymentId) {
        return expectError(function () use ($client, $paymentId) { $client->refund($paymentId, SALE_AREA, 100); }, PaynetException::RULE, '/already refunded/');
    });
    check('saved card: unlinkCard', function () use ($client, &$payment) {
        $hash = $payment['cardLinkHash'] ?? ($payment['customer']['cardLinkHash'] ?? null);
        if (!$hash) {
            return 'skipped: no card saved for this payment';
        }
        $client->unlinkCard($hash, SALE_AREA, (string) $payment['customer']['code']);
        return 'unlinked';
    });
    check('getStatement (last 7 days)', function () use ($client) {
        $s = $client->getStatement(new \DateTimeImmutable('-7 days'), new \DateTimeImmutable());
        ensure(is_array($s), 'no statement');
        return implode(',', array_keys($s));
    });
    check('downloadStatement (.xlsx)', function () use ($client) {
        $file = $client->downloadStatement(Time::chisinauDate(new \DateTimeImmutable('-7 days')), Time::chisinauDate());
        ensure(strlen($file) > 100 && substr($file, 0, 2) === 'PK', 'not an xlsx file');
        return strlen($file) . ' bytes';
    });
    check('error: unknown payment → NOT_FOUND', function () use ($client) {
        return expectError(function () use ($client) { $client->getPayment(999999999); }, PaynetException::NOT_FOUND);
    });
    check('error: wrong password → AUTHENTICATION', function () use ($paymentId) {
        $bad = new PaynetClient(['username' => '771064', 'password' => 'wrong', 'environment' => 'test']);
        return expectError(function () use ($bad, $paymentId) { $bad->getPayment($paymentId); }, PaynetException::AUTHENTICATION);
    });
    check('error: invalid order → VALIDATION', function () use ($client) {
        return substr(expectError(function () use ($client) { $client->createOrder(['Order' => (int) floor(microtime(true) * 1000)]); }, PaynetException::VALIDATION), 0, 120);
    });
    check('hosted checkout form (test vector signature)', function () {
        $form = Checkout::buildForm(['Order' => 1762444800000, 'Currency' => '498', 'Merchant' => '265505', 'SaleAreaCode' => SALE_AREA, 'Amount' => '1235', 'Description' => 'Test&Co SRL', 'CustomerCode' => '5555', 'CustomerNameFirst' => 'First name', 'CustomerNameLast' => 'Last name', 'CustomerPhoneNumber' => '060000000', 'CustomerEmail' => 'test@gmail.com', 'ExpiryDate' => '2026-12-31T23:59:59', 'LinkUrlCancel' => 'https://test.oplta.md/cancel', 'LinkUrlSuccess' => 'https://test.oplta.md/ok', 'Lang' => 'ro', 'MoneyType' => 'Card'], 'F90D6485-9CCC-458B-96A3-8958AF9B4458');
        ensure($form['fields']['Signature'] === 'cxr/+yLYZp34aR0KXLkb2A==', $form['fields']['Signature']);
        return $form['fields']['Signature'];
    });
    echo json_encode(['order' => $order, 'checks' => $checks], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
} else {
    fwrite(STDERR, "usage: php check.php create | after-pay <order>\n");
    exit(2);
}
