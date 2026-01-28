<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BackupSettings extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'auto_backup_enabled',
        'frequency',
        'backup_time',
        'day_of_week',
        'day_of_month',
        'retention_days',
        'max_backups',
        'last_backup_at',
        'next_backup_at',
        'updated_by',
    ];

    protected $casts = [
        'auto_backup_enabled' => 'boolean',
        'last_backup_at' => 'datetime',
        'next_backup_at' => 'datetime',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Calculate the next backup time based on settings
     */
    public function calculateNextBackupAt(): \Carbon\Carbon
    {
        $now = now();

        // Parse backup time (format: HH:mm:ss)
        [$hours, $minutes] = explode(':', substr($this->backup_time, 0, 5));

        switch ($this->frequency) {
            case 'daily':
                $next = $now->copy()->setTime((int)$hours, (int)$minutes, 0);
                if ($next->lte($now)) {
                    $next->addDay();
                }
                break;

            case 'weekly':
                $dayOfWeek = $this->day_of_week ?? 0; // 0 = Sunday, 6 = Saturday
                $next = $now->copy()->setTime((int)$hours, (int)$minutes, 0);

                // Adjust to the target day of week
                while ($next->dayOfWeek !== $dayOfWeek || $next->lte($now)) {
                    $next->addDay();
                }
                break;

            case 'monthly':
                $dayOfMonth = $this->day_of_month ?? 1;
                $next = $now->copy()->setTime((int)$hours, (int)$minutes, 0)->day($dayOfMonth);

                if ($next->lte($now)) {
                    $next->addMonth();
                }
                break;

            default:
                $next = $now->copy()->addDay()->setTime((int)$hours, (int)$minutes, 0);
        }

        return $next;
    }
}
