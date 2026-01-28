<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add serial_no to products table
        Schema::table('products', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
            $table->index(['tenant_id', 'serial_no']);
        });

        // Add serial_no to brands table
        Schema::table('brands', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
            $table->index(['tenant_id', 'serial_no']);
        });

        // Add serial_no to countries table
        Schema::table('countries', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
            $table->index(['tenant_id', 'serial_no']);
        });

        // Add serial_no to customers table
        Schema::table('customers', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
            $table->index(['tenant_id', 'serial_no']);
        });

        // Add serial_no to suppliers table
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('serial_no')->nullable()->after('tenant_id');
            $table->index(['tenant_id', 'serial_no']);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('brands', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('countries', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });
    }
};
