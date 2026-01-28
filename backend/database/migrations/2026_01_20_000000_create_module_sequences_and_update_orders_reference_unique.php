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

        return ($result->count ?? 0) > 0;
    }

    public function up(): void
    {
        if (! Schema::hasTable('module_sequences')) {
            Schema::create('module_sequences', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
                $table->string('module');
                $table->unsignedBigInteger('last_number')->default(0);
                $table->timestamps();

                $table->unique(['tenant_id', 'module']);
            });
        }

        $legacyIndexName = null;
        if ($this->indexExists('orders', 'orders_serial_no_unique')) {
            $legacyIndexName = 'orders_serial_no_unique';
        } elseif ($this->indexExists('orders', 'serial_no_unique')) {
            $legacyIndexName = 'serial_no_unique';
        } elseif ($this->indexExists('orders', 'orders_seria_no_unique')) {
            $legacyIndexName = 'orders_seria_no_unique';
        } elseif ($this->indexExists('orders', 'seria_no_unique')) {
            $legacyIndexName = 'seria_no_unique';
        }

        Schema::table('orders', function (Blueprint $table) use ($legacyIndexName) {
            if ($legacyIndexName) {
                $table->dropUnique($legacyIndexName);
            }
            $table->unique(['tenant_id', 'transaction_type', 'serial_no'], 'orders_tenant_type_serial_unique');
        });
    }

    public function down(): void
    {
        $hasNewIndex = $this->indexExists('orders', 'orders_tenant_type_serial_unique');

        Schema::table('orders', function (Blueprint $table) use ($hasNewIndex) {
            if ($hasNewIndex) {
                $table->dropUnique('orders_tenant_type_serial_unique');
            }
            $table->unique('serial_no');
        });

        Schema::dropIfExists('module_sequences');
    }
};
