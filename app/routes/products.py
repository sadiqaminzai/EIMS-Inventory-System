from flask import Blueprint, request, jsonify
from app import db
from app.models import Product, Category, Supplier

bp = Blueprint('products', __name__, url_prefix='/api/products')

@bp.route('', methods=['GET'])
def get_products():
    """Get all products with optional filtering"""
    # Query parameters
    category_id = request.args.get('category_id', type=int)
    supplier_id = request.args.get('supplier_id', type=int)
    low_stock = request.args.get('low_stock', type=bool)
    search = request.args.get('search', type=str)
    
    query = Product.query
    
    # Apply filters
    if category_id:
        query = query.filter_by(category_id=category_id)
    if supplier_id:
        query = query.filter_by(supplier_id=supplier_id)
    if low_stock:
        query = query.filter(Product.quantity <= Product.reorder_level)
    if search:
        query = query.filter(
            db.or_(
                Product.name.ilike(f'%{search}%'),
                Product.sku.ilike(f'%{search}%'),
                Product.description.ilike(f'%{search}%')
            )
        )
    
    products = query.all()
    return jsonify([product.to_dict() for product in products]), 200


@bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Get a specific product by ID"""
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict()), 200


@bp.route('', methods=['POST'])
def create_product():
    """Create a new product"""
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name') or not data.get('sku'):
        return jsonify({'error': 'Name and SKU are required'}), 400
    
    # Check if SKU already exists
    if Product.query.filter_by(sku=data['sku']).first():
        return jsonify({'error': 'SKU already exists'}), 400
    
    # Validate category if provided
    if data.get('category_id'):
        category = Category.query.get(data['category_id'])
        if not category:
            return jsonify({'error': 'Category not found'}), 404
    
    # Validate supplier if provided
    if data.get('supplier_id'):
        supplier = Supplier.query.get(data['supplier_id'])
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404
    
    product = Product(
        name=data['name'],
        sku=data['sku'],
        description=data.get('description'),
        unit_price=data.get('unit_price', 0.0),
        quantity=data.get('quantity', 0),
        reorder_level=data.get('reorder_level', 10),
        category_id=data.get('category_id'),
        supplier_id=data.get('supplier_id')
    )
    
    db.session.add(product)
    db.session.commit()
    
    return jsonify(product.to_dict()), 201


@bp.route('/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """Update an existing product"""
    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    
    # Check if SKU is being changed and if it already exists
    if data.get('sku') and data['sku'] != product.sku:
        if Product.query.filter_by(sku=data['sku']).first():
            return jsonify({'error': 'SKU already exists'}), 400
    
    # Validate category if provided
    if data.get('category_id'):
        category = Category.query.get(data['category_id'])
        if not category:
            return jsonify({'error': 'Category not found'}), 404
    
    # Validate supplier if provided
    if data.get('supplier_id'):
        supplier = Supplier.query.get(data['supplier_id'])
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404
    
    # Update fields
    if 'name' in data:
        product.name = data['name']
    if 'sku' in data:
        product.sku = data['sku']
    if 'description' in data:
        product.description = data['description']
    if 'unit_price' in data:
        product.unit_price = data['unit_price']
    if 'quantity' in data:
        product.quantity = data['quantity']
    if 'reorder_level' in data:
        product.reorder_level = data['reorder_level']
    if 'category_id' in data:
        product.category_id = data['category_id']
    if 'supplier_id' in data:
        product.supplier_id = data['supplier_id']
    
    db.session.commit()
    
    return jsonify(product.to_dict()), 200


@bp.route('/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Delete a product"""
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    
    return jsonify({'message': 'Product deleted successfully'}), 200


@bp.route('/low-stock', methods=['GET'])
def get_low_stock_products():
    """Get products that need reordering"""
    products = Product.query.filter(Product.quantity <= Product.reorder_level).all()
    return jsonify([product.to_dict() for product in products]), 200
