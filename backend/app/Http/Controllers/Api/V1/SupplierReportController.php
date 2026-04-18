<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SupplierReportController extends Controller
{
    public function aging(Request $request)
    {
        $data = $request->validate([
            'as_of_date' => ['nullable', 'date'],
        ]);

        $asOfDate = isset($data['as_of_date'])
            ? Carbon::parse($data['as_of_date'])->endOfDay()
            : now()->endOfDay();

        $orders = Order::query()
            ->where('transaction_type', 'purchase')
            ->where('party_type', Supplier::class)
            ->where('due_amount', '>', 0)
            ->orderBy('transaction_date')
            ->get(['id', 'serial_no', 'party_id', 'transaction_date', 'net_amount', 'paid_amount', 'due_amount']);

        $supplierMap = Supplier::query()
            ->whereIn('id', $orders->pluck('party_id')->unique()->filter())
            ->pluck('name', 'id');

        $totals = [
            '0_30' => 0.0,
            '31_60' => 0.0,
            '61_90' => 0.0,
            '90_plus' => 0.0,
            'total_due' => 0.0,
        ];

        $supplierSummary = [];
        $orderRows = [];

        foreach ($orders as $order) {
            $daysOverdue = max(0, Carbon::parse($order->transaction_date)->startOfDay()->diffInDays($asOfDate, false));
            $bucket = $this->resolveBucket($daysOverdue);
            $due = (float) $order->due_amount;
            $supplierId = (int) $order->party_id;

            if (! isset($supplierSummary[$supplierId])) {
                $supplierSummary[$supplierId] = [
                    'supplier_id' => $supplierId,
                    'supplier_name' => $supplierMap[$supplierId] ?? 'Unknown Supplier',
                    '0_30' => 0.0,
                    '31_60' => 0.0,
                    '61_90' => 0.0,
                    '90_plus' => 0.0,
                    'total_due' => 0.0,
                    'open_orders' => 0,
                ];
            }

            $supplierSummary[$supplierId][$bucket] += $due;
            $supplierSummary[$supplierId]['total_due'] += $due;
            $supplierSummary[$supplierId]['open_orders']++;

            $totals[$bucket] += $due;
            $totals['total_due'] += $due;

            $orderRows[] = [
                'order_id' => $order->id,
                'serial_no' => $order->serial_no,
                'supplier_id' => $supplierId,
                'supplier_name' => $supplierMap[$supplierId] ?? 'Unknown Supplier',
                'transaction_date' => Carbon::parse($order->transaction_date)->toDateString(),
                'net_amount' => (float) $order->net_amount,
                'paid_amount' => (float) $order->paid_amount,
                'due_amount' => $due,
                'days_overdue' => $daysOverdue,
                'aging_bucket' => $bucket,
            ];
        }

        return response()->json([
            'as_of_date' => $asOfDate->toDateString(),
            'summary' => $totals,
            'suppliers' => array_values($supplierSummary),
            'orders' => $orderRows,
        ]);
    }

    protected function resolveBucket(int $days): string
    {
        if ($days <= 30) {
            return '0_30';
        }

        if ($days <= 60) {
            return '31_60';
        }

        if ($days <= 90) {
            return '61_90';
        }

        return '90_plus';
    }
}
