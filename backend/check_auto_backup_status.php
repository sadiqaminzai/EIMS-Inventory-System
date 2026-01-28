<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tz = config('app.timezone');
$now = now();

echo "App timezone: {$tz}\n";
echo "Now: {$now}\n\n";

$settings = \App\Models\BackupSettings::get();
if ($settings->isEmpty()) {
    echo "No backup settings found.\n";
    exit(0);
}

foreach ($settings as $s) {
    echo "Tenant ID: {$s->tenant_id}\n";
    echo "  Auto Enabled: " . ($s->auto_backup_enabled ? 'Yes' : 'No') . "\n";
    echo "  Frequency: {$s->frequency}\n";
    echo "  Backup Time: {$s->backup_time}\n";
    echo "  Next Backup At: " . ($s->next_backup_at ?? 'NULL') . "\n";
    $due = $s->auto_backup_enabled && $s->next_backup_at && $s->next_backup_at->lte($now);
    echo "  Due Now: " . ($due ? 'Yes' : 'No') . "\n\n";
}
