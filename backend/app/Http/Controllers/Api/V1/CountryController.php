<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Country;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CountryController extends Controller
{
    public function index()
    {
        return Country::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('countries', 'name')->where('tenant_id', TenantContext::getTenantId())],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $country = Country::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($country, 201);
    }

    public function update(Request $request, Country $country)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('countries', 'name')->where('tenant_id', TenantContext::getTenantId())->ignore($country->id)],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $country->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($country);
    }

    public function destroy(Country $country)
    {
        $country->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
