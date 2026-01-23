<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountTransaction extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'serial_no',
        'account_id',
        'to_account_id',
        'type',
        'category',
        'amount',
        'currency',
        'exchange_rate',
        'contact_id',
        'payment_method',
        'reference_id',
        'description',
        'attachment',
        'date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
