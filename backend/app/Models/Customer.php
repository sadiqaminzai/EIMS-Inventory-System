<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'serial_no',
        'name',
        'email',
        'phone',
        'billing_address',
        'shipping_address',
        'status',
        'created_by',
        'updated_by',
    ];

    public function saleOrders()
    {
        return $this->hasMany(Order::class, 'party_id')
            ->where('party_type', self::class)
            ->where('transaction_type', 'sale');
    }

    public function paymentDetails()
    {
        return $this->hasMany(PaymentDetail::class);
    }

    public function paymentAllocations()
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
