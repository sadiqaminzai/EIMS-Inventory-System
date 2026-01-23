<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\InventoryBatch;
use App\Models\Product;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query()
            ->select('products.*', DB::raw('COALESCE(view_product_stock.current_stock, 0) as current_stock'))
            ->leftJoin('view_product_stock', function ($join) {
                $join->on('view_product_stock.product_id', '=', 'products.id')
                    ->on('view_product_stock.tenant_id', '=', 'products.tenant_id');
            });

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.sku', 'like', "%{$search}%");
            });
        }

        $items = $query->paginate(15);

        $items->getCollection()->transform(function ($product) {
            return $this->transformProduct($product);
        });

        return $items;
    }

    public function show(Product $product)
    {
        return response()->json($this->transformProduct($product));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'country_id' => ['nullable', 'integer'],
            'sku' => ['nullable', 'string', Rule::unique('products', 'sku')->where('tenant_id', TenantContext::getTenantId())],
            'model_no' => ['nullable', 'string'],
            'name' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'unit_of_measure' => ['nullable', 'string'],
            'min_stock_level' => ['nullable', 'integer'],
            'reorder_point' => ['nullable', 'integer'],
            'image_url' => ['nullable', 'string'],
            'photo' => ['nullable', 'file', 'image', 'max:2048'],
            'cost_price' => ['nullable', 'numeric'],
            'sale_price' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('products', 'public');
            $data['photo'] = Storage::disk('public')->url($path);
        } else {
            unset($data['photo']);
        }

        $product = Product::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($this->transformProduct($product), 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'country_id' => ['nullable', 'integer'],
            'sku' => ['nullable', 'string', Rule::unique('products', 'sku')->where('tenant_id', TenantContext::getTenantId())->ignore($product->id)],
            'model_no' => ['nullable', 'string'],
            'name' => ['required', 'string'],
            'description' => ['nullable', 'string'],
            'unit_of_measure' => ['nullable', 'string'],
            'min_stock_level' => ['nullable', 'integer'],
            'reorder_point' => ['nullable', 'integer'],
            'image_url' => ['nullable', 'string'],
            'photo' => ['nullable', 'file', 'image', 'max:2048'],
            'cost_price' => ['nullable', 'numeric'],
            'sale_price' => ['nullable', 'numeric'],
            'status' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('products', 'public');
            $data['photo'] = Storage::disk('public')->url($path);
        } else {
            unset($data['photo']);
        }

        $product->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($this->transformProduct($product));
    }

    public function destroy(Product $product)
    {
        $product->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function batches(Product $product)
    {
        $batches = InventoryBatch::query()
            ->where('product_id', $product->id)
            ->where('quantity_remaining', '>', 0)
            ->orderByRaw('batch_no IS NULL DESC')
            ->orderBy('received_date')
            ->get();

        return response()->json($batches);
    }

    protected function transformProduct(Product $product): array
    {
        return [
            'id' => $product->id,
            'model_no' => $product->model_no ?? $product->sku ?? '',
            'name' => $product->name,
            'description' => $product->description,
            'photo' => $product->photo ?? $product->image_url,
            'cost_price' => (float) ($product->cost_price ?? 0),
            'sale_price' => (float) ($product->sale_price ?? 0),
            'brand_id' => $product->brand_id,
            'country_id' => $product->country_id,
            'status' => $product->status ?? ($product->is_active ? 'active' : 'inactive'),
            'stock_qty' => (int) ($product->current_stock ?? 0),
            'created_by' => $product->created_by,
            'updated_by' => $product->updated_by,
            'created_at' => $product->created_at,
            'updated_at' => $product->updated_at,
        ];
    }
}
