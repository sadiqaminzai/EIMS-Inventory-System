<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentDetail extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'payment_id',
        'customer_id',
        'debit_amount',
        'credit_amount',
        'balance_amount',
        'remarks',
        'created_by',
        'updated_by',
    ];

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
