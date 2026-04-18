<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\InvoiceAdjustment;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\Supplier;
use Illuminate\Validation\ValidationException;

class PaymentAllocationService
{
    public function applyPaymentDetails(Payment $payment, array $details, int $userId): void
    {
        $paymentType = $this->resolvePaymentType($payment->payment_type ?? null);

        foreach ($details as $detail) {
            $amount = (float) ($detail['credit_amount'] ?? 0);
            if ($amount <= 0) {
                continue;
            }

            $partyId = $this->resolveDetailPartyId($detail, $paymentType);
            if ($partyId <= 0) {
                continue;
            }

            $manualAllocations = $detail['allocations'] ?? [];
            if (is_array($manualAllocations) && count($manualAllocations) > 0) {
                $this->applyManualAllocations($payment, $paymentType, $partyId, $amount, $manualAllocations, $userId);
                continue;
            }

            $this->applyFifoAllocations($payment, $paymentType, $partyId, $amount, $userId);
        }
    }

    public function reversePaymentAllocations(Payment $payment, int $userId): void
    {
        $allocations = PaymentAllocation::query()
            ->where('payment_id', $payment->id)
            ->orderByDesc('id')
            ->get();

        if ($allocations->isEmpty()) {
            $payment->loadMissing('details');
            $this->reverseLegacyPaymentDetails($payment, $userId);

            return;
        }

        foreach ($allocations as $allocation) {
            $order = Order::query()
                ->whereKey($allocation->order_id)
                ->lockForUpdate()
                ->first();

            if (! $order) {
                $allocation->delete();
                continue;
            }

            $newPaid = max((float) $order->paid_amount - (float) $allocation->allocated_amount, 0);
            $adjustments = $this->getAdjustmentTotalForOrder($order);
            $netAmount = (float) ($order->net_amount ?? $order->total_amount ?? 0);
            $newDue = max($netAmount - $newPaid - $adjustments, 0);

            $order->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'payment_status' => $this->resolvePaymentStatus($newPaid, $newDue),
                'updated_by' => $userId,
            ]);

