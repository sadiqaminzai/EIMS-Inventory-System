<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'transaction_type',
        'reference_number',
        'user_id',
        'party_type',
        'party_id',
        'status',
        'total_amount',
        'notes',
        'transaction_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'transaction_date' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function party()
    {
        return $this->morphTo(null, 'party_type', 'party_id');
    }
}
