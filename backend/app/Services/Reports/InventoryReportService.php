<?php

namespace App\Services\Reports;

use App\Models\Customer;
use App\Support\TenantContext;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryReportService
{
    public function customerWise(array $filters, bool $forExport = false): array
    {
        $query = DB::table('orders')
            ->join('customers', 'customers.id', '=', 'orders.party_id')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.party_type', Customer::class)
            ->where('orders.tenant_id', $this->tenantId())
            ->where('customers.tenant_id', $this->tenantId())
            ->selectRaw('customers.id as customer_id')
            ->selectRaw('customers.name as customer_name')
            ->selectRaw('COUNT(orders.id) as total_invoices')
            ->selectRaw('COALESCE(SUM(orders.net_amount), 0) as total_sales')
            ->selectRaw('COALESCE(SUM(orders.paid_amount), 0) as total_paid')
            ->selectRaw('COALESCE(SUM(orders.due_amount), 0) as remaining_balance')
            ->groupBy('customers.id', 'customers.name');

        $this->applyDateRange($query, 'orders.transaction_date', $filters);

        if (!empty($filters['customer_id'])) {
            $query->where('customers.id', (int) $filters['customer_id']);
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where('customers.name', 'like', "%{$search}%");
        }

        $this->applySorting($query, $filters, [
            'customer_name' => 'customer_name',
            'total_sales' => 'total_sales',
            'total_paid' => 'total_paid',
            'remaining_balance' => 'remaining_balance',
            'total_invoices' => 'total_invoices',
        ], 'total_sales', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'customer_rows')
            ->selectRaw('COUNT(*) as total_customers')
            ->selectRaw('COALESCE(SUM(total_sales), 0) as total_sales')
            ->selectRaw('COALESCE(SUM(total_paid), 0) as total_paid')
            ->selectRaw('COALESCE(SUM(remaining_balance), 0) as remaining_balance')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'customer_name' => 'Customer Name',
                'total_sales' => 'Total Sales',
                'total_paid' => 'Total Paid',
                'remaining_balance' => 'Remaining Balance',
                'total_invoices' => 'Total Invoices',
            ],
            'summary' => [
                'total_customers' => (int) ($summary->total_customers ?? 0),
                'total_sales' => (float) ($summary->total_sales ?? 0),
                'total_paid' => (float) ($summary->total_paid ?? 0),
                'remaining_balance' => (float) ($summary->remaining_balance ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'customer_name',
                'y_key' => 'total_sales',
            ],
        ];
    }

    public function customerWiseInvoices(int $customerId, array $filters, bool $forExport = false): array
    {
        $query = DB::table('orders')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.party_type', Customer::class)
            ->where('orders.party_id', $customerId)
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('orders.id as invoice_id')
            ->selectRaw('orders.serial_no as invoice_no')
            ->selectRaw('DATE(orders.transaction_date) as invoice_date')
            ->selectRaw('COALESCE(orders.net_amount, 0) as total_sales')
            ->selectRaw('COALESCE(orders.paid_amount, 0) as total_paid')
            ->selectRaw('COALESCE(orders.due_amount, 0) as remaining_balance')
            ->selectRaw('orders.payment_status as payment_status');

        $this->applyDateRange($query, 'orders.transaction_date', $filters);

        $this->applySorting($query, $filters, [
            'invoice_date' => 'invoice_date',
            'invoice_no' => 'invoice_no',
            'total_sales' => 'total_sales',
            'total_paid' => 'total_paid',
            'remaining_balance' => 'remaining_balance',
        ], 'invoice_date', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'invoice_rows')
            ->selectRaw('COUNT(*) as total_invoices')
            ->selectRaw('COALESCE(SUM(total_sales), 0) as total_sales')
            ->selectRaw('COALESCE(SUM(total_paid), 0) as total_paid')
            ->selectRaw('COALESCE(SUM(remaining_balance), 0) as remaining_balance')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'invoice_no' => 'Invoice No',
                'invoice_date' => 'Date',
                'total_sales' => 'Total Sales',
                'total_paid' => 'Total Paid',
                'remaining_balance' => 'Remaining Balance',
                'payment_status' => 'Payment Status',
            ],
            'summary' => [
                'total_invoices' => (int) ($summary->total_invoices ?? 0),
                'total_sales' => (float) ($summary->total_sales ?? 0),
                'total_paid' => (float) ($summary->total_paid ?? 0),
                'remaining_balance' => (float) ($summary->remaining_balance ?? 0),
            ],
            'rows' => $rows,
        ];
    }

    public function brandWise(array $filters, bool $forExport = false): array
    {
        $query = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('brands', 'brands.id', '=', 'products.brand_id')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.tenant_id', $this->tenantId())
            ->where('order_items.tenant_id', $this->tenantId())
            ->selectRaw('COALESCE(brands.id, 0) as brand_id')
            ->selectRaw("COALESCE(brands.name, 'Unbranded') as brand_name")
            ->selectRaw('COALESCE(SUM(order_items.quantity + COALESCE(order_items.bonus, 0)), 0) as total_products_sold')
            ->selectRaw('COALESCE(SUM(order_items.total_price), 0) as total_revenue')
            ->groupBy('brands.id', 'brands.name');

        $this->applyDateRange($query, 'orders.transaction_date', $filters);

        if (!empty($filters['brand_id'])) {
            $query->where('brands.id', (int) $filters['brand_id']);
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('brands.name', 'like', "%{$search}%")
                    ->orWhereNull('brands.id');
            });
        }

        $this->applySorting($query, $filters, [
            'brand_name' => 'brand_name',
            'total_products_sold' => 'total_products_sold',
            'total_revenue' => 'total_revenue',
        ], 'total_revenue', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'brand_rows')
            ->selectRaw('COUNT(*) as total_brands')
            ->selectRaw('COALESCE(SUM(total_products_sold), 0) as total_products_sold')
            ->selectRaw('COALESCE(SUM(total_revenue), 0) as total_revenue')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'brand_name' => 'Brand Name',
                'total_products_sold' => 'Total Products Sold',
                'total_revenue' => 'Total Revenue',
            ],
            'summary' => [
                'total_brands' => (int) ($summary->total_brands ?? 0),
                'total_products_sold' => (float) ($summary->total_products_sold ?? 0),
                'total_revenue' => (float) ($summary->total_revenue ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'brand_name',
                'y_key' => 'total_revenue',
            ],
        ];
    }

    public function productWise(array $filters, bool $forExport = false): array
    {
        $query = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.tenant_id', $this->tenantId())
            ->where('order_items.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw('COALESCE(SUM(order_items.quantity + COALESCE(order_items.bonus, 0)), 0) as quantity_sold')
            ->selectRaw('COALESCE(SUM(order_items.total_price), 0) as total_sales_amount')
            ->groupBy('products.id', 'products.name');

        $this->applyDateRange($query, 'orders.transaction_date', $filters);

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where('products.name', 'like', "%{$search}%");
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'quantity_sold' => 'quantity_sold',
            'total_sales_amount' => 'total_sales_amount',
        ], 'total_sales_amount', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'product_rows')
            ->selectRaw('COUNT(*) as total_products')
            ->selectRaw('COALESCE(SUM(quantity_sold), 0) as quantity_sold')
            ->selectRaw('COALESCE(SUM(total_sales_amount), 0) as total_sales_amount')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'quantity_sold' => 'Quantity Sold',
                'total_sales_amount' => 'Total Sales Amount',
            ],
            'summary' => [
                'total_products' => (int) ($summary->total_products ?? 0),
                'quantity_sold' => (float) ($summary->quantity_sold ?? 0),
                'total_sales_amount' => (float) ($summary->total_sales_amount ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'product_name',
                'y_key' => 'quantity_sold',
            ],
        ];
    }

    public function batchWise(array $filters, bool $forExport = false): array
    {
        $asOfDate = !empty($filters['as_of_date'])
            ? Carbon::parse((string) $filters['as_of_date'])->toDateString()
            : null;

        $movementSubquery = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->when($asOfDate !== null, function ($builder) use ($asOfDate): void {
                $builder->whereDate('orders.transaction_date', '<=', $asOfDate);
            })
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw("COALESCE(SUM(CASE WHEN inventory_logs.transaction_type = 'in' THEN inventory_logs.quantity_change ELSE 0 END), 0) as purchase_qty")
            ->selectRaw("COALESCE(SUM(CASE WHEN inventory_logs.transaction_type = 'out' THEN ABS(inventory_logs.quantity_change) ELSE 0 END), 0) as sold_qty")
            ->selectRaw("COALESCE(SUM(inventory_logs.quantity_change), 0) as remaining_qty")
            ->groupBy('inventory_logs.batch_id');

        $query = DB::table('inventory_batches')
            ->join('products', 'products.id', '=', 'inventory_batches.product_id')
            ->leftJoinSub($movementSubquery, 'movement_rows', function ($join): void {
                $join->on('movement_rows.batch_id', '=', 'inventory_batches.id');
            })
            ->where('inventory_batches.tenant_id', $this->tenantId())
            ->where('products.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw("COALESCE(inventory_batches.batch_no, '-') as batch_number")
            ->selectRaw('COALESCE(SUM(movement_rows.remaining_qty), 0) as available_quantity')
            ->selectRaw('COALESCE(MAX(inventory_batches.cost_price), 0) as cost_price')
            ->selectRaw('COALESCE(MAX(products.sale_price), 0) as sale_price')
            ->selectRaw('(COALESCE(MAX(inventory_batches.cost_price), 0) * COALESCE(SUM(movement_rows.remaining_qty), 0)) as net_amount')
            ->groupBy('products.id', 'products.name', 'inventory_batches.batch_no');

        if (!empty($filters['show_only_positive_stock'])) {
            $query->havingRaw('COALESCE(SUM(movement_rows.remaining_qty), 0) > 0');
        }

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['batch_no'])) {
            $query->where('inventory_batches.batch_no', 'like', '%'.(string) $filters['batch_no'].'%');
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('products.name', 'like', "%{$search}%")
                    ->orWhere('inventory_batches.batch_no', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'batch_number' => 'batch_number',
            'available_quantity' => 'available_quantity',
            'cost_price' => 'cost_price',
            'sale_price' => 'sale_price',
            'net_amount' => 'net_amount',
        ], 'available_quantity', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'batch_rows')
            ->selectRaw('COUNT(*) as total_batches')
            ->selectRaw('COALESCE(SUM(available_quantity), 0) as available_quantity')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as net_amount')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'batch_number' => 'Batch Number',
                'available_quantity' => 'Available Quantity',
                'cost_price' => 'Cost Price',
                'sale_price' => 'Sale Price',
                'net_amount' => 'Net Amount',
            ],
            'summary' => [
                'total_batches' => (int) ($summary->total_batches ?? 0),
                'available_quantity' => (float) ($summary->available_quantity ?? 0),
                'net_amount' => (float) ($summary->net_amount ?? 0),
            ],
            'rows' => $rows,
        ];
    }

    public function expiryWise(array $filters, bool $forExport = false): array
    {
        $nearExpiryDays = isset($filters['near_expiry_days']) ? max(1, (int) $filters['near_expiry_days']) : 30;
        $hasDateRange = !empty($filters['from_date']) || !empty($filters['to_date']);

        $baseQuery = DB::table('inventory_batches')
            ->join('products', 'products.id', '=', 'inventory_batches.product_id')
            ->where('inventory_batches.tenant_id', $this->tenantId())
            ->where('products.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw('COALESCE(products.cost_price, 0) as cost_price')
            ->selectRaw('COALESCE(products.sale_price, 0) as sale_price')
            ->selectRaw('products.brand_id as brand_id')
            ->selectRaw('inventory_batches.batch_no as batch_number')
            ->selectRaw('MIN(inventory_batches.expiry_date) as expiry_date')
            ->selectRaw('COALESCE(SUM(inventory_batches.quantity_remaining), 0) as remaining_quantity')
            ->groupBy('products.id', 'products.name', 'products.cost_price', 'products.sale_price', 'products.brand_id', 'inventory_batches.batch_no');

        $query = DB::query()->fromSub($baseQuery, 'expiry_rows');

        if ($hasDateRange) {
            $query->whereNotNull('expiry_date');
            $this->applyDateRange($query, 'expiry_date', [
                'from_date' => $filters['from_date'] ?? null,
                'to_date' => $filters['to_date'] ?? null,
            ]);
        }

        if (!empty($filters['show_only_expiry_date'])) {
            $query->whereNotNull('expiry_date');
        }

        // ESR should only show available stock rows.
        $query->where('remaining_quantity', '>', 0);

        if (!empty($filters['product_id'])) {
            $query->where('product_id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['batch_no'])) {
            $query->where('batch_number', 'like', '%'.(string) $filters['batch_no'].'%');
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('product_name', 'like', "%{$search}%")
                    ->orWhere('batch_number', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'batch_number' => 'batch_number',
            'expiry_date' => 'expiry_date',
            'remaining_quantity' => 'remaining_quantity',
        ], 'expiry_date', 'asc');

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        $transform = function ($row) use ($nearExpiryDays): array {
            $expiryDate = !empty($row->expiry_date) ? Carbon::parse($row->expiry_date) : null;
            $daysToExpiry = $expiryDate ? Carbon::today()->diffInDays($expiryDate, false) : null;
            $isNearExpiry = $daysToExpiry !== null && $daysToExpiry <= $nearExpiryDays;

            return [
                'product_id' => (int) ($row->product_id ?? 0),
                'product_name' => (string) ($row->product_name ?? ''),
                'cost_price' => (float) ($row->cost_price ?? 0),
                'sale_price' => (float) ($row->sale_price ?? 0),
                'batch_number' => (string) ($row->batch_number ?? '-'),
                'expiry_date' => $expiryDate?->toDateString(),
                'remaining_quantity' => (float) ($row->remaining_quantity ?? 0),
                'days_to_expiry' => $daysToExpiry,
                'is_near_expiry' => $isNearExpiry,
            ];
        };

        if ($rows instanceof LengthAwarePaginator) {
            $rows->setCollection($rows->getCollection()->map($transform));
            $rowCollection = $rows->getCollection();
        } else {
            $rows = $rows->map($transform);
            $rowCollection = $rows;
        }

        $summary = [
            'total_batches' => $rowCollection->count(),
            'near_expiry_batches' => $rowCollection->where('is_near_expiry', true)->count(),
            'remaining_quantity' => (float) $rowCollection->sum('remaining_quantity'),
            'total_cost_amount' => (float) $rowCollection->sum(fn ($row) => (float) ($row['remaining_quantity'] ?? 0) * (float) ($row['cost_price'] ?? 0)),
            'total_sale_amount' => (float) $rowCollection->sum(fn ($row) => (float) ($row['remaining_quantity'] ?? 0) * (float) ($row['sale_price'] ?? 0)),
            'near_expiry_days' => $nearExpiryDays,
        ];

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'batch_number' => 'Batch Number',
                'expiry_date' => 'Expiry Date',
                'remaining_quantity' => 'Remaining Quantity',
                'days_to_expiry' => 'Days To Expiry',
                'is_near_expiry' => 'Near Expiry',
            ],
            'summary' => $summary,
            'rows' => $rows,
        ];
    }

    public function productBatchWise(array $filters, bool $forExport = false): array
    {
        $asOfDate = !empty($filters['as_of_date'])
            ? Carbon::parse((string) $filters['as_of_date'])->toDateString()
            : null;

        $movementSubquery = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->when($asOfDate !== null, function ($builder) use ($asOfDate): void {
                $builder->whereDate('orders.transaction_date', '<=', $asOfDate);
            })
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw("COALESCE(SUM(inventory_logs.quantity_change), 0) as stock_remaining")
            ->groupBy('inventory_logs.batch_id');

        $query = DB::table('inventory_batches')
            ->join('products', 'products.id', '=', 'inventory_batches.product_id')
            ->leftJoinSub($movementSubquery, 'movement_rows', function ($join): void {
                $join->on('movement_rows.batch_id', '=', 'inventory_batches.id');
            })
            ->where('inventory_batches.tenant_id', $this->tenantId())
            ->where('products.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw("COALESCE(inventory_batches.batch_no, '-') as batch_number")
            ->selectRaw('COALESCE(MAX(inventory_batches.cost_price), 0) as cost_price')
            ->selectRaw('COALESCE(MAX(products.sale_price), 0) as sale_price')
            ->selectRaw('COALESCE(movement_rows.stock_remaining, 0) as available_quantity')
            ->selectRaw('(COALESCE(MAX(inventory_batches.cost_price), 0) * COALESCE(movement_rows.stock_remaining, 0)) as net_amount');

        // Filter out zero stock items if requested
        if (!empty($filters['show_only_positive_stock'])) {
            $query->havingRaw(
                'COALESCE(opening_stock, 0) > 0
                 OR COALESCE(purchased, 0) > 0
                 OR COALESCE(purchase_return, 0) > 0
                 OR COALESCE(sold, 0) > 0
                 OR COALESCE(sales_return, 0) > 0
                 OR COALESCE(closing_stock, 0) > 0'
            );
        }

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['batch_no'])) {
            $query->where('inventory_batches.batch_no', 'like', '%'.(string) $filters['batch_no'].'%');
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('products.name', 'like', "%{$search}%")
                    ->orWhere('inventory_batches.batch_no', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'batch_number' => 'batch_number',
            'cost_price' => 'cost_price',
            'sale_price' => 'sale_price',
            'available_quantity' => 'available_quantity',
            'net_amount' => 'net_amount',
        ], 'available_quantity', 'desc');

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        $rowCollection = $rows instanceof LengthAwarePaginator ? $rows->getCollection() : $rows;

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'batch_number' => 'Batch No',
                'available_quantity' => 'Available Quantity',
                'cost_price' => 'Cost Price',
                'sale_price' => 'Sale Price',
                'net_amount' => 'Net Amount',
            ],
            'summary' => [
                'total_rows' => $rowCollection->count(),
                'available_quantity' => (float) $rowCollection->sum('available_quantity'),
                'net_amount' => (float) $rowCollection->sum('net_amount'),
            ],
            'rows' => $rows,
        ];
    }

    public function dateWiseSales(array $filters, bool $forExport = false): array
    {
        $includeProfit = !empty($filters['include_profit']);

        $salesBase = DB::table('orders')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('DATE(orders.transaction_date) as report_date')
            ->selectRaw('COALESCE(SUM(orders.net_amount), 0) as total_sales')
            ->selectRaw('COUNT(orders.id) as total_invoices')
            ->groupBy(DB::raw('DATE(orders.transaction_date)'));

        $this->applyDateRange($salesBase, 'orders.transaction_date', $filters);

        if ($includeProfit) {
            $costBase = DB::table('orders')
                ->join('order_items', 'order_items.order_id', '=', 'orders.id')
                ->join('products', 'products.id', '=', 'order_items.product_id')
                ->where('orders.transaction_type', 'sale')
                ->where('orders.tenant_id', $this->tenantId())
                ->where('order_items.tenant_id', $this->tenantId())
                ->where('products.tenant_id', $this->tenantId())
                ->selectRaw('DATE(orders.transaction_date) as report_date')
                ->selectRaw('COALESCE(SUM((order_items.quantity + COALESCE(order_items.bonus, 0)) * COALESCE(products.cost_price, 0)), 0) as total_cost')
                ->groupBy(DB::raw('DATE(orders.transaction_date)'));

            $this->applyDateRange($costBase, 'orders.transaction_date', $filters);

            $query = DB::query()
                ->fromSub($salesBase, 'sales_rows')
                ->leftJoinSub($costBase, 'cost_rows', 'cost_rows.report_date', '=', 'sales_rows.report_date')
                ->selectRaw('sales_rows.report_date as date')
                ->selectRaw('sales_rows.total_sales as total_sales')
                ->selectRaw('sales_rows.total_invoices as total_invoices')
                ->selectRaw('COALESCE(sales_rows.total_sales - COALESCE(cost_rows.total_cost, 0), 0) as profit');
        } else {
            $query = DB::query()
                ->fromSub($salesBase, 'sales_rows')
                ->selectRaw('sales_rows.report_date as date')
                ->selectRaw('sales_rows.total_sales as total_sales')
                ->selectRaw('sales_rows.total_invoices as total_invoices')
                ->selectRaw('0 as profit');
        }

        $this->applySorting($query, $filters, [
            'date' => 'date',
            'total_sales' => 'total_sales',
            'total_invoices' => 'total_invoices',
            'profit' => 'profit',
        ], 'date', 'asc');

        $summary = DB::query()->fromSub(clone $query, 'date_rows')
            ->selectRaw('COUNT(*) as total_days')
            ->selectRaw('COALESCE(SUM(total_sales), 0) as total_sales')
            ->selectRaw('COALESCE(SUM(total_invoices), 0) as total_invoices')
            ->selectRaw('COALESCE(SUM(profit), 0) as total_profit')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'date' => 'Date',
                'total_sales' => 'Total Sales',
                'total_invoices' => 'Total Invoices',
                'profit' => 'Profit',
            ],
            'summary' => [
                'total_days' => (int) ($summary->total_days ?? 0),
                'total_sales' => (float) ($summary->total_sales ?? 0),
                'total_invoices' => (float) ($summary->total_invoices ?? 0),
                'total_profit' => (float) ($summary->total_profit ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'date',
                'y_key' => 'total_sales',
            ],
        ];
    }

    public function salesAndStock(array $filters, bool $forExport = false): array
    {
        $purchasedSub = DB::table('inventory_batches')
            ->selectRaw('inventory_batches.product_id as product_id')
            ->selectRaw('COALESCE(SUM(inventory_batches.quantity_initial), 0) as purchased_qty')
            ->groupBy('inventory_batches.product_id');

        $this->applyDateRange($purchasedSub, 'inventory_batches.received_date', $filters);

        $purchaseReturnSub = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.transaction_type', 'return_out')
            ->where('orders.tenant_id', $this->tenantId())
            ->where('order_items.tenant_id', $this->tenantId())
            ->selectRaw('order_items.product_id as product_id')
            ->selectRaw('COALESCE(SUM(order_items.quantity + COALESCE(order_items.bonus, 0)), 0) as purchase_return_qty')
            ->groupBy('order_items.product_id');

        $this->applyDateRange($purchaseReturnSub, 'orders.transaction_date', $filters);

        $soldSub = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.tenant_id', $this->tenantId())
            ->where('order_items.tenant_id', $this->tenantId())
            ->selectRaw('order_items.product_id as product_id')
            ->selectRaw('COALESCE(SUM(order_items.quantity + COALESCE(order_items.bonus, 0)), 0) as sold_qty')
            ->groupBy('order_items.product_id');

        $this->applyDateRange($soldSub, 'orders.transaction_date', $filters);

        $salesReturnSub = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.transaction_type', 'return_in')
            ->where('orders.tenant_id', $this->tenantId())
            ->where('order_items.tenant_id', $this->tenantId())
            ->selectRaw('order_items.product_id as product_id')
            ->selectRaw('COALESCE(SUM(order_items.quantity + COALESCE(order_items.bonus, 0)), 0) as sales_return_qty')
            ->groupBy('order_items.product_id');

        $this->applyDateRange($salesReturnSub, 'orders.transaction_date', $filters);

        $closingSub = DB::table('inventory_batches')
            ->selectRaw('inventory_batches.product_id as product_id')
            ->selectRaw('COALESCE(SUM(inventory_batches.quantity_remaining), 0) as closing_stock')
            ->groupBy('inventory_batches.product_id');

        $query = DB::table('products')
            ->where('products.tenant_id', $this->tenantId())
            ->leftJoinSub($purchasedSub, 'purchased_rows', 'purchased_rows.product_id', '=', 'products.id')
            ->leftJoinSub($purchaseReturnSub, 'purchase_return_rows', 'purchase_return_rows.product_id', '=', 'products.id')
            ->leftJoinSub($soldSub, 'sold_rows', 'sold_rows.product_id', '=', 'products.id')
            ->leftJoinSub($salesReturnSub, 'sales_return_rows', 'sales_return_rows.product_id', '=', 'products.id')
            ->leftJoinSub($closingSub, 'closing_rows', 'closing_rows.product_id', '=', 'products.id')
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw('COALESCE(closing_rows.closing_stock, 0) - COALESCE(purchased_rows.purchased_qty, 0) + COALESCE(purchase_return_rows.purchase_return_qty, 0) + COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0) as opening_stock')
            ->selectRaw('COALESCE(purchased_rows.purchased_qty, 0) as purchased')
            ->selectRaw('COALESCE(purchase_return_rows.purchase_return_qty, 0) as purchase_return')
            ->selectRaw('COALESCE(sold_rows.sold_qty, 0) as sold')
            ->selectRaw('COALESCE(sales_return_rows.sales_return_qty, 0) as sales_return')
            ->selectRaw('COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0) as net_sale')
            ->selectRaw('COALESCE(products.sale_price, 0) as sale_price')
            ->selectRaw('(COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0)) * COALESCE(products.sale_price, 0) as amount')
            ->selectRaw('COALESCE(closing_rows.closing_stock, 0) as closing_stock');

        if (!empty($filters['show_only_positive_stock'])) {
            $query->havingRaw(
                'COALESCE(opening_stock, 0) > 0
                 OR COALESCE(purchased, 0) > 0
                 OR COALESCE(purchase_return, 0) > 0
                 OR COALESCE(sold, 0) > 0
                 OR COALESCE(sales_return, 0) > 0
                 OR COALESCE(closing_stock, 0) > 0'
            );
        }

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where('products.name', 'like', "%{$search}%");
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'opening_stock' => 'opening_stock',
            'purchased' => 'purchased',
            'purchase_return' => 'purchase_return',
            'sold' => 'sold',
            'sales_return' => 'sales_return',
            'net_sale' => 'net_sale',
            'sale_price' => 'sale_price',
            'amount' => 'amount',
            'closing_stock' => 'closing_stock',
        ], 'closing_stock', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'sales_stock_rows')
            ->selectRaw('COUNT(*) as total_products')
            ->selectRaw('COALESCE(SUM(opening_stock), 0) as opening_stock')
            ->selectRaw('COALESCE(SUM(purchased), 0) as purchased')
            ->selectRaw('COALESCE(SUM(purchase_return), 0) as purchase_return')
            ->selectRaw('COALESCE(SUM(sold), 0) as sold')
            ->selectRaw('COALESCE(SUM(sales_return), 0) as sales_return')
            ->selectRaw('COALESCE(SUM(net_sale), 0) as net_sale')
            ->selectRaw('COALESCE(SUM(amount), 0) as amount')
            ->selectRaw('COALESCE(SUM(closing_stock), 0) as closing_stock')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'opening_stock' => 'Opening Stock',
                'purchased' => 'Purchased',
                'purchase_return' => 'P. Return',
                'sold' => 'Sold',
                'sales_return' => 'S. Return',
                'net_sale' => 'Net Sale',
                'closing_stock' => 'Closing Stock',
                'sale_price' => 'Sale Price',
                'amount' => 'Amount',
            ],
            'summary' => [
                'total_products' => (int) ($summary->total_products ?? 0),
                'opening_stock' => (float) ($summary->opening_stock ?? 0),
                'purchased' => (float) ($summary->purchased ?? 0),
                'purchase_return' => (float) ($summary->purchase_return ?? 0),
                'sold' => (float) ($summary->sold ?? 0),
                'sales_return' => (float) ($summary->sales_return ?? 0),
                'net_sale' => (float) ($summary->net_sale ?? 0),
                'amount' => (float) ($summary->amount ?? 0),
                'closing_stock' => (float) ($summary->closing_stock ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'product_name',
                'y_key' => 'closing_stock',
            ],
        ];
    }

    public function salesAndStockBatchWise(array $filters, bool $forExport = false): array
    {
        $purchaseSub = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.transaction_type', 'purchase')
            ->where('inventory_logs.transaction_type', 'in')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw('COALESCE(SUM(inventory_logs.quantity_change), 0) as purchased_qty')
            ->groupBy('inventory_logs.batch_id');

        $this->applyDateRange($purchaseSub, 'orders.transaction_date', $filters);

        $purchaseReturnSub = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.transaction_type', 'return_out')
            ->where('inventory_logs.transaction_type', 'out')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw('COALESCE(SUM(ABS(inventory_logs.quantity_change)), 0) as purchase_return_qty')
            ->groupBy('inventory_logs.batch_id');

        $this->applyDateRange($purchaseReturnSub, 'orders.transaction_date', $filters);

        $soldSub = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.transaction_type', 'sale')
            ->where('inventory_logs.transaction_type', 'out')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw('COALESCE(SUM(ABS(inventory_logs.quantity_change)), 0) as sold_qty')
            ->groupBy('inventory_logs.batch_id');

        $this->applyDateRange($soldSub, 'orders.transaction_date', $filters);

        $salesReturnSub = DB::table('inventory_logs')
            ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.transaction_type', 'return_in')
            ->where('inventory_logs.transaction_type', 'in')
            ->where('inventory_logs.tenant_id', $this->tenantId())
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('inventory_logs.batch_id as batch_id')
            ->selectRaw('COALESCE(SUM(inventory_logs.quantity_change), 0) as sales_return_qty')
            ->groupBy('inventory_logs.batch_id');

        $this->applyDateRange($salesReturnSub, 'orders.transaction_date', $filters);

        $query = DB::table('inventory_batches')
            ->join('products', 'products.id', '=', 'inventory_batches.product_id')
            ->leftJoinSub($purchaseReturnSub, 'purchase_return_rows', function ($join): void {
                $join->on('purchase_return_rows.batch_id', '=', 'inventory_batches.id');
            })
            ->leftJoinSub($soldSub, 'sold_rows', function ($join): void {
                $join->on('sold_rows.batch_id', '=', 'inventory_batches.id');
            })
            ->leftJoinSub($salesReturnSub, 'sales_return_rows', function ($join): void {
                $join->on('sales_return_rows.batch_id', '=', 'inventory_batches.id');
            })
            ->where('inventory_batches.tenant_id', $this->tenantId())
            ->where('products.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw("COALESCE(inventory_batches.batch_no, '-') as batch_number")
            ->selectRaw('COALESCE(purchase_rows.purchased_qty, 0) as purchased')
            ->selectRaw('COALESCE(purchase_return_rows.purchase_return_qty, 0) as purchase_return')
            ->selectRaw('COALESCE(sold_rows.sold_qty, 0) as sold')
            ->selectRaw('COALESCE(sales_return_rows.sales_return_qty, 0) as sales_return')
            ->selectRaw('COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0) as net_sale')
            ->selectRaw('COALESCE(inventory_batches.quantity_remaining, 0) as closing_stock')
            ->selectRaw('(COALESCE(inventory_batches.quantity_remaining, 0) - COALESCE(purchase_rows.purchased_qty, 0) + COALESCE(purchase_return_rows.purchase_return_qty, 0) + COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0)) as opening_stock')
            ->selectRaw('COALESCE(inventory_batches.cost_price, 0) as cost_price')
            ->selectRaw('COALESCE(products.sale_price, 0) as sale_price')
            ->selectRaw('(COALESCE(sold_rows.sold_qty, 0) - COALESCE(sales_return_rows.sales_return_qty, 0)) * COALESCE(products.sale_price, 0) as amount');

        $query->leftJoinSub($purchaseSub, 'purchase_rows', function ($join): void {
            $join->on('purchase_rows.batch_id', '=', 'inventory_batches.id');
        });

        if (!empty($filters['show_only_positive_stock'])) {
            $query->havingRaw(
                'COALESCE(opening_stock, 0) > 0
                 OR COALESCE(purchased, 0) > 0
                 OR COALESCE(purchase_return, 0) > 0
                 OR COALESCE(sold, 0) > 0
                 OR COALESCE(sales_return, 0) > 0
                 OR COALESCE(closing_stock, 0) > 0'
            );
        }

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['batch_no'])) {
            $query->where('inventory_batches.batch_no', 'like', '%'.(string) $filters['batch_no'].'%');
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('products.name', 'like', "%{$search}%")
                    ->orWhere('inventory_batches.batch_no', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'batch_number' => 'batch_number',
            'opening_stock' => 'opening_stock',
            'purchased' => 'purchased',
            'purchase_return' => 'purchase_return',
            'sold' => 'sold',
            'sales_return' => 'sales_return',
            'net_sale' => 'net_sale',
            'cost_price' => 'cost_price',
            'sale_price' => 'sale_price',
            'amount' => 'amount',
            'closing_stock' => 'closing_stock',
        ], 'closing_stock', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'sales_stock_batch_rows')
            ->selectRaw('COUNT(*) as total_batches')
            ->selectRaw('COALESCE(SUM(opening_stock), 0) as opening_stock')
            ->selectRaw('COALESCE(SUM(purchased), 0) as purchased')
            ->selectRaw('COALESCE(SUM(purchase_return), 0) as purchase_return')
            ->selectRaw('COALESCE(SUM(sold), 0) as sold')
            ->selectRaw('COALESCE(SUM(sales_return), 0) as sales_return')
            ->selectRaw('COALESCE(SUM(net_sale), 0) as net_sale')
            ->selectRaw('COALESCE(SUM(amount), 0) as amount')
            ->selectRaw('COALESCE(SUM(closing_stock), 0) as closing_stock')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'batch_number' => 'Batch Number',
                'opening_stock' => 'Opening Stock',
                'purchased' => 'Purchased',
                'purchase_return' => 'P. Return',
                'sold' => 'Sold',
                'sales_return' => 'S. Return',
                'net_sale' => 'Net Sale',
                'closing_stock' => 'Closing Stock',
                'sale_price' => 'Sale Price',
                'amount' => 'Amount',
            ],
            'summary' => [
                'total_batches' => (int) ($summary->total_batches ?? 0),
                'opening_stock' => (float) ($summary->opening_stock ?? 0),
                'purchased' => (float) ($summary->purchased ?? 0),
                'purchase_return' => (float) ($summary->purchase_return ?? 0),
                'sold' => (float) ($summary->sold ?? 0),
                'sales_return' => (float) ($summary->sales_return ?? 0),
                'net_sale' => (float) ($summary->net_sale ?? 0),
                'amount' => (float) ($summary->amount ?? 0),
                'closing_stock' => (float) ($summary->closing_stock ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'batch_number',
                'y_key' => 'closing_stock',
            ],
        ];
    }

    public function availableStock(array $filters, bool $forExport = false): array
    {
        $asOfDate = !empty($filters['as_of_date'])
            ? Carbon::parse((string) $filters['as_of_date'])->toDateString()
            : null;

        if ($asOfDate !== null) {
            // Historical stock as of a selected date.
            $stockSubquery = DB::table('inventory_logs')
                ->join('order_items', 'order_items.id', '=', 'inventory_logs.order_item_id')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->where('inventory_logs.tenant_id', $this->tenantId())
                ->where('orders.tenant_id', $this->tenantId())
                ->whereDate('orders.transaction_date', '<=', $asOfDate)
                ->selectRaw('order_items.product_id as product_id')
                ->selectRaw("COALESCE(SUM(inventory_logs.quantity_change), 0) as available_quantity")
                ->groupBy('order_items.product_id');
        } else {
            // Current stock from remaining quantities in inventory batches.
            $stockSubquery = DB::table('inventory_batches')
                ->where('inventory_batches.tenant_id', $this->tenantId())
                ->selectRaw('inventory_batches.product_id as product_id')
                ->selectRaw('COALESCE(SUM(inventory_batches.quantity_remaining), 0) as available_quantity')
                ->groupBy('inventory_batches.product_id');
        }

        $query = DB::table('products')
            ->leftJoinSub($stockSubquery, 'stock_rows', function ($join): void {
                $join->on('stock_rows.product_id', '=', 'products.id');
            })
            ->where('products.tenant_id', $this->tenantId())
            ->selectRaw('products.id as product_id')
            ->selectRaw('products.name as product_name')
            ->selectRaw("'-' as batch_number")
            ->selectRaw('COALESCE(stock_rows.available_quantity, 0) as available_quantity')
            ->selectRaw('COALESCE(products.cost_price, 0) as cost_price')
            ->selectRaw('COALESCE(products.sale_price, 0) as sale_price')
            ->selectRaw('(COALESCE(products.cost_price, 0) * COALESCE(stock_rows.available_quantity, 0)) as net_amount');

        if (!empty($filters['show_only_positive_stock'])) {
            $query->whereRaw('COALESCE(stock_rows.available_quantity, 0) > 0');
        }

        if (!empty($filters['product_id'])) {
            $query->where('products.id', (int) $filters['product_id']);
        }

        if (!empty($filters['brand_id'])) {
            $query->where('products.brand_id', (int) $filters['brand_id']);
        }

        if (!empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($builder) use ($search): void {
                $builder->where('products.name', 'like', "%{$search}%")
                    ->orWhere('products.model_no', 'like', "%{$search}%")
                    ->orWhere('products.sku', 'like', "%{$search}%");
            });
        }

        $this->applySorting($query, $filters, [
            'product_name' => 'product_name',
            'batch_number' => 'batch_number',
            'available_quantity' => 'available_quantity',
            'cost_price' => 'cost_price',
            'sale_price' => 'sale_price',
            'net_amount' => 'net_amount',
        ], 'available_quantity', 'desc');

        $summary = DB::query()->fromSub(clone $query, 'available_rows')
            ->selectRaw('COUNT(*) as total_batches')
            ->selectRaw('COALESCE(SUM(available_quantity), 0) as available_quantity')
            ->first();

        $rows = $this->paginateOrCollect($query, $filters, $forExport);

        return [
            'columns' => [
                'product_name' => 'Product Name',
                'batch_number' => 'Batch No',
                'available_quantity' => 'Available Quantity',
                'cost_price' => 'Cost Price',
                'sale_price' => 'Sale Price',
                'net_amount' => 'Net Amount',
            ],
            'summary' => [
                'total_batches' => (int) ($summary->total_batches ?? 0),
                'available_quantity' => (float) ($summary->available_quantity ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'product_name',
                'y_key' => 'available_quantity',
            ],
        ];
    }

    public function customerLedger(array $filters, bool $forExport = false): array
    {
        $customerId = !empty($filters['customer_id']) ? (int) $filters['customer_id'] : null;

        $invoiceQuery = DB::table('orders')
            ->leftJoin('customers', 'customers.id', '=', 'orders.party_id')
            ->where('orders.transaction_type', 'sale')
            ->where('orders.party_type', Customer::class)
            ->where('orders.tenant_id', $this->tenantId())
            ->selectRaw('orders.id as entry_id')
            ->selectRaw("'invoice' as entry_type")
            ->selectRaw('DATE(orders.transaction_date) as date')
            ->selectRaw('orders.serial_no as invoice_no')
            ->selectRaw("COALESCE(customers.name, 'Unknown Customer') as customer_name")
            ->selectRaw('COALESCE(orders.net_amount, 0) as debit')
            ->selectRaw('0 as credit');

        if ($customerId !== null) {
            $invoiceQuery->where('orders.party_id', $customerId);
        }

        $this->applyDateRange($invoiceQuery, 'orders.transaction_date', $filters);

        $paymentQuery = DB::table('payment_allocations')
            ->join('payments', 'payments.id', '=', 'payment_allocations.payment_id')
            ->leftJoin('customers', 'customers.id', '=', 'payment_allocations.customer_id')
            ->where('payment_allocations.tenant_id', $this->tenantId())
            ->where('payments.tenant_id', $this->tenantId())
            ->selectRaw('payment_allocations.id as entry_id')
            ->selectRaw("'payment' as entry_type")
            ->selectRaw('DATE(payments.date) as date')
            ->selectRaw('payments.serial_no as invoice_no')
            ->selectRaw("COALESCE(customers.name, 'Unknown Customer') as customer_name")
            ->selectRaw('0 as debit')
            ->selectRaw('COALESCE(payment_allocations.allocated_amount, 0) as credit');

        if ($customerId !== null) {
            $paymentQuery->where('payment_allocations.customer_id', $customerId);
        }

        $this->applyDateRange($paymentQuery, 'payments.date', $filters);

        $unionQuery = $invoiceQuery->unionAll($paymentQuery);

        $ledgerRows = DB::query()
            ->fromSub($unionQuery, 'ledger_entries')
            ->orderBy('date')
            ->orderBy('entry_type')
            ->orderBy('entry_id')
            ->get();

        $runningBalance = 0.0;
        $computed = $ledgerRows->map(function ($row) use (&$runningBalance): array {
            $debit = (float) ($row->debit ?? 0);
            $credit = (float) ($row->credit ?? 0);
            $runningBalance += ($debit - $credit);

            return [
                'date' => (string) ($row->date ?? ''),
                'invoice_no' => (string) ($row->invoice_no ?? ''),
                'customer_name' => (string) ($row->customer_name ?? 'Unknown Customer'),
                'entry_type' => (string) ($row->entry_type ?? ''),
                'debit' => $debit,
                'credit' => $credit,
                'running_balance' => $runningBalance,
            ];
        });

        if (!empty($filters['search'])) {
            $search = strtolower((string) $filters['search']);
            $computed = $computed->filter(function (array $row) use ($search): bool {
                return str_contains(strtolower($row['invoice_no']), $search)
                    || str_contains(strtolower($row['customer_name']), $search)
                    || str_contains(strtolower($row['entry_type']), $search)
                    || str_contains(strtolower($row['date']), $search);
            })->values();
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'date');
        $sortDir = strtolower((string) ($filters['sort_dir'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
        if (in_array($sortBy, ['date', 'customer_name', 'invoice_no', 'debit', 'credit', 'running_balance'], true)) {
            $computed = $sortDir === 'asc'
                ? $computed->sortBy($sortBy)->values()
                : $computed->sortByDesc($sortBy)->values();
        }

        $rows = $forExport ? $computed : $this->paginateCollection($computed, $filters);

        return [
            'columns' => $customerId === null
                ? [
                    'date' => 'Date',
                    'customer_name' => 'Customer',
                    'invoice_no' => 'Invoice No',
                    'debit' => 'Debit (Sales)',
                    'credit' => 'Credit (Payments)',
                    'running_balance' => 'Running Balance',
                ]
                : [
                    'date' => 'Date',
                    'invoice_no' => 'Invoice No',
                    'debit' => 'Debit (Sales)',
                    'credit' => 'Credit (Payments)',
                    'running_balance' => 'Running Balance',
                ],
            'summary' => [
                'total_debit' => (float) $computed->sum('debit'),
                'total_credit' => (float) $computed->sum('credit'),
                'closing_balance' => (float) ($computed->last()['running_balance'] ?? 0),
            ],
            'rows' => $rows,
            'charts' => [
                'x_key' => 'date',
                'y_key' => 'running_balance',
            ],
        ];
    }

    protected function applyDateRange($query, string $column, array $filters): void
    {
        if (!empty($filters['from_date'])) {
            $fromDate = Carbon::parse((string) $filters['from_date'])->startOfDay();
            $query->where($column, '>=', $fromDate);
        }

        if (!empty($filters['to_date'])) {
            $toDate = Carbon::parse((string) $filters['to_date'])->endOfDay();
            $query->where($column, '<=', $toDate);
        }
    }

    protected function applySorting($query, array $filters, array $allowedSorts, string $defaultSort, string $defaultDirection = 'asc'): void
    {
        $sortByInput = (string) ($filters['sort_by'] ?? $defaultSort);
        $sortDirection = strtolower((string) ($filters['sort_dir'] ?? $defaultDirection));
        $sortDirection = $sortDirection === 'desc' ? 'desc' : 'asc';

        $sortColumn = $allowedSorts[$sortByInput] ?? ($allowedSorts[$defaultSort] ?? $defaultSort);
        $query->orderBy($sortColumn, $sortDirection);
    }

    protected function paginateOrCollect($query, array $filters, bool $forExport): LengthAwarePaginator|Collection
    {
        if ($forExport) {
            return $query->get();
        }

        $perPage = $this->resolvePerPage($filters);
        $page = max(1, (int) ($filters['page'] ?? 1));

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     */
    protected function paginateCollection(Collection $collection, array $filters): LengthAwarePaginator
    {
        $perPage = $this->resolvePerPage($filters);
        $page = max(1, (int) ($filters['page'] ?? 1));

        $items = $collection->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $items,
            $collection->count(),
            $perPage,
            $page,
            [
                'path' => LengthAwarePaginator::resolveCurrentPath(),
                'pageName' => 'page',
            ]
        );
    }

    protected function resolvePerPage(array $filters): int
    {
        $perPage = (int) ($filters['per_page'] ?? 25);
        if ($perPage < 1) {
            return 25;
        }

        return min($perPage, 200);
    }

    protected function tenantId(): int
    {
        return (int) (TenantContext::getTenantId() ?? 0);
    }

    /**
     * @param  LengthAwarePaginator|Collection<int, mixed>  $rows
     * @return array<int, array<string, mixed>>
     */
    public function rowsToArray(LengthAwarePaginator|Collection $rows): array
    {
        $collection = $rows instanceof LengthAwarePaginator ? $rows->getCollection() : $rows;

        return $collection->map(function ($row): array {
            if (is_array($row)) {
                return $row;
            }

            return (array) $row;
        })->values()->all();
    }
}
