# Enterprise Inventory Management System - Database Schema
## Architecture: Laravel 12 + PostgreSQL

This schema is designed to support **Strict FIFO (First-In-First-Out)** inventory valuation and **RBAC (Role-Based Access Control)**.

### 1. User Management & RBAC

#### `roles`
Defines the hierarchy of access (Admin, Manager, Staff).
- `id` (PK, BigInt, Auto-increment)
- `name` (String, Unique) - e.g., 'admin', 'manager', 'staff'
- `description` (Text, Nullable)
- `permissions` (JSON) - Specific capability flags (e.g., `{"can_delete_stock": true}`)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### `users`
- `id` (PK, BigInt, Auto-increment)
- `role_id` (FK -> roles.id)
- `name` (String)
- `email` (String, Unique)
- `password_hash` (String)
- `is_active` (Boolean, Default: true)
- `last_login_at` (Timestamp, Nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

---

### 2. Master Data (Entities)

#### `categories`
- `id` (PK, BigInt, Auto-increment)
- `name` (String)
- `slug` (String, Unique)
- `parent_id` (FK -> categories.id, Nullable) - For nested categories
- `created_at` (Timestamp)

#### `products`
The central registry of items. Note: This does NOT hold the quantity. Quantity is derived from `inventory_batches`.
- `id` (PK, BigInt, Auto-increment)
- `category_id` (FK -> categories.id)
- `sku` (String, Unique) - Stock Keeping Unit
- `name` (String)
- `description` (Text, Nullable)
- `unit_of_measure` (String) - e.g., 'pcs', 'kg', 'liters'
- `min_stock_level` (Integer) - For low stock alerts
- `reorder_point` (Integer) - Auto-reorder trigger
- `image_url` (String, Nullable)
- `is_active` (Boolean, Default: true)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### `suppliers`
- `id` (PK, BigInt, Auto-increment)
- `name` (String)
- `email` (String)
- `phone` (String)
- `address` (Text)
- `tax_id` (String, Nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### `customers`
- `id` (PK, BigInt, Auto-increment)
- `name` (String)
- `email` (String)
- `phone` (String)
- `billing_address` (Text)
- `shipping_address` (Text)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

---

### 3. Inventory & FIFO Logic

This is the core of the FIFO system. We do not just store "Total Quantity". We store "Batches".

#### `inventory_batches`
Represents a specific lot of items received.
- `id` (PK, BigInt, Auto-increment)
- `product_id` (FK -> products.id)
- `supplier_id` (FK -> suppliers.id, Nullable) - Nullable for initial stock adjustments
- `batch_number` (String, Unique) - Generated or Supplier provided
- `cost_price` (Decimal 10,2) - **Crucial for FIFO cost calculation**
- `quantity_initial` (Integer) - How many were originally bought
- `quantity_remaining` (Integer) - **Current stock in this batch**
- `received_date` (Date) - Used to order batches for FIFO (oldest date first)
- `expiry_date` (Date, Nullable)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

**FIFO Logic:**
When a Sale occurs:
1. Query `inventory_batches` where `product_id` matches and `quantity_remaining > 0`.
2. Order by `received_date ASC` (Oldest first).
3. Deduct quantity from the first batch. If order > batch size, deplete the first batch and move to the next.

---

### 4. Transactions (Movements)

#### `orders`
Head table for both Purchases and Sales.
- `id` (PK, BigInt, Auto-increment)
- `transaction_type` (Enum: 'purchase', 'sale', 'return_in', 'return_out')
- `reference_number` (String, Unique) - Invoice # or PO #
- `user_id` (FK -> users.id) - Who created the order
- `party_id` (BigInt) - Polymorphic relation to `suppliers.id` or `customers.id`
- `status` (Enum: 'pending', 'completed', 'cancelled')
- `total_amount` (Decimal 10,2)
- `notes` (Text, Nullable)
- `transaction_date` (Timestamp)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

#### `order_items`
Line items for the orders.
- `id` (PK, BigInt, Auto-increment)
- `order_id` (FK -> orders.id)
- `product_id` (FK -> products.id)
- `quantity` (Integer)
- `unit_price` (Decimal 10,2) - Selling price (for sales) or Buying price (for purchases)
- `total_price` (Decimal 10,2)
- `created_at` (Timestamp)

#### `inventory_logs` (Audit Trail)
Links a specific Order Item to the specific Batch it depleted/created.
- `id` (PK, BigInt, Auto-increment)
- `transaction_type` (Enum: 'in', 'out')
- `order_item_id` (FK -> order_items.id)
- `batch_id` (FK -> inventory_batches.id)
- `quantity_change` (Integer) - Positive for IN, Negative for OUT
- `running_balance` (Integer) - Snapshot of product total stock at that moment
- `created_at` (Timestamp)

---

### 5. Views & Aggregates (Virtual)

#### `view_product_stock`
A SQL View to quickly get total stock without summing batches every time.
```sql
CREATE VIEW view_product_stock AS
SELECT 
    product_id, 
    SUM(quantity_remaining) as current_stock,
    AVG(cost_price) as average_cost_price
FROM inventory_batches
WHERE quantity_remaining > 0
GROUP BY product_id;
```
