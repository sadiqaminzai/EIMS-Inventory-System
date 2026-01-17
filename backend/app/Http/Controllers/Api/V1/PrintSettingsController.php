<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PrintSettingsController extends Controller
{
    public function show(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        return Cache::get("print_settings_{$tenantId}", [
            'show_product_image' => true,
            'show_header_logo' => true,
            'show_footer_signature' => true,
            'show_batch' => true,
            'show_exp_date' => true,
            'show_bonus' => true,
        ]);
    }

    public function update(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        $data = $request->validate([
            'show_product_image' => ['required', 'boolean'],
            'show_header_logo' => ['required', 'boolean'],
            'show_footer_signature' => ['required', 'boolean'],
            'show_batch' => ['nullable', 'boolean'],
            'show_exp_date' => ['nullable', 'boolean'],
            'show_bonus' => ['nullable', 'boolean'],
        ]);

        Cache::put("print_settings_{$tenantId}", $data);

        return response()->json($data);
    }
}
