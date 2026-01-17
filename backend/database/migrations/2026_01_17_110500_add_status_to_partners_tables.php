<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('status')->default('active')->after('tax_id');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->string('status')->default('active')->after('shipping_address');
        });
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('status');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
