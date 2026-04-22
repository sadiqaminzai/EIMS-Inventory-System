<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\AccountTransactionCategoryController;
use App\Http\Controllers\Api\V1\AccountTransactionController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\CountryController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\CustomerReportController;
use App\Http\Controllers\Api\V1\InvoiceAdjustmentController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SupplierReportController;
use App\Http\Controllers\Api\V1\TenantController;
use App\Http\Controllers\Api\V1\TenantProfileController;
use App\Http\Controllers\Api\V1\TransactionController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\PrintSettingsController;
use App\Http\Controllers\Api\V1\PaymentController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\BackupController;
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

        // Backup routes
        Route::get('/settings/backups', [BackupController::class, 'index'])->middleware('permission:manage_settings|settings.backup');
        Route::post('/settings/backups', [BackupController::class, 'store'])->middleware('permission:manage_settings|settings.backup');
        Route::get('/settings/backups/{backup}/download', [BackupController::class, 'download'])->middleware('permission:manage_settings|settings.backup');
        Route::delete('/settings/backups/{backup}', [BackupController::class, 'destroy'])->middleware('permission:manage_settings|settings.backup');
        Route::post('/settings/backups/{backup}/restore', [BackupController::class, 'restore'])->middleware('permission:manage_settings|settings.backup');
        Route::get('/settings/backup-settings', [BackupController::class, 'getSettings'])->middleware('permission:manage_settings|settings.backup');
        Route::put('/settings/backup-settings', [BackupController::class, 'updateSettings'])->middleware('permission:manage_settings|settings.backup');

        Route::get('/products', [ProductController::class, 'index'])
            ->middleware('permission:manage_products|product.view');
        Route::get('/products/{product}', [ProductController::class, 'show'])
            ->middleware('permission:manage_products|product.view');
        Route::post('/products', [ProductController::class, 'store'])
            ->middleware('permission:manage_products|product.create');
        Route::put('/products/{product}', [ProductController::class, 'update'])
            ->middleware('permission:manage_products|product.edit');
        Route::delete('/products/{product}', [ProductController::class, 'destroy'])
            ->middleware('permission:manage_products|product.delete');
        Route::get('/products/{product}/batches', [ProductController::class, 'batches'])
            ->middleware('permission:manage_inventory|inventory.view');

        Route::get('/brands', [BrandController::class, 'index'])->middleware('permission:manage_products|brand.view');
        Route::post('/brands', [BrandController::class, 'store'])->middleware('permission:manage_products|brand.create');
        Route::put('/brands/{brand}', [BrandController::class, 'update'])->middleware('permission:manage_products|brand.edit');
        Route::delete('/brands/{brand}', [BrandController::class, 'destroy'])->middleware('permission:manage_products|brand.delete');

        Route::get('/countries', [CountryController::class, 'index'])->middleware('permission:manage_products|country.view');
        Route::post('/countries', [CountryController::class, 'store'])->middleware('permission:manage_products|country.create');
        Route::put('/countries/{country}', [CountryController::class, 'update'])->middleware('permission:manage_products|country.edit');
        Route::delete('/countries/{country}', [CountryController::class, 'destroy'])->middleware('permission:manage_products|country.delete');

        Route::get('/categories', [CategoryController::class, 'index'])->middleware('permission:manage_products|product.view');
        Route::post('/categories', [CategoryController::class, 'store'])->middleware('permission:manage_products|product.create');
        Route::put('/categories/{category}', [CategoryController::class, 'update'])->middleware('permission:manage_products|product.edit');
        Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->middleware('permission:manage_products|product.delete');

        Route::get('/suppliers', [SupplierController::class, 'index'])->middleware('permission:manage_inventory|supplier.view');
        Route::get('/suppliers/pending-summary', [SupplierController::class, 'pendingSummary'])->middleware('permission:manage_inventory|supplier.view');
        Route::get('/suppliers/{supplier}/ledger', [SupplierController::class, 'ledger'])->middleware('permission:manage_inventory|supplier.view');
        Route::post('/suppliers', [SupplierController::class, 'store'])->middleware('permission:manage_inventory|supplier.create');
        Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->middleware('permission:manage_inventory|supplier.edit');
        Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->middleware('permission:manage_inventory|supplier.delete');

        Route::get('/customers', [CustomerController::class, 'index'])->middleware('permission:manage_inventory|customer.view');
        Route::get('/customers/pending-summary', [CustomerController::class, 'pendingSummary'])->middleware('permission:manage_inventory|customer.view');
        Route::get('/customers/{customer}/ledger', [CustomerController::class, 'ledger'])->middleware('permission:manage_inventory|customer.view');
        Route::post('/customers', [CustomerController::class, 'store'])->middleware('permission:manage_inventory|customer.create');
        Route::put('/customers/{customer}', [CustomerController::class, 'update'])->middleware('permission:manage_inventory|customer.edit');
        Route::delete('/customers/{customer}', [CustomerController::class, 'destroy'])->middleware('permission:manage_inventory|customer.delete');

        Route::get('/users', [UserController::class, 'index'])->middleware('permission:manage_users|user.view');
        Route::post('/users', [UserController::class, 'store'])->middleware('permission:manage_users|user.create');
        Route::put('/users/{user}', [UserController::class, 'update'])->middleware('permission:manage_users|user.edit');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->middleware('permission:manage_users|user.delete');

        Route::get('/roles', [RoleController::class, 'index'])->middleware('permission:manage_users|role.view');
        Route::post('/roles', [RoleController::class, 'store'])->middleware('permission:manage_users|role.create');
        Route::put('/roles/{role}', [RoleController::class, 'update'])->middleware('permission:manage_users|role.edit');
        Route::delete('/roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:manage_users|role.delete');

        Route::get('/permissions', [PermissionController::class, 'index'])->middleware('permission:manage_users|permission.view');
        Route::post('/permissions', [PermissionController::class, 'store'])->middleware('permission:manage_users|permission.view');
        Route::put('/permissions/{permission}', [PermissionController::class, 'update'])->middleware('permission:manage_users|permission.edit');
        Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy'])->middleware('permission:manage_users|permission.view');

        Route::get('/tenants', [TenantController::class, 'index'])->middleware('superadmin');
        Route::post('/tenants', [TenantController::class, 'store'])->middleware('superadmin');
        Route::put('/tenants/{tenant}', [TenantController::class, 'update'])->middleware('superadmin');
        Route::delete('/tenants/{tenant}', [TenantController::class, 'destroy'])->middleware('superadmin');

        Route::get('/accounts', [AccountController::class, 'index'])->middleware('permission:manage_orders|account.accounts.view');
        Route::post('/accounts', [AccountController::class, 'store'])->middleware('permission:manage_orders|account.accounts.create');
        Route::put('/accounts/{account}', [AccountController::class, 'update'])->middleware('permission:manage_orders|account.accounts.edit');
        Route::delete('/accounts/{account}', [AccountController::class, 'destroy'])->middleware('permission:manage_orders|account.accounts.delete');

        Route::get('/account-transactions', [AccountTransactionController::class, 'index'])->middleware('permission:manage_orders|account.transactions.view');
        Route::post('/account-transactions', [AccountTransactionController::class, 'store'])->middleware('permission:manage_orders|account.transactions.create');
        Route::put('/account-transactions/{accountTransaction}', [AccountTransactionController::class, 'update'])->middleware('permission:manage_orders|account.transactions.edit');
        Route::delete('/account-transactions/{accountTransaction}', [AccountTransactionController::class, 'destroy'])->middleware('permission:manage_orders|account.transactions.delete');

        Route::get('/account-transaction-categories', [AccountTransactionCategoryController::class, 'index'])->middleware('permission:manage_orders|account.transactions.view');
        Route::post('/account-transaction-categories', [AccountTransactionCategoryController::class, 'store'])->middleware('permission:manage_orders|account.transactions.create');
        Route::put('/account-transaction-categories/{accountTransactionCategory}', [AccountTransactionCategoryController::class, 'update'])->middleware('permission:manage_orders|account.transactions.edit');
        Route::delete('/account-transaction-categories/{accountTransactionCategory}', [AccountTransactionCategoryController::class, 'destroy'])->middleware('permission:manage_orders|account.transactions.delete');

        Route::get('/payments', [PaymentController::class, 'index'])->middleware('permission:manage_orders|purchase.view|sales.view');
        Route::get('/payments/{payment}', [PaymentController::class, 'show'])->middleware('permission:manage_orders|purchase.view|sales.view');
        Route::get('/payments/serial/{serial}', [PaymentController::class, 'showBySerial'])->middleware('permission:manage_orders|purchase.view|sales.view');
        Route::post('/payments', [PaymentController::class, 'store'])->middleware('permission:manage_orders|purchase.create|sales.create');
        Route::put('/payments/{payment}', [PaymentController::class, 'update'])->middleware('permission:manage_orders|purchase.edit|sales.edit');
        Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])->middleware('permission:manage_orders|purchase.delete|sales.delete');

        Route::get('/invoice-adjustments', [InvoiceAdjustmentController::class, 'index'])->middleware('permission:manage_orders|sales.view');
        Route::post('/invoice-adjustments', [InvoiceAdjustmentController::class, 'store'])->middleware('permission:manage_orders|sales.edit');
        Route::delete('/invoice-adjustments/{invoiceAdjustment}', [InvoiceAdjustmentController::class, 'destroy'])->middleware('permission:manage_orders|sales.edit');

        Route::get('/reports/customer-aging', [CustomerReportController::class, 'aging'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/supplier-aging', [SupplierReportController::class, 'aging'])->middleware('permission:manage_inventory|purchase.view|report.view|reports.view');

        Route::get('/reports/customer-wise', [ReportController::class, 'customerWise'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/customer-wise/export', [ReportController::class, 'customerWiseExport'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/customer-wise/{customerId}/invoices', [ReportController::class, 'customerWiseInvoices'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/customer-wise/{customerId}/invoices/export', [ReportController::class, 'customerWiseInvoicesExport'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');

        Route::get('/reports/brand-wise', [ReportController::class, 'brandWise'])->middleware('permission:manage_orders|sales.view|invoices.view|manage_products|brand.view|report.view|reports.view');
        Route::get('/reports/brand-wise/export', [ReportController::class, 'brandWiseExport'])->middleware('permission:manage_orders|sales.view|invoices.view|manage_products|brand.view|report.view|reports.view');

        Route::get('/reports/product-wise', [ReportController::class, 'productWise'])->middleware('permission:manage_orders|sales.view|invoices.view|manage_products|product.view|report.view|reports.view');
        Route::get('/reports/product-wise/export', [ReportController::class, 'productWiseExport'])->middleware('permission:manage_orders|sales.view|invoices.view|manage_products|product.view|report.view|reports.view');

        Route::get('/reports/batch-wise', [ReportController::class, 'batchWise'])->middleware('permission:manage_inventory|inventory.view|purchase.view|report.view|reports.view');
        Route::get('/reports/batch-wise/export', [ReportController::class, 'batchWiseExport'])->middleware('permission:manage_inventory|inventory.view|purchase.view|report.view|reports.view');

        Route::get('/reports/expiry-wise', [ReportController::class, 'expiryWise'])->middleware('permission:manage_inventory|inventory.view|purchase.view|report.view|reports.view');
        Route::get('/reports/expiry-wise/export', [ReportController::class, 'expiryWiseExport'])->middleware('permission:manage_inventory|inventory.view|purchase.view|report.view|reports.view');

        Route::get('/reports/product-batch-wise', [ReportController::class, 'productBatchWise'])->middleware('permission:manage_inventory|inventory.view|manage_products|product.view|report.view|reports.view');
        Route::get('/reports/product-batch-wise/export', [ReportController::class, 'productBatchWiseExport'])->middleware('permission:manage_inventory|inventory.view|manage_products|product.view|report.view|reports.view');

        Route::get('/reports/date-wise-sales', [ReportController::class, 'dateWiseSales'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/date-wise-sales/export', [ReportController::class, 'dateWiseSalesExport'])->middleware('permission:manage_orders|sales.view|invoices.view|report.view|reports.view');

        Route::get('/reports/sales-and-stock', [ReportController::class, 'salesAndStock'])->middleware('permission:manage_inventory|inventory.view|manage_orders|sales.view|invoices.view|report.view|reports.view');
        Route::get('/reports/sales-and-stock/export', [ReportController::class, 'salesAndStockExport'])->middleware('permission:manage_inventory|inventory.view|manage_orders|sales.view|invoices.view|report.view|reports.view');

        Route::get('/reports/available-stock', [ReportController::class, 'availableStock'])->middleware('permission:manage_inventory|inventory.view|report.view|reports.view');
        Route::get('/reports/available-stock/export', [ReportController::class, 'availableStockExport'])->middleware('permission:manage_inventory|inventory.view|report.view|reports.view');

        Route::get('/reports/customer-ledger', [ReportController::class, 'customerLedger'])->middleware('permission:manage_orders|sales.view|invoices.view|customer.view|report.view|reports.view');
        Route::get('/reports/customer-ledger/export', [ReportController::class, 'customerLedgerExport'])->middleware('permission:manage_orders|sales.view|invoices.view|customer.view|report.view|reports.view');

        Route::post('/transactions/purchase', [TransactionController::class, 'purchase'])
            ->middleware('permission:manage_inventory|purchase.create');
        Route::put('/transactions/purchase/{order}', [TransactionController::class, 'updatePurchase'])
            ->middleware('permission:manage_inventory|purchase.edit');
        Route::delete('/transactions/purchase/{order}', [TransactionController::class, 'deletePurchase'])
            ->middleware('permission:manage_inventory|purchase.delete');
        Route::post('/transactions/sale', [TransactionController::class, 'sale'])
            ->middleware('permission:manage_orders|sales.create');
        Route::put('/transactions/sale/{order}', [TransactionController::class, 'updateSale'])
            ->middleware('permission:manage_orders|sales.edit');
        Route::delete('/transactions/sale/{order}', [TransactionController::class, 'deleteSale'])
            ->middleware('permission:manage_orders|sales.delete');
        Route::post('/transactions/return-in', [TransactionController::class, 'returnIn'])
            ->middleware('permission:manage_orders|return_in.create');
        Route::put('/transactions/return-in/{order}', [TransactionController::class, 'updateReturnIn'])
            ->middleware('permission:manage_orders|return_in.edit');
        Route::delete('/transactions/return-in/{order}', [TransactionController::class, 'deleteReturnIn'])
            ->middleware('permission:manage_orders|return_in.delete');
        Route::post('/transactions/return-out', [TransactionController::class, 'returnOut'])
            ->middleware('permission:manage_orders|return_out.create');
        Route::put('/transactions/return-out/{order}', [TransactionController::class, 'updateReturnOut'])
            ->middleware('permission:manage_orders|return_out.edit');
        Route::delete('/transactions/return-out/{order}', [TransactionController::class, 'deleteReturnOut'])
            ->middleware('permission:manage_orders|return_out.delete');
        Route::post('/transactions/quotation', [TransactionController::class, 'quotation'])
            ->middleware('permission:manage_orders|sales.create');
        Route::put('/transactions/quotation/{order}', [TransactionController::class, 'updateQuotation'])
            ->middleware('permission:manage_orders|sales.edit');
        Route::delete('/transactions/quotation/{order}', [TransactionController::class, 'deleteQuotation'])
            ->middleware('permission:manage_orders|sales.delete');
        Route::get('/transactions', [TransactionController::class, 'history'])
            ->middleware('permission:manage_orders|purchase.view|sales.view');
    });
});
