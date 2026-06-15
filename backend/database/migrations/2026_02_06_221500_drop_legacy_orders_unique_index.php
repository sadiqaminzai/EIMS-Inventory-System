<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();
        $result = DB::selectOne(
            'SELECT COUNT(1) AS count FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [$database, $table, $indexName]
        );

        return ((int) ($result->count ?? 0)) > 0;
    }

    public function up(): void
    {
        // Drop legacy unique index that causes serial_no collisions across transaction types
        if ($this->indexExists('orders', 'orders_tenant_id_serial_no_unique')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropUnique('orders_tenant_id_serial_no_unique');
            });
        }

        // Ensure the correct unique index exists: tenant + transaction_type + serial_no
        if (! $this->indexExists('orders', 'orders_tenant_type_serial_unique')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unique(['tenant_id', 'transaction_type', 'serial_no'], 'orders_tenant_type_serial_unique');
            });
        }
    }

    public function down(): void
    {
        // Restore legacy unique index if needed
        if ($this->indexExists('orders', 'orders_tenant_type_serial_unique')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropUnique('orders_tenant_type_serial_unique');
            });
        }

        if (! $this->indexExists('orders', 'orders_tenant_id_serial_no_unique')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unique(['tenant_id', 'serial_no'], 'orders_tenant_id_serial_no_unique');
            });
        }
    }
};
