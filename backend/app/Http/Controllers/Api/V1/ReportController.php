<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Reports\InventoryReportService;
use App\Services\Reports\ReportExportService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

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
            'brand_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->batchWise($filters));
    }

    public function batchWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
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
            'brand_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'show_only_expiry_date' => ['nullable', 'boolean'],
            'show_with_cost_price' => ['nullable', 'boolean'],
            'near_expiry_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]));

        return $this->jsonReportResponse($this->reportService->expiryWise($filters));
    }

    public function expiryWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'brand_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'show_only_expiry_date' => ['nullable', 'boolean'],
            'show_with_cost_price' => ['nullable', 'boolean'],
            'near_expiry_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        if (($filters['format'] ?? 'csv') === 'pdf') {
            $result = $this->reportService->expiryWise($filters, true);
            $rows = $this->reportService->rowsToArray($result['rows']);
            $summary = $result['summary'] ?? [];
            $withCostPrice = !empty($filters['show_with_cost_price']);

            $pdf = $this->renderExpiryWisePdf(
                $request->user(),
                $result['columns'] ?? [],
                $rows,
                $summary,
                $filters,
                $withCostPrice,
            );

            $filename = 'expiry_report_'.now()->format('Y-m-d').'.pdf';
            $contentDisposition = 'attachment; filename="'.$filename.'"; filename*=UTF-8\'' . rawurlencode($filename);

            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => $contentDisposition,
            ]);
        }

        return $this->exportReport('Expiry Wise Report', $filters, function (array $params) {
            return $this->reportService->expiryWise($params, true);
        });
    }

    public function productBatchWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->productBatchWise($filters));
    }

    public function productBatchWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
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
            'brand_id' => ['nullable', 'integer'],
        ]));

        return $this->jsonReportResponse($this->reportService->salesAndStock($filters));
    }

    public function salesAndStockExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Sales and Stock Report', $filters, function (array $params) {
            return $this->reportService->salesAndStock($params, true);
        });
    }

    public function salesAndStockBatchWise(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->salesAndStockBatchWise($filters));
    }

    public function salesAndStockBatchWiseExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
            'format' => ['nullable', 'in:csv,pdf'],
        ]));

        return $this->exportReport('Sales and Stock Batch Wise Report', $filters, function (array $params) {
            return $this->reportService->salesAndStockBatchWise($params, true);
        });
    }

    public function availableStock(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
            'batch_no' => ['nullable', 'string', 'max:100'],
        ]));

        return $this->jsonReportResponse($this->reportService->availableStock($filters));
    }

    public function availableStockExport(Request $request)
    {
        $filters = $request->validate(array_merge($this->baseRules(), [
            'product_id' => ['nullable', 'integer'],
            'brand_id' => ['nullable', 'integer'],
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
     * @param  array<string, string>  $columns
     * @param  array<int, array<string, mixed>>  $rows
     * @param  array<string, mixed>  $summary
     * @param  array<string, mixed>  $filters
     */
    protected function renderExpiryWisePdf($user, array $columns, array $rows, array $summary, array $filters, bool $withCostPrice): string
    {
        $tenant = $user?->tenant;
        $companyName = $tenant?->name ?? $user?->tenant_name ?? $user?->name ?? 'Company Name';
        $companyAddress = $tenant?->address ?? '';
        $companyPhone = $tenant?->phone ?? '';
        $companyEmail = $tenant?->email ?? '';
        $reportPeriod = ($filters['from_date'] ?? null) || ($filters['to_date'] ?? null)
            ? 'From '.$this->formatPdfDate($filters['from_date'] ?? null).' to '.$this->formatPdfDate($filters['to_date'] ?? null)
            : (($filters['as_of_date'] ?? null) ? 'As of '.$this->formatPdfDate($filters['as_of_date'] ?? null) : '');

        $summaryCards = [
            ['label' => 'No. of Items', 'value' => (string) ($summary['total_batches'] ?? count($rows))],
        ];

        if ($withCostPrice) {
            $summaryCards[] = ['label' => 'Total Amount in Cost Price', 'value' => $this->formatMoney((float) ($summary['total_cost_amount'] ?? 0))];
        }

        $summaryCards[] = ['label' => 'Total Amount in Sale Price', 'value' => $this->formatMoney((float) ($summary['total_sale_amount'] ?? 0))];

        $headers = array_values($columns);
        $keys = array_keys($columns);

        $rowsHtml = '';
        if ($rows === []) {
            $rowsHtml = '<tr><td colspan="'.count($headers).'" class="empty-row">No records found</td></tr>';
        } else {
            foreach ($rows as $row) {
                $rowsHtml .= '<tr>';
                foreach ($keys as $key) {
                    $rowsHtml .= '<td>'.$this->escapePdfHtml($this->formatPdfCellValue($key, $row[$key] ?? null)).'</td>';
                }
                $rowsHtml .= '</tr>';
            }
        }

        $cardCount = count($summaryCards);
        $cardWidth = $cardCount === 3 ? '33.333%' : ($cardCount === 2 ? '50%' : '100%');

        $summaryHtml = '';
        foreach ($summaryCards as $card) {
            $summaryHtml .= '<td style="width:'.$cardWidth.'; vertical-align: top; padding-right: 10px;">'
                .'<table class="summary-card"><tr><td>'
                .'<div class="summary-label">'.$this->escapePdfHtml($card['label']).'</div>'
                .'<div class="summary-value">'.$this->escapePdfHtml($card['value']).'</div>'
                .'</td></tr></table>'
                .'</td>';
        }

        $contactHtml = '';
        if ($companyPhone || $companyEmail) {
            $contactHtml = '<div class="contact-row">'
                .($companyPhone ? '<span class="contact-chip">Phone: '.$this->escapePdfHtml($companyPhone).'</span>' : '')
                .($companyEmail ? '<span class="contact-chip">Email: '.$this->escapePdfHtml($companyEmail).'</span>' : '')
                .'</div>';
        }

        $logoHtml = '';
        if (!empty($tenant?->logo)) {
            $logoHtml = '<td class="logo-cell"><img src="'.$this->escapePdfHtml((string) $tenant->logo).'" alt="Logo"></td>';
        }

        $html = '<html><head><style>
            @page { size: A4 landscape; margin: 18px 22px; }
            body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 11px; color: #111827; }
            .header { width: 100%; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 10px; }
            .header-table { width: 100%; border-collapse: collapse; }
            .brand-block { padding-left: 10px; border-left: 4px solid #111827; }
            .company { font-size: 20px; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
            .meta-line { font-size: 11px; color: #374151; margin-top: 3px; }
            .contact-row { margin-top: 6px; }
            .contact-chip { display: inline-block; font-size: 10px; border: 1px solid #d1d5db; border-radius: 999px; padding: 3px 8px; margin-right: 6px; background: #f9fafb; }
            .title-box { text-align: right; }
            .title { font-size: 18px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
            .report-period { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; margin: 8px 0 10px 0; }
            .report-period td { padding: 8px 12px; }
            .report-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #4b5563; white-space: nowrap; }
            .report-value { font-size: 12px; font-weight: 700; color: #111827; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            .report-table th, .report-table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
            .report-table th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; font-size: 10px; }
            .report-table td { font-size: 10px; }
            .empty-row { text-align: center; font-style: italic; color: #6b7280; padding: 16px; }
            .summary-wrap { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; }
            .summary-card { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; }
            .summary-card td { padding: 12px 14px; }
            .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 6px; }
            .summary-value { font-size: 16px; font-weight: 700; color: #111827; }
            .logo-cell { width: 76px; vertical-align: top; padding-right: 10px; }
            .logo-cell img { width: 72px; height: 72px; object-fit: contain; }
        </style></head><body>'
            .'<div class="header"><table class="header-table"><tr>'
            .$logoHtml
            .'<td><div class="brand-block"><div class="company">'.$this->escapePdfHtml($companyName).'</div>'
            .'<div class="meta-line">'.$this->escapePdfHtml($companyAddress).'</div>'
            .$contactHtml
            .'</div></td>'
            .'<td class="title-box"><div class="title">Expiry Wise</div><div class="meta-line">Print Date: '.now()->format('m/d/Y').'</div></td>'
            .'</tr></table></div>'
            .($reportPeriod ? '<table class="report-period"><tr><td class="report-label">Report Period</td><td class="report-value">'.$this->escapePdfHtml($reportPeriod).'</td></tr></table>' : '')
            .'<table class="report-table"><thead><tr>';

        foreach ($headers as $header) {
            $html .= '<th>'.$this->escapePdfHtml($header).'</th>';
        }

        $html .= '</tr></thead><tbody>'.$rowsHtml.'</tbody></table>';

        $html .= '<table class="summary-wrap"><tr>'.$summaryHtml.'</tr></table>';

        $html .= '</body></html>';

        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'Arial');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return $dompdf->output();
    }

    protected function formatPdfCellValue(string $key, mixed $value): string
    {
        if ($value === null || $value === '') {
            return '-';
        }

        if (str_contains($key, 'date') && is_string($value)) {
            try {
                return Carbon::parse($value)->format('m/d/Y');
            } catch (\Throwable) {
                return (string) $value;
            }
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_numeric($value) && preg_match('/(amount|price|qty|quantity|days|total|remaining)/i', $key)) {
            return number_format((float) $value, 2, '.', ',');
        }

        return (string) $value;
    }

    protected function formatPdfDate(?string $value): string
    {
        if (empty($value)) {
            return '-';
        }

        try {
            return Carbon::parse($value)->format('m/d/Y');
        } catch (\Throwable) {
            return $value;
        }
    }

    protected function formatMoney(float $value): string
    {
        return number_format($value, 2, '.', ',');
    }

    protected function escapePdfHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function baseRules(): array
    {
        return [
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date', 'after_or_equal:from_date'],
            'as_of_date' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort_by' => ['nullable', 'string', 'max:100'],
            'sort_dir' => ['nullable', 'in:asc,desc'],
            'search' => ['nullable', 'string', 'max:255'],
            'show_only_positive_stock' => ['nullable', 'boolean'],
            'client_id' => ['nullable', 'string', 'max:100'],
        ];
    }
}
