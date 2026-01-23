<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'account_id',
        'serial_no',
        'date',
        'salesman',
        'booker',
        'total_pending_before',
        'total_received',
        'total_pending_after',
        'currency',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    public function details()
    {
        return $this->hasMany(PaymentDetail::class);
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }
}
