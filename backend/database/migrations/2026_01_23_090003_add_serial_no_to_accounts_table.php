<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
        });

        $tenants = DB::table('accounts')->select('tenant_id')->distinct()->pluck('tenant_id');
        foreach ($tenants as $tenantId) {
            $accounts = DB::table('accounts')
                ->where('tenant_id', $tenantId)
                ->orderBy('id')
                ->get(['id']);

            $counter = 1;
            foreach ($accounts as $account) {
                DB::table('accounts')
                    ->where('id', $account->id)
                    ->update(['serial_no' => (string) $counter]);
                $counter++;
            }
        }

            foreach ($tenants as $tenantId) {
                $maxSerial = DB::table('accounts')
                    ->where('tenant_id', $tenantId)
                    ->max('serial_no');

                DB::table('module_sequences')->updateOrInsert(
                    ['tenant_id' => $tenantId, 'module' => 'account'],
                    [
                        'last_number' => (int) ($maxSerial ?: 0),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }

        Schema::table('accounts', function (Blueprint $table) {
            $table->unique(['tenant_id', 'serial_no']);
        });
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE accounts DROP INDEX accounts_tenant_id_serial_no_unique");
        DB::statement("ALTER TABLE accounts DROP COLUMN serial_no");
    }
};
