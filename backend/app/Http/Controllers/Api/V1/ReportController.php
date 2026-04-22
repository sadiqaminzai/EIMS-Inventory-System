<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Reports\InventoryReportService;
use App\Services\Reports\ReportExportService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

class ReportController extends Controller
{
    public function __construct(
        protected InventoryReportService $reportService,
        protected ReportExportService $reportExportService,
    ) {
    }

    public function customerWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'customer_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->customerWise($filters));
    }

    public function customerWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'customer_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Customer Wise Report', $filters, function (array $params) {
            return $this->reportService->customerWise($params, true);
        });
    }

    public function customerWiseInvoices(Request $request, int $customerId)
    {
        $filters = $request->validate($this->baseRules());

        return $this->jsonReportResponse($this->reportService->customerWiseInvoices($customerId, $filters));
    }

    public function customerWiseInvoicesExport(Request $request, int $customerId)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Customer Invoice Drilldown', $filters, function (array $params) use ($customerId) {
            return $this->reportService->customerWiseInvoices($customerId, $params, true);
        });
    }

    public function brandWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'brand_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->brandWise($filters));
    }

    public function brandWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'brand_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Brand Wise Report', $filters, function (array $params) {
            return $this->reportService->brandWise($params, true);
        });
    }

    public function productWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->productWise($filters));
    }

    public function productWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Product Wise Report', $filters, function (array $params) {
            return $this->reportService->productWise($params, true);
        });
    }

    public function batchWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->batchWise($filters));
    }

    public function batchWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Batch Wise Report', $filters, function (array $params) {
            return $this->reportService->batchWise($params, true);
        });
    }

    public function expiryWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'near_expiry_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]));

        return $this->jsonReportResponse($this->reportService->expiryWise($filters));
    }

    public function expiryWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'near_expiry_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Expiry Wise Report', $filters, function (array $params) {
            return $this->reportService->expiryWise($params, true);
        });
    }

    public function productBatchWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->productBatchWise($filters));
    }

    public function productBatchWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Product Batch Wise Report', $filters, function (array $params) {
            return $this->reportService->productBatchWise($params, true);
        });
    }

    public function dateWiseSales(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'include_profit' => ['nullable', 'boolean'],
        ]));

        return $this->jsonReportResponse($this->reportService->dateWiseSales($filters));
    }

    public function dateWiseSalesExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'include_profit' => ['nullable', 'boolean'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Date Wise Sales Report', $filters, function (array $params) {
            return $this->reportService->dateWiseSales($params, true);
        });
    }

    public function salesAndStock(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->salesAndStock($filters));
    }

    public function salesAndStockExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Sales and Stock Report', $filters, function (array $params) {
            return $this->reportService->salesAndStock($params, true);
        });
    }

    public function availableStock(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->availableStock($filters));
    }

    public function availableStockExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Available Stock Report', $filters, function (array $params) {
            return $this->reportService->availableStock($params, true);
        });
    }

    public function customerLedger(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'customer_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->customerLedger($filters));
    }

    public function customerLedgerExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'customer_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Customer Ledger', $filters, function (array $params) {
            return $this->reportService->customerLedger($params, true);
        });
    }

    protected function jsonReportResponse(array $result)
    {
        $rows = $result['rows'];
        $rowData = $this->reportService->rowsToArray($rows);

        $pagination = null;
        if ($rows instanceof LengthAwarePaginator) {
            $pagination = [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
            ];
        }

        return response()->json([
            'data' => $rowData,
            'summary' => $result['summary'] ?? [],
            'columns' => $result['columns'] ?? [],
            'charts' => $result['charts'] ?? null,
            'pagination' => $pagination,
        ]);
    }

    protected function exportReport(string $reportName, array $filters, \Closure $resolver)
    {
        $format = (string) ($filters['format'] ?? 'csv');
        unset($filters['format']);

        $result = $resolver($filters);
        $rows = $this->reportService->rowsToArray($result['rows']);

        return $this->reportExportService->export(
            $reportName,
            $format,
            $result['columns'] ?? [],
            $rows,
        );
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function baseRules(): array
    {
        return [
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date', 'after_or_equal:from_date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort_by' => ['nullable', 'string', 'max:100'],
            'sort_dir' => ['nullable', 'in:asc,desc'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }
}
