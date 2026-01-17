<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\InventoryBatch;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function purchase(Request $request)
    {
        $data = $this->validateOrder($request);
        $supplier = Supplier::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $supplier, $request) {
            return $this->createPurchaseOrder($data, $supplier, $request);
        });

        return response()->json($order->load('items'), 201);
    }

    public function updatePurchase(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'purchase') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        $data = $this->validateOrder($request);
        $supplier = Supplier::findOrFail($data['party_id']);

        $updated = DB::transaction(function () use ($order, $data, $supplier, $request) {
            $orderItems = $order->items()->get();
            $orderItemIds = $orderItems->pluck('id');

            $batchIds = InventoryLog::whereIn('order_item_id', $orderItemIds)
                ->pluck('batch_id')
                ->unique();

            $hasUsage = InventoryBatch::whereIn('id', $batchIds)
                ->whereColumn('quantity_remaining', '<', 'quantity_initial')
                ->exists();

            if ($hasUsage) {
                throw ValidationException::withMessages([
                    'purchase' => ['Cannot edit this purchase because stock has been used.'],
                ]);
            }

            InventoryLog::whereIn('order_item_id', $orderItemIds)->delete();
            InventoryBatch::whereIn('id', $batchIds)->delete();
            OrderItem::whereIn('id', $orderItemIds)->delete();

            $order->update([
                'party_id' => $supplier->id,
                'party_type' => Supplier::class,
                'transaction_date' => $data['date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => 0,
                'updated_by' => $request->user()->id,
            ]);

            return $this->createPurchaseOrder($data, $supplier, $request, $order);
        });

        return response()->json($updated->load('items'));
    }

    public function deletePurchase(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'purchase') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        DB::transaction(function () use ($order) {
            $orderItems = $order->items()->get();
            $orderItemIds = $orderItems->pluck('id');

            $batchIds = InventoryLog::whereIn('order_item_id', $orderItemIds)
                ->pluck('batch_id')
                ->unique();

            $hasUsage = InventoryBatch::whereIn('id', $batchIds)
                ->whereColumn('quantity_remaining', '<', 'quantity_initial')
                ->exists();

            if ($hasUsage) {
                throw ValidationException::withMessages([
                    'purchase' => ['Cannot delete this purchase because stock has been used.'],
                ]);
            }

            InventoryLog::whereIn('order_item_id', $orderItemIds)->delete();
            InventoryBatch::whereIn('id', $batchIds)->delete();
            OrderItem::whereIn('id', $orderItemIds)->delete();
            $order->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }

    public function sale(Request $request)
    {
        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $customer, $request) {
            $order = Order::create([
                'transaction_type' => 'sale',
                'reference_number' => (string) Str::uuid(),
                'user_id' => $request->user()->id,
                'party_type' => Customer::class,
                'party_id' => $customer->id,
                'status' => 'completed',
                'total_amount' => 0,
                'notes' => $data['notes'] ?? null,
                'transaction_date' => $data['date'],
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->assignReferenceNumber($order);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = $item['quantity'];

                $batches = InventoryBatch::query()
                    ->where('product_id', $product->id)
                    ->where('quantity_remaining', '>', 0)
                    ->orderBy('received_date')
                    ->lockForUpdate()
                    ->get();

                $availableQty = $batches->sum('quantity_remaining');
                if ($availableQty < $requestedQty) {
                    throw ValidationException::withMessages([
                        'stock' => ['Insufficient stock for product: '.$product->name],
                    ]);
                }

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $requestedQty,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $requestedQty * $item['unit_price'],
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $remaining = $requestedQty;

                foreach ($batches as $batch) {
                    if ($remaining <= 0) {
                        break;
                    }

                    $deduct = min($batch->quantity_remaining, $remaining);
                    $batch->update([
                        'quantity_remaining' => $batch->quantity_remaining - $deduct,
                        'updated_by' => $request->user()->id,
                    ]);

                    $runningBalance = InventoryBatch::where('product_id', $product->id)
                        ->sum('quantity_remaining');

                    InventoryLog::create([
                        'transaction_type' => 'out',
                        'order_item_id' => $orderItem->id,
                        'batch_id' => $batch->id,
                        'quantity_change' => -$deduct,
                        'running_balance' => $runningBalance,
                        'created_at' => now(),
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);

                    $remaining -= $deduct;
                }

                $total += $orderItem->total_price;
            }

            $order->update(['total_amount' => $total]);

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function updateSale(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'sale') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $updated = DB::transaction(function () use ($order, $data, $customer, $request) {
            $this->restoreSaleInventory($order, $request);

            $order->update([
                'party_id' => $customer->id,
                'party_type' => Customer::class,
                'transaction_date' => $data['date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => 0,
                'updated_by' => $request->user()->id,
            ]);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = $item['quantity'];

                $batches = InventoryBatch::query()
                    ->where('product_id', $product->id)
                    ->where('quantity_remaining', '>', 0)
                    ->orderBy('received_date')
                    ->lockForUpdate()
                    ->get();

                $availableQty = $batches->sum('quantity_remaining');
                if ($availableQty < $requestedQty) {
                    throw ValidationException::withMessages([
                        'stock' => ['Insufficient stock for product: '.$product->name],
                    ]);
                }

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $requestedQty,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $requestedQty * $item['unit_price'],
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $remaining = $requestedQty;

                foreach ($batches as $batch) {
                    if ($remaining <= 0) {
                        break;
                    }

                    $deduct = min($batch->quantity_remaining, $remaining);
                    $batch->update([
                        'quantity_remaining' => $batch->quantity_remaining - $deduct,
                        'updated_by' => $request->user()->id,
                    ]);

                    $runningBalance = InventoryBatch::where('product_id', $product->id)
                        ->sum('quantity_remaining');

                    InventoryLog::create([
                        'transaction_type' => 'out',
                        'order_item_id' => $orderItem->id,
                        'batch_id' => $batch->id,
                        'quantity_change' => -$deduct,
                        'running_balance' => $runningBalance,
                        'created_at' => now(),
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);

                    $remaining -= $deduct;
                }

                $total += $orderItem->total_price;
            }

            $order->update(['total_amount' => $total, 'updated_by' => $request->user()->id]);

            return $order;
        });

        return response()->json($updated->load('items'));
    }

    public function deleteSale(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'sale') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        DB::transaction(function () use ($order, $request) {
            $this->restoreSaleInventory($order, $request);
            $order->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }

    public function returnIn(Request $request)
    {
        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $customer, $request) {
            $order = Order::create([
                'transaction_type' => 'return_in',
                'reference_number' => (string) Str::uuid(),
                'user_id' => $request->user()->id,
                'party_type' => Customer::class,
                'party_id' => $customer->id,
                'status' => 'completed',
                'total_amount' => 0,
                'notes' => $data['notes'] ?? null,
                'transaction_date' => $data['date'],
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $this->assignReferenceNumber($order);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $totalPrice = $item['quantity'] * $item['unit_price'];

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $batch = InventoryBatch::create([
                    'product_id' => $product->id,
                    'supplier_id' => null,
                    'batch_number' => $this->generateBatchNumber(),
                    'cost_price' => $item['unit_price'],
                    'quantity_initial' => $item['quantity'],
                    'quantity_remaining' => $item['quantity'],
                    'received_date' => $data['date'],
                    'expiry_date' => $item['expiry_date'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $runningBalance = InventoryBatch::where('product_id', $product->id)
                    ->sum('quantity_remaining');

                InventoryLog::create([
                    'transaction_type' => 'in',
                    'order_item_id' => $orderItem->id,
                    'batch_id' => $batch->id,
                    'quantity_change' => $item['quantity'],
                    'running_balance' => $runningBalance,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $total += $totalPrice;
            }

            $order->update(['total_amount' => $total]);

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function updateReturnIn(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'return_in') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $updated = DB::transaction(function () use ($order, $data, $customer, $request) {
            $this->deleteReturnBatches($order);

            $order->update([
                'party_id' => $customer->id,
                'party_type' => Customer::class,
                'transaction_date' => $data['date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => 0,
                'updated_by' => $request->user()->id,
            ]);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $totalPrice = $item['quantity'] * $item['unit_price'];

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $batch = InventoryBatch::create([
                    'product_id' => $product->id,
                    'supplier_id' => null,
                    'batch_number' => $this->generateBatchNumber(),
                    'cost_price' => $item['unit_price'],
                    'quantity_initial' => $item['quantity'],
                    'quantity_remaining' => $item['quantity'],
                    'received_date' => $data['date'],
                    'expiry_date' => $item['expiry_date'] ?? null,
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $runningBalance = InventoryBatch::where('product_id', $product->id)
                    ->sum('quantity_remaining');

                InventoryLog::create([
                    'transaction_type' => 'in',
                    'order_item_id' => $orderItem->id,
                    'batch_id' => $batch->id,
                    'quantity_change' => $item['quantity'],
                    'running_balance' => $runningBalance,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $total += $totalPrice;
            }

            $order->update(['total_amount' => $total, 'updated_by' => $request->user()->id]);

            return $order;
        });

        return response()->json($updated->load('items'));
    }

    public function deleteReturnIn(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'return_in') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        DB::transaction(function () use ($order) {
            $this->deleteReturnBatches($order);
            $order->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }

    public function history(Request $request)
    {
        $query = Order::query()->with('items');

        if ($request->filled('type')) {
            $query->where('transaction_type', $request->input('type'));
        }

        return $query->orderByDesc('transaction_date')->paginate(15);
    }

    protected function validateOrder(Request $request): array
    {
        return $request->validate([
            'party_id' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    protected function createPurchaseOrder(array $data, Supplier $supplier, Request $request, ?Order $order = null): Order
    {
        $order = $order ?? Order::create([
            'transaction_type' => 'purchase',
            'reference_number' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'party_type' => Supplier::class,
            'party_id' => $supplier->id,
            'status' => 'completed',
            'total_amount' => 0,
            'notes' => $data['notes'] ?? null,
            'transaction_date' => $data['date'],
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        $this->assignReferenceNumber($order);

        $total = 0;

        foreach ($data['items'] as $item) {
            $product = Product::findOrFail($item['product_id']);
            $totalPrice = $item['quantity'] * $item['unit_price'];

            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'total_price' => $totalPrice,
                'created_at' => now(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $batch = InventoryBatch::create([
                'product_id' => $product->id,
                'supplier_id' => $supplier->id,
                'batch_number' => $this->generateBatchNumber(),
                'cost_price' => $item['unit_price'],
                'quantity_initial' => $item['quantity'],
                'quantity_remaining' => $item['quantity'],
                'received_date' => $data['date'],
                'expiry_date' => $item['expiry_date'] ?? null,
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $runningBalance = InventoryBatch::where('product_id', $product->id)
                ->sum('quantity_remaining');

            InventoryLog::create([
                'transaction_type' => 'in',
                'order_item_id' => $orderItem->id,
                'batch_id' => $batch->id,
                'quantity_change' => $item['quantity'],
                'running_balance' => $runningBalance,
                'created_at' => now(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $total += $totalPrice;
        }

        $order->update([
            'total_amount' => $total,
            'updated_by' => $request->user()->id,
        ]);

        return $order;
    }

    protected function restoreSaleInventory(Order $order, Request $request): void
    {
        $orderItems = $order->items()->get();
        $orderItemIds = $orderItems->pluck('id');

        foreach ($orderItems as $item) {
            $logs = InventoryLog::where('order_item_id', $item->id)->get();

            foreach ($logs as $log) {
                $batch = InventoryBatch::find($log->batch_id);
                if ($batch) {
                    $batch->update([
                        'quantity_remaining' => $batch->quantity_remaining + abs($log->quantity_change),
                        'updated_by' => $request->user()->id,
                    ]);
                }
            }

            InventoryLog::where('order_item_id', $item->id)->delete();
        }

        OrderItem::whereIn('id', $orderItemIds)->delete();
    }

    protected function deleteReturnBatches(Order $order): void
    {
        $orderItems = $order->items()->get();
        $orderItemIds = $orderItems->pluck('id');

        $batchIds = InventoryLog::whereIn('order_item_id', $orderItemIds)
            ->pluck('batch_id')
            ->unique();

        $hasUsage = InventoryBatch::whereIn('id', $batchIds)
            ->whereColumn('quantity_remaining', '<', 'quantity_initial')
            ->exists();

        if ($hasUsage) {
            throw ValidationException::withMessages([
                'return' => ['Cannot edit/delete this return because stock has been used.'],
            ]);
        }

        InventoryLog::whereIn('order_item_id', $orderItemIds)->delete();
        InventoryBatch::whereIn('id', $batchIds)->delete();
        OrderItem::whereIn('id', $orderItemIds)->delete();
    }

    protected function assignReferenceNumber(Order $order): void
    {
        $prefix = match ($order->transaction_type) {
            'purchase' => 'P',
            'sale' => 'S',
            'return_in' => 'R',
            default => 'T',
        };
        $expected = $prefix.'-'.$order->id;

        if ($order->reference_number === $expected) {
            return;
        }

        if (preg_match('/^[PSR]-\d+$/', (string) $order->reference_number)) {
            return;
        }

        $order->forceFill([
            'reference_number' => $expected,
        ])->save();
    }

    protected function generateBatchNumber(): string
    {
        return 'BATCH-'.Str::upper(Str::random(10));
    }
}
