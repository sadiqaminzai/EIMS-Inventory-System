# Automatic Backups Setup Guide

## Overview
The automatic backup system consists of:
1. **BackupCommand** (`app/Console/Commands/RunAutomaticBackups.php`) - Executes the backup process
2. **Kernel** (`app/Console/Kernel.php`) - Schedules the command to run every minute
3. **BackupSettings Model** - Calculates when the next backup should run

## How It Works

1. The Laravel scheduler checks every minute if any backups are scheduled to run
2. The `calculateNextBackupAt()` method on the BackupSettings model determines when the next backup should occur based on:
   - **Daily**: Every day at the specified backup time
   - **Weekly**: On a specific day of the week (0-6) at the specified backup time
   - **Monthly**: On a specific day of the month (1-28) at the specified backup time

3. When `next_backup_at` <= current time, the backup is executed for that tenant
4. After a successful backup, `last_backup_at` is updated and `next_backup_at` is recalculated
5. Old backups are automatically cleaned up based on retention settings

## Local Development Setup

### Option 1: Manual Command Testing
Run the command manually to test:
```bash
php artisan backups:auto-run
```

### Option 2: Laravel Scheduler in Development
On Windows, you can use a scheduled task. On macOS/Linux, use cron.

For Windows, you can use the Task Scheduler or install a package like `laravel-scheduler-monitor`.

### Option 3: Continuous Loop (Development Only)
For development, you can run:
```bash
php artisan schedule:work
```

This command will run the scheduler in the foreground, executing scheduled commands as they come due. This is useful for local testing.

## Production Setup

### Linux/macOS (Cron)
Add this line to your crontab (`crontab -e`):
```cron
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

This runs Laravel's scheduler every minute. The scheduler will then execute the backup command when it's due.

### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create a new task that runs every minute
3. Set the action to: `php.exe` with arguments: `artisan schedule:run`
4. Set the working directory to your project root

## Configuration

In the UI, when you enable automatic backups for a tenant:
1. Open Settings > Backup
2. Click the "Settings" button
3. Enable "Enable Automatic Backups"
4. Select frequency (daily, weekly, monthly)
5. Set the backup time (HH:MM format)
6. Configure retention days and max backups
7. If weekly: select day of week (0=Sunday, 6=Saturday)
8. If monthly: select day of month (1-28)

## Troubleshooting

### Backups not running automatically?
1. Check if the scheduler is running with `php artisan schedule:list`
2. Manually run `php artisan backups:auto-run` to test
3. Check Laravel logs in `storage/logs/laravel.log`
4. Ensure `next_backup_at` is set and due for the tenant

### Check scheduled backups:
```bash
php artisan tinker
> BackupSettings::where('auto_backup_enabled', true)->get(['tenant_id', 'frequency', 'backup_time', 'next_backup_at']);
```

### Manually trigger a backup for testing:
```bash
php artisan tinker
> $settings = BackupSettings::find(1);
> $settings->update(['next_backup_at' => now()->subHour()]);
> // Now run: php artisan backups:auto-run
```
