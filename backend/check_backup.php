<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$backup = \App\Models\Backup::latest()->first();
if ($backup) {
    echo "Latest backup:\n";
    echo "  ID: {$backup->id}\n";
    echo "  Type: {$backup->type}\n";
    echo "  Status: {$backup->status}\n";
    echo "  Filename: {$backup->filename}\n";
    echo "  Path: {$backup->path}\n";
    echo "  Size: {$backup->size} bytes\n";
    echo "  Created: {$backup->created_at}\n";

    if (!empty($backup->path)) {
        $exists = \Illuminate\Support\Facades\Storage::disk('local')->exists($backup->path);
        echo "  File Exists: " . ($exists ? 'Yes' : 'No') . "\n";
    }
}
