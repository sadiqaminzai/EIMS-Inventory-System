<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AccountTransactionCategory;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AccountTransactionCategoryController extends Controller
{
    public function index(Request $request)
    {
        $query = AccountTransactionCategory::query()->orderBy('name');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $type = $request->input('type');

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('account_transaction_categories', 'name')
                    ->where('tenant_id', TenantContext::getTenantId())
                    ->where('type', $type),
            ],
            'type' => ['required', Rule::in(['expense', 'other_income'])],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $category = AccountTransactionCategory::create([
            ...$data,
            'status' => $data['status'] ?? 'active',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($category, 201);
    }

    public function update(Request $request, AccountTransactionCategory $accountTransactionCategory)
    {
        $type = $request->input('type', $accountTransactionCategory->type);

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                Rule::unique('account_transaction_categories', 'name')
                    ->where('tenant_id', TenantContext::getTenantId())
                    ->where('type', $type)
                    ->ignore($accountTransactionCategory->id),
            ],
            'type' => ['required', Rule::in(['expense', 'other_income'])],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
        ]);

        $accountTransactionCategory->update([
            ...$data,
            'status' => $data['status'] ?? $accountTransactionCategory->status,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($accountTransactionCategory);
    }

    public function destroy(AccountTransactionCategory $accountTransactionCategory)
    {
        $accountTransactionCategory->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
