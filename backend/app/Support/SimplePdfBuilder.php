<?php

namespace App\Support;

class SimplePdfBuilder
{
    /**
     * Build a lightweight table-style PDF without external dependencies.
     *
     * @param  array<int, string>  $headers
     * @param  array<int, array<int, string|int|float|null>>  $rows
     */
    public static function table(string $title, array $headers, array $rows): string
    {
        $lines = [];
        $lines[] = strtoupper($title);
        $lines[] = 'Generated: '.now()->toDateTimeString();
        $lines[] = '';
        $lines[] = self::joinColumns($headers);
        $lines[] = str_repeat('-', 140);

        foreach ($rows as $row) {
            $lineValues = [];
            foreach ($row as $value) {
                $lineValues[] = self::sanitize((string) ($value ?? ''));
            }
            $lines[] = self::joinColumns($lineValues);
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
            return mb_strlen($trimmed) > 30 ? mb_substr($trimmed, 0, 30).'...' : $trimmed;
        }, $columns);

        return implode(' | ', $prepared);
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
