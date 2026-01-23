<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_transactions', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
        });

        $tenants = DB::table('account_transactions')->select('tenant_id')->distinct()->pluck('tenant_id');
        foreach ($tenants as $tenantId) {
            $transactions = DB::table('account_transactions')
                ->where('tenant_id', $tenantId)
                ->orderBy('id')
                ->get(['id']);

            $counter = 1;
            foreach ($transactions as $tx) {
                DB::table('account_transactions')
                    ->where('id', $tx->id)
                    ->update(['serial_no' => (string) $counter]);
                $counter++;
            }

            $maxSerial = DB::table('account_transactions')
                ->where('tenant_id', $tenantId)
                ->max('serial_no');

            DB::table('module_sequences')->updateOrInsert(
                ['tenant_id' => $tenantId, 'module' => 'account_tx'],
                [
                    'last_number' => (int) ($maxSerial ?: 0),
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        Schema::table('account_transactions', function (Blueprint $table) {
            $table->unique(['tenant_id', 'serial_no']);
        });
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE account_transactions DROP INDEX account_transactions_tenant_id_serial_no_unique");
        DB::statement("ALTER TABLE account_transactions DROP COLUMN serial_no");
    }
};
