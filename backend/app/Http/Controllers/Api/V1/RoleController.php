<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index()
    {
        return Role::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('roles', 'name')->where('tenant_id', TenantContext::getTenantId())],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
        ]);

        $role = Role::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($role, 201);
    }

    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('roles', 'name')->where('tenant_id', TenantContext::getTenantId())->ignore($role->id)],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
        ]);

        $role->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($role);
    }

    public function destroy(Role $role)
    {
        $role->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
