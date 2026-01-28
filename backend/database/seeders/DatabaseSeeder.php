<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantContext;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        TenantContext::setIgnoreTenantScope(true);
        $tenant = Tenant::firstOrCreate([
            'slug' => 'default',
        ], [
            'name' => 'Default Tenant',
            'is_active' => true,
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        DB::table('model_has_permissions')->delete();
        DB::table('model_has_roles')->delete();
        DB::table('role_has_permissions')->delete();
        Permission::query()->delete();
        Role::query()->delete();
        User::query()->delete();

        $permissions = [
            'manage_products',
            'manage_inventory',
            'manage_orders',
            'manage_users',
            'inventory.view',
            'partners.view',
            'invoices.view',
            'product.view', 'product.create', 'product.edit', 'product.delete', 'product.search', 'product.export', 'product.print',
            'brand.view', 'brand.create', 'brand.edit', 'brand.delete', 'brand.search', 'brand.export', 'brand.print',
            'country.view', 'country.create', 'country.edit', 'country.delete', 'country.search', 'country.export', 'country.print',
            'supplier.view', 'supplier.create', 'supplier.edit', 'supplier.delete', 'supplier.search', 'supplier.export', 'supplier.print',
            'customer.view', 'customer.create', 'customer.edit', 'customer.delete', 'customer.search', 'customer.export', 'customer.print',
            'purchase.view', 'purchase.create', 'purchase.edit', 'purchase.delete', 'purchase.search', 'purchase.export', 'purchase.print',
            'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.search', 'sales.export', 'sales.print',
            'return_in.view', 'return_in.create', 'return_in.edit', 'return_in.delete', 'return_in.search', 'return_in.export', 'return_in.print',
            'return_out.view', 'return_out.create', 'return_out.edit', 'return_out.delete', 'return_out.search', 'return_out.export', 'return_out.print',
            'account.view',
            'account.transactions.view', 'account.transactions.create', 'account.transactions.edit', 'account.transactions.delete', 'account.transactions.search', 'account.transactions.export', 'account.transactions.print',
            'account.accounts.view', 'account.accounts.create', 'account.accounts.edit', 'account.accounts.delete', 'account.accounts.search', 'account.accounts.export', 'account.accounts.print',
            'account.transaction.payment', 'account.transaction.income', 'account.transaction.expense', 'account.transaction.transfer',
            'account.transaction.save', 'account.transaction.cancel',
            'settings.view', 'settings.edit', 'settings.print',
            'settings.clients', 'settings.general', 'settings.permissions', 'settings.profile', 'settings.roles', 'settings.users',
            'user.view', 'user.create', 'user.edit', 'user.delete', 'user.search', 'user.export', 'user.print',
            'role.view', 'role.create', 'role.edit', 'role.delete', 'role.search', 'role.export', 'role.print',
            'permission.view', 'permission.edit', 'permission.search', 'permission.export',
            'client.view', 'client.create', 'client.edit', 'client.delete', 'client.search', 'client.export', 'client.print',
        ];

        $permissionModels = collect($permissions)
            ->map(fn ($name) => Permission::findOrCreate($name, 'web'));

        $superAdminRole = Role::firstOrCreate([
            'tenant_id' => $tenant->id,
            'name' => 'superadmin',
        ], [
            'description' => 'Super Administrator',
            'guard_name' => 'web',
        ]);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->id);
        $superAdminRole->syncPermissions($permissionModels);

        $superAdmin = User::updateOrCreate([
            'tenant_id' => $tenant->id,
            'email' => 'superadmin@softcareitsolution.com',
        ], [
            'name' => 'Super Admin',
            'password' => Hash::make('password'),
            'must_change_password' => true,
            'role_id' => $superAdminRole->id,
            'is_active' => true,
        ]);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->id);
        $superAdmin->syncRoles([$superAdminRole]);
    }
}
