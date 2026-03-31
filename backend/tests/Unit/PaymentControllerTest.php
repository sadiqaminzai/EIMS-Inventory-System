<?php

namespace Tests\Unit;

use App\Http\Controllers\Api\V1\PaymentController;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class PaymentControllerTest extends TestCase
{
    public function test_normalize_payment_details_calculates_debit_and_clamps_credit(): void
    {
        $controller = new PaymentController();

        $details = [
            [
                'customer_id' => 10,
                'debit_amount' => 999, // should be ignored
                'credit_amount' => 60,
                'balance_amount' => 999, // should be ignored
                'remarks' => 'first',
            ],
            [
                'customer_id' => 10,
                'credit_amount' => 50, // should clamp to remaining 40
                'remarks' => 'second',
            ],
            [
                'customer_id' => 11,
                'credit_amount' => 5,
                'remarks' => 'third',
            ],
        ];

        $dueByCustomer = [
            10 => 100,
            11 => 0,
        ];

        $method = new ReflectionMethod(PaymentController::class, 'normalizePaymentDetails');
        $method->setAccessible(true);
        $normalized = $method->invoke($controller, $details, $dueByCustomer);

        $this->assertSame(100.0, $normalized[0]['debit_amount']);
        $this->assertSame(60.0, $normalized[0]['credit_amount']);
        $this->assertSame(40.0, $normalized[0]['balance_amount']);

        $this->assertSame(40.0, $normalized[1]['debit_amount']);
        $this->assertSame(40.0, $normalized[1]['credit_amount']);
        $this->assertSame(0.0, $normalized[1]['balance_amount']);

        $this->assertSame(0.0, $normalized[2]['debit_amount']);
        $this->assertSame(0.0, $normalized[2]['credit_amount']);
        $this->assertSame(0.0, $normalized[2]['balance_amount']);
    }
}
