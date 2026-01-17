<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

        $tenantId = $data['tenant_id'] ?? 1;

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
        $role = $user->role;
        $permissions = array_keys(array_filter($role?->permissions ?? [], fn ($value) => $value === true));

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role?->name,
            'permissions' => $permissions,
        ];
    }
}
