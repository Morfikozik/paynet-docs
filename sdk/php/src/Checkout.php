<?php

declare(strict_types=1);

namespace Paynet\Ecom;

/**
 * Hosted checkout (client-server): a signed HTML form the customer's browser posts to Paynet.
 * Compute the signature on YOUR SERVER — the secret key must never reach the browser.
 */
final class Checkout
{
    private const REQUIRED = ['Order', 'Currency', 'Merchant', 'SaleAreaCode', 'Amount', 'Description', 'ExpiryDate', 'LinkUrlSuccess', 'LinkUrlCancel', 'Lang', 'MoneyType'];

    /**
     * Builds the checkout form. Currency defaults to 498, ExpiryDate to now + 24 h (Chișinău time).
     *
     * @param array  $fields      form fields (see the Hosted checkout guide)
     * @param string $secretKey   hosted checkout secret key (not the notification key)
     * @param string $environment 'test' | 'production'
     * @return array{action:string, fields:array, html:string}
     */
    public static function buildForm(array $fields, string $secretKey, string $environment = 'test', bool $autoSubmit = false): array
    {
        if ($secretKey === '') {
            throw PaynetException::rule('secretKey (hosted checkout key) is required');
        }
        if (!isset(PaynetClient::ENVIRONMENTS[$environment])) {
            throw PaynetException::rule('Unknown environment "' . $environment . '"');
        }
        $all = array_merge(['Currency' => 498, 'ExpiryDate' => Time::expiryInHours(24)], $fields);
        $missing = [];
        foreach (self::REQUIRED as $name) {
            if (!isset($all[$name]) || $all[$name] === '') {
                $missing[] = $name;
            }
        }
        if ($missing) {
            throw PaynetException::rule('Missing required checkout fields: ' . implode(', ', $missing));
        }
        $all['Signature'] = Signature::checkout($all, $secretKey);
        $action = PaynetClient::ENVIRONMENTS[$environment]['checkoutUrl'];
        $e = static function ($v): string {
            return htmlspecialchars((string) $v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        };
        $inputs = [];
        foreach ($all as $name => $value) {
            if ($value !== null) {
                $inputs[] = '  <input type="hidden" name="' . $e($name) . '" value="' . $e($value) . '">';
            }
        }
        $html = '<form id="paynet-checkout" method="POST" action="' . $e($action) . '">' . "\n" . implode("\n", $inputs)
            . "\n" . '  <button type="submit">Pay</button>' . "\n" . '</form>'
            . ($autoSubmit ? "\n" . '<script>document.getElementById("paynet-checkout").submit();</script>' : '');
        return ['action' => $action, 'fields' => $all, 'html' => $html];
    }
}
