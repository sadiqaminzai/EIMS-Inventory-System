<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('account_id')->constrained('accounts')->cascadeOnDelete();
            $table->foreignId('to_account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->string('type');
            $table->string('category')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('currency')->default('USD');
            $table->decimal('exchange_rate', 14, 6)->nullable();
            $table->unsignedBigInteger('contact_id')->nullable();
            $table->string('payment_method')->nullable();
            $table->string('reference_id')->nullable();
            $table->text('description')->nullable();
            $table->string('attachment')->nullable();
            $table->date('date');
            $table->timestamps();

            $table->index(['tenant_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_transactions');
    }
};
