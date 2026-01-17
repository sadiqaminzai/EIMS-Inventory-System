<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'category_id',
        'brand_id',
        'country_id',
        'model_no',
        'sku',
        'name',
        'description',
        'unit_of_measure',
        'min_stock_level',
        'reorder_point',
        'image_url',
        'photo',
        'cost_price',
        'sale_price',
        'status',
        'stock_qty',
        'is_active',
        'created_by',
        'updated_by',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function batches()
    {
        return $this->hasMany(InventoryBatch::class);
    }
}
