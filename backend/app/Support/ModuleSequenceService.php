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
}
