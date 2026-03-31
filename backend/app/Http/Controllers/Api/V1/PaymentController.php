<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentDetail;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function index()
    {
        return Payment::query()->with('details')->orderByDesc('date')->get();
    }

    public function show(Payment $payment)
    {
        return $payment->load('details');
    }

    public function showBySerial(string $serial)
    {
        $payment = Payment::query()->where('serial_no', $serial)->firstOrFail();

        return $payment->load('details');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'account_id' => ['required', 'integer'],
            'currency' => ['required', 'string'],
            'salesman' => ['nullable', 'string'],
            'booker' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'details' => ['required', 'array', 'min:1'],
            'details.*.customer_id' => ['required', 'integer'],
            'details.*.debit_amount' => ['nullable', 'numeric', 'min:0'],
            'details.*.credit_amount' => ['required', 'numeric', 'min:0'],
            'details.*.balance_amount' => ['nullable', 'numeric', 'min:0'],
            'details.*.remarks' => ['nullable', 'string'],
        ]);

        $details = $data['details'];

        $payment = DB::transaction(function () use ($data, $details, $request) {
            $serial = (new ModuleSequenceService())->next('payment');
            $customerIds = collect($details)->pluck('customer_id')->unique()->values()->all();
            $dueByCustomer = $this->getCustomerDueMap($customerIds);
            $normalizedDetails = $this->normalizePaymentDetails($details, $dueByCustomer);

            $totalPending = collect($normalizedDetails)->sum('debit_amount');
            $totalReceived = collect($normalizedDetails)->sum('credit_amount');
            $totalPendingAfter = collect($normalizedDetails)->sum('balance_amount');

            $payment = Payment::create([
                'account_id' => $data['account_id'],
                'serial_no' => (string) $serial,
                'date' => $data['date'],
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

            foreach ($normalizedDetails as $detail) {
                PaymentDetail::create([
                    'payment_id' => $payment->id,
                    'customer_id' => $detail['customer_id'],
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
                    'type' => 'Income',
                    'category' => 'Customer Receipts',
                    'amount' => $totalReceived,
                    'currency' => $data['currency'] ?? $account->currency,
                    'exchange_rate' => null,
                    'contact_id' => null,
                    'payment_method' => 'Cash',
                    'reference_id' => $payment->serial_no,
                    'description' => $data['notes'] ?? 'Customer payment collection',
                    'date' => $data['date'],
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $account->increment('balance', $totalReceived);
            }

            foreach ($normalizedDetails as $detail) {
                $amount = (float) ($detail['credit_amount'] ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $this->applyPaymentToOrders((int) $detail['customer_id'], $amount, $request->user()->id);
            }

            return $payment;
        });

        return response()->json($payment->load('details'), 201);
    }

    public function destroy(Payment $payment, Request $request)
    {
        $payment->load('details');

        DB::transaction(function () use ($payment, $request) {
            foreach ($payment->details as $detail) {
                $amount = (float) ($detail->credit_amount ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $this->reversePaymentFromOrders((int) $detail->customer_id, $amount, $request->user()->id);
            }

            $txs = AccountTransaction::query()
                ->where('reference_id', $payment->serial_no)
                ->where('type', 'Income')
                ->get();

            if ($txs->isEmpty()) {
                $txs = AccountTransaction::query()
                    ->where('reference_id', (string) $payment->id)
                    ->where('type', 'Income')
                    ->get();
            }

            if ($txs->isNotEmpty()) {
                foreach ($txs as $tx) {
                    $account = Account::find($tx->account_id);
                    if ($account) {
                        $account->decrement('balance', $tx->amount);
                    }
                    $tx->delete();
                }
            } elseif ($payment->total_received > 0) {
                Account::where('id', $payment->account_id)->decrement('balance', $payment->total_received);
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
        $data = $request->validate([
            'date' => ['required', 'date'],
            'account_id' => ['required', 'integer'],
            'currency' => ['required', 'string'],
            'salesman' => ['nullable', 'string'],
            'booker' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'details' => ['required', 'array', 'min:1'],
            'details.*.customer_id' => ['required', 'integer'],
            'details.*.debit_amount' => ['nullable', 'numeric', 'min:0'],
            'details.*.credit_amount' => ['required', 'numeric', 'min:0'],
            'details.*.balance_amount' => ['nullable', 'numeric', 'min:0'],
            'details.*.remarks' => ['nullable', 'string'],
        ]);

        $details = $data['details'];

        $payment = DB::transaction(function () use ($payment, $data, $details, $request) {
            $payment->load('details');

            $oldReceived = $payment->details->sum('credit_amount');
            $oldAccountId = (int) $payment->account_id;

            foreach ($payment->details as $detail) {
                $amount = (float) ($detail->credit_amount ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $this->reversePaymentFromOrders((int) $detail->customer_id, $amount, $request->user()->id);
            }

            $customerIds = collect($details)->pluck('customer_id')->unique()->values()->all();
            $dueByCustomer = $this->getCustomerDueMap($customerIds);
            $normalizedDetails = $this->normalizePaymentDetails($details, $dueByCustomer);

            $totalPending = collect($normalizedDetails)->sum('debit_amount');
            $totalReceived = collect($normalizedDetails)->sum('credit_amount');
            $totalPendingAfter = collect($normalizedDetails)->sum('balance_amount');

            $newAccountId = (int) $data['account_id'];

            if ($oldAccountId === $newAccountId) {
                $diff = (float) $totalReceived - (float) $oldReceived;
                if ($diff > 0) {
                    Account::where('id', $oldAccountId)->increment('balance', $diff);
                } elseif ($diff < 0) {
                    Account::where('id', $oldAccountId)->decrement('balance', abs($diff));
                }
            } else {
                if ($oldReceived > 0) {
                    Account::where('id', $oldAccountId)->decrement('balance', $oldReceived);
                }
                if ($totalReceived > 0) {
                    Account::where('id', $newAccountId)->increment('balance', $totalReceived);
                }
            }

            $txs = AccountTransaction::query()
                ->where('reference_id', $payment->serial_no)
                ->where('type', 'Income')
                ->get();

            if ($totalReceived > 0) {
                $tx = $txs->first();
                if ($tx) {
                    $tx->update([
                        'account_id' => $newAccountId,
                        'amount' => $totalReceived,
                        'currency' => $data['currency'],
                        'date' => $data['date'],
                        'description' => $data['notes'] ?? 'Customer payment collection',
                        'updated_by' => $request->user()->id,
                    ]);
                    $txs->skip(1)->each->delete();
                } else {
                    AccountTransaction::create([
                        'account_id' => $newAccountId,
                        'type' => 'Income',
                        'category' => 'Customer Receipts',
                        'amount' => $totalReceived,
                        'currency' => $data['currency'],
                        'exchange_rate' => null,
                        'contact_id' => null,
                        'payment_method' => 'Cash',
                        'reference_id' => $payment->serial_no,
                        'description' => $data['notes'] ?? 'Customer payment collection',
                        'date' => $data['date'],
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);
                }
            } else {
                $txs->each->delete();
            }

            $payment->update([
                'account_id' => $newAccountId,
                'date' => $data['date'],
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
            foreach ($normalizedDetails as $detail) {
                PaymentDetail::create([
                    'payment_id' => $payment->id,
                    'customer_id' => $detail['customer_id'],
                    'debit_amount' => $detail['debit_amount'] ?? 0,
                    'credit_amount' => $detail['credit_amount'] ?? 0,
                    'balance_amount' => $detail['balance_amount'] ?? 0,
                    'remarks' => $detail['remarks'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);
            }

            foreach ($normalizedDetails as $detail) {
                $amount = (float) ($detail['credit_amount'] ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $this->applyPaymentToOrders((int) $detail['customer_id'], $amount, $request->user()->id);
            }

            return $payment;
        });

        return response()->json($payment->load('details'));
    }

    protected function applyPaymentToOrders(int $customerId, float $amount, int $userId): void
    {
        $remaining = $amount;

        $orders = Order::query()
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->where('party_id', $customerId)
            ->where('due_amount', '>', 0)
            ->orderBy('transaction_date')
            ->lockForUpdate()
            ->get();

        foreach ($orders as $order) {
            if ($remaining <= 0) {
                break;
            }

            $apply = min($remaining, (float) $order->due_amount);
            $newPaid = (float) $order->paid_amount + $apply;
            $newDue = max((float) $order->due_amount - $apply, 0);

            $order->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'updated_by' => $userId,
            ]);

            $remaining -= $apply;
        }
    }

    protected function reversePaymentFromOrders(int $customerId, float $amount, int $userId): void
    {
        $remaining = $amount;

        $orders = Order::query()
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->where('party_id', $customerId)
            ->where('paid_amount', '>', 0)
            ->orderByDesc('transaction_date')
            ->lockForUpdate()
            ->get();

        foreach ($orders as $order) {
            if ($remaining <= 0) {
                break;
            }

            $apply = min($remaining, (float) $order->paid_amount);
            $newPaid = max((float) $order->paid_amount - $apply, 0);
            $newDue = (float) $order->due_amount + $apply;

            $order->update([
                'paid_amount' => $newPaid,
                'due_amount' => $newDue,
                'updated_by' => $userId,
            ]);

            $remaining -= $apply;
        }
    }

    protected function getCustomerDueMap(array $customerIds): array
    {
        if (empty($customerIds)) {
            return [];
        }

        return Order::query()
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->whereIn('party_id', $customerIds)
            ->selectRaw('party_id, SUM(due_amount) as total_due')
            ->groupBy('party_id')
            ->pluck('total_due', 'party_id')
            ->map(fn ($due) => (float) $due)
            ->all();
    }

    protected function normalizePaymentDetails(array $details, array $dueByCustomer): array
    {
        $remainingByCustomer = [];
        foreach ($dueByCustomer as $customerId => $due) {
            $remainingByCustomer[(int) $customerId] = max((float) $due, 0);
        }

        $normalized = [];
        foreach ($details as $detail) {
            $customerId = (int) ($detail['customer_id'] ?? 0);
            $debitAmount = (float) ($remainingByCustomer[$customerId] ?? 0);
            $creditAmount = min(max((float) ($detail['credit_amount'] ?? 0), 0), $debitAmount);
            $balanceAmount = max($debitAmount - $creditAmount, 0);
            $remainingByCustomer[$customerId] = $balanceAmount;

            $normalized[] = [
                'customer_id' => $customerId,
                'debit_amount' => $debitAmount,
                'credit_amount' => $creditAmount,
                'balance_amount' => $balanceAmount,
                'remarks' => $detail['remarks'] ?? null,
            ];
        }

        return $normalized;
    }
}
