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
        'name',
        'email',
        'phone',
        'billing_address',
        'shipping_address',
        'status',
        'created_by',
        'updated_by',
    ];
}
