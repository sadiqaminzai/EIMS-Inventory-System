<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class PermissionController extends Controller
{
    public function index()
    {
        $defaults = [
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

        foreach ($defaults as $name) {
            Permission::findOrCreate($name, 'web');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return Permission::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('permissions', 'name')],
        ]);

        $permission = Permission::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json($permission, 201);
    }

    public function update(Request $request, Permission $permission)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('permissions', 'name')->ignore($permission->id)],
        ]);

        $permission->update([
            'name' => $data['name'],
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json($permission);
    }

    public function destroy(Permission $permission)
    {
        $permission->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['message' => 'Deleted']);
    }
}
