<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'brands',
            'countries',
            'categories',
            'products',
            'suppliers',
            'customers',
            'inventory_batches',
            'orders',
            'order_items',
            'inventory_logs',
            'roles',
            'tenants',
            'accounts',
            'account_transactions',
            'users',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                if (!Schema::hasColumn($table->getTable(), 'created_by')) {
                    $table->unsignedBigInteger('created_by')->nullable()->after('id');
                }
                if (!Schema::hasColumn($table->getTable(), 'updated_by')) {
                    $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
                }
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'brands',
            'countries',
            'categories',
            'products',
            'suppliers',
            'customers',
            'inventory_batches',
            'orders',
            'order_items',
            'inventory_logs',
            'roles',
            'tenants',
            'accounts',
            'account_transactions',
            'users',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $table) {
                if (Schema::hasColumn($table->getTable(), 'created_by')) {
                    $table->dropColumn('created_by');
                }
                if (Schema::hasColumn($table->getTable(), 'updated_by')) {
                    $table->dropColumn('updated_by');
                }
            });
        }
    }
};
