#!/usr/bin/env python3
"""
Example script demonstrating the Enterprise Inventory Management system
"""
from app import create_app, db
from app.models import Product, Category, Supplier, Transaction

def main():
    """Run example demonstration"""
    print("=" * 70)
    print("Enterprise Inventory Management System - Demo")
    print("=" * 70)
    print()
    
    # Create application
    app = create_app()
    
    with app.app_context():
        # Query all categories
        categories = Category.query.all()
        print(f"📦 Total Categories: {len(categories)}")
        for cat in categories:
            print(f"   - {cat.name}: {len(cat.products)} products")
        print()
        
        # Query all suppliers
        suppliers = Supplier.query.all()
        print(f"🏢 Total Suppliers: {len(suppliers)}")
        for sup in suppliers:
            print(f"   - {sup.name}: {len(sup.products)} products")
        print()
        
        # Query all products
        products = Product.query.all()
        print(f"📋 Total Products: {len(products)}")
        print(f"\n{'Product':<30} {'SKU':<20} {'Qty':<8} {'Price':<10} {'Status'}")
        print("-" * 80)
        for prod in products:
            status = "⚠️ LOW" if prod.quantity <= prod.reorder_level else "✓ OK"
            print(f"{prod.name:<30} {prod.sku:<20} {prod.quantity:<8} ${prod.unit_price:<9.2f} {status}")
        print()
        
        # Low stock products
        low_stock = Product.query.filter(Product.quantity <= Product.reorder_level).all()
        if low_stock:
            print(f"⚠️  Low Stock Alert: {len(low_stock)} product(s) need reordering")
            for prod in low_stock:
                print(f"   - {prod.name} (Current: {prod.quantity}, Reorder Level: {prod.reorder_level})")
        else:
            print("✅ All products are well stocked!")
        print()
        
        # Recent transactions
        transactions = Transaction.query.order_by(Transaction.transaction_date.desc()).limit(5).all()
        print(f"📊 Recent Transactions (Last {len(transactions)}):")
        print(f"\n{'Type':<6} {'Product':<30} {'Quantity':<10} {'Value':<12} {'Date'}")
        print("-" * 80)
        for txn in transactions:
            value = txn.quantity * txn.unit_price if txn.unit_price else 0
            date = txn.transaction_date.strftime("%Y-%m-%d %H:%M") if txn.transaction_date else "N/A"
            print(f"{txn.transaction_type:<6} {txn.product.name:<30} {txn.quantity:<10} ${value:<11.2f} {date}")
        print()
        
        # Inventory value
        total_value = sum(p.quantity * p.unit_price for p in products)
        print(f"💰 Total Inventory Value: ${total_value:,.2f}")
        print()
        
        # Transaction summary
        total_transactions = Transaction.query.count()
        transactions_in = Transaction.query.filter_by(transaction_type='IN').count()
        transactions_out = Transaction.query.filter_by(transaction_type='OUT').count()
        
        print(f"📈 Transaction Summary:")
        print(f"   Total Transactions: {total_transactions}")
        print(f"   Stock In: {transactions_in}")
        print(f"   Stock Out: {transactions_out}")
        print()
        
        print("=" * 70)
        print("Demo completed successfully!")
        print("=" * 70)

if __name__ == '__main__':
    main()
