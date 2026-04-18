<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $hasRef = Schema::hasColumn('orders', 'reference_number');
        $hasSerial = Schema::hasColumn('orders', 'serial_no');

        if ($hasRef && ! $hasSerial) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('serial_no')->nullable()->after('reference_number');
            });
        }

        if (Schema::hasColumn('orders', 'reference_number') && Schema::hasColumn('orders', 'serial_no')) {
            DB::statement("UPDATE orders SET serial_no = reference_number WHERE serial_no IS NULL");

            $indexes = DB::select("SHOW INDEX FROM orders WHERE Column_name = 'reference_number' AND Non_unique = 0");
            foreach ($indexes as $idx) {
                if (!empty($idx->Key_name)) {
                    DB::statement("ALTER TABLE orders DROP INDEX {$idx->Key_name}");
                }
            }

            DB::statement("ALTER TABLE orders DROP COLUMN reference_number");
        }

        $serialIndex = DB::select("SHOW INDEX FROM orders WHERE Column_name = 'serial_no' AND Non_unique = 0");
        if (empty($serialIndex)) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unique(['tenant_id', 'serial_no']);
            });
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        if (! Schema::hasColumn('orders', 'reference_number')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->string('reference_number')->nullable()->after('serial_no');
            });
        }

        if (Schema::hasColumn('orders', 'serial_no')) {
            DB::statement("UPDATE orders SET reference_number = serial_no WHERE reference_number IS NULL");

            $serialIndexes = DB::select("SHOW INDEX FROM orders WHERE Column_name = 'serial_no' AND Non_unique = 0");
            foreach ($serialIndexes as $idx) {
                if (!empty($idx->Key_name)) {
                    DB::statement("ALTER TABLE orders DROP INDEX {$idx->Key_name}");
                }
            }

            DB::statement("ALTER TABLE orders DROP COLUMN serial_no");
        }

        $refIndex = DB::select("SHOW INDEX FROM orders WHERE Column_name = 'reference_number' AND Non_unique = 0");
        if (empty($refIndex)) {
            Schema::table('orders', function (Blueprint $table) {
                $table->unique('reference_number');
            });
        }
    }
};
