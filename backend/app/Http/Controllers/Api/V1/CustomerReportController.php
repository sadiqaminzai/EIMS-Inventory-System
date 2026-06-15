<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CustomerReportController extends Controller
{
    public function aging(Request $request)
    {
        $data = $request->validate([
            'as_of_date' => ['nullable', 'date'],
            'customer_id' => ['nullable', 'integer'],
        ]);

        $asOfDate = isset($data['as_of_date'])
            ? Carbon::parse($data['as_of_date'])->endOfDay()
            : now()->endOfDay();

        $orders = Order::query()
            ->where('transaction_type', 'sale')
            ->where('party_type', Customer::class)
            ->where('due_amount', '>', 0)
            ->when(!empty($data['customer_id']), function ($query) use ($data): void {
                $query->where('party_id', (int) $data['customer_id']);
            })
            ->orderBy('transaction_date')
            ->get(['id', 'serial_no', 'party_id', 'transaction_date', 'net_amount', 'paid_amount', 'due_amount']);

        $customerMap = Customer::query()
            ->whereIn('id', $orders->pluck('party_id')->unique()->filter())
            ->pluck('name', 'id');

        $totals = [
            '0_30' => 0.0,
            '31_60' => 0.0,
            '61_90' => 0.0,
            '90_plus' => 0.0,
            'total_due' => 0.0,
        ];

        $customerSummary = [];
        $orderRows = [];

        foreach ($orders as $order) {
            $daysOverdue = max(0, Carbon::parse($order->transaction_date)->startOfDay()->diffInDays($asOfDate, false));
            $bucket = $this->resolveBucket($daysOverdue);
            $due = (float) $order->due_amount;
            $customerId = (int) $order->party_id;

            if (! isset($customerSummary[$customerId])) {
                $customerSummary[$customerId] = [
                    'customer_id' => $customerId,
                    'customer_name' => $customerMap[$customerId] ?? 'Unknown Customer',
                    '0_30' => 0.0,
                    '31_60' => 0.0,
                    '61_90' => 0.0,
                    '90_plus' => 0.0,
                    'total_due' => 0.0,
                    'open_orders' => 0,
                ];
            }

            $customerSummary[$customerId][$bucket] += $due;
            $customerSummary[$customerId]['total_due'] += $due;
            $customerSummary[$customerId]['open_orders']++;

            $totals[$bucket] += $due;
            $totals['total_due'] += $due;

            $orderRows[] = [
                'order_id' => $order->id,
                'serial_no' => $order->serial_no,
                'customer_id' => $customerId,
                'customer_name' => $customerMap[$customerId] ?? 'Unknown Customer',
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
            'customers' => array_values($customerSummary),
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
