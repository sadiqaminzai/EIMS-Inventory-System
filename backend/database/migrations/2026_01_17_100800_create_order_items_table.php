<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('batch_no')->nullable();
            $table->date('exp_date')->nullable();
            $table->integer('quantity');
            $table->integer('bonus')->nullable();
            $table->decimal('discount', 10, 2)->nullable();
            $table->decimal('discount_percent', 5, 2)->nullable();
            $table->decimal('tax', 10, 2)->nullable();
            $table->decimal('tax_percent', 5, 2)->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 10, 2);
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
