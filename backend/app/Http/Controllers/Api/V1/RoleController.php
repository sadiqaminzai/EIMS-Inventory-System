<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->input('tenant_id');
        $isSuperAdmin = $request->user()?->hasRole('superadmin') ?? false;

        // Superadmin can see all roles across tenants, others see only their tenant's roles
        $query = $isSuperAdmin ? Role::withoutGlobalScope('tenant') : Role::query();
        $query->with(['permissions', 'tenant'])->orderBy('name');

        if ($tenantId) {
            $query->where('tenant_id', (int) $tenantId);
        }

        return $query
            ->get()
            ->map(function (Role $role) {
                $permNames = $role->permissions->pluck('name')->values()->all();
                $permMap = [];
                foreach ($permNames as $name) {
                    $permMap[$name] = true;
                }
                return array_merge($role->toArray(), [
                    'permissions' => $permMap,
                    'tenant_name' => $role->tenant?->name,
                ]);
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('roles', 'name')->where('tenant_id', TenantContext::getTenantId())],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
        ]);

        // Ensure the role is explicitly tied to the active tenant context
        $role = Role::create(array_merge($data, [
            'tenant_id' => TenantContext::getTenantId(),
            'guard_name' => 'web',
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));
        $role->load(['permissions', 'tenant']);

        if (!empty($data['permissions'])) {
            $permissions = collect($data['permissions'])
                ->flatMap(function ($value, $key) {
                    if (is_string($key)) {
                        return $value ? [$key] : [];
                    }
                    return [$value];
                })
                ->filter()
                ->map(fn ($name) => Permission::findOrCreate($name, 'web'));
            $role->syncPermissions($permissions);
        }

        return response()->json(array_merge($role->toArray(), [
            'tenant_name' => $role->tenant?->name,
        ]), 201);
    }

    public function update(Request $request, Role $role)
    {
        $data = $request->validate([
            'name' => ['required', 'string', Rule::unique('roles', 'name')->where('tenant_id', TenantContext::getTenantId())->ignore($role->id)],
            'description' => ['nullable', 'string'],
            'permissions' => ['nullable', 'array'],
        ]);

        // When editing as superadmin, set tenant to the active tenant context
        $role->update(array_merge($data, [
            'tenant_id' => TenantContext::getTenantId(),
            'guard_name' => $role->guard_name ?? 'web',
            'updated_by' => $request->user()->id,
        ]));
        $role->load(['permissions', 'tenant']);

        if (array_key_exists('permissions', $data)) {
            $permissions = collect($data['permissions'] ?? [])
                ->flatMap(function ($value, $key) {
                    if (is_string($key)) {
                        return $value ? [$key] : [];
                    }
                    return [$value];
                })
                ->filter()
                ->map(fn ($name) => Permission::findOrCreate($name, 'web'));
            $role->syncPermissions($permissions);
        }

        return response()->json(array_merge($role->toArray(), [
            'tenant_name' => $role->tenant?->name,
        ]));
    }

    public function destroy(Role $role)
    {
        $role->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
