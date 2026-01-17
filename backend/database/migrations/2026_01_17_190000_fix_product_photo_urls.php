<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE products SET photo = REPLACE(photo, 'http://localhost:8000http://localhost', '') WHERE photo LIKE 'http://localhost:8000http://localhost%'");
        DB::statement("UPDATE products SET photo = REPLACE(photo, 'http://localhost:8000', '') WHERE photo LIKE 'http://localhost:8000%'");
        DB::statement("UPDATE products SET photo = REPLACE(photo, 'http://localhost', '') WHERE photo LIKE 'http://localhost%'");
    }

    public function down(): void
    {
        // Irreversible cleanup
    }
};
