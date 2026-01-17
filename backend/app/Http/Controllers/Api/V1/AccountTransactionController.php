<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountTransactionController extends Controller
{
    public function index(Request $request)
    {
        $query = AccountTransaction::query()->orderByDesc('date');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'account_id' => ['required', 'integer'],
            'to_account_id' => ['nullable', 'integer'],
            'type' => ['required', 'string'],
            'category' => ['nullable', 'string'],
            'amount' => ['required', 'numeric'],
            'currency' => ['required', 'string'],
            'exchange_rate' => ['nullable', 'numeric'],
            'contact_id' => ['nullable', 'integer'],
            'payment_method' => ['nullable', 'string'],
            'reference_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'attachment' => ['nullable', 'string'],
            'date' => ['required', 'date'],
        ]);

        $transaction = DB::transaction(function () use ($data, $request) {
            $tx = AccountTransaction::create(array_merge($data, [
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]));

            $account = Account::findOrFail($data['account_id']);

            if ($data['type'] === 'Income') {
                $account->increment('balance', $data['amount']);
            } elseif ($data['type'] === 'Expense') {
                $account->decrement('balance', $data['amount']);
            } elseif ($data['type'] === 'Transfer' && !empty($data['to_account_id'])) {
                $account->decrement('balance', $data['amount']);
                Account::where('id', $data['to_account_id'])->increment('balance', $data['amount']);
            }

            return $tx;
        });

        return response()->json($transaction, 201);
    }

    public function update(Request $request, AccountTransaction $accountTransaction)
    {
        $data = $request->validate([
            'account_id' => ['required', 'integer'],
            'to_account_id' => ['nullable', 'integer'],
            'type' => ['required', 'string'],
            'category' => ['nullable', 'string'],
            'amount' => ['required', 'numeric'],
            'currency' => ['required', 'string'],
            'exchange_rate' => ['nullable', 'numeric'],
            'contact_id' => ['nullable', 'integer'],
            'payment_method' => ['nullable', 'string'],
            'reference_id' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'attachment' => ['nullable', 'string'],
            'date' => ['required', 'date'],
        ]);

        $transaction = DB::transaction(function () use ($accountTransaction, $data, $request) {
            $original = $accountTransaction->replicate();

            // Revert original balances
            $originalAccount = Account::findOrFail($original->account_id);

            if ($original->type === 'Income') {
                $originalAccount->decrement('balance', $original->amount);
            } elseif ($original->type === 'Expense') {
                $originalAccount->increment('balance', $original->amount);
            } elseif ($original->type === 'Transfer' && $original->to_account_id) {
                $originalAccount->increment('balance', $original->amount);
                Account::where('id', $original->to_account_id)->decrement('balance', $original->amount);
            }

            $accountTransaction->update(array_merge($data, [
                'updated_by' => $request->user()->id,
            ]));

            $newAccount = Account::findOrFail($data['account_id']);

            if ($data['type'] === 'Income') {
                $newAccount->increment('balance', $data['amount']);
            } elseif ($data['type'] === 'Expense') {
                $newAccount->decrement('balance', $data['amount']);
            } elseif ($data['type'] === 'Transfer' && !empty($data['to_account_id'])) {
                $newAccount->decrement('balance', $data['amount']);
                Account::where('id', $data['to_account_id'])->increment('balance', $data['amount']);
            }

            return $accountTransaction;
        });

        return response()->json($transaction);
    }

    public function destroy(AccountTransaction $accountTransaction)
    {
        DB::transaction(function () use ($accountTransaction) {
            $account = Account::findOrFail($accountTransaction->account_id);

            if ($accountTransaction->type === 'Income') {
                $account->decrement('balance', $accountTransaction->amount);
            } elseif ($accountTransaction->type === 'Expense') {
                $account->increment('balance', $accountTransaction->amount);
            } elseif ($accountTransaction->type === 'Transfer' && $accountTransaction->to_account_id) {
                $account->increment('balance', $accountTransaction->amount);
                Account::where('id', $accountTransaction->to_account_id)->decrement('balance', $accountTransaction->amount);
            }

            $accountTransaction->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }
}
