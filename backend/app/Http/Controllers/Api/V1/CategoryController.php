<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::query()->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', Rule::unique('categories', 'slug')->where('tenant_id', TenantContext::getTenantId())],
            'parent_id' => ['nullable', 'integer'],
        ]);

        $category = Category::create(array_merge($data, [
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name' => ['required', 'string'],
            'slug' => ['required', 'string', Rule::unique('categories', 'slug')->where('tenant_id', TenantContext::getTenantId())->ignore($category->id)],
            'parent_id' => ['nullable', 'integer'],
        ]);

        $category->update(array_merge($data, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($category);
    }

    public function destroy(Category $category)
    {
        $category->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
