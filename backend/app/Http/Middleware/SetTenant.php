<?php

namespace App\Http\Middleware;

use App\Support\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->header('X-Tenant-Id');

        if (!$tenantId && $request->user()) {
            $tenantId = $request->user()->tenant_id;
        }

        if (!$tenantId && $request->input('tenant_id')) {
            $tenantId = $request->input('tenant_id');
        }

        if ($tenantId) {
            TenantContext::setTenantId((int) $tenantId);
        }

        return $next($request);
    }
}
