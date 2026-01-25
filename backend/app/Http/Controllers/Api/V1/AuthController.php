<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'tenant_id' => ['nullable', 'integer'],
        ]);

        $tenantId = $data['tenant_id'] ?? Tenant::query()->value('id');
        if (!$tenantId) {
            return response()->json(['message' => 'No tenant configured'], 422);
        }

        $user = User::query()
            ->where('tenant_id', $tenantId)
            ->where('email', $data['email'])
            ->where('is_active', true)
            ->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => $this->transformUser($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    public function profile(Request $request)
    {
        return response()->json($this->transformUser($request->user()));
    }

    protected function transformUser(User $user): array
    {
        $roleName = $user->getRoleNames()->first();
        $permissions = $user->getAllPermissions()->pluck('name')->values()->all();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $roleName,
            'permissions' => $permissions,
            'tenant_id' => $user->tenant_id,
            'must_change_password' => (bool) $user->must_change_password,
        ];
    }
}
