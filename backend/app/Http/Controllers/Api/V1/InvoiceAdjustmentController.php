<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\InvoiceAdjustment;
use App\Models\Order;
use App\Services\InvoiceAdjustmentService;
use Illuminate\Http\Request;

class InvoiceAdjustmentController extends Controller
{
    public function index(Request $request)
    {
        $query = InvoiceAdjustment::query()
            ->with(['order'])
            ->orderByDesc('created_at');

        if ($request->filled('order_id')) {
            $query->where('order_id', (int) $request->input('order_id'));
        }

        if ($request->filled('customer_id')) {
            $customerId = (int) $request->input('customer_id');
            $query->whereHas('order', function ($orderQuery) use ($customerId) {
                $orderQuery
                    ->where('transaction_type', 'sale')
                    ->where('party_type', Customer::class)
                    ->where('party_id', $customerId);
            });
        }

        return $query->get();
    }

    public function store(Request $request, InvoiceAdjustmentService $service)
    {
        $data = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'type' => ['required', 'in:discount,waiver,write_off,correction'],
            'amount' => ['required', 'numeric', 'not_in:0'],
            'reason' => ['nullable', 'string'],
        ]);

        $order = Order::query()->findOrFail($data['order_id']);

        $adjustment = $service->applyAdjustment(
            $order,
            $data['type'],
            (float) $data['amount'],
            $data['reason'] ?? null,
            $request->user()->id
        );

        return response()->json($adjustment->load('order'), 201);
    }

    public function destroy(InvoiceAdjustment $invoiceAdjustment, Request $request, InvoiceAdjustmentService $service)
    {
        $service->removeAdjustment($invoiceAdjustment, $request->user()->id);

        return response()->json(['message' => 'Deleted']);
    }
}
