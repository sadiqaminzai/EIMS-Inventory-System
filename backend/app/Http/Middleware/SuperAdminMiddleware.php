<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SuperAdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->hasRole('superadmin')) {
            return response()->json(['message' => 'Forbidden - Superadmin access required'], 403);
        }

        return $next($request);
    }
}
