<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory, HasTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'order_id',
        'product_id',
        'batch_no',
        'exp_date',
        'quantity',
        'bonus',
        'discount',
        'discount_percent',
        'tax',
        'tax_percent',
        'unit_price',
        'total_price',
        'created_by',
        'updated_by',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
