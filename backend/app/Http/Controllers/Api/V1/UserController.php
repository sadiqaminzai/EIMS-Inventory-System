<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return User::query()->with(['role', 'tenant'])->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $isSuperAdmin = $request->user()?->hasRole('superadmin') ?? false;
        $tenantId = $request->user()?->tenant_id;

        if ($isSuperAdmin && $request->filled('tenant_id')) {
            $tenantId = (int) $request->input('tenant_id');
        }

        // Support selecting a role by name for the active tenant
        if ($request->filled('role_name') && !$request->filled('role_id')) {
            $roleByName = Role::query()->where('tenant_id', $tenantId)->where('name', $request->input('role_name'))->first();
            if ($roleByName) {
                $request->merge(['role_id' => $roleByName->id]);
            }
        }

        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->where('tenant_id', $tenantId)],
            'password' => ['required', 'string', 'min:6'],
            'role_id' => ['required_without:role_name', 'integer', Rule::exists('roles', 'id')->where('tenant_id', $tenantId)],
            'role_name' => ['required_without:role_id', 'string'],
            'tenant_id' => $isSuperAdmin ? ['nullable', 'integer', Rule::exists('tenants', 'id')] : ['nullable'],
            'is_active' => ['nullable', 'boolean'],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
        ]);

        // ...existing code...
        // Resolve role by name if role_id was not provided
        $role = null;
        if (!empty($data['role_id'])) {
            $role = Role::query()->where('tenant_id', $tenantId)->find($data['role_id']);
        }
        if (!$role && !empty($data['role_name'])) {
            $role = Role::query()->where('tenant_id', $tenantId)->where('name', $data['role_name'])->first();
        }
        if (!$role) {
            return response()->json(['message' => 'The selected role is invalid for the chosen tenant.'], 422);
        }
        $data['role_id'] = $role->id;

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('users', 'public');
            $data['avatar'] = Storage::url($path);
        } else {
            unset($data['avatar']);
        }

        if (!$isSuperAdmin && $role->name === 'superadmin') {
            abort(403, 'Cannot assign superadmin role.');
        }

        $user = User::create([
            'tenant_id' => $tenantId,
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'must_change_password' => ($data['password'] ?? '') === 'password',
            'role_id' => $data['role_id'],
            'is_active' => $data['is_active'] ?? true,
            'avatar' => $data['avatar'] ?? null,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);
        if ($role) {
            $user->syncRoles([$role]);
        }

        return response()->json($user->load('role'), 201);
    }

    public function update(Request $request, User $user)
    {
        $isSuperAdmin = $request->user()?->hasRole('superadmin') ?? false;
        $tenantId = $user->tenant_id;

        if ($isSuperAdmin && $request->filled('tenant_id')) {
            $tenantId = (int) $request->input('tenant_id');
        }

        // Support selecting a role by name for the active tenant during update
        if ($request->filled('role_name') && !$request->filled('role_id')) {
            $roleByName = Role::query()->where('tenant_id', $tenantId)->where('name', $request->input('role_name'))->first();
            if ($roleByName) {
                $request->merge(['role_id' => $roleByName->id]);
            }
        }

        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->where('tenant_id', $tenantId)->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'role_id' => ['required_without:role_name', 'integer', Rule::exists('roles', 'id')->where('tenant_id', $tenantId)],
            'role_name' => ['required_without:role_id', 'string'],
            'tenant_id' => $isSuperAdmin ? ['nullable', 'integer', Rule::exists('tenants', 'id')] : ['nullable'],
            'is_active' => ['nullable', 'boolean'],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
        ]);

        // Resolve role by name if necessary
        $role = null;
        if (!empty($data['role_id'])) {
            $role = Role::query()->where('tenant_id', $tenantId)->find($data['role_id']);
        }
        if (!$role && !empty($data['role_name'])) {
            $role = Role::query()->where('tenant_id', $tenantId)->where('name', $data['role_name'])->first();
        }
        if (!$role) {
            return response()->json(['message' => 'The selected role is invalid for the chosen tenant.'], 422);
        }
        $data['role_id'] = $role->id;

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('users', 'public');
            $data['avatar'] = Storage::url($path);
        } else {
            unset($data['avatar']);
        }

        if (!$isSuperAdmin && $role->name === 'superadmin') {
            abort(403, 'Cannot assign superadmin role.');
        }

        $user->fill([
            'tenant_id' => $tenantId,
            'name' => $data['name'],
            'email' => $data['email'],
            'role_id' => $data['role_id'],
            'is_active' => $data['is_active'] ?? $user->is_active,
            'avatar' => $data['avatar'] ?? $user->avatar,
            'updated_by' => $request->user()->id,
        ]);

        if (!empty($data['password'])) {
            $user->password = Hash::make($data['password']);
            $user->must_change_password = false;
        }

        $user->save();

        if ($role) {
            $user->syncRoles([$role]);
        }

        return response()->json($user->load('role'));
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
