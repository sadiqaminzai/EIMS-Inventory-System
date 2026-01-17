<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MediaController;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/media/{path}', [MediaController::class, 'show'])
    ->where('path', '.*');
