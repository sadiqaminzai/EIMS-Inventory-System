<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->enum('transaction_type', ['purchase', 'sale', 'return_in', 'return_out', 'quotation']);
            $table->string('serial_no')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('party_type')->nullable();
            $table->unsignedBigInteger('party_id')->nullable();
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('completed');
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->decimal('total_discount', 10, 2)->default(0);
            $table->decimal('total_tax', 10, 2)->default(0);
            $table->decimal('net_amount', 10, 2)->default(0);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->decimal('due_amount', 10, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('transaction_date');
            $table->timestamps();

            $table->unique(['tenant_id', 'serial_no']);
            $table->index(['tenant_id', 'transaction_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
