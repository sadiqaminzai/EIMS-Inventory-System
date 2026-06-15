<?php

namespace App\Services\Reports;

use App\Support\SimplePdfBuilder;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportService
{
    /**
     * @param  array<string, string>  $columns
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function export(string $reportName, string $format, array $columns, array $rows): StreamedResponse|\Illuminate\Http\Response
    {
        $normalized = strtolower($format);

        return $normalized === 'pdf'
            ? $this->exportPdf($reportName, $columns, $rows)
            : $this->exportCsv($reportName, $columns, $rows);
    }

    /**
     * @param  array<string, string>  $columns
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function exportCsv(string $reportName, array $columns, array $rows): StreamedResponse
    {
        $filename = $this->buildFilename($reportName, 'csv');
        $headers = array_values($columns);
        $keys = array_keys($columns);

        return response()->streamDownload(function () use ($headers, $keys, $rows): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, $headers);
            foreach ($rows as $row) {
                $line = [];
                foreach ($keys as $key) {
                    $line[] = $row[$key] ?? null;
                }
                fputcsv($handle, $line);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @param  array<string, string>  $columns
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function exportPdf(string $reportName, array $columns, array $rows): \Illuminate\Http\Response
    {
        $filename = $this->buildFilename($reportName, 'pdf');
        $keys = array_keys($columns);

        $preparedRows = array_map(function (array $row) use ($keys): array {
            $line = [];
            foreach ($keys as $key) {
                $line[] = $row[$key] ?? '';
            }
            return $line;
        }, $rows);

        $pdf = SimplePdfBuilder::table($reportName, array_values($columns), $preparedRows);
        $contentDisposition = 'attachment; filename="'.$filename.'"; filename*=UTF-8\'' . rawurlencode($filename);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => $contentDisposition,
        ]);
    }

    protected function buildFilename(string $reportName, string $extension): string
    {
        $safe = strtolower(trim(preg_replace('/[^a-zA-Z0-9\s_-]+/', '', $reportName) ?? 'report'));
        $safe = preg_replace('/\s+/', '-', $safe) ?? 'report';

        return $safe.'-'.now()->format('Ymd_His').'.'.$extension;
    }
}
