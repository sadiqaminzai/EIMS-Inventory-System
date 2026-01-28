<?php

namespace App\Console\Commands;

use App\Models\Backup;
use App\Models\BackupSettings;
use App\Models\Tenant;
use App\Support\TenantContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class RunAutomaticBackups extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'backups:auto-run';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Run automatic backups for all tenants based on their backup settings';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting automatic backup process...');

        // Get all tenants with auto backup enabled
        $settings = BackupSettings::where('auto_backup_enabled', true)
            ->where(function ($query) {
                $query->whereNull('next_backup_at')
                    ->orWhere('next_backup_at', '<=', now());
            })
            ->get();

        if ($settings->isEmpty()) {
            $this->info('No backups scheduled at this time.');
            return 0;
        }

        $this->info("Found {$settings->count()} tenant(s) with scheduled backups.");

        foreach ($settings as $setting) {
            $this->backupTenant($setting, true);
        }

        $this->info('Automatic backup process completed.');
        return 0;
    }

    /**
     * Public method to run backups programmatically (without CLI output)
     */
    public function runBackupsQuietly(): int
    {
        // Get all tenants with auto backup enabled
        $settings = BackupSettings::where('auto_backup_enabled', true)
            ->where(function ($query) {
                $query->whereNull('next_backup_at')
                    ->orWhere('next_backup_at', '<=', now());
            })
            ->get();

        if ($settings->isEmpty()) {
            return 0;
        }

        foreach ($settings as $setting) {
            $this->backupTenant($setting);
        }

        return 0;
    }

    /**
     * Backup a specific tenant
     */
    private function backupTenant(BackupSettings $settings, bool $verbose = false): void
    {
        $tenantId = $settings->tenant_id;

        try {
            if ($verbose) {
                $this->info("Starting backup for tenant ID: {$tenantId}");
            }

            // Set tenant context
            TenantContext::setTenantId($tenantId);

            // Create backup record
            $backup = Backup::create([
                'tenant_id' => $tenantId,
                'filename' => 'backup_' . date('Y-m-d_H-i-s') . '.sql',
                'path' => '',
                'type' => 'automatic',
                'status' => 'in_progress',
                'started_at' => now(),
            ]);

            // Get tenant-specific tables
            $tables = $this->getTenantTables();
            $backupData = $this->generateBackupData($tenantId, $tables);

            // Save backup file
            $filename = "backups/tenant_{$tenantId}/{$backup->filename}";
            Storage::disk('local')->put($filename, $backupData);

            // Update backup as completed
            $backup->update([
                'path' => $filename,
                'size' => strlen($backupData),
                'status' => 'completed',
                'tables_included' => $tables,
                'completed_at' => now(),
            ]);

            // Update backup settings
            $settings->last_backup_at = now();
            $settings->next_backup_at = $settings->calculateNextBackupAt();
            $settings->save();

            // Clean up old backups based on retention policy
            $this->cleanupOldBackups($tenantId, $settings);

            if ($verbose) {
                $this->info("Backup completed successfully for tenant ID: {$tenantId}");
            }
        } catch (\Exception $e) {
            if ($verbose) {
                $this->error("Backup failed for tenant ID: {$tenantId} - " . $e->getMessage());
            }

            // Update backup record as failed
            Backup::where('tenant_id', $tenantId)
                ->where('status', 'in_progress')
                ->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'completed_at' => now(),
                ]);
        } finally {
            // Reset tenant context
            TenantContext::setTenantId(null);
        }
    }

    /**
     * Get list of tenant-specific tables
     */
    private function getTenantTables(): array
    {
        return [
            'products',
            'brands',
            'countries',
            'categories',
            'suppliers',
            'customers',
            'inventory_batches',
            'inventory_logs',
            'orders',
            'order_items',
            'accounts',
            'account_transactions',
            'payments',
            'payment_details',
            'roles',
            'users',
        ];
    }

    /**
     * Generate SQL backup data for the tenant
     */
    private function generateBackupData(int $tenantId, array $tables): string
    {
        $output = "-- Backup generated at " . now()->toIso8601String() . "\n";
        $output .= "-- Tenant ID: {$tenantId}\n\n";
        $output .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ($tables as $table) {
            try {
                // Check if table has tenant_id column
                $hasTenantsColumn = DB::getSchemaBuilder()->hasColumn($table, 'tenant_id');

                if ($hasTenantsColumn) {
                    $rows = DB::table($table)->where('tenant_id', $tenantId)->get();
                } else {
                    continue;
                }

                if ($rows->isEmpty()) {
                    continue;
                }

                $output .= "-- Table: {$table}\n";
                $output .= "-- Records: " . $rows->count() . "\n\n";

                foreach ($rows as $row) {
                    $rowArray = (array) $row;
                    $columns = implode('`, `', array_keys($rowArray));
                    $values = array_map(function ($value) {
                        if ($value === null) {
                            return 'NULL';
                        }
                        return "'" . addslashes($value) . "'";
                    }, array_values($rowArray));
                    $valuesStr = implode(', ', $values);

                    $output .= "INSERT INTO `{$table}` (`{$columns}`) VALUES ({$valuesStr});\n";
                }

                $output .= "\n";
            } catch (\Exception $e) {
                $output .= "-- Error backing up table {$table}: " . $e->getMessage() . "\n\n";
            }
        }

        $output .= "SET FOREIGN_KEY_CHECKS=1;\n";

        return $output;
    }

    /**
     * Clean up old backups based on retention policy
     */
    private function cleanupOldBackups(int $tenantId, BackupSettings $settings): void
    {
        // Delete backups older than retention days
        if ($settings->retention_days > 0) {
            $cutoffDate = now()->subDays($settings->retention_days);

            Backup::where('tenant_id', $tenantId)
                ->where('created_at', '<', $cutoffDate)
                ->get()
                ->each(function ($backup) {
                    if ($backup->path && Storage::disk('local')->exists($backup->path)) {
                        Storage::disk('local')->delete($backup->path);
                    }
                    $backup->delete();
                });
        }

        // Keep only the max number of backups
        if ($settings->max_backups > 0) {
            $backupCount = Backup::where('tenant_id', $tenantId)->count();

            if ($backupCount > $settings->max_backups) {
                $backupsToDelete = Backup::where('tenant_id', $tenantId)
                    ->orderBy('created_at', 'desc')
                    ->limit(999999)
                    ->offset($settings->max_backups)
                    ->get();

                $backupsToDelete->each(function ($backup) {
                    if ($backup->path && Storage::disk('local')->exists($backup->path)) {
                        Storage::disk('local')->delete($backup->path);
                    }
                    $backup->delete();
                });
            }
        }
    }
}
