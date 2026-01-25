<?php

namespace App\Support;

use Spatie\Permission\Contracts\PermissionsTeamResolver;

class TenantTeamResolver implements PermissionsTeamResolver
{
    public function getPermissionsTeamId(): int|string|null
    {
        return TenantContext::getTenantId();
    }

    public function setPermissionsTeamId($id): void
    {
        TenantContext::setTenantId($id ? (int) $id : null);
    }
}
