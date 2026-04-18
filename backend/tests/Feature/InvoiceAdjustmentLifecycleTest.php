<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\InvoiceAdjustment;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use App\Services\InvoiceAdjustmentService;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InvoiceAdjustmentLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        TenantContext::setTenantId(null);
        TenantContext::setIgnoreTenantScope(false);
        parent::tearDown();
    }

    public function test_it_applies_and_removes_adjustments_with_due_recalculation(): void
    {
        [$tenant, $user, $customer] = $this->seedTenantContext();

        $order = Order::create([
            'transaction_type' => 'sale',
            'serial_no' => '3001',
            'user_id' => $user->id,
            'party_type' => Customer::class,
            'party_id' => $customer->id,
            'status' => 'completed',
            'total_amount' => 200,
            'total_discount' => 0,
            'total_tax' => 0,
            'net_amount' => 200,
            'paid_amount' => 50,
            'due_amount' => 150,
            'payment_status' => 'partial',
            'notes' => null,
            'transaction_date' => now(),
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $service = app(InvoiceAdjustmentService::class);

        $discount = $service->applyAdjustment($order, 'discount', 20, 'Seasonal discount', $user->id);
        $order->refresh();

        $this->assertSame('partial', $order->payment_status);
        $this->assertSame(130.0, (float) $order->due_amount);
        $this->assertDatabaseHas('invoice_adjustments', [
            'id' => $discount->id,
            'order_id' => $order->id,
            'type' => 'discount',
            'amount' => 20.00,
        ]);

        $writeOff = $service->applyAdjustment($order, 'write_off', 130, 'Close receivable', $user->id);
        $order->refresh();

        $this->assertSame('paid', $order->payment_status);
        $this->assertSame(0.0, (float) $order->due_amount);

        $service->removeAdjustment($writeOff, $user->id);
        $order->refresh();

        $this->assertSame('partial', $order->payment_status);
        $this->assertSame(130.0, (float) $order->due_amount);
        $this->assertSame(1, InvoiceAdjustment::query()->where('order_id', $order->id)->count());
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
            'name' => 'Customer B',
            'email' => 'customer' . uniqid() . '@example.test',
            'phone' => '0700000001',
            'billing_address' => 'Billing Address',
            'shipping_address' => 'Shipping Address',
            'status' => 'active',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return [$tenant, $user, $customer];
    }
}
