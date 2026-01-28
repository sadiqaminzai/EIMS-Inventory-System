<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// Get the first tenant
$tenant = \App\Models\Tenant::first();

if (!$tenant) {
    echo "No tenants found\n";
    exit(1);
}

// Create or update backup settings to enable auto backup for immediate execution
$settings = \App\Models\BackupSettings::updateOrCreate(
    ['tenant_id' => $tenant->id],
    [
        'auto_backup_enabled' => true,
        'frequency' => 'daily',
        'backup_time' => now()->format('H:i:00'),
        'retention_days' => 30,
        'max_backups' => 10,
        'next_backup_at' => now(), // Set to now so it runs immediately
    ]
);

echo "✓ Backup settings configured:\n";
echo "  Tenant ID: {$settings->tenant_id}\n";
echo "  Auto Backup Enabled: " . ($settings->auto_backup_enabled ? 'Yes' : 'No') . "\n";
echo "  Frequency: {$settings->frequency}\n";
echo "  Backup Time: {$settings->backup_time}\n";
echo "  Next Backup At: {$settings->next_backup_at}\n\n";

// Create directory if it doesn't exist
$backupDir = storage_path("app/backups/tenant_{$tenant->id}");
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

echo "Running automatic backups...\n\n";

// Import and run the command logic
$command = new \App\Console\Commands\RunAutomaticBackups();
$command->runBackupsQuietly();

echo "\n✓ Test complete!\n";

// Verify backup was created
$backupCount = \App\Models\Backup::where('tenant_id', $tenant->id)->count();
echo "\nBackups created: {$backupCount}\n";

$latestBackup = \App\Models\Backup::where('tenant_id', $tenant->id)->latest()->first();
if ($latestBackup) {
    echo "Latest backup status: {$latestBackup->status}\n";
    if ($latestBackup->status === 'completed') {
        echo "✓ Automatic backup completed successfully!\n";
    }
}

