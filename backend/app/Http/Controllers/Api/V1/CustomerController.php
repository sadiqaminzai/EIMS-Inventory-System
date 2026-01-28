<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index()
    {
        return Customer::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())],
            'phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $serial = app(ModuleSequenceService::class)->next('customer');

        $customer = Customer::create(array_merge($data, [
            'serial_no' => (string) $serial,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($customer, 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['nullable', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())->ignore($customer->id)],
            'phone' => ['nullable', 'string'],
            'billing_address' => ['nullable', 'string'],
            'shipping_address' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $customer->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($customer);
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();
        app(ModuleSequenceService::class)->decrement('customer');

        return response()->json(['message' => 'Deleted']);
    }
}
