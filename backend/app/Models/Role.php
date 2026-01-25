<?php

namespace App\Models;

use App\Models\Concerns\HasTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use HasFactory, HasTenant;

    protected string $guard_name = 'web';

    protected $fillable = [
        'tenant_id',
        'name',
        'description',
        'guard_name',
        'created_by',
        'updated_by',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
