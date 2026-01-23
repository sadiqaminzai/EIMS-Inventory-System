<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Support\ModuleSequenceService;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function index()
    {
        return Account::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'type' => ['required', 'string'],
            'currency' => ['required', 'string'],
            'account_number' => ['nullable', 'string'],
            'balance' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
        ]);

        $serial = app(ModuleSequenceService::class)->next('account');

        $account = Account::create(array_merge($data, [
            'serial_no' => (string) $serial,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($account, 201);
    }

    public function update(Request $request, Account $account)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'type' => ['required', 'string'],
            'currency' => ['required', 'string'],
            'account_number' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $account->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($account);
    }

    public function destroy(Account $account)
    {
        $account->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
