<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\InvoiceAdjustment;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InvoiceAdjustmentService
{
    public function applyAdjustment(Order $order, string $type, float $amount, ?string $reason, int $userId): InvoiceAdjustment
    {
        if ($order->transaction_type !== 'sale' || $order->party_type !== Customer::class) {
            throw ValidationException::withMessages([
                'order_id' => ['Adjustments are supported only for customer sale orders.'],
            ]);
        }

        return DB::transaction(function () use ($order, $type, $amount, $reason, $userId) {
            $lockedOrder = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            $adjustment = InvoiceAdjustment::create([
                'order_id' => $lockedOrder->id,
                'type' => $type,
                'amount' => $amount,
                'reason' => $reason,
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);

            $this->recalculateOrderDue($lockedOrder, $userId);

            return $adjustment;
        });
    }

    public function removeAdjustment(InvoiceAdjustment $invoiceAdjustment, int $userId): void
    {
        DB::transaction(function () use ($invoiceAdjustment, $userId) {
            $lockedOrder = Order::query()
                ->whereKey($invoiceAdjustment->order_id)
                ->lockForUpdate()
                ->firstOrFail();

            $invoiceAdjustment->delete();

            $this->recalculateOrderDue($lockedOrder, $userId);
        });
    }

    protected function recalculateOrderDue(Order $order, int $userId): void
    {
        $adjustmentTotal = (float) InvoiceAdjustment::query()
            ->where('order_id', $order->id)
            ->sum('amount');

        $netAmount = (float) ($order->net_amount ?? $order->total_amount ?? 0);
        $paidAmount = (float) ($order->paid_amount ?? 0);
        $dueAmount = max($netAmount - $paidAmount - $adjustmentTotal, 0);

        $order->update([
            'due_amount' => $dueAmount,
            'payment_status' => $this->resolvePaymentStatus($paidAmount, $dueAmount),
            'updated_by' => $userId,
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
