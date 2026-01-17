<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class TenantController extends Controller
{
    public function index()
    {
        return Tenant::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', Rule::unique('tenants', 'slug')],
            'is_active' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'file', 'image', 'max:10240'],
            'address' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'website' => ['nullable', 'string'],
            'license_no' => ['nullable', 'string'],
            'license_issue' => ['nullable', 'date'],
            'license_expiry' => ['nullable', 'date'],
            'license_type' => ['nullable', 'string'],
            'max_users' => ['nullable', 'integer'],
            'license_status' => ['nullable', 'string'],
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('tenants', 'public');
            $data['logo'] = Storage::disk('public')->url($path);
        } else {
            unset($data['logo']);
        }

        $tenant = Tenant::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($tenant, 201);
    }

    public function update(Request $request, Tenant $tenant)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'slug' => ['sometimes', 'string', Rule::unique('tenants', 'slug')->ignore($tenant->id)],
            'is_active' => ['nullable', 'boolean'],
            'logo' => ['nullable', 'file', 'image', 'max:10240'],
            'address' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'website' => ['nullable', 'string'],
            'license_no' => ['nullable', 'string'],
            'license_issue' => ['nullable', 'date'],
            'license_expiry' => ['nullable', 'date'],
            'license_type' => ['nullable', 'string'],
            'max_users' => ['nullable', 'integer'],
            'license_status' => ['nullable', 'string'],
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('tenants', 'public');
            $data['logo'] = Storage::disk('public')->url($path);
        } else {
            unset($data['logo']);
        }

        if (!array_key_exists('name', $data)) {
            $data['name'] = $tenant->name;
        }
        if (!array_key_exists('slug', $data)) {
            $data['slug'] = $tenant->slug;
        }

        $tenant->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($tenant);
    }

    public function destroy(Tenant $tenant)
    {
        $tenant->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
