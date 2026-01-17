<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
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
            'email' => ['required', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())],
            'phone' => ['required', 'string'],
            'billing_address' => ['required', 'string'],
            'shipping_address' => ['required', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $customer = Customer::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($customer, 201);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('customers', 'email')->where('tenant_id', TenantContext::getTenantId())->ignore($customer->id)],
            'phone' => ['required', 'string'],
            'billing_address' => ['required', 'string'],
            'shipping_address' => ['required', 'string'],
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

        return response()->json(['message' => 'Deleted']);
    }
}
