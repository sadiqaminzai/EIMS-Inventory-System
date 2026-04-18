<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (! Schema::hasColumn('payments', 'payment_type')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('payment_type')->default('receivable')->after('date');
                $table->index(['tenant_id', 'payment_type'], 'payments_tenant_payment_type_idx');
            });
        }

        if ($driver !== 'sqlite' && Schema::hasColumn('payment_details', 'customer_id')) {
            DB::statement('ALTER TABLE payment_details MODIFY customer_id BIGINT UNSIGNED NULL');
        }

        Schema::table('payment_details', function (Blueprint $table) {
            if (! Schema::hasColumn('payment_details', 'supplier_id')) {
                $table->foreignId('supplier_id')->nullable()->after('customer_id')->constrained('suppliers')->nullOnDelete();
                $table->index(['tenant_id', 'supplier_id'], 'payment_details_tenant_supplier_idx');
            }
        });

        if ($driver !== 'sqlite' && Schema::hasColumn('payment_allocations', 'customer_id')) {
            DB::statement('ALTER TABLE payment_allocations MODIFY customer_id BIGINT UNSIGNED NULL');
        }

        Schema::table('payment_allocations', function (Blueprint $table) {
            if (! Schema::hasColumn('payment_allocations', 'supplier_id')) {
                $table->foreignId('supplier_id')->nullable()->after('customer_id')->constrained('suppliers')->nullOnDelete();
                $table->index(['tenant_id', 'supplier_id'], 'payment_allocations_tenant_supplier_idx');
            }
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (Schema::hasColumn('payments', 'payment_type')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropIndex('payments_tenant_payment_type_idx');
                $table->dropColumn('payment_type');
            });
        }

        if (Schema::hasColumn('payment_details', 'supplier_id')) {
            Schema::table('payment_details', function (Blueprint $table) {
                $table->dropIndex('payment_details_tenant_supplier_idx');
                $table->dropConstrainedForeignId('supplier_id');
            });
        }

        if (Schema::hasColumn('payment_allocations', 'supplier_id')) {
            Schema::table('payment_allocations', function (Blueprint $table) {
                $table->dropIndex('payment_allocations_tenant_supplier_idx');
                $table->dropConstrainedForeignId('supplier_id');
            });
        }

        if ($driver !== 'sqlite' && Schema::hasColumn('payment_details', 'customer_id')) {
            DB::statement('ALTER TABLE payment_details MODIFY customer_id BIGINT UNSIGNED NOT NULL');
        }

        if ($driver !== 'sqlite' && Schema::hasColumn('payment_allocations', 'customer_id')) {
            DB::statement('ALTER TABLE payment_allocations MODIFY customer_id BIGINT UNSIGNED NOT NULL');
        }
    }
};
