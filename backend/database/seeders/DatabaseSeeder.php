<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $tenant = Tenant::firstOrCreate([
            'slug' => 'default',
        ], [
            'name' => 'Default Tenant',
            'is_active' => true,
        ]);

        $superAdminRole = Role::firstOrCreate([
            'tenant_id' => $tenant->id,
            'name' => 'superadmin',
        ], [
            'description' => 'Super Administrator',
            'permissions' => [
                'manage_products' => true,
                'manage_inventory' => true,
                'manage_orders' => true,
                'manage_users' => true,
            ],
        ]);

        $adminRole = Role::firstOrCreate([
            'tenant_id' => $tenant->id,
            'name' => 'admin',
        ], [
            'description' => 'Administrator',
            'permissions' => [
                'manage_products' => true,
                'manage_inventory' => true,
                'manage_orders' => true,
                'manage_users' => true,
            ],
        ]);

        $accountantRole = Role::firstOrCreate([
            'tenant_id' => $tenant->id,
            'name' => 'accountant',
        ], [
            'description' => 'Accountant',
            'permissions' => [
                'manage_orders' => true,
            ],
        ]);

        User::updateOrCreate([
            'tenant_id' => $tenant->id,
            'email' => 'superadmin@example.com',
        ], [
            'name' => 'Super Admin',
            'password' => Hash::make('password'),
            'role_id' => $superAdminRole->id,
            'is_active' => true,
        ]);

        User::updateOrCreate([
            'tenant_id' => $tenant->id,
            'email' => 'admin@example.com',
        ], [
            'name' => 'Admin',
            'password' => Hash::make('password'),
            'role_id' => $adminRole->id,
            'is_active' => true,
        ]);

        User::updateOrCreate([
            'tenant_id' => $tenant->id,
            'email' => 'accountant@example.com',
        ], [
            'name' => 'Accountant',
            'password' => Hash::make('password'),
            'role_id' => $accountantRole->id,
            'is_active' => true,
        ]);
    }
}
