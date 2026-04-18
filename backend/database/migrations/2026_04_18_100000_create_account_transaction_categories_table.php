<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('account_transaction_categories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name');
            $table->string('type'); // expense | other_income
            $table->text('details')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();

            $table->unique(['tenant_id', 'type', 'name'], 'acc_tx_categories_tenant_type_name_unique');
            $table->index(['tenant_id', 'type', 'status'], 'acc_tx_categories_tenant_type_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('account_transaction_categories');
    }
};
