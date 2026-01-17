#!/usr/bin/env python3
"""
CLI tool for Enterprise Inventory Management
"""
import sys
import argparse
from app import create_app, db
from app.models import Product, Category, Supplier, Transaction
from datetime import datetime

def init_db():
    """Initialize the database"""
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Database initialized successfully!")

def add_sample_data():
    """Add sample data to the database"""
    app = create_app()
    with app.app_context():
        # Check if data already exists
        if Category.query.first():
            print("Sample data already exists!")
            return
        
        # Create categories
        electronics = Category(name='Electronics', description='Electronic devices and accessories')
        office = Category(name='Office Supplies', description='Office and stationery items')
        furniture = Category(name='Furniture', description='Office furniture')
        
        db.session.add_all([electronics, office, furniture])
        db.session.commit()
        
        # Create suppliers
        tech_supplier = Supplier(
            name='Tech Solutions Inc',
            contact_name='John Smith',
            email='john@techsolutions.com',
            phone='+1-555-0101',
            address='123 Tech Street, Silicon Valley, CA'
        )
        office_supplier = Supplier(
            name='Office Depot',
            contact_name='Jane Doe',
            email='jane@officedepot.com',
            phone='+1-555-0102',
            address='456 Office Road, New York, NY'
        )
        
        db.session.add_all([tech_supplier, office_supplier])
        db.session.commit()
        
        # Create products
        products = [
            Product(
                name='Laptop Dell XPS 15',
                sku='DELL-XPS15-001',
                description='High-performance laptop for business users',
                unit_price=1299.99,
                quantity=15,
                reorder_level=5,
                category_id=electronics.id,
                supplier_id=tech_supplier.id
            ),
            Product(
                name='Wireless Mouse',
                sku='MOUSE-WL-001',
                description='Ergonomic wireless mouse',
                unit_price=29.99,
                quantity=50,
                reorder_level=20,
                category_id=electronics.id,
                supplier_id=tech_supplier.id
            ),
            Product(
                name='Office Chair Executive',
                sku='CHAIR-EXEC-001',
                description='Comfortable executive office chair',
                unit_price=299.99,
                quantity=8,
                reorder_level=3,
                category_id=furniture.id,
                supplier_id=office_supplier.id
            ),
            Product(
                name='Notebook A4',
                sku='NOTE-A4-001',
                description='High-quality ruled notebook',
                unit_price=4.99,
                quantity=100,
                reorder_level=30,
                category_id=office.id,
                supplier_id=office_supplier.id
            ),
            Product(
                name='Pen Blue',
                sku='PEN-BLUE-001',
                description='Blue ballpoint pen',
                unit_price=0.99,
                quantity=200,
                reorder_level=50,
                category_id=office.id,
                supplier_id=office_supplier.id
            )
        ]
        
        db.session.add_all(products)
        db.session.commit()
        
        # Create some sample transactions
        transactions = [
            Transaction(
                product_id=products[0].id,
                transaction_type='IN',
                quantity=15,
                unit_price=1299.99,
                notes='Initial stock'
            ),
            Transaction(
                product_id=products[1].id,
                transaction_type='IN',
                quantity=50,
                unit_price=29.99,
                notes='Initial stock'
            ),
            Transaction(
                product_id=products[0].id,
                transaction_type='OUT',
                quantity=3,
                unit_price=1299.99,
                notes='Sold to customer ABC Corp'
            )
        ]
        
        db.session.add_all(transactions)
        db.session.commit()
        
        print("Sample data added successfully!")
        print(f"  - Categories: {len([electronics, office, furniture])}")
        print(f"  - Suppliers: {len([tech_supplier, office_supplier])}")
        print(f"  - Products: {len(products)}")
        print(f"  - Transactions: {len(transactions)}")

def list_products():
    """List all products"""
    app = create_app()
    with app.app_context():
        products = Product.query.all()
        if not products:
            print("No products found!")
            return
        
        print(f"\n{'ID':<5} {'SKU':<20} {'Name':<30} {'Quantity':<10} {'Price':<10} {'Status'}")
        print("-" * 90)
        for product in products:
            status = '⚠️ LOW' if product.quantity <= product.reorder_level else '✓ OK'
            print(f"{product.id:<5} {product.sku:<20} {product.name:<30} {product.quantity:<10} ${product.unit_price:<9.2f} {status}")

