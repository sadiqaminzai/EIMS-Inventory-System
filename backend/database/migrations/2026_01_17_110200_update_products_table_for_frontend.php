<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('brand_id')->nullable()->after('category_id')->constrained('brands')->nullOnDelete();
            $table->foreignId('country_id')->nullable()->after('brand_id')->constrained('countries')->nullOnDelete();
            $table->string('model_no')->nullable()->after('name');
            $table->decimal('cost_price', 10, 2)->nullable()->after('model_no');
            $table->decimal('sale_price', 10, 2)->nullable()->after('cost_price');
            $table->string('photo')->nullable()->after('sale_price');
            $table->string('status')->default('active')->after('photo');
            $table->integer('stock_qty')->default(0)->after('status');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('sku')->nullable()->change();
            $table->string('unit_of_measure')->nullable()->change();
            $table->foreignId('category_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropForeign(['country_id']);
            $table->dropColumn([
                'brand_id',
                'country_id',
                'model_no',
                'cost_price',
                'sale_price',
                'photo',
                'status',
                'stock_qty',
            ]);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('sku')->nullable(false)->change();
            $table->string('unit_of_measure')->nullable(false)->change();
            $table->foreignId('category_id')->nullable(false)->change();
        });
    }
};
