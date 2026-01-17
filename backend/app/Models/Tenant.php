<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'is_active',
        'logo',
        'address',
        'phone',
        'email',
        'website',
        'license_no',
        'license_issue',
        'license_expiry',
        'license_type',
        'max_users',
        'license_status',
        'created_by',
        'updated_by',
    ];
}
