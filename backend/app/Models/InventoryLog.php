<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryLog extends Model
{
    use HasFactory, HasTenant;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'transaction_type',
        'order_item_id',
        'batch_id',
        'quantity_change',
        'running_balance',
        'created_by',
        'updated_by',
    ];

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function batch()
    {
        return $this->belongsTo(InventoryBatch::class, 'batch_id');
    }
}
