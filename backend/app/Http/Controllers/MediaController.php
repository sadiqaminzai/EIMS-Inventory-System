<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function show(Request $request, string $path)
    {
        $disk = Storage::disk('public');

        if (!$disk->exists($path)) {
            abort(404);
        }

        return $disk->response($path, null, [
            'Access-Control-Allow-Origin' => '*',
        ]);
    }
}
