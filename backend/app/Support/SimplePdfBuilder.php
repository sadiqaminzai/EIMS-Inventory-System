<?php

namespace App\Support;

class SimplePdfBuilder
{
    private const PAGE_WIDTH_CHARS = 92;

    /**
     * Build a lightweight table-style PDF without external dependencies.
     *
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|float|null>>  $rows
     */
    public static function table(string $title, array $headers, array $rows): string
    {
        return self::tableWithSummary($title, [], $headers, $rows);
    }

    /**
     * @param  array<int, string>  $summaryLines
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|float|null>>  $rows
     */
    public static function tableWithSummary(string $title, array $summaryLines, array $headers, array $rows): string
    {
        $lines = [];
        $lines[] = self::centerText(strtoupper($title));
        $lines[] = self::centerText('Generated: '.now()->toDateTimeString());
        $lines[] = '';
        if ($summaryLines !== []) {
            $lines[] = self::centerText('TOTALS');
            foreach ($summaryLines as $line) {
                $lines[] = self::formatSummaryLine($line);
            }
            $lines[] = '';
        }
        $widths = self::resolveColumnWidths($headers, $rows);
        $lines[] = self::formatRow($headers, $widths);
        $lines[] = self::buildSeparator($widths);

        foreach ($rows as $row) {
            $lines[] = self::formatRow($row, $widths);
        }

        return self::buildDocument($lines);
    }

    /**
     * @param  array<int, string>  $columns
     */
    protected static function joinColumns(array $columns): string
    {
        $prepared = array_map(function (string $value): string {
            $trimmed = trim($value);
            return mb_strlen($trimmed) > 18 ? mb_substr($trimmed, 0, 18).'...' : $trimmed;
        }, $columns);

        return implode(' | ', $prepared);
    }

    /**
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|float|null>>  $rows
     * @return array<int, int>
     */
    protected static function resolveColumnWidths(array $headers, array $rows): array
    {
        $columnCount = max(1, count($headers));
        $usableWidth = self::PAGE_WIDTH_CHARS - (($columnCount - 1) * 3);
        $baseWidth = max(8, (int) floor($usableWidth / $columnCount));

        $widths = array_fill(0, $columnCount, $baseWidth);

        foreach ($headers as $index => $header) {
            $widths[$index] = max($widths[$index], min(24, mb_strlen((string) $header) + 2));
        }

        foreach ($rows as $row) {
            foreach ($row as $index => $value) {
                if (!array_key_exists($index, $widths)) {
                    continue;
                }

                $widths[$index] = max($widths[$index], min(24, mb_strlen((string) ($value ?? '')) + 2));
            }
        }

        $totalWidth = array_sum($widths) + (($columnCount - 1) * 3);
        if ($totalWidth > self::PAGE_WIDTH_CHARS) {
            $overflow = $totalWidth - self::PAGE_WIDTH_CHARS;
            while ($overflow > 0) {
                for ($i = $columnCount - 1; $i >= 0 && $overflow > 0; $i--) {
                    if ($widths[$i] > 8) {
                        $widths[$i]--;
                        $overflow--;
                    }
                }
            }
        }

        return $widths;
    }

    /**
     * @param  array<int, string|int|float|null>  $values
     * @param  array<int, int>  $widths
     */
    protected static function formatRow(array $values, array $widths): string
    {
        $cells = [];
        foreach ($widths as $index => $width) {
            $value = self::sanitize((string) ($values[$index] ?? ''));
            $value = self::truncate($value, $width);
            $cells[] = str_pad($value, $width, ' ', STR_PAD_RIGHT);
        }

        return implode(' | ', $cells);
    }

    protected static function formatSummaryLine(string $line): string
    {
        $clean = self::sanitize($line);
        if (str_contains($clean, ':')) {
            [$label, $value] = array_pad(explode(':', $clean, 2), 2, '');
            return str_pad(trim($label), 30, ' ', STR_PAD_RIGHT).' : '.trim($value);
        }

        return $clean;
    }

