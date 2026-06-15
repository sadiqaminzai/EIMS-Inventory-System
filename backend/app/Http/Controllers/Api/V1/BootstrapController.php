<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Country;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;

class BootstrapController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $role = Role::withoutGlobalScope('tenant')->with('permissions')->find($user->role_id);
        $roleName = strtolower((string) ($role?->name ?? ''));
        $isSuperAdmin = str_contains($roleName, 'super');
        $permissions = $role?->permissions->pluck('name')->values()->all() ?? [];
        $canViewUsers = $isSuperAdmin || in_array('user.view', $permissions, true) || in_array('manage_users', $permissions, true);

        return response()->json([
            'tenant' => Tenant::find($user->tenant_id),
            'printSettings' => $this->printSettings($user->tenant_id),
            'brands' => $this->canAny($isSuperAdmin, $permissions, ['manage_products', 'brand.view']) ? Brand::query()->orderBy('name')->get() : [],
            'categories' => $this->canAny($isSuperAdmin, $permissions, ['manage_products', 'product.view']) ? Category::query()->orderBy('name')->get() : [],
            'countries' => $this->canAny($isSuperAdmin, $permissions, ['manage_products', 'country.view']) ? Country::query()->orderBy('name')->get() : [],
            'products' => $this->canAny($isSuperAdmin, $permissions, ['manage_products', 'product.view']) ? $this->products() : $this->emptyPaginator(),
            'suppliers' => $this->canAny($isSuperAdmin, $permissions, ['manage_inventory', 'supplier.view']) ? Supplier::query()->orderBy('name')->get() : [],
            'customers' => $this->canAny($isSuperAdmin, $permissions, ['manage_inventory', 'customer.view']) ? Customer::query()->orderBy('name')->get() : [],
            'accounts' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'account.accounts.view']) ? Account::query()->orderBy('name')->get() : [],
            'transactions' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'account.transactions.view']) ? AccountTransaction::query()->orderByDesc('date')->get() : [],
            'purchases' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'manage_inventory', 'purchase.view']) ? $this->orders('purchase') : $this->emptyPaginator(),
            'sales' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'sales.view']) ? $this->orders('sale') : $this->emptyPaginator(),
            'returns' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'return_in.view']) ? $this->orders('return_in') : $this->emptyPaginator(),
            'returnOuts' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'return_out.view']) ? $this->orders('return_out') : $this->emptyPaginator(),
            'quotations' => $this->canAny($isSuperAdmin, $permissions, ['manage_orders', 'sales.view']) ? $this->orders('quotation') : $this->emptyPaginator(),
            'users' => $canViewUsers ? User::query()->with(['role', 'tenant'])->orderBy('name')->get() : [],
            'roles' => $this->canAny($isSuperAdmin, $permissions, ['manage_users', 'role.view']) ? $this->roles($isSuperAdmin) : [],
            'permissions' => $this->canAny($isSuperAdmin, $permissions, ['manage_users', 'permission.view']) ? Permission::query()->orderBy('name')->get() : [],
            'clients' => $isSuperAdmin ? Tenant::query()->orderBy('name')->get() : [],
        ]);
    }

    protected function canAny(bool $isSuperAdmin, array $permissions, array $needed): bool
    {
        return $isSuperAdmin || count(array_intersect($needed, $permissions)) > 0;
    }

    protected function emptyPaginator(): array
    {
        return [
            'data' => [],
            'current_page' => 1,
            'per_page' => 0,
            'total' => 0,
            'last_page' => 1,
        ];
    }

    protected function printSettings(?int $tenantId): array
    {
        return Cache::get("print_settings_{$tenantId}", [
            'show_product_image' => true,
            'show_header_logo' => true,
            'show_footer_signature' => true,
            'show_batch' => true,
            'show_exp_date' => true,
            'show_bonus' => true,
        ]);
    }

    protected function products()
    {
        $items = Product::query()
            ->select('products.*', DB::raw('COALESCE(view_product_stock.current_stock, 0) as current_stock'))
            ->leftJoin('view_product_stock', function ($join) {
                $join->on('view_product_stock.product_id', '=', 'products.id')
                    ->on('view_product_stock.tenant_id', '=', 'products.tenant_id');
            })
            ->paginate(50);

        $items->getCollection()->transform(fn (Product $product) => [
            'id' => $product->id,
            'serial_no' => $product->serial_no,
            'model_no' => $product->model_no ?? $product->sku ?? '',
            'category_id' => $product->category_id,
            'name' => $product->name,
            'description' => $product->description,
            'photo' => $product->photo ?? $product->image_url,
            'cost_price' => (float) ($product->cost_price ?? 0),
            'sale_price' => (float) ($product->sale_price ?? 0),
            'brand_id' => $product->brand_id,
            'country_id' => $product->country_id,
            'unit_of_measure' => $product->unit_of_measure,
            'status' => $product->status ?? ($product->is_active ? 'active' : 'inactive'),
            'stock_qty' => (int) ($product->current_stock ?? 0),
            'created_by' => $product->created_by,
            'updated_by' => $product->updated_by,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ]);

        return $items;
    }

    protected function orders(string $type)
    {
        return Order::query()
            ->with([
                'items',
                'paymentAllocations' => fn ($query) => $query->orderBy('id')->with(['payment:id,serial_no,date']),
                'invoiceAdjustments' => fn ($query) => $query->orderBy('id'),
            ])
            ->where('transaction_type', $type)
            ->orderByDesc('transaction_date')
            ->paginate(15);
    }

    protected function roles(bool $isSuperAdmin)
    {
        $query = $isSuperAdmin ? Role::withoutGlobalScope('tenant') : Role::query();

        return $query
            ->with(['permissions', 'tenant'])
            ->orderBy('name')
            ->get()
            ->map(function (Role $role) {
                $permMap = [];
                foreach ($role->permissions->pluck('name')->values()->all() as $name) {
                    $permMap[$name] = true;
                }

                return array_merge($role->toArray(), [
                    'permissions' => $permMap,
                    'tenant_name' => $role->tenant?->name,
                ]);
            });
    }
}