            $allocation->delete();
        }
    }

    protected function reverseLegacyPaymentDetails(Payment $payment, int $userId): void
    {
        $paymentType = $this->resolvePaymentType($payment->payment_type ?? null);

        foreach ($payment->details as $detail) {
            $amount = (float) ($detail->credit_amount ?? 0);
            if ($amount <= 0) {
                continue;
            }

            $partyId = $this->resolveDetailPartyId($detail->toArray(), $paymentType);
            if ($partyId <= 0) {
                continue;
            }

            $this->reverseLegacyPartyAmount($paymentType, $partyId, $amount, $userId);
        }
    }

    protected function reverseLegacyPartyAmount(string $paymentType, int $partyId, float $amount, int $userId): void
    {
        $remaining = $amount;
        [$transactionType, $partyType] = $this->resolvePaymentContext($paymentType);

        $orders = Order::query()
            ->where('transaction_type', $transactionType)
            ->where('party_type', $partyType)
            ->where('party_id', $partyId)
            ->where('paid_amount', '>', 0)
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->get();

        foreach ($orders as $order) {
            if ($remaining <= 0) {
                break;
            }

            $apply = min($remaining, (float) $order->paid_amount);
            $newPaid = max((float) $order->paid_amount - $apply, 0);
            $adjustments = $this->getAdjustmentTotalForOrder($order);
            $netAmount = (float) ($order->net_amount ?? $order->total_amount ?? 0);
            $newDue = max($netAmount - $newPaid - $adjustments, 0);

            $order->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'payment_status' => $this->resolvePaymentStatus($newPaid, $newDue),
                'updated_by' => $userId,
            ]);

            $remaining -= $apply;
        }
    }

    protected function applyManualAllocations(Payment $payment, string $paymentType, int $partyId, float $amount, array $allocations, int $userId): void
    {
        $remaining = $amount;
        [$transactionType, $partyType] = $this->resolvePaymentContext($paymentType);

        foreach ($allocations as $allocationData) {
            $requested = (float) ($allocationData['amount'] ?? 0);
            if ($requested <= 0) {
                continue;
            }

            $orderId = (int) ($allocationData['order_id'] ?? $allocationData['sale_invoice_id'] ?? 0);
            if ($orderId <= 0) {
                throw ValidationException::withMessages([
                    'details' => ['Manual allocation requires a valid order_id.'],
                ]);
            }

            if ($requested > ($remaining + 0.0001)) {
                throw ValidationException::withMessages([
                    'details' => ['Manual allocation amount exceeds available party payment amount.'],
                ]);
            }

            $order = Order::query()
                ->whereKey($orderId)
                ->where('transaction_type', $transactionType)
                ->where('party_type', $partyType)
                ->where('party_id', $partyId)
                ->lockForUpdate()
                ->first();

            if (! $order) {
                throw ValidationException::withMessages([
                    'details' => ['Manual allocation target order is invalid for the selected party.'],
                ]);
            }

            $currentDue = (float) $order->due_amount;
            if ($requested > ($currentDue + 0.0001)) {
                throw ValidationException::withMessages([
                    'details' => ["Allocation exceeds due amount for order {$order->serial_no}."],
                ]);
            }

            $this->applyAmountToOrder($payment, $paymentType, $order, $partyId, $requested, $userId);
            $remaining -= $requested;
        }
    }

    protected function applyFifoAllocations(Payment $payment, string $paymentType, int $partyId, float $amount, int $userId): void
    {
        $remaining = $amount;
        [$transactionType, $partyType] = $this->resolvePaymentContext($paymentType);

        $orders = Order::query()
            ->where('transaction_type', $transactionType)
            ->where('party_type', $partyType)
            ->where('party_id', $partyId)
            ->where('due_amount', '>', 0)
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($orders as $order) {
            if ($remaining <= 0) {
                break;
            }

            $apply = min($remaining, (float) $order->due_amount);
            if ($apply <= 0) {
                continue;
            }

            $this->applyAmountToOrder($payment, $paymentType, $order, $partyId, $apply, $userId);
            $remaining -= $apply;
        }
    }

    protected function applyAmountToOrder(Payment $payment, string $paymentType, Order $order, int $partyId, float $amount, int $userId): void
    {
        $newPaid = (float) $order->paid_amount + $amount;
        $adjustments = $this->getAdjustmentTotalForOrder($order);
        $netAmount = (float) ($order->net_amount ?? $order->total_amount ?? 0);
        $newDue = max($netAmount - $newPaid - $adjustments, 0);

        $order->update([
            'paid_amount' => $newPaid,
            'due_amount' => $newDue,
            'payment_status' => $this->resolvePaymentStatus($newPaid, $newDue),
            'updated_by' => $userId,
        ]);

        $allocation = PaymentAllocation::query()
            ->where('payment_id', $payment->id)
            ->where('order_id', $order->id)
            ->lockForUpdate()
            ->first();

        if ($allocation) {
            $allocation->update([
                'allocated_amount' => (float) $allocation->allocated_amount + $amount,
                'updated_by' => $userId,
            ]);

            return;
        }

        $customerId = $paymentType === 'receivable' ? $partyId : null;
        $supplierId = $paymentType === 'payable' ? $partyId : null;

        PaymentAllocation::create([
            'payment_id' => $payment->id,
            'order_id' => $order->id,
            'customer_id' => $customerId,
            'supplier_id' => $supplierId,
            'allocated_amount' => $amount,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);
    }

    protected function getAdjustmentTotalForOrder(Order $order): float
    {
        if ($order->transaction_type !== 'sale') {
            return 0.0;
        }

        return (float) InvoiceAdjustment::query()
            ->where('order_id', $order->id)
            ->sum('amount');
    }

    protected function resolvePaymentType(?string $paymentType): string
    {
        return strtolower((string) $paymentType) === 'payable' ? 'payable' : 'receivable';
    }

    protected function resolvePaymentContext(string $paymentType): array
    {
        if ($paymentType === 'payable') {
            return ['purchase', Supplier::class];
        }

        return ['sale', Customer::class];
    }

    protected function resolveDetailPartyId(array $detail, string $paymentType): int
    {
        if ($paymentType === 'payable') {
            return (int) ($detail['supplier_id'] ?? 0);
        }

        return (int) ($detail['customer_id'] ?? 0);
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
