<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('orders', 'payment_status')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('payment_status')->default('pending')->after('due_amount');
                $table->index(['tenant_id', 'payment_status'], 'orders_tenant_payment_status_idx');
                $table->index(['tenant_id', 'transaction_type', 'party_type', 'party_id', 'due_amount'], 'orders_customer_due_lookup_idx');
            });
        }

        DB::table('orders')
            ->select(['id', 'paid_amount', 'due_amount'])
            ->orderBy('id')
            ->chunkById(500, function ($orders): void {
                foreach ($orders as $order) {
                    $paid = (float) ($order->paid_amount ?? 0);
                    $due = (float) ($order->due_amount ?? 0);

                    $status = 'pending';
                    if ($due <= 0) {
                        $status = 'paid';
                    } elseif ($paid > 0) {
                        $status = 'partial';
                    }

                    DB::table('orders')
                        ->where('id', $order->id)
                        ->update(['payment_status' => $status]);
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'payment_status')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropIndex('orders_tenant_payment_status_idx');
                $table->dropIndex('orders_customer_due_lookup_idx');
                $table->dropColumn('payment_status');
            });
        }
    }
};
