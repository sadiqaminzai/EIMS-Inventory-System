<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\InvoiceAdjustment;
use App\Models\Order;
use App\Models\PaymentAllocation;
use App\Models\PaymentDetail;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index()
    {
        return Customer::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())],
            'phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $serial = app(ModuleSequenceService::class)->next('customer');

        $customer = Customer::create(array_merge($data, [
            'serial_no' => (string) $serial,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($customer, 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())->ignore($customer->id)],
            'phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $customer->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($customer);
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();
        app(ModuleSequenceService::class)->decrement('customer');

        return response()->json(['message' => 'Deleted']);
    }

    public function ledger(Customer $customer)
    {
        $orders = Order::query()
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->where('party_id', $customer->id)
            ->with(['paymentAllocations.payment:id,serial_no,date', 'invoiceAdjustments'])
            ->orderByDesc('transaction_date')
            ->get();

        $orderIds = $orders->pluck('id');

        $totalInvoiced = (float) $orders->sum('net_amount');
        $totalPaid = (float) $orders->sum('paid_amount');
        $totalDue = (float) $orders->sum('due_amount');
        $totalAdjustments = (float) InvoiceAdjustment::query()
            ->whereIn('order_id', $orderIds)
            ->sum('amount');

        $totalReceived = (float) PaymentDetail::query()
            ->where('customer_id', $customer->id)
            ->sum('credit_amount');

        $totalAllocated = (float) PaymentAllocation::query()
            ->where('customer_id', $customer->id)
            ->sum('allocated_amount');

        return response()->json([
            'customer' => $customer,
            'summary' => [
                'total_invoiced' => $totalInvoiced,
                'total_paid' => $totalPaid,
                'total_due' => $totalDue,
                'total_adjustments' => $totalAdjustments,
                'total_received' => $totalReceived,
                'total_allocated' => $totalAllocated,
                'unallocated_credit' => max($totalReceived - $totalAllocated, 0),
            ],
            'orders' => $orders->map(function (Order $order) {
                return [
                    'id' => $order->id,
                    'serial_no' => $order->serial_no,
                    'transaction_date' => optional($order->transaction_date)->toDateString(),
                    'net_amount' => (float) $order->net_amount,
                    'paid_amount' => (float) $order->paid_amount,
                    'due_amount' => (float) $order->due_amount,
                    'payment_status' => $order->payment_status ?? $this->resolvePaymentStatus((float) $order->paid_amount, (float) $order->due_amount),
                    'allocations' => $order->paymentAllocations->map(function ($allocation) {
                        return [
                            'id' => $allocation->id,
                            'payment_id' => $allocation->payment_id,
                            'payment_serial' => optional($allocation->payment)->serial_no,
                            'payment_date' => optional(optional($allocation->payment)->date)->toDateString(),
                            'allocated_amount' => (float) $allocation->allocated_amount,
                        ];
                    })->values(),
                    'adjustments' => $order->invoiceAdjustments->map(function ($adjustment) {
                        return [
                            'id' => $adjustment->id,
                            'type' => $adjustment->type,
                            'amount' => (float) $adjustment->amount,
                            'reason' => $adjustment->reason,
                            'created_at' => optional($adjustment->created_at)->toDateTimeString(),
                        ];
                    })->values(),
                    'days_open' => optional($order->transaction_date)
                        ? max(0, Carbon::parse($order->transaction_date)->startOfDay()->diffInDays(now()->startOfDay(), false))
                        : null,
                ];
            })->values(),
        ]);
    }

    public function pendingSummary()
    {
        $rows = Order::query()
            ->selectRaw('party_id as customer_id, COUNT(*) as open_orders, SUM(due_amount) as total_due')
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->where('due_amount', '>', 0)
            ->groupBy('party_id')
            ->orderByDesc('total_due')
            ->get();

        $customerMap = Customer::query()
            ->whereIn('id', $rows->pluck('customer_id'))
            ->pluck('name', 'id');

        $summary = $rows->map(function ($row) use ($customerMap) {
            return [
                'customer_id' => (int) $row->customer_id,
                'customer_name' => $customerMap[$row->customer_id] ?? 'Unknown Customer',
                'open_orders' => (int) $row->open_orders,
                'total_due' => (float) $row->total_due,
            ];
        })->values();

        return response()->json([
            'total_customers' => $summary->count(),
            'total_due' => (float) $summary->sum('total_due'),
            'customers' => $summary,
        ]);
    }

    protected function resolvePaymentStatus(float $paidAmount, float $dueAmount): string
    {
        if ($dueAmount <= 0) {
            return 'paid';
        }

        if ($paidAmount > 0) {
            return 'partial';
        }

        return 'pending';
    }
}