def list_low_stock():
    """List products with low stock"""
    app = create_app()
    with app.app_context():
        products = Product.query.filter(Product.quantity <= Product.reorder_level).all()
        if not products:
            print("No low stock products!")
            return
        
        print(f"\n{'ID':<5} {'SKU':<20} {'Name':<30} {'Quantity':<10} {'Reorder Level'}")
        print("-" * 85)
        for product in products:
            print(f"{product.id:<5} {product.sku:<20} {product.name:<30} {product.quantity:<10} {product.reorder_level}")

def add_product(args):
    """Add a new product"""
    app = create_app()
    with app.app_context():
        product = Product(
            name=args.name,
            sku=args.sku,
            description=args.description or '',
            unit_price=args.price,
            quantity=args.quantity,
            reorder_level=args.reorder_level
        )
        
        db.session.add(product)
        db.session.commit()
        print(f"Product '{product.name}' added successfully with ID {product.id}!")

def update_stock(product_id, quantity, transaction_type):
    """Update product stock"""
    app = create_app()
    with app.app_context():
        product = Product.query.get(product_id)
        if not product:
            print(f"Product with ID {product_id} not found!")
            return
        
        old_quantity = product.quantity
        
        # Create transaction
        transaction = Transaction(
            product_id=product.id,
            transaction_type=transaction_type,
            quantity=abs(quantity),
            unit_price=product.unit_price,
            notes=f'Stock adjustment via CLI'
        )
        
        # Update quantity
        if transaction_type == 'IN':
            product.quantity += abs(quantity)
        else:
            if product.quantity < abs(quantity):
                print(f"Insufficient stock! Current: {product.quantity}, Requested: {abs(quantity)}")
                return
            product.quantity -= abs(quantity)
        
        db.session.add(transaction)
        db.session.commit()
        
        print(f"Stock updated for '{product.name}':")
        print(f"  Old quantity: {old_quantity}")
        print(f"  New quantity: {product.quantity}")
        print(f"  Transaction type: {transaction_type}")

def main():
    parser = argparse.ArgumentParser(description='Enterprise Inventory Management CLI')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # init-db command
    subparsers.add_parser('init-db', help='Initialize the database')
    
    # sample-data command
    subparsers.add_parser('sample-data', help='Add sample data to the database')
    
    # list command
    subparsers.add_parser('list', help='List all products')
    
    # low-stock command
    subparsers.add_parser('low-stock', help='List products with low stock')
    
    # add command
    add_parser = subparsers.add_parser('add', help='Add a new product')
    add_parser.add_argument('--name', required=True, help='Product name')
    add_parser.add_argument('--sku', required=True, help='Product SKU')
    add_parser.add_argument('--description', help='Product description')
    add_parser.add_argument('--price', type=float, required=True, help='Unit price')
    add_parser.add_argument('--quantity', type=int, default=0, help='Initial quantity')
    add_parser.add_argument('--reorder-level', type=int, default=10, help='Reorder level')
    
    # stock-in command
    stock_in_parser = subparsers.add_parser('stock-in', help='Add stock to a product')
    stock_in_parser.add_argument('product_id', type=int, help='Product ID')
    stock_in_parser.add_argument('quantity', type=int, help='Quantity to add')
    
    # stock-out command
    stock_out_parser = subparsers.add_parser('stock-out', help='Remove stock from a product')
    stock_out_parser.add_argument('product_id', type=int, help='Product ID')
    stock_out_parser.add_argument('quantity', type=int, help='Quantity to remove')
    
    args = parser.parse_args()
    
    if args.command == 'init-db':
        init_db()
    elif args.command == 'sample-data':
        add_sample_data()
    elif args.command == 'list':
        list_products()
    elif args.command == 'low-stock':
        list_low_stock()
    elif args.command == 'add':
        add_product(args)
    elif args.command == 'stock-in':
        update_stock(args.product_id, args.quantity, 'IN')
    elif args.command == 'stock-out':
        update_stock(args.product_id, args.quantity, 'OUT')
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
