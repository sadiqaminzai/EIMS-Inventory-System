<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V1\PaymentController;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PaymentAllocationService;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PaymentAllocationLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        TenantContext::setTenantId(null);
        TenantContext::setIgnoreTenantScope(false);
        parent::tearDown();
    }

    public function test_it_applies_fifo_allocations_and_updates_order_balances(): void
    {
        [$tenant, $user, $customer] = $this->seedTenantContext();

        $orderOne = $this->createSaleOrder($user, $customer, '1001', 100, 0, 100, 'pending');
        $orderTwo = $this->createSaleOrder($user, $customer, '1002', 50, 0, 50, 'pending');

        $payment = Payment::create([
            'account_id' => null,
            'serial_no' => '2001',
            'date' => now()->toDateString(),
            'total_pending_before' => 150,
            'total_received' => 120,
            'total_pending_after' => 30,
            'currency' => 'USD',
            'notes' => 'Allocation test',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        app(PaymentAllocationService::class)->applyPaymentDetails($payment, [
            [
                'customer_id' => $customer->id,
                'debit_amount' => 150,
                'credit_amount' => 120,
                'balance_amount' => 30,
            ],
        ], $user->id);

        $orderOne->refresh();
        $orderTwo->refresh();

        $this->assertDatabaseHas('payment_allocations', [
            'payment_id' => $payment->id,
            'order_id' => $orderOne->id,
            'customer_id' => $customer->id,
            'allocated_amount' => 100.00,
        ]);

        $this->assertDatabaseHas('payment_allocations', [
            'payment_id' => $payment->id,
            'order_id' => $orderTwo->id,
            'customer_id' => $customer->id,
            'allocated_amount' => 20.00,
        ]);

        $this->assertSame('paid', $orderOne->payment_status);
        $this->assertSame(100.0, (float) $orderOne->paid_amount);
        $this->assertSame(0.0, (float) $orderOne->due_amount);

        $this->assertSame('partial', $orderTwo->payment_status);
        $this->assertSame(20.0, (float) $orderTwo->paid_amount);
        $this->assertSame(30.0, (float) $orderTwo->due_amount);
    }

    public function test_it_reverses_allocations_and_restores_order_balances(): void
    {
        [$tenant, $user, $customer] = $this->seedTenantContext();

        $orderOne = $this->createSaleOrder($user, $customer, '1003', 100, 0, 100, 'pending');
        $orderTwo = $this->createSaleOrder($user, $customer, '1004', 50, 0, 50, 'pending');

        $payment = Payment::create([
            'account_id' => null,
            'serial_no' => '2002',
            'date' => now()->toDateString(),
            'total_pending_before' => 150,
            'total_received' => 120,
            'total_pending_after' => 30,
            'currency' => 'USD',
            'notes' => 'Reverse test',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $service = app(PaymentAllocationService::class);
        $service->applyPaymentDetails($payment, [
            [
                'customer_id' => $customer->id,
                'debit_amount' => 150,
                'credit_amount' => 120,
                'balance_amount' => 30,
            ],
        ], $user->id);

        $service->reversePaymentAllocations($payment, $user->id);

        $orderOne->refresh();
        $orderTwo->refresh();

        $this->assertSame(0, PaymentAllocation::query()->where('payment_id', $payment->id)->count());

        $this->assertSame('pending', $orderOne->payment_status);
        $this->assertSame(0.0, (float) $orderOne->paid_amount);
        $this->assertSame(100.0, (float) $orderOne->due_amount);

        $this->assertSame('pending', $orderTwo->payment_status);
        $this->assertSame(0.0, (float) $orderTwo->paid_amount);
        $this->assertSame(50.0, (float) $orderTwo->due_amount);
    }

    public function test_it_validates_manual_allocation_totals_against_credit_amount(): void
    {
        [$tenant, $user, $customer] = $this->seedTenantContext();

        $orderOne = $this->createSaleOrder($user, $customer, '1005', 80, 0, 80, 'pending');
        $orderTwo = $this->createSaleOrder($user, $customer, '1006', 90, 0, 90, 'pending');

        $controller = app(PaymentController::class);
        $request = Request::create('/api/v1/payments', 'POST', [
            'date' => now()->toDateString(),
            'account_id' => 1,
            'currency' => 'USD',
            'details' => [
                [
                    'customer_id' => $customer->id,
                    'debit_amount' => 170,
                    'credit_amount' => 50,
                    'balance_amount' => 120,
                    'allocations' => [
                        ['order_id' => $orderOne->id, 'amount' => 30],
                        ['order_id' => $orderTwo->id, 'amount' => 25],
                    ],
                ],
            ],
        ]);

        $request->setUserResolver(fn () => $user);

        try {
            $controller->store($request);
            $this->fail('Expected manual allocation total validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('details.0.allocations', $exception->errors());
        }
    }

    private function seedTenantContext(): array
    {
        $tenant = Tenant::create([
            'name' => 'Test Tenant',
            'slug' => 'tenant-' . uniqid(),
            'is_active' => true,
        ]);

        TenantContext::setTenantId($tenant->id);
        TenantContext::setIgnoreTenantScope(false);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Test User',
            'email' => 'user' . uniqid() . '@example.test',
            'password' => Hash::make('secret123'),
        ]);

        $customer = Customer::create([
            'serial_no' => (string) random_int(1000, 9999),
            'name' => 'Customer A',
            'email' => 'customer' . uniqid() . '@example.test',
            'phone' => '0700000000',
            'billing_address' => 'Billing Address',
            'shipping_address' => 'Shipping Address',
            'status' => 'active',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return [$tenant, $user, $customer];
    }

    private function createSaleOrder(User $user, Customer $customer, string $serialNo, float $netAmount, float $paidAmount, float $dueAmount, string $status): Order
    {
        return Order::create([
            'transaction_type' => 'sale',
            'serial_no' => $serialNo,
            'user_id' => $user->id,
            'party_type' => Customer::class,
            'party_id' => $customer->id,
            'status' => 'completed',
            'total_amount' => $netAmount,
            'total_discount' => 0,
            'total_tax' => 0,
            'net_amount' => $netAmount,
            'paid_amount' => $paidAmount,
            'due_amount' => $dueAmount,
            'payment_status' => $status,
            'notes' => null,
            'transaction_date' => now(),
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);
    }
}
