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
use Illuminate\Support\Carbon;
use App\Support\ModuleSequenceService;
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
                $logsByItem = InventoryLog::whereIn('order_item_id', $orderItemIds)
                    ->get()
                    ->groupBy('order_item_id');

                $usedBatchIds = InventoryBatch::whereIn('id', $batchIds)
                    ->whereColumn('quantity_remaining', '<', 'quantity_initial')
                    ->pluck('id')
                    ->flip();

                $existingItems = $orderItems->values()->map(function ($existing) use ($logsByItem, $usedBatchIds) {
                    $existingExp = $existing->exp_date ? Carbon::parse($existing->exp_date)->toDateString() : '';
                    $key = implode('|', [
                        (int) $existing->product_id,
                        (string) ($existing->batch_no ?? ''),
                        (string) $existingExp,
                        (int) $existing->quantity,
                        (int) ($existing->bonus ?? 0),
                        (float) $existing->unit_price,
                    ]);

                    $logs = $logsByItem->get($existing->id, collect());
                    $used = $logs->contains(fn ($log) => $usedBatchIds->has($log->batch_id));

                    return [
                        'item' => $existing,
                        'key' => $key,
                        'used' => $used,
                    ];
                })->values();

                $matched = [];
                $matchedUpdates = [];
                $newItems = [];

                foreach ($data['items'] as $item) {
                    $incomingExp = $item['expiry_date'] ?? '';
                    $incomingKey = implode('|', [
                        (int) $item['product_id'],
                        (string) ($item['batch_no'] ?? ''),
                        (string) $incomingExp,
                        (int) $item['quantity'],
                        (int) ($item['bonus'] ?? 0),
                        (float) $item['unit_price'],
                    ]);

                    $matchIndex = null;
                    foreach ($existingItems as $index => $existing) {
                        if (($matched[$index] ?? false) === true) {
                            continue;
                        }
                        if ($existing['key'] === $incomingKey) {
                            $matchIndex = $index;
                            break;
                        }
                    }

                    if ($matchIndex === null) {
                        $newItems[] = $item;
                        continue;
                    }

                    $matched[$matchIndex] = true;
                    $matchedUpdates[] = [
                        'existing' => $existingItems[$matchIndex],
                        'incoming' => $item,
                    ];
                }

                $unmatchedExisting = $existingItems->filter(function ($_, $index) use ($matched) {
                    return ! ($matched[$index] ?? false);
                })->values();

                $hasUsedUnmatched = $unmatchedExisting->contains(fn ($entry) => $entry['used'] === true);
                if ($hasUsedUnmatched) {
                    throw ValidationException::withMessages([
                        'purchase' => ['Cannot edit purchase items because stock has been used.'],
                    ]);
                }

                $removeItemIds = $unmatchedExisting->map(fn ($entry) => $entry['item']->id);
                if ($removeItemIds->isNotEmpty()) {
                    $removeBatchIds = InventoryLog::whereIn('order_item_id', $removeItemIds)
                        ->pluck('batch_id')
                        ->unique();

                    InventoryLog::whereIn('order_item_id', $removeItemIds)->delete();
                    InventoryBatch::whereIn('id', $removeBatchIds)->delete();
                    OrderItem::whereIn('id', $removeItemIds)->delete();
                }

                foreach ($matchedUpdates as $update) {
                    $existing = $update['existing']['item'];
                    $item = $update['incoming'];

                    $existing->update([
                        'discount' => $item['discount'] ?? 0,
                        'discount_percent' => $item['discount_percent'] ?? 0,
                        'tax' => $item['tax'] ?? 0,
                        'tax_percent' => $item['tax_percent'] ?? 0,
                        'total_price' => ($item['quantity'] * $item['unit_price']),
                        'updated_by' => $request->user()->id,
                    ]);
                }

                foreach ($newItems as $item) {
                    $product = Product::findOrFail($item['product_id']);
                    $totalPrice = $item['quantity'] * $item['unit_price'];
                    $qtyWithBonus = $item['quantity'] + ($item['bonus'] ?? 0);

                    $orderItem = OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $product->id,
                        'batch_no' => $item['batch_no'] ?? null,
                        'exp_date' => $item['expiry_date'] ?? null,
                        'quantity' => $item['quantity'],
                        'bonus' => $item['bonus'] ?? 0,
                        'discount' => $item['discount'] ?? 0,
                        'discount_percent' => $item['discount_percent'] ?? 0,
                        'tax' => $item['tax'] ?? 0,
                        'tax_percent' => $item['tax_percent'] ?? 0,
                        'unit_price' => $item['unit_price'],
                        'total_price' => $totalPrice,
                        'created_at' => now(),
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);

                    $batch = $this->upsertInventoryBatch($product, $item, $data['date'], $request, $qtyWithBonus, $supplier->id);

                    $runningBalance = InventoryBatch::where('product_id', $product->id)
                        ->sum('quantity_remaining');

                    InventoryLog::create([
                        'transaction_type' => 'in',
                        'order_item_id' => $orderItem->id,
                        'batch_id' => $batch->id,
                        'quantity_change' => $qtyWithBonus,
                        'running_balance' => $runningBalance,
                        'created_at' => now(),
                        'created_by' => $request->user()->id,
                        'updated_by' => $request->user()->id,
                    ]);
                }

                $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
                $order->update(array_merge($totals, [
                    'party_id' => $supplier->id,
                    'party_type' => Supplier::class,
                    'transaction_date' => $data['date'],
                    'notes' => $data['notes'] ?? null,
                    'updated_by' => $request->user()->id,
                ]));

                return $order;
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
            $productIds = $orderItems->pluck('product_id')->unique();

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

            foreach ($productIds as $productId) {
                $this->syncProductStock($productId);
            }
        });

        return response()->json(['message' => 'Deleted']);
    }

    public function sale(Request $request)
    {
        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $customer, $request) {
            $serialNo = $this->getNextSerialNo('sale');
            $order = Order::create([
                'transaction_type' => 'sale',
                'serial_no' => $serialNo,
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

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = $item['quantity'] + ($item['bonus'] ?? 0);

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
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['quantity'] * $item['unit_price'],
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

                $this->syncProductStock($product->id);

                $total += $orderItem->total_price;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update($totals);

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
                $requestedQty = $item['quantity'] + ($item['bonus'] ?? 0);

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
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['quantity'] * $item['unit_price'],
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

                $this->syncProductStock($product->id);

                $total += $orderItem->total_price;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update(array_merge($totals, ['updated_by' => $request->user()->id]));

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
            $serialNo = $this->getNextSerialNo('return_in');
            $order = Order::create([
                'transaction_type' => 'return_in',
                'serial_no' => $serialNo,
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

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $totalPrice = $item['quantity'] * $item['unit_price'];
                $qtyWithBonus = $item['quantity'] + ($item['bonus'] ?? 0);

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $batch = $this->upsertInventoryBatch($product, $item, $data['date'], $request, $qtyWithBonus, null);

                $runningBalance = InventoryBatch::where('product_id', $product->id)
                    ->sum('quantity_remaining');

                InventoryLog::create([
                    'transaction_type' => 'in',
                    'order_item_id' => $orderItem->id,
                    'batch_id' => $batch->id,
                    'quantity_change' => $qtyWithBonus,
                    'running_balance' => $runningBalance,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $this->syncProductStock($product->id);

                $total += $totalPrice;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update($totals);

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function returnOut(Request $request)
    {
        $data = $this->validateOrder($request);
        $supplier = Supplier::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $supplier, $request) {
            $serialNo = $this->getNextSerialNo('return_out');
            $order = Order::create([
                'transaction_type' => 'return_out',
                'serial_no' => $serialNo,
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

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = $item['quantity'] + ($item['bonus'] ?? 0);

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
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['quantity'] * $item['unit_price'],
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

                $this->syncProductStock($product->id);

                $total += $orderItem->total_price;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update($totals);

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function quotation(Request $request)
    {
        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $order = DB::transaction(function () use ($data, $customer, $request) {
            $serialNo = $this->getNextSerialNo('quotation');
            $order = Order::create([
                'transaction_type' => 'quotation',
                'serial_no' => $serialNo,
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

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $totalPrice = $item['quantity'] * $item['unit_price'];

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $total += $totalPrice;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update(array_merge($totals, [
                'updated_by' => $request->user()->id,
            ]));

            return $order;
        });

        return response()->json($order->load('items'), 201);
    }

    public function updateQuotation(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'quotation') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        $data = $this->validateOrder($request);
        $customer = Customer::findOrFail($data['party_id']);

        $updated = DB::transaction(function () use ($order, $data, $customer, $request) {
            $orderItems = $order->items()->get();
            $orderItemIds = $orderItems->pluck('id');

            OrderItem::whereIn('id', $orderItemIds)->delete();

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

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $total += $totalPrice;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update(array_merge($totals, ['updated_by' => $request->user()->id]));

            return $order;
        });

        return response()->json($updated->load('items'));
    }

    public function deleteQuotation(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'quotation') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        DB::transaction(function () use ($order) {
            $orderItems = $order->items()->get();
            $orderItemIds = $orderItems->pluck('id');

            OrderItem::whereIn('id', $orderItemIds)->delete();
            $order->delete();
        });

        return response()->json(['message' => 'Deleted']);
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
                $qtyWithBonus = $item['quantity'] + ($item['bonus'] ?? 0);

                $orderItem = OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $totalPrice,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $batch = $this->upsertInventoryBatch($product, $item, $data['date'], $request, $qtyWithBonus);

                $runningBalance = InventoryBatch::where('product_id', $product->id)
                    ->sum('quantity_remaining');

                InventoryLog::create([
                    'transaction_type' => 'in',
                    'order_item_id' => $orderItem->id,
                    'batch_id' => $batch->id,
                    'quantity_change' => $qtyWithBonus,
                    'running_balance' => $runningBalance,
                    'created_at' => now(),
                    'created_by' => $request->user()->id,
                    'updated_by' => $request->user()->id,
                ]);

                $this->syncProductStock($product->id);

                $total += $totalPrice;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update(array_merge($totals, ['updated_by' => $request->user()->id]));

            return $order;
        });

        return response()->json($updated->load('items'));
    }

    public function updateReturnOut(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'return_out') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        $data = $this->validateOrder($request);
        $supplier = Supplier::findOrFail($data['party_id']);

        $updated = DB::transaction(function () use ($order, $data, $supplier, $request) {
            $this->restoreSaleInventory($order, $request);

            $order->update([
                'party_id' => $supplier->id,
                'party_type' => Supplier::class,
                'transaction_date' => $data['date'],
                'notes' => $data['notes'] ?? null,
                'total_amount' => 0,
                'updated_by' => $request->user()->id,
            ]);

            $total = 0;

            foreach ($data['items'] as $item) {
                $product = Product::findOrFail($item['product_id']);
                $requestedQty = $item['quantity'] + ($item['bonus'] ?? 0);

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
                    'batch_no' => $item['batch_no'] ?? null,
                    'exp_date' => $item['expiry_date'] ?? null,
                    'quantity' => $item['quantity'],
                    'bonus' => $item['bonus'] ?? 0,
                    'discount' => $item['discount'] ?? 0,
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'tax' => $item['tax'] ?? 0,
                    'tax_percent' => $item['tax_percent'] ?? 0,
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['quantity'] * $item['unit_price'],
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

                $this->syncProductStock($product->id);

                $total += $orderItem->total_price;
            }

            $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));
            $order->update(array_merge($totals, ['updated_by' => $request->user()->id]));

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

    public function deleteReturnOut(Request $request, Order $order)
    {
        if ($order->transaction_type !== 'return_out') {
            return response()->json(['message' => 'Invalid order type'], 422);
        }

        DB::transaction(function () use ($order, $request) {
            $this->restoreSaleInventory($order, $request);
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
            'items.*.bonus' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.batch_no' => ['nullable', 'string'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_percent' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    protected function calculateTotals(array $items, float $paidAmount): array
    {
        $totalAmount = 0;
        $totalDiscount = 0;
        $totalTax = 0;

        foreach ($items as $item) {
            $qty = $item['quantity'] ?? 0;
            $price = $item['unit_price'] ?? 0;
            $totalAmount += $qty * $price;
            $totalDiscount += $item['discount'] ?? 0;
            $totalTax += $item['tax'] ?? 0;
        }

        $netAmount = $totalAmount - $totalDiscount + $totalTax;
        $dueAmount = $netAmount - $paidAmount;

        return [
            'total_amount' => $totalAmount,
            'total_discount' => $totalDiscount,
            'total_tax' => $totalTax,
            'net_amount' => $netAmount,
            'paid_amount' => $paidAmount,
            'due_amount' => $dueAmount,
        ];
    }

    protected function upsertInventoryBatch(Product $product, array $item, string $date, Request $request, int $qtyWithBonus, ?int $supplierId = null): InventoryBatch
    {
        $batchNo = $item['batch_no'] ?? null;
        $expiryDate = $item['expiry_date'] ?? null;

        if ($batchNo !== null && $batchNo !== '') {
            $query = InventoryBatch::query()
                ->where('product_id', $product->id)
                ->where('batch_no', $batchNo)
                ->lockForUpdate();

            if ($expiryDate) {
                $query->whereDate('expiry_date', $expiryDate);
            }

            $existing = $query->first();

            if ($existing) {
                $existing->update([
                    'quantity_initial' => $existing->quantity_initial + $qtyWithBonus,
                    'quantity_remaining' => $existing->quantity_remaining + $qtyWithBonus,
                    'cost_price' => $item['unit_price'],
                    'received_date' => $date,
                    'expiry_date' => $expiryDate ?? $existing->expiry_date,
                    'supplier_id' => $supplierId ?? $existing->supplier_id,
                    'updated_by' => $request->user()->id,
                ]);

                return $existing;
            }
        }

        return InventoryBatch::create([
            'product_id' => $product->id,
            'supplier_id' => $supplierId,
            'batch_no' => $batchNo ?: null,
            'cost_price' => $item['unit_price'],
            'quantity_initial' => $qtyWithBonus,
            'quantity_remaining' => $qtyWithBonus,
            'received_date' => $date,
            'expiry_date' => $expiryDate,
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);
    }

    protected function createPurchaseOrder(array $data, Supplier $supplier, Request $request, ?Order $order = null): Order
    {
        $serialNo = $order ? $order->serial_no : $this->getNextSerialNo('purchase');

        $order = $order ?? Order::create([
            'transaction_type' => 'purchase',
            'serial_no' => $serialNo,
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

        $total = 0;

        foreach ($data['items'] as $item) {
            $product = Product::findOrFail($item['product_id']);
            $totalPrice = $item['quantity'] * $item['unit_price'];
            $qtyWithBonus = $item['quantity'] + ($item['bonus'] ?? 0);

            $orderItem = OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'batch_no' => $item['batch_no'] ?? null,
                'exp_date' => $item['expiry_date'] ?? null,
                'quantity' => $item['quantity'],
                'bonus' => $item['bonus'] ?? 0,
                'discount' => $item['discount'] ?? 0,
                'discount_percent' => $item['discount_percent'] ?? 0,
                'tax' => $item['tax'] ?? 0,
                'tax_percent' => $item['tax_percent'] ?? 0,
                'unit_price' => $item['unit_price'],
                'total_price' => $totalPrice,
                'created_at' => now(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $batch = $this->upsertInventoryBatch($product, $item, $data['date'], $request, $qtyWithBonus, $supplier->id);

            $runningBalance = InventoryBatch::where('product_id', $product->id)
                ->sum('quantity_remaining');

            InventoryLog::create([
                'transaction_type' => 'in',
                'order_item_id' => $orderItem->id,
                'batch_id' => $batch->id,
                'quantity_change' => $qtyWithBonus,
                'running_balance' => $runningBalance,
                'created_at' => now(),
                'created_by' => $request->user()->id,
                'updated_by' => $request->user()->id,
            ]);

            $total += $totalPrice;
        }

        $totals = $this->calculateTotals($data['items'], (float) ($data['paid_amount'] ?? 0));

        $order->update(array_merge($totals, [
            'updated_by' => $request->user()->id,
        ]));

        return $order;
    }

    protected function restoreSaleInventory(Order $order, Request $request): void
    {
        $orderItems = $order->items()->get();
        $orderItemIds = $orderItems->pluck('id');
        $productIds = $orderItems->pluck('product_id')->unique();

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

        foreach ($productIds as $productId) {
            $this->syncProductStock($productId);
        }
    }

    protected function deleteReturnBatches(Order $order): void
    {
        $orderItems = $order->items()->get();
        $orderItemIds = $orderItems->pluck('id');
        $productIds = $orderItems->pluck('product_id')->unique();

        $batchIds = InventoryLog::whereIn('order_item_id', $orderItemIds)
            ->pluck('batch_id')
            ->unique();

        $hasUsage = InventoryBatch::whereIn('id', $batchIds)
            ->whereColumn('quantity_remaining', '<', 'quantity_initial')
            ->exists();

        InventoryLog::whereIn('order_item_id', $orderItemIds)->delete();

        if (! $hasUsage) {
            InventoryBatch::whereIn('id', $batchIds)->delete();
        }

        OrderItem::whereIn('id', $orderItemIds)->delete();

        foreach ($productIds as $productId) {
            $this->syncProductStock($productId);
        }
    }

    protected function syncProductStock(int $productId): void
    {
        return;
    }

    protected function getNextSerialNo(string $transactionType): string
    {
        $module = match ($transactionType) {
            'sale' => 'trx_S',
            'purchase' => 'trx_P',
            'return_in' => 'trx_R',
            'return_out' => 'trx_O',
            'quotation' => 'trx_Q',
            default => throw new \InvalidArgumentException('Unsupported transaction type.'),
        };

        $next = app(ModuleSequenceService::class)->next($module);

        return (string) $next;
    }

    protected function generateBatchNumber(): string
    {
        return 'BATCH-'.Str::upper(Str::random(10));
    }
}
