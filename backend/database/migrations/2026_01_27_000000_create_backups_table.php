<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('backups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->string('filename');
            $table->string('path');
            $table->bigInteger('size')->default(0); // File size in bytes
            $table->enum('type', ['manual', 'automatic'])->default('manual');
            $table->enum('status', ['pending', 'in_progress', 'completed', 'failed'])->default('pending');
            $table->text('error_message')->nullable();
            $table->json('tables_included')->nullable(); // List of tables backed up
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'type']);
        });

        Schema::create('backup_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            $table->boolean('auto_backup_enabled')->default(false);
            $table->enum('frequency', ['daily', 'weekly', 'monthly'])->default('daily');
            $table->time('backup_time')->default('02:00:00'); // Default 2 AM
            $table->unsignedTinyInteger('day_of_week')->nullable(); // 0-6 for weekly (0 = Sunday)
            $table->unsignedTinyInteger('day_of_month')->nullable(); // 1-28 for monthly
            $table->unsignedInteger('retention_days')->default(30); // How long to keep backups
            $table->unsignedInteger('max_backups')->default(10); // Maximum number of backups to keep
            $table->timestamp('last_backup_at')->nullable();
            $table->timestamp('next_backup_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique('tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_settings');
        Schema::dropIfExists('backups');
    }
};
