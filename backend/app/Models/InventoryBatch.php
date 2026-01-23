<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryBatch extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'product_id',
        'supplier_id',
        'batch_no',
        'cost_price',
        'quantity_initial',
        'quantity_remaining',
        'received_date',
        'expiry_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'received_date' => 'date',
        'expiry_date' => 'date',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
