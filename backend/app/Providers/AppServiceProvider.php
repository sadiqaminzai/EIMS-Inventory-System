<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use App\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Allow superadmin to bypass all permission checks regardless of team/tenant
        Gate::before(function ($user, string $ability) {
            if (!$user) {
                return null;
            }
            $isSuperAdmin = Role::withoutGlobalScope('tenant')
                ->where('id', $user->role_id)
                ->where('name', 'superadmin')
                ->exists();
            return $isSuperAdmin ? true : null;
        });
    }
}
