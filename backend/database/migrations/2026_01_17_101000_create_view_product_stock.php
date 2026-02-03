<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP VIEW IF EXISTS view_product_stock');
        DB::statement(<<<SQL
            CREATE VIEW view_product_stock AS
            SELECT
                tenant_id,
                product_id,
                SUM(quantity_remaining) as current_stock,
                AVG(cost_price) as average_cost_price
            FROM inventory_batches
            WHERE quantity_remaining > 0
            GROUP BY tenant_id, product_id
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS view_product_stock');
    }
};
