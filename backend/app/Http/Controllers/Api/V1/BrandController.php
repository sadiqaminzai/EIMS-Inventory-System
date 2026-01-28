<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Support\ModuleSequenceService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BrandController extends Controller
{
    public function index()
    {
        return Brand::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('brands', 'name')->where('tenant_id', TenantContext::getTenantId())],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $serial = app(ModuleSequenceService::class)->next('brand');

        $brand = Brand::create(array_merge($data, [
            'serial_no' => (string) $serial,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($brand, 201);
    }

    public function update(Request $request, Brand $brand)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('brands', 'name')->where('tenant_id', TenantContext::getTenantId())->ignore($brand->id)],
            'details' => ['nullable', 'string'],
            'status' => ['nullable', 'string'],
        ]);

        $brand->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($brand);
    }

    public function destroy(Brand $brand)
    {
        $brand->delete();
        app(ModuleSequenceService::class)->decrement('brand');

        return response()->json(['message' => 'Deleted']);
    }
}
