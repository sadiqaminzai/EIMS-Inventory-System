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
        'serial_no',
        'user_id',
        'party_type',
        'party_id',
        'status',
        'total_amount',
        'total_discount',
        'total_tax',
        'net_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'notes',
        'transaction_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'transaction_date' => 'datetime',
        'total_amount' => 'decimal:2',
        'total_discount' => 'decimal:2',
        'total_tax' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
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

    public function paymentAllocations()
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function invoiceAdjustments()
    {
        return $this->hasMany(InvoiceAdjustment::class);
    }
}
