<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TenantProfileController extends Controller
{
    public function show(Request $request)
    {
        return Tenant::findOrFail($request->user()->tenant_id);
    }

    public function update(Request $request)
    {
        $tenant = Tenant::findOrFail($request->user()->tenant_id);

        $data = $request->validate([
            'name' => ['sometimes', 'string'],
            'phone' => ['nullable', 'string'],
            'email' => ['nullable', 'email'],
            'website' => ['nullable', 'string'],
            'address' => ['nullable', 'string'],
            'logo' => ['nullable', 'file', 'image', 'max:10240'],
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

        $tenant->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($tenant);
    }
}
