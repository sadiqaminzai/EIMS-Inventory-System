# API Documentation

## Overview

The Enterprise Inventory Management API provides RESTful endpoints for managing products, categories, suppliers, and inventory transactions.

## Base URL

```
http://localhost:5000
```

## Endpoints

### System

#### GET /
Returns API information and available endpoints.

**Response:**
```json
{
  "message": "Enterprise Inventory Management API",
  "version": "1.0.0",
  "endpoints": {
    "products": "/api/products",
    "categories": "/api/categories",
    "suppliers": "/api/suppliers",
    "transactions": "/api/transactions"
  }
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

### Products

#### GET /api/products
Get all products with optional filtering.

**Query Parameters:**
- `category_id` (integer): Filter by category ID
- `supplier_id` (integer): Filter by supplier ID
- `low_stock` (boolean): Filter low stock products
- `search` (string): Search in name, SKU, or description

**Response:**
```json
[
  {
    "id": 1,
    "name": "Laptop Dell XPS 15",
    "sku": "DELL-XPS15-001",
    "description": "High-performance laptop",
    "unit_price": 1299.99,
    "quantity": 15,
    "reorder_level": 5,
    "needs_reorder": false,
    "category": {...},
    "supplier": {...},
    "created_at": "2026-01-17T08:00:00",
    "updated_at": "2026-01-17T08:00:00"
  }
]
```

#### GET /api/products/{id}
Get a specific product by ID.

**Response:** Product object (same as above)

#### POST /api/products
Create a new product.

**Request Body:**
```json
{
  "name": "Product Name",
  "sku": "PROD-001",
  "description": "Product description",
  "unit_price": 99.99,
  "quantity": 10,
  "reorder_level": 5,
  "category_id": 1,
  "supplier_id": 1
}
```

**Response:** Created product object (201)

#### PUT /api/products/{id}
Update an existing product.

**Request Body:** Same as POST (all fields optional)

**Response:** Updated product object (200)

#### DELETE /api/products/{id}
Delete a product.

**Response:**
```json
{
  "message": "Product deleted successfully"
}
```

#### GET /api/products/low-stock
Get products that need reordering (quantity <= reorder_level).

**Response:** Array of product objects

### Categories

#### GET /api/categories
Get all categories.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Electronics",
    "description": "Electronic devices",
    "product_count": 5,
    "created_at": "2026-01-17T08:00:00",
    "updated_at": "2026-01-17T08:00:00"
  }
]
```

#### GET /api/categories/{id}
Get a specific category by ID.

#### POST /api/categories
Create a new category.

**Request Body:**
```json
{
  "name": "Category Name",
  "description": "Category description"
}
```

#### PUT /api/categories/{id}
Update a category.

#### DELETE /api/categories/{id}
Delete a category (only if no products associated).

### Suppliers

#### GET /api/suppliers
Get all suppliers.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Tech Solutions Inc",
    "contact_name": "John Smith",
    "email": "john@tech.com",
    "phone": "+1-555-0101",
    "address": "123 Tech Street",
    "product_count": 3,
    "created_at": "2026-01-17T08:00:00",
    "updated_at": "2026-01-17T08:00:00"
  }
]
```

#### GET /api/suppliers/{id}
Get a specific supplier by ID.

#### POST /api/suppliers
Create a new supplier.

**Request Body:**
```json
{
  "name": "Supplier Name",
  "contact_name": "Contact Person",
  "email": "contact@supplier.com",
  "phone": "+1-555-0000",
  "address": "Supplier Address"
}
```

#### PUT /api/suppliers/{id}
Update a supplier.

#### DELETE /api/suppliers/{id}
Delete a supplier (only if no products associated).

### Transactions

#### GET /api/transactions
Get all transactions with optional filtering.

**Query Parameters:**
- `product_id` (integer): Filter by product ID
- `type` (string): Filter by type (IN/OUT)
- `start_date` (ISO string): Filter by start date
- `end_date` (ISO string): Filter by end date

**Response:**
```json
[
  {
    "id": 1,
    "product_id": 1,
    "product_name": "Laptop Dell XPS 15",
    "product_sku": "DELL-XPS15-001",
    "transaction_type": "IN",
    "quantity": 10,
    "unit_price": 1299.99,
    "total_value": 12999.90,
    "notes": "Restocking",
    "transaction_date": "2026-01-17T08:00:00",
    "created_at": "2026-01-17T08:00:00"
  }
]
```

#### GET /api/transactions/{id}
Get a specific transaction by ID.

#### POST /api/transactions
Create a new transaction (stock IN or OUT).

**Request Body:**
```json
{
  "product_id": 1,
  "transaction_type": "IN",
  "quantity": 10,
  "unit_price": 1299.99,
  "notes": "Restocking from supplier",
  "transaction_date": "2026-01-17T08:00:00"
}
```

**Notes:**
- `transaction_type` must be "IN" or "OUT"
- For OUT transactions, system checks available stock
- Product quantity is automatically updated
- `unit_price` defaults to product's unit price if not provided
- `transaction_date` defaults to current time if not provided

**Response:** Created transaction object (201)

#### GET /api/transactions/summary
Get transaction statistics.

**Response:**
```json
{
  "total_transactions": 10,
  "transactions_in": 6,
  "transactions_out": 4,
  "total_value_in": 50000.00,
  "total_value_out": 20000.00,
  "net_value": 30000.00
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

## Examples

### Search Products

```bash
curl "http://localhost:5000/api/products?search=laptop"
```

### Get Low Stock Products

```bash
curl "http://localhost:5000/api/products/low-stock"
```

### Create a Stock IN Transaction

```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "transaction_type": "IN",
    "quantity": 20,
    "notes": "New shipment"
  }'
```

### Get Transaction Summary

```bash
curl "http://localhost:5000/api/transactions/summary"
```
