<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentDetail;
use App\Models\Supplier;
use App\Services\PaymentAllocationService;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index()
    {
        return Payment::query()
            ->with($this->paymentRelations())
            ->orderByDesc('date')
            ->get();
    }

    public function show(Payment $payment)
    {
        return $payment->load($this->paymentRelations());
    }

    public function showBySerial(string $serial)
    {
        $payment = Payment::query()->where('serial_no', $serial)->firstOrFail();

        return $payment->load($this->paymentRelations());
    }

    public function store(Request $request)
    {
        $data = $this->validatePaymentRequest($request);
        $paymentType = $this->resolvePaymentType($data['payment_type'] ?? null);

        $details = $data['details'];
        $this->validatePaymentDetailParties($details, $paymentType);
        $this->validateManualAllocationDetails($details, $paymentType);
        $allocationService = app(PaymentAllocationService::class);

        $payment = DB::transaction(function () use ($data, $details, $paymentType, $request, $allocationService) {
            $serial = (new ModuleSequenceService())->next('payment');
            $totalPending = collect($details)->sum('debit_amount');
            $totalReceived = collect($details)->sum('credit_amount');
            $totalPendingAfter = collect($details)->sum('balance_amount');

            $payment = Payment::create([
                'account_id' => $data['account_id'],
                'serial_no' => (string) $serial,
                'date' => $data['date'],
                'payment_type' => $paymentType,
                'salesman' => $data['salesman'] ?? null,
                'booker' => $data['booker'] ?? null,
                'total_pending_before' => $totalPending,
                'total_received' => $totalReceived,
                'total_pending_after' => $totalPendingAfter,
                'currency' => $data['currency'] ?? 'USD',
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            foreach ($details as $detail) {
                PaymentDetail::create([
                    'payment_id' => $payment->id,
                    'customer_id' => $detail['customer_id'] ?? null,
                    'supplier_id' => $detail['supplier_id'] ?? null,
                    'debit_amount' => $detail['debit_amount'] ?? 0,
                    'credit_amount' => $detail['credit_amount'] ?? 0,
                    'balance_amount' => $detail['balance_amount'] ?? 0,
                    'remarks' => $detail['remarks'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);
            }

            if ($totalReceived > 0) {
                $account = Account::findOrFail($data['account_id']);

                AccountTransaction::create([
                    'account_id' => $account->id,
                    'type' => $this->accountTransactionTypeForPayment($paymentType),
                    'category_type' => $paymentType === 'payable' ? 'expense' : null,
                    'category' => $this->accountTransactionCategoryForPayment($paymentType),
                    'amount' => $totalReceived,
                    'currency' => $data['currency'] ?? $account->currency,
                    'exchange_rate' => null,
                    'contact_id' => null,
                    'payment_method' => 'Cash',
                    'reference_id' => $payment->serial_no,
                    'description' => $data['notes'] ?? $this->defaultPaymentDescription($paymentType),
                    'date' => $data['date'],
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $this->applyAccountEffect($account, (float) $totalReceived, $paymentType);
            }

            $allocationService->applyPaymentDetails($payment, $details, $request->user()->id);

            return $payment;
        });

        return response()->json($payment->load($this->paymentRelations()), 201);
    }

    public function destroy(Payment $payment, Request $request)
    {
        $payment->load('details');
        $allocationService = app(PaymentAllocationService::class);
        $paymentType = $this->resolvePaymentType($payment->payment_type ?? null);

        DB::transaction(function () use ($payment, $paymentType, $request, $allocationService) {
            $allocationService->reversePaymentAllocations($payment, $request->user()->id);

            $txs = AccountTransaction::query()
                ->where('reference_id', $payment->serial_no)
                ->whereIn('type', ['Income', 'Expense'])
                ->get();

            if ($txs->isEmpty()) {
                $txs = AccountTransaction::query()
                    ->where('reference_id', (string) $payment->id)
                    ->whereIn('type', ['Income', 'Expense'])
                    ->get();
            }

            if ($txs->isNotEmpty()) {
                foreach ($txs as $tx) {
                    $account = Account::find($tx->account_id);
                    if ($account) {
                        if ($tx->type === 'Income') {
                            $account->decrement('balance', $tx->amount);
                        } elseif ($tx->type === 'Expense') {
                            $account->increment('balance', $tx->amount);
                        }
                    }
                    $tx->delete();
                }
            } elseif ($payment->total_received > 0) {
                $account = Account::find($payment->account_id);
                if ($account) {
                    $this->reverseAccountEffect($account, (float) $payment->total_received, $paymentType);
                }
            }

            $payment->details()->delete();
            $payment->delete();

            $this->maybeRollbackSequence($payment);
        });

        return response()->json(['message' => 'Deleted']);
    }

    protected function maybeRollbackSequence(Payment $payment): void
    {
        $serial = (int) ($payment->serial_no ?? 0);
        if ($serial <= 0) {
            return;
        }

        $tenantId = TenantContext::getTenantId();
        if (! $tenantId) {
            return;
        }

        $hasHigher = Payment::query()
            ->where('tenant_id', $tenantId)
            ->where('serial_no', '>', $serial)
            ->exists();

        if ($hasHigher) {
            return;
        }

        $sequence = DB::table('module_sequences')
            ->where('tenant_id', $tenantId)
            ->where('module', 'payment')
            ->lockForUpdate()
            ->first();

        if ($sequence && (int) $sequence->last_number === $serial) {
            DB::table('module_sequences')
                ->where('tenant_id', $tenantId)
                ->where('module', 'payment')
                ->update([
                    'last_number' => max($serial - 1, 0),
                    'updated_at' => now(),
                ]);
        }
    }

    public function update(Payment $payment, Request $request)
    {
        $data = $this->validatePaymentRequest($request);
        $paymentType = $this->resolvePaymentType($data['payment_type'] ?? $payment->payment_type ?? null);

        $details = $data['details'];
        $this->validatePaymentDetailParties($details, $paymentType);
        $this->validateManualAllocationDetails($details, $paymentType);
        $allocationService = app(PaymentAllocationService::class);

        $payment = DB::transaction(function () use ($payment, $data, $details, $paymentType, $request, $allocationService) {
            $payment->load('details');

            $oldReceived = $payment->details->sum('credit_amount');
            $oldPaymentType = $this->resolvePaymentType($payment->payment_type ?? null);

            $allocationService->reversePaymentAllocations($payment, $request->user()->id);

            $txs = AccountTransaction::query()
                ->where('reference_id', $payment->serial_no)
                ->whereIn('type', ['Income', 'Expense'])
                ->get();

            if ($txs->isEmpty()) {
                $txs = AccountTransaction::query()
                    ->where('reference_id', (string) $payment->id)
                    ->whereIn('type', ['Income', 'Expense'])
                    ->get();
            }

            if ($txs->isNotEmpty()) {
                foreach ($txs as $tx) {
                    $txAccount = Account::find($tx->account_id);
                    if ($txAccount) {
                        if ($tx->type === 'Income') {
                            $txAccount->decrement('balance', $tx->amount);
                        } elseif ($tx->type === 'Expense') {
                            $txAccount->increment('balance', $tx->amount);
                        }
                    }
                    $tx->delete();
                }
            } elseif ($oldReceived > 0) {
                $oldAccount = Account::find($payment->account_id);
                if ($oldAccount) {
                    $this->reverseAccountEffect($oldAccount, (float) $oldReceived, $oldPaymentType);
                }
            }

            $totalPending = collect($details)->sum('debit_amount');
            $totalReceived = collect($details)->sum('credit_amount');
            $totalPendingAfter = collect($details)->sum('balance_amount');
            $newAccountId = (int) $data['account_id'];

            $payment->update([
                'account_id' => $newAccountId,
                'date' => $data['date'],
                'payment_type' => $paymentType,
                'salesman' => $data['salesman'] ?? null,
                'booker' => $data['booker'] ?? null,
                'total_pending_before' => $totalPending,
                'total_received' => $totalReceived,
                'total_pending_after' => $totalPendingAfter,
                'currency' => $data['currency'],
                'notes' => $data['notes'] ?? null,
                'updated_by' => $request->user()->id,
            ]);

            $payment->details()->delete();
            foreach ($details as $detail) {
                PaymentDetail::create([
                    'payment_id' => $payment->id,
                    'customer_id' => $detail['customer_id'] ?? null,
                    'supplier_id' => $detail['supplier_id'] ?? null,
                    'debit_amount' => $detail['debit_amount'] ?? 0,
                    'credit_amount' => $detail['credit_amount'] ?? 0,
                    'balance_amount' => $detail['balance_amount'] ?? 0,
                    'remarks' => $detail['remarks'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);
            }

            if ($totalReceived > 0) {
                $account = Account::findOrFail($newAccountId);

                AccountTransaction::create([
                    'account_id' => $newAccountId,
                    'type' => $this->accountTransactionTypeForPayment($paymentType),
                    'category_type' => $paymentType === 'payable' ? 'expense' : null,
                    'category' => $this->accountTransactionCategoryForPayment($paymentType),
                    'amount' => $totalReceived,
                    'currency' => $data['currency'],
                    'exchange_rate' => null,
                    'contact_id' => null,
                    'payment_method' => 'Cash',
                    'reference_id' => $payment->serial_no,
                    'description' => $data['notes'] ?? $this->defaultPaymentDescription($paymentType),
                    'date' => $data['date'],
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $this->applyAccountEffect($account, (float) $totalReceived, $paymentType);
            }

            $allocationService->applyPaymentDetails($payment, $details, $request->user()->id);

            return $payment;
        });

        return response()->json($payment->load($this->paymentRelations()));
    }

    protected function validateManualAllocationDetails(array $details, string $paymentType): void
    {
        [$transactionType, $partyType, $partyField] = $this->allocationContext($paymentType);

        foreach ($details as $detailIndex => $detail) {
            $allocations = $detail['allocations'] ?? [];
            if (! is_array($allocations) || count($allocations) === 0) {
                continue;
            }

            $creditAmount = (float) ($detail['credit_amount'] ?? 0);
            $partyId = (int) ($detail[$partyField] ?? 0);
            if ($partyId <= 0) {
                throw ValidationException::withMessages([
                    "details.{$detailIndex}.{$partyField}" => ['Select a valid party before using manual allocation.'],
                ]);
            }

            $allocationTotal = 0.0;
            $seenOrderIds = [];

            foreach ($allocations as $allocationIndex => $allocation) {
                $orderId = (int) ($allocation['order_id'] ?? $allocation['sale_invoice_id'] ?? 0);
                if ($orderId <= 0) {
                    throw ValidationException::withMessages([
                        "details.{$detailIndex}.allocations.{$allocationIndex}.order_id" => ['Each manual allocation must include a valid order_id.'],
                    ]);
                }

                if (in_array($orderId, $seenOrderIds, true)) {
                    throw ValidationException::withMessages([
                        "details.{$detailIndex}.allocations" => ['Duplicate order_id in manual allocations is not allowed for the same payment detail line.'],
                    ]);
                }

                $validOrder = Order::query()
                    ->whereKey($orderId)
                    ->where('transaction_type', $transactionType)
                    ->where('party_type', $partyType)
                    ->where('party_id', $partyId)
                    ->exists();

                if (! $validOrder) {
                    throw ValidationException::withMessages([
                        "details.{$detailIndex}.allocations.{$allocationIndex}.order_id" => ['Manual allocation order_id must reference an existing invoice for the selected party.'],
                    ]);
                }

                $amount = (float) ($allocation['amount'] ?? 0);
                if ($amount <= 0) {
                    throw ValidationException::withMessages([
                        "details.{$detailIndex}.allocations.{$allocationIndex}.amount" => ['Manual allocation amount must be greater than zero.'],
                    ]);
                }

                $allocationTotal += $amount;
                $seenOrderIds[] = $orderId;
            }

            if ($allocationTotal > ($creditAmount + 0.0001)) {
                throw ValidationException::withMessages([
                    "details.{$detailIndex}.allocations" => ['Total manual allocations cannot exceed credit_amount for this detail line.'],
                ]);
            }
        }
    }

    protected function validatePaymentRequest(Request $request): array
    {
        return $request->validate([
            'date' => ['required', 'date'],
            'account_id' => ['required', 'integer'],
            'payment_type' => ['nullable', Rule::in(['receivable', 'payable'])],
            'currency' => ['required', 'string'],
            'salesman' => ['nullable', 'string'],
            'booker' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'details' => ['required', 'array', 'min:1'],
            'details.*.customer_id' => ['nullable', 'integer'],
            'details.*.supplier_id' => ['nullable', 'integer'],
            'details.*.debit_amount' => ['required', 'numeric', 'min:0'],
            'details.*.credit_amount' => ['required', 'numeric', 'min:0'],
            'details.*.balance_amount' => ['required', 'numeric', 'min:0'],
            'details.*.remarks' => ['nullable', 'string'],
            'details.*.allocations' => ['nullable', 'array'],
            'details.*.allocations.*.order_id' => ['nullable', 'integer'],
            'details.*.allocations.*.sale_invoice_id' => ['nullable', 'integer'],
            'details.*.allocations.*.amount' => ['nullable', 'numeric', 'gt:0'],
        ]);
    }

    protected function validatePaymentDetailParties(array $details, string $paymentType): void
    {
        foreach ($details as $index => $detail) {
            $customerId = (int) ($detail['customer_id'] ?? 0);
            $supplierId = (int) ($detail['supplier_id'] ?? 0);

            if ($paymentType === 'payable') {
                if ($supplierId <= 0) {
                    throw ValidationException::withMessages([
                        "details.{$index}.supplier_id" => ['Supplier is required for payable entries.'],
                    ]);
                }

                if ($customerId > 0) {
                    throw ValidationException::withMessages([
                        "details.{$index}.customer_id" => ['Customer cannot be set for payable entries.'],
                    ]);
                }
            } else {
                if ($customerId <= 0) {
                    throw ValidationException::withMessages([
                        "details.{$index}.customer_id" => ['Customer is required for receivable entries.'],
                    ]);
                }

                if ($supplierId > 0) {
                    throw ValidationException::withMessages([
                        "details.{$index}.supplier_id" => ['Supplier cannot be set for receivable entries.'],
                    ]);
                }
            }
        }
    }

    protected function paymentRelations(): array
    {
        return [
            'details.customer',
            'details.supplier',
            'allocations.order',
            'allocations.customer',
            'allocations.supplier',
        ];
    }

    protected function resolvePaymentType(?string $value): string
    {
        return strtolower((string) $value) === 'payable' ? 'payable' : 'receivable';
    }

    protected function accountTransactionTypeForPayment(string $paymentType): string
    {
        return $paymentType === 'payable' ? 'Expense' : 'Income';
    }

    protected function accountTransactionCategoryForPayment(string $paymentType): string
    {
        return $paymentType === 'payable' ? 'Supplier Payments' : 'Customer Receipts';
    }

    protected function defaultPaymentDescription(string $paymentType): string
    {
        return $paymentType === 'payable'
            ? 'Supplier payment disbursement'
            : 'Customer payment collection';
    }

    protected function applyAccountEffect(Account $account, float $amount, string $paymentType): void
    {
        if ($amount <= 0) {
            return;
        }

        if ($paymentType === 'payable') {
            $account->decrement('balance', $amount);

            return;
        }

        $account->increment('balance', $amount);
    }

    protected function reverseAccountEffect(Account $account, float $amount, string $paymentType): void
    {
        if ($amount <= 0) {
            return;
        }

        if ($paymentType === 'payable') {
            $account->increment('balance', $amount);

            return;
        }

        $account->decrement('balance', $amount);
    }

    protected function allocationContext(string $paymentType): array
    {
        if ($paymentType === 'payable') {
            return ['purchase', Supplier::class, 'supplier_id'];
        }

        return ['sale', Customer::class, 'customer_id'];
    }
}
