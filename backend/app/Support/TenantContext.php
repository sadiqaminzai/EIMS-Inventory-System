<?php

namespace App\Support;

class TenantContext
{
    protected static ?int $tenantId = null;

    public static function setTenantId(?int $tenantId): void
    {
        self::$tenantId = $tenantId;
    }

    public static function getTenantId(): ?int
    {
        return self::$tenantId;
    }
}
