<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use App\Support\TenantContext;

class ModuleSequenceService
{
    public function next(string $module, ?int $tenantId = null): int
    {
        $tenantId = $tenantId ?? TenantContext::getTenantId();

        if ($tenantId === null) {
            throw new \RuntimeException('Tenant ID is required to generate a sequence number.');
        }

        $now = now();

        $sequence = DB::table('module_sequences')
            ->where('tenant_id', $tenantId)
            ->where('module', $module)
            ->lockForUpdate()
            ->first();

        if (! $sequence) {
            DB::table('module_sequences')->insertOrIgnore([
                'tenant_id' => $tenantId,
                'module' => $module,
                'last_number' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $sequence = DB::table('module_sequences')
                ->where('tenant_id', $tenantId)
                ->where('module', $module)
                ->lockForUpdate()
                ->first();
        }

        $next = ((int) $sequence->last_number) + 1;

        DB::table('module_sequences')
            ->where('tenant_id', $tenantId)
            ->where('module', $module)
            ->update([
                'last_number' => $next,
                'updated_at' => $now,
            ]);

        return $next;
    }

    public function decrement(string $module, ?int $tenantId = null): void
    {
        $tenantId = $tenantId ?? TenantContext::getTenantId();

        if ($tenantId === null) {
            return;
        }

        $now = now();

        DB::table('module_sequences')
            ->where('tenant_id', $tenantId)
            ->where('module', $module)
            ->where('last_number', '>', 0)
            ->decrement('last_number', 1, ['updated_at' => $now]);
    }

    public function current(string $module, ?int $tenantId = null): int
    {
        $tenantId = $tenantId ?? TenantContext::getTenantId();

        if ($tenantId === null) {
            return 0;
        }

        $sequence = DB::table('module_sequences')
            ->where('tenant_id', $tenantId)
            ->where('module', $module)
            ->first();

        return $sequence ? (int) $sequence->last_number : 0;
    }
}
