<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('batch_no')->nullable();
            $table->decimal('cost_price', 10, 2);
            $table->integer('quantity_initial');
            $table->integer('quantity_remaining');
            $table->date('received_date');
            $table->date('expiry_date')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'batch_no']);
            $table->index(['tenant_id', 'product_id', 'received_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_batches');
    }
};
