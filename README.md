# Enterprise Inventory Management System

A comprehensive REST API-based inventory management system built with Flask, designed for enterprise use cases. This system provides complete functionality for managing products, categories, suppliers, and inventory transactions.

## Features

- **Product Management**: Full CRUD operations for products with SKU tracking
- **Category Management**: Organize products into categories
- **Supplier Management**: Track supplier information and relationships
- **Inventory Transactions**: Record stock movements (IN/OUT) with full history
- **Low Stock Alerts**: Automatic identification of products needing reorder
- **Search & Filter**: Advanced querying capabilities
- **REST API**: Complete RESTful API for integration
- **CLI Tool**: Command-line interface for quick operations
- **Comprehensive Tests**: Full test coverage with pytest

## Technology Stack

- **Backend**: Flask 3.0
- **Database**: SQLAlchemy ORM with SQLite (easily configurable for PostgreSQL/MySQL)
- **API**: RESTful design with JSON responses
- **Testing**: pytest with fixtures
- **CORS**: Enabled for frontend integration

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/sadiqaminzai/Enterprise_Inventory_Management.git
cd Enterprise_Inventory_Management
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize the database:
```bash
python cli.py init-db
```

5. (Optional) Add sample data:
```bash
python cli.py sample-data
```

## Usage

### Running the API Server

Start the Flask development server:

```bash
python run.py
```

The API will be available at `http://localhost:5000`

### API Endpoints

#### Products

- `GET /api/products` - List all products
  - Query params: `category_id`, `supplier_id`, `low_stock`, `search`
- `GET /api/products/<id>` - Get product details
- `POST /api/products` - Create new product
- `PUT /api/products/<id>` - Update product
- `DELETE /api/products/<id>` - Delete product
- `GET /api/products/low-stock` - Get products needing reorder

#### Categories

- `GET /api/categories` - List all categories
- `GET /api/categories/<id>` - Get category details
- `POST /api/categories` - Create new category
- `PUT /api/categories/<id>` - Update category
- `DELETE /api/categories/<id>` - Delete category

#### Suppliers

- `GET /api/suppliers` - List all suppliers
- `GET /api/suppliers/<id>` - Get supplier details
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/<id>` - Update supplier
- `DELETE /api/suppliers/<id>` - Delete supplier

#### Transactions

- `GET /api/transactions` - List all transactions
  - Query params: `product_id`, `type`, `start_date`, `end_date`
- `GET /api/transactions/<id>` - Get transaction details
- `POST /api/transactions` - Create new transaction (stock IN/OUT)
- `GET /api/transactions/summary` - Get transaction statistics

### CLI Tool

The CLI provides quick access to common operations:

```bash
# Initialize database
python cli.py init-db

# Add sample data
python cli.py sample-data

# List all products
python cli.py list

# List low stock products
python cli.py low-stock

# Add a new product
python cli.py add --name "Laptop" --sku "LAP-001" --price 999.99 --quantity 10

# Add stock
python cli.py stock-in <product_id> <quantity>

# Remove stock
python cli.py stock-out <product_id> <quantity>
```

## API Examples

### Create a Product

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop Dell XPS 15",
    "sku": "DELL-XPS15-001",
    "description": "High-performance laptop",
    "unit_price": 1299.99,
    "quantity": 10,
    "reorder_level": 5
  }'
```

### Get All Products

```bash
curl http://localhost:5000/api/products
```

### Search Products

```bash
curl "http://localhost:5000/api/products?search=laptop"
```

### Get Low Stock Products

```bash
curl http://localhost:5000/api/products/low-stock
```

### Create a Transaction (Stock In)

```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "transaction_type": "IN",
    "quantity": 20,
    "unit_price": 1299.99,
    "notes": "New shipment received"
  }'
```

### Create a Transaction (Stock Out)

```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 1,
    "transaction_type": "OUT",
    "quantity": 5,
    "notes": "Sold to customer ABC Corp"
  }'
```

## Database Schema

### Product
- id (PK)
- name
- sku (unique)
- description
- unit_price
- quantity
- reorder_level
- category_id (FK)
- supplier_id (FK)
- created_at
- updated_at

### Category
- id (PK)
- name (unique)
- description
- created_at
- updated_at

### Supplier
- id (PK)
- name
- contact_name
- email
- phone
- address
- created_at
- updated_at

### Transaction
- id (PK)
- product_id (FK)
- transaction_type (IN/OUT)
- quantity
- unit_price
- notes
- transaction_date
- created_at

## Testing

Run the test suite:

```bash
pytest
```

Run with coverage:

```bash
pytest --cov=app tests/
```

Run specific test file:

```bash
pytest tests/test_products.py
```

## Configuration

The application can be configured using environment variables:

- `DATABASE_URI`: Database connection string (default: `sqlite:///inventory.db`)
- `SECRET_KEY`: Flask secret key (change in production)
- `PORT`: Server port (default: 5000)
- `FLASK_ENV`: Environment mode (`development` or `production`)

Create a `.env` file in the project root:

```
DATABASE_URI=sqlite:///inventory.db
SECRET_KEY=your-secret-key-here
FLASK_ENV=development
PORT=5000
```

## Project Structure

```
Enterprise_Inventory_Management/
├── app/
│   ├── __init__.py          # Application factory
│   ├── models/
│   │   └── __init__.py      # Database models
│   └── routes/
│       ├── products.py      # Product endpoints
│       ├── categories.py    # Category endpoints
│       ├── suppliers.py     # Supplier endpoints
│       └── transactions.py  # Transaction endpoints
├── tests/
│   ├── conftest.py          # Test fixtures
│   ├── test_app.py          # Application tests
│   ├── test_products.py     # Product tests
│   ├── test_categories.py   # Category tests
│   └── test_transactions.py # Transaction tests
├── cli.py                   # CLI tool
├── run.py                   # Application entry point
├── requirements.txt         # Python dependencies
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## Development

### Adding New Features

1. Create/modify models in `app/models/`
2. Create/modify routes in `app/routes/`
3. Add tests in `tests/`
4. Update documentation

### Database Migrations

For production use, consider using Flask-Migrate for database migrations:

```bash
pip install Flask-Migrate
```

## Production Deployment

For production deployment:

1. Use a production-grade database (PostgreSQL, MySQL)
2. Set proper environment variables
3. Use a production WSGI server (gunicorn, uwsgi)
4. Enable HTTPS
5. Configure proper logging
6. Set up database backups

Example with gunicorn:

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is available for use under the MIT License.

## Support

For issues, questions, or contributions, please open an issue on GitHub.