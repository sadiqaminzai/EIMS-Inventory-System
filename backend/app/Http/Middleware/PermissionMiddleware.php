<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Superadmin bypasses all permission checks
        if ($user->hasRole('superadmin')) {
            return $next($request);
        }

        // Support OR logic with pipe separator (e.g., "manage_products|product.view")
        $permissions = explode('|', $permission);

        // Check permissions via the user's role directly
        // This bypasses Spatie's team-based permission check which has issues
        $role = $user->role;
        if ($role) {
            foreach ($permissions as $perm) {
                $permName = trim($perm);
                // Check if the role has this permission
                if ($role->permissions->contains('name', $permName)) {
                    return $next($request);
                }
            }
        }

        return response()->json(['message' => 'Forbidden'], 403);
    }
}
