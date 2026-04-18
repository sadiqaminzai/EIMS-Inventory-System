<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentAllocation;
use App\Models\PaymentDetail;
use App\Models\Supplier;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index()
    {
        return Supplier::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('suppliers', 'email')->where('tenant_id', TenantContext::getTenantId())],
            'phone' => ['nullable', 'string'],
            'address' => ['nullable', 'string'],
            'tax_id' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $serial = app(ModuleSequenceService::class)->next('supplier');

        $supplier = Supplier::create(array_merge($data, [
            'serial_no' => (string) $serial,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($supplier, 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('suppliers', 'email')->where('tenant_id', TenantContext::getTenantId())->ignore($supplier->id)],
            'phone' => ['nullable', 'string'],
            'address' => ['nullable', 'string'],
            'tax_id' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $supplier->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($supplier);
    }

    public function destroy(Supplier $supplier)
    {
        $supplier->delete();
        app(ModuleSequenceService::class)->decrement('supplier');

        return response()->json(['message' => 'Deleted']);
    }

    public function ledger(Supplier $supplier)
    {
        $orders = Order::query()
            ->where('transaction_type', 'purchase')
            ->where('party_type', Supplier::class)
            ->where('party_id', $supplier->id)
            ->with(['paymentAllocations.payment:id,serial_no,date'])
            ->orderByDesc('transaction_date')
            ->get();

        $totalInvoiced = (float) $orders->sum('net_amount');
        $totalPaid = (float) $orders->sum('paid_amount');
        $totalDue = (float) $orders->sum('due_amount');

        $totalPaidOut = (float) PaymentDetail::query()
            ->where('supplier_id', $supplier->id)
            ->sum('credit_amount');

        $totalAllocated = (float) PaymentAllocation::query()
            ->where('supplier_id', $supplier->id)
            ->sum('allocated_amount');

        return response()->json([
            'supplier' => $supplier,
            'summary' => [
                'total_invoiced' => $totalInvoiced,
                'total_paid' => $totalPaid,
                'total_due' => $totalDue,
                'total_paid_out' => $totalPaidOut,
                'total_allocated' => $totalAllocated,
                'unallocated_payment' => max($totalPaidOut - $totalAllocated, 0),
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
            ->selectRaw('party_id as supplier_id, COUNT(*) as open_orders, SUM(due_amount) as total_due')
            ->where('transaction_type', 'purchase')
            ->where('party_type', Supplier::class)
            ->where('due_amount', '>', 0)
            ->groupBy('party_id')
            ->orderByDesc('total_due')
            ->get();

        $supplierMap = Supplier::query()
            ->whereIn('id', $rows->pluck('supplier_id'))
            ->pluck('name', 'id');

        $summary = $rows->map(function ($row) use ($supplierMap) {
            return [
                'supplier_id' => (int) $row->supplier_id,
                'supplier_name' => $supplierMap[$row->supplier_id] ?? 'Unknown Supplier',
                'open_orders' => (int) $row->open_orders,
                'total_due' => (float) $row->total_due,
            ];
        })->values();

        return response()->json([
            'total_suppliers' => $summary->count(),
            'total_due' => (float) $summary->sum('total_due'),
            'suppliers' => $summary,
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
