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

        // Build user query - find by email first
        $userQuery = User::query()
            ->where('email', $data['email'])
            ->where('is_active', true);

        // If tenant_id is provided, filter by it
        if (!empty($data['tenant_id'])) {
            $userQuery->where('tenant_id', $data['tenant_id']);
        }

        $user = $userQuery->first();

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
        $roleName = $user->role?->name ?? $user->getRoleNames()->first();

        // Get permissions directly from the user's role to avoid Spatie team context issues
        $permissions = [];
        if ($user->role) {
            $permissions = $user->role->permissions->pluck('name')->values()->all();
        }

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