    protected static function centerText(string $value): string
    {
        $clean = self::sanitize($value);
        $padding = max(0, (int) floor((self::PAGE_WIDTH_CHARS - mb_strlen($clean)) / 2));
        return str_repeat(' ', $padding).$clean;
    }

    protected static function buildSeparator(array $widths): string
    {
        $segments = array_map(static fn (int $width): string => str_repeat('-', max(8, $width)), $widths);
        return implode('-+-', $segments);
    }

    protected static function truncate(string $value, int $limit): string
    {
        if ($limit < 4) {
            return mb_substr($value, 0, max(0, $limit));
        }

        return mb_strlen($value) > $limit ? mb_substr($value, 0, $limit - 3).'...' : $value;
    }

    protected static function sanitize(string $value): string
    {
        $value = str_replace(["\r", "\n", "\t"], ' ', $value);
        return preg_replace('/\s+/', ' ', trim($value)) ?? '';
    }

    /**
     * @param  array<int, string>  $lines
     */
    protected static function buildDocument(array $lines): string
    {
        $linesPerPage = 48;
        $chunks = array_chunk($lines, $linesPerPage);

        $objects = [];
        $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

        $pageObjectIds = [];
        $contentObjectIds = [];

        $nextId = 3;
        foreach ($chunks as $_chunk) {
            $pageObjectIds[] = $nextId++;
            $contentObjectIds[] = $nextId++;
        }

        $kids = implode(' ', array_map(fn (int $id) => $id.' 0 R', $pageObjectIds));
        $objects[2] = "<< /Type /Pages /Count ".count($pageObjectIds)." /Kids [{$kids}] >>";

        foreach ($chunks as $index => $chunk) {
            $pageObjectId = $pageObjectIds[$index];
            $contentObjectId = $contentObjectIds[$index];

            $stream = self::buildPageStream($chunk);
            $objects[$contentObjectId] = "<< /Length ".strlen($stream)." >>\nstream\n{$stream}\nendstream";

            $objects[$pageObjectId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ".($nextId)." 0 R >> >> /Contents {$contentObjectId} 0 R >>";
        }

        // Font object id is always the last one.
        $fontObjectId = $nextId;
        $objects[$fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

        // Replace temporary font references.
        foreach ($pageObjectIds as $pageObjectId) {
            $objects[$pageObjectId] = str_replace(($nextId).' 0 R', $fontObjectId.' 0 R', $objects[$pageObjectId]);
        }

        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [0 => 0];

        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= $id." 0 obj\n".$body."\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $maxObjectId = max(array_keys($objects));

        $pdf .= "xref\n0 ".($maxObjectId + 1)."\n";
        $pdf .= "0000000000 65535 f \n";

        for ($i = 1; $i <= $maxObjectId; $i++) {
            $offset = $offsets[$i] ?? 0;
            $pdf .= str_pad((string) $offset, 10, '0', STR_PAD_LEFT)." 00000 n \n";
        }

        $pdf .= "trailer\n<< /Size ".($maxObjectId + 1)." /Root 1 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }

    /**
     * @param  array<int, string>  $lines
     */
    protected static function buildPageStream(array $lines): string
    {
        $y = 805;
        $leading = 15;

        $escapedLines = array_map(function (string $line): string {
            $line = str_replace('\\', '\\\\', $line);
            $line = str_replace('(', '\\(', $line);
            $line = str_replace(')', '\\)', $line);
            return $line;
        }, $lines);

        $stream = "BT\n/F1 10 Tf\n{$leading} TL\n40 {$y} Td\n";

        foreach ($escapedLines as $index => $line) {
            if ($index === 0) {
                $stream .= "({$line}) Tj\n";
            } else {
                $stream .= "T*\n({$line}) Tj\n";
            }
        }

        $stream .= "ET";

        return $stream;
    }
}
