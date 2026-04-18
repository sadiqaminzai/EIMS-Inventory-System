<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('account_transactions', 'category_type')) {
                $table->string('category_type')->nullable()->after('type');
                $table->index(['tenant_id', 'type', 'category_type'], 'acc_tx_tenant_type_category_type_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('account_transactions', function (Blueprint $table) {
            if (Schema::hasColumn('account_transactions', 'category_type')) {
                $table->dropIndex('acc_tx_tenant_type_category_type_idx');
                $table->dropColumn('category_type');
            }
        });
    }
};
