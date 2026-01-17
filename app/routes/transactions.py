from flask import Blueprint, request, jsonify
from app import db
from app.models import Transaction, Product
from datetime import datetime

bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')

@bp.route('', methods=['GET'])
def get_transactions():
    """Get all transactions with optional filtering"""
    # Query parameters
    product_id = request.args.get('product_id', type=int)
    transaction_type = request.args.get('type', type=str)
    start_date = request.args.get('start_date', type=str)
    end_date = request.args.get('end_date', type=str)
    
    query = Transaction.query
    
    # Apply filters
    if product_id:
        query = query.filter_by(product_id=product_id)
    if transaction_type:
        query = query.filter_by(transaction_type=transaction_type.upper())
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(Transaction.transaction_date >= start)
        except ValueError:
            return jsonify({'error': 'Invalid start_date format'}), 400
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(Transaction.transaction_date <= end)
        except ValueError:
            return jsonify({'error': 'Invalid end_date format'}), 400
    
    transactions = query.order_by(Transaction.transaction_date.desc()).all()
    return jsonify([transaction.to_dict() for transaction in transactions]), 200


@bp.route('/<int:transaction_id>', methods=['GET'])
def get_transaction(transaction_id):
    """Get a specific transaction by ID"""
    transaction = Transaction.query.get_or_404(transaction_id)
    return jsonify(transaction.to_dict()), 200


@bp.route('', methods=['POST'])
def create_transaction():
    """Create a new transaction (stock in/out)"""
    data = request.get_json()
    
    # Validate required fields
    if not data.get('product_id') or not data.get('transaction_type') or not data.get('quantity'):
        return jsonify({'error': 'product_id, transaction_type, and quantity are required'}), 400
    
    # Validate transaction type
    transaction_type = data['transaction_type'].upper()
    if transaction_type not in ['IN', 'OUT']:
        return jsonify({'error': 'transaction_type must be IN or OUT'}), 400
    
    # Validate quantity
    quantity = data['quantity']
    if quantity <= 0:
        return jsonify({'error': 'quantity must be positive'}), 400
    
    # Get product
    product = Product.query.get(data['product_id'])
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    
    # Check if there's enough stock for OUT transactions
    if transaction_type == 'OUT' and product.quantity < quantity:
        return jsonify({'error': f'Insufficient stock. Available: {product.quantity}'}), 400
    
    # Create transaction
    if data.get('transaction_date'):
        try:
            transaction_date = datetime.fromisoformat(data['transaction_date'])
        except ValueError:
            return jsonify({'error': 'Invalid transaction_date format'}), 400
    else:
        transaction_date = datetime.utcnow()
    
    transaction = Transaction(
        product_id=data['product_id'],
        transaction_type=transaction_type,
        quantity=quantity,
        unit_price=data.get('unit_price', product.unit_price),
        notes=data.get('notes'),
        transaction_date=transaction_date
    )
    
    # Update product quantity
    if transaction_type == 'IN':
        product.quantity += quantity
    else:  # OUT
        product.quantity -= quantity
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify(transaction.to_dict()), 201


@bp.route('/summary', methods=['GET'])
def get_transaction_summary():
    """Get transaction summary statistics"""
    # Total transactions
    total_transactions = Transaction.query.count()
    
    # Transactions by type
    transactions_in = Transaction.query.filter_by(transaction_type='IN').count()
    transactions_out = Transaction.query.filter_by(transaction_type='OUT').count()
    
    # Total value
    total_value_in = db.session.query(db.func.sum(Transaction.quantity * Transaction.unit_price))\
        .filter_by(transaction_type='IN').scalar() or 0
    total_value_out = db.session.query(db.func.sum(Transaction.quantity * Transaction.unit_price))\
        .filter_by(transaction_type='OUT').scalar() or 0
    
    return jsonify({
        'total_transactions': total_transactions,
        'transactions_in': transactions_in,
        'transactions_out': transactions_out,
        'total_value_in': round(total_value_in, 2),
        'total_value_out': round(total_value_out, 2),
        'net_value': round(total_value_in - total_value_out, 2)
    }), 200
