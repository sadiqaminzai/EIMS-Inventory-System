<?php

namespace App\Support;

class TenantContext
{
    protected static ?int $tenantId = null;
    protected static bool $ignoreTenantScope = false;

    public static function setTenantId(?int $tenantId): void
    {
        self::$tenantId = $tenantId;
    }

    public static function setIgnoreTenantScope(bool $ignore): void
    {
        self::$ignoreTenantScope = $ignore;
    }

    public static function getTenantId(): ?int
    {
        return self::$tenantId;
    }

    public static function shouldIgnoreTenantScope(): bool
    {
        return self::$ignoreTenantScope;
    }
}
