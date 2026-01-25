<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use App\Models\Role;
use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;
use Symfony\Component\HttpFoundation\Response;

class SetTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $tenantId = $request->input('tenant_id') ?: $request->header('X-Tenant-Id');

        if (!$tenantId && $user) {
            $tenantId = $user->tenant_id;
        }

        if (!$tenantId && $request->input('tenant_id')) {
            $tenantId = $request->input('tenant_id');
        }

        if ($tenantId) {
            TenantContext::setTenantId((int) $tenantId);
        } else {
            TenantContext::setTenantId(null);
        }

        $isSuperAdmin = false;
        if ($user) {
            $isSuperAdmin = Role::withoutGlobalScope('tenant')
                ->where('id', $user->role_id)
                ->where('name', 'superadmin')
                ->exists();
        }

        if ($isSuperAdmin && $user) {
            // Superadmins operate on the actively selected tenant context
            app(PermissionRegistrar::class)->setPermissionsTeamId($tenantId ? (int) $tenantId : null);
            TenantContext::setIgnoreTenantScope(true);
        } else {
            app(PermissionRegistrar::class)->setPermissionsTeamId($tenantId ? (int) $tenantId : null);
            TenantContext::setIgnoreTenantScope(false);
        }

        return $next($request);
    }
}
