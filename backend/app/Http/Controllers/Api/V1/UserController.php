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
        return User::query()->with('role')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->where('tenant_id', TenantContext::getTenantId())],
            'password' => ['required', 'string', 'min:6'],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('tenant_id', TenantContext::getTenantId())],
            'is_active' => ['nullable', 'boolean'],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
        ]);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('users', 'public');
            $data['avatar'] = Storage::disk('public')->url($path);
        } else {
            unset($data['avatar']);
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => $data['role_id'],
            'is_active' => $data['is_active'] ?? true,
            'avatar' => $data['avatar'] ?? null,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json($user->load('role'), 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->where('tenant_id', TenantContext::getTenantId())->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:6'],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')->where('tenant_id', TenantContext::getTenantId())],
            'is_active' => ['nullable', 'boolean'],
            'avatar' => ['nullable', 'file', 'image', 'max:2048'],
        ]);

        if ($request->hasFile('avatar')) {
            $path = $request->file('avatar')->store('users', 'public');
            $data['avatar'] = Storage::disk('public')->url($path);
        } else {
            unset($data['avatar']);
        }

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
            'role_id' => $data['role_id'],
            'is_active' => $data['is_active'] ?? $user->is_active,
            'avatar' => $data['avatar'] ?? $user->avatar,
            'updated_by' => $request->user()->id,
        ]);

        if (!empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();

        return response()->json($user->load('role'));
    }

    public function destroy(User $user)
    {
        $user->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
