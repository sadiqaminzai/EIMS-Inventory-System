<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\AccountTransactionController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CountryController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\TenantProfileController;
use App\Http\Controllers\Api\V1\TransactionController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\PrintSettingsController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware(['api'])->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('tenant');

    Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/user', [AuthController::class, 'profile']);
        Route::put('/profile', [ProfileController::class, 'update']);

        Route::get('/settings/print', [PrintSettingsController::class, 'show']);
        Route::put('/settings/print', [PrintSettingsController::class, 'update']);

        Route::get('/settings/tenant', [TenantProfileController::class, 'show']);
        Route::put('/settings/tenant', [TenantProfileController::class, 'update']);

        Route::get('/products', [ProductController::class, 'index'])
            ->middleware('permission:manage_products');
        Route::get('/products/{product}', [ProductController::class, 'show'])
            ->middleware('permission:manage_products');
        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('permission:manage_products');
        Route::put('/products/{product}', [ProductController::class, 'update'])
            ->middleware('permission:manage_products');
        Route::delete('/products/{product}', [ProductController::class, 'destroy'])
            ->middleware('permission:manage_products');
        Route::get('/products/{product}/batches', [ProductController::class, 'batches'])
            ->middleware('permission:manage_inventory');

        Route::get('/brands', [BrandController::class, 'index'])->middleware('permission:manage_products');
        Route::post('/brands', [BrandController::class, 'store'])->middleware('permission:manage_products');
        Route::put('/brands/{brand}', [BrandController::class, 'update'])->middleware('permission:manage_products');
        Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->middleware('permission:manage_products');

        Route::get('/countries', [CountryController::class, 'index'])->middleware('permission:manage_products');
        Route::post('/countries', [CountryController::class, 'store'])->middleware('permission:manage_products');
        Route::put('/countries/{country}', [CountryController::class, 'update'])->middleware('permission:manage_products');
        Route::delete('/countries/{country}', [CountryController::class, 'destroy'])->middleware('permission:manage_products');

        Route::get('/categories', [CategoryController::class, 'index'])->middleware('permission:manage_products');
        Route::post('/categories', [CategoryController::class, 'store'])->middleware('permission:manage_products');
        Route::put('/categories/{category}', [CategoryController::class, 'update'])->middleware('permission:manage_products');
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('permission:manage_products');

        Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('permission:manage_inventory');
        Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('permission:manage_inventory');
        Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:manage_inventory');
        Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:manage_inventory');

        Route::get('/customers', [CustomerController::class, 'index'])->middleware('permission:manage_inventory');
        Route::post('/customers', [CustomerController::class, 'store'])->middleware('permission:manage_inventory');
        Route::put('/customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:manage_inventory');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->middleware('permission:manage_inventory');

        Route::get('/users', [UserController::class, 'index'])->middleware('permission:manage_users');
        Route::post('/users', [UserController::class, 'store'])->middleware('permission:manage_users');
        Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:manage_users');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:manage_users');

        Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:manage_users');
        Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:manage_users');
        Route::put('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:manage_users');
        Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:manage_users');

        Route::get('/tenants', [TenantController::class, 'index'])->middleware('permission:manage_users');
        Route::post('/tenants', [TenantController::class, 'store'])->middleware('permission:manage_users');
        Route::put('/tenants/{tenant}', [TenantController::class, 'update'])->middleware('permission:manage_users');
        Route::delete('/tenants/{tenant}', [TenantController::class, 'destroy'])->middleware('permission:manage_users');

        Route::get('/accounts', [AccountController::class, 'index'])->middleware('permission:manage_orders');
        Route::post('/accounts', [AccountController::class, 'store'])->middleware('permission:manage_orders');
        Route::put('/accounts/{account}', [AccountController::class, 'update'])->middleware('permission:manage_orders');
        Route::delete('/accounts/{account}', [AccountController::class, 'destroy'])->middleware('permission:manage_orders');

        Route::get('/account-transactions', [AccountTransactionController::class, 'index'])->middleware('permission:manage_orders');
        Route::post('/account-transactions', [AccountTransactionController::class, 'store'])->middleware('permission:manage_orders');
        Route::put('/account-transactions/{accountTransaction}', [AccountTransactionController::class, 'update'])->middleware('permission:manage_orders');
        Route::delete('/account-transactions/{accountTransaction}', [AccountTransactionController::class, 'destroy'])->middleware('permission:manage_orders');

        Route::post('/transactions/purchase', [TransactionController::class, 'purchase'])
            ->middleware('permission:manage_inventory');
        Route::put('/transactions/purchase/{order}', [TransactionController::class, 'updatePurchase'])
            ->middleware('permission:manage_inventory');
        Route::delete('/transactions/purchase/{order}', [TransactionController::class, 'deletePurchase'])
            ->middleware('permission:manage_inventory');
        Route::post('/transactions/sale', [TransactionController::class, 'sale'])
            ->middleware('permission:manage_orders');
        Route::put('/transactions/sale/{order}', [TransactionController::class, 'updateSale'])
            ->middleware('permission:manage_orders');
        Route::delete('/transactions/sale/{order}', [TransactionController::class, 'deleteSale'])
            ->middleware('permission:manage_orders');
        Route::post('/transactions/return-in', [TransactionController::class, 'returnIn'])
            ->middleware('permission:manage_orders');
        Route::put('/transactions/return-in/{order}', [TransactionController::class, 'updateReturnIn'])
            ->middleware('permission:manage_orders');
        Route::delete('/transactions/return-in/{order}', [TransactionController::class, 'deleteReturnIn'])
            ->middleware('permission:manage_orders');
        Route::get('/transactions', [TransactionController::class, 'history'])
            ->middleware('permission:manage_orders');
    });
});
