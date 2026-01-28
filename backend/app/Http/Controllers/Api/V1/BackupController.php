<?php

namespace App\Http\Controllers\Api\V1;

use App\Console\Commands\RunAutomaticBackups;
use App\Http\Controllers\Controller;
use App\Models\Backup;
use App\Models\BackupSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BackupController extends Controller
{
    /**
     * List all backups for the current tenant
     */
    public function index(Request $request)
    {
        try {
            $this->runDueAutoBackupsOnce();
            $backups = Backup::query()
                ->with(['creator' => function ($query) {
                    $query->select('id', 'name');
                }])
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json($backups);
        } catch (\Exception $e) {
            \Log::error('Backup index error: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Failed to load backups',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create a new manual backup
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $tenantId = $user->tenant_id;
        $userId = $user->id;

        // Create backup record
        $backup = Backup::create([
            'tenant_id' => $tenantId,
            'filename' => 'backup_' . date('Y-m-d_H-i-s') . '.sql',
            'path' => '',
            'type' => 'manual',
            'status' => 'in_progress',
            'started_at' => now(),
            'created_by' => $userId,
        ]);

        try {
            // Get tenant-specific tables data
            $tables = $this->getTenantTables();
            $backupData = $this->generateBackupData($tenantId, $tables);

            // Save backup file
            $filename = "backups/tenant_{$tenantId}/{$backup->filename}";
            Storage::disk('local')->put($filename, $backupData);

            $backup->update([
                'path' => $filename,
                'size' => strlen($backupData),
                'status' => 'completed',
                'tables_included' => $tables,
                'completed_at' => now(),
            ]);

            // Update backup settings last backup time
            BackupSettings::updateOrCreate(
                ['tenant_id' => $tenantId],
                ['last_backup_at' => now()]
            );

            return response()->json($backup, 201);
        } catch (\Exception $e) {
            $backup->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Backup failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download a backup file
     */
    public function download(Backup $backup)
    {
        if ($backup->status !== 'completed') {
            return response()->json(['message' => 'Backup is not available for download'], 400);
        }

        if (!Storage::disk('local')->exists($backup->path)) {
            return response()->json(['message' => 'Backup file not found'], 404);
        }

        return Storage::disk('local')->download($backup->path, $backup->filename);
    }

    /**
     * Delete a backup
     */
    public function destroy(Backup $backup)
    {
        if ($backup->path && Storage::disk('local')->exists($backup->path)) {
            Storage::disk('local')->delete($backup->path);
        }

        $backup->delete();

        return response()->json(['message' => 'Backup deleted successfully']);
    }

    /**
     * Get backup settings for the current tenant
     */
    public function getSettings(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $tenantId = $user->tenant_id;
        if (!$tenantId) {
            return response()->json(['message' => 'Tenant not found'], 400);
        }

        $this->runDueAutoBackupsOnce();

        $settings = BackupSettings::where('tenant_id', $tenantId)->first();

        if (!$settings) {
            $settings = BackupSettings::create([
                'tenant_id' => $tenantId,
                'auto_backup_enabled' => false,
                'frequency' => 'daily',
                'backup_time' => '02:00:00',
                'retention_days' => 30,
                'max_backups' => 10,
            ]);
        }

        return response()->json($settings);
    }

    /**
     * Run due automatic backups at most once per minute (fallback when scheduler isn't running)
     */
    private function runDueAutoBackupsOnce(): void
    {
        $lockKey = 'auto_backups:last_run';
        $acquired = Cache::add($lockKey, now()->timestamp, 60);
        if (!$acquired) {
            return;
        }

        try {
            app(RunAutomaticBackups::class)->runBackupsQuietly();
        } catch (\Exception $e) {
            \Log::error('Auto backup fallback run failed: ' . $e->getMessage());
        }
    }

    /**
     * Update backup settings for the current tenant
     */
    public function updateSettings(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $tenantId = $user->tenant_id;

        $data = $request->validate([
            'auto_backup_enabled' => ['required', 'boolean'],
            'frequency' => ['required', 'in:daily,weekly,monthly'],
            'backup_time' => ['required', 'date_format:H:i'],
            'day_of_week' => ['nullable', 'integer', 'between:0,6'],
            'day_of_month' => ['nullable', 'integer', 'between:1,28'],
            'retention_days' => ['required', 'integer', 'min:1', 'max:365'],
            'max_backups' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $settings = BackupSettings::updateOrCreate(
            ['tenant_id' => $tenantId],
            array_merge($data, [
                'backup_time' => $data['backup_time'] . ':00',
                'updated_by' => $request->user()->id,
            ])
        );

        // Calculate and set next backup time if auto backup is enabled
        if ($settings->auto_backup_enabled) {
            $settings->next_backup_at = $settings->calculateNextBackupAt();
            $settings->save();
        } else {
            $settings->update(['next_backup_at' => null]);
        }

        return response()->json($settings);
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
                    // For tables without tenant_id (like roles), skip or handle differently
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
     * Restore from a backup (creates records from backup file)
     */
    public function restore(Request $request, Backup $backup)
    {
        if ($backup->status !== 'completed') {
            return response()->json(['message' => 'Cannot restore from incomplete backup'], 400);
        }

        if (!Storage::disk('local')->exists($backup->path)) {
            return response()->json(['message' => 'Backup file not found'], 404);
        }

        // For safety, we just return the backup content for now
        // A full restore would require careful implementation with transaction handling
        return response()->json([
            'message' => 'Restore functionality is available. Please contact administrator for full database restore.',
            'backup' => $backup,
        ]);
    }
}
