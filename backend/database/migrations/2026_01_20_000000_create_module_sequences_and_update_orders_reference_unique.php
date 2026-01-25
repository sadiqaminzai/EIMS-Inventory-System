<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
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

        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['seria_no']);
            $table->unique(['tenant_id', 'transaction_type', 'reference_number'], 'orders_tenant_type_reference_unique');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_tenant_type_reference_unique');
            $table->unique('reference_number');
        });

        Schema::dropIfExists('module_sequences');
    }
};
