<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
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
}
