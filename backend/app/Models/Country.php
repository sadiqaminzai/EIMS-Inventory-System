<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Country extends Model
{
    use HasFactory, HasTenant;

    protected $fillable = [
        'tenant_id',
        'name',
        'details',
        'status',
        'created_by',
        'updated_by',
    ];
}
