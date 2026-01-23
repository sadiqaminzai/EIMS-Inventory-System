<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_batches', function (Blueprint $table) {
            $table->string('batch_no')->nullable()->change();
        });

        DB::statement('ALTER TABLE inventory_batches DROP INDEX IF EXISTS inventory_batches_tenant_id_batch_number_unique');
        DB::statement('ALTER TABLE inventory_batches DROP INDEX IF EXISTS inventory_batches_tenant_id_batch_no_unique');
        Schema::table('inventory_batches', function (Blueprint $table) {
            $table->unique(['tenant_id', 'batch_no']);
        });
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE inventory_batches DROP INDEX IF EXISTS inventory_batches_tenant_id_batch_no_unique');
        Schema::table('inventory_batches', function (Blueprint $table) {
            $table->string('batch_no')->nullable(false)->change();
        });
    }
};
