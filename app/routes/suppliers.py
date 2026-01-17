from flask import Blueprint, request, jsonify
from app import db
from app.models import Supplier

bp = Blueprint('suppliers', __name__, url_prefix='/api/suppliers')

@bp.route('', methods=['GET'])
def get_suppliers():
    """Get all suppliers"""
    suppliers = Supplier.query.all()
    return jsonify([supplier.to_dict() for supplier in suppliers]), 200


@bp.route('/<int:supplier_id>', methods=['GET'])
def get_supplier(supplier_id):
    """Get a specific supplier by ID"""
    supplier = Supplier.query.get_or_404(supplier_id)
    return jsonify(supplier.to_dict()), 200


@bp.route('', methods=['POST'])
def create_supplier():
    """Create a new supplier"""
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    supplier = Supplier(
        name=data['name'],
        contact_name=data.get('contact_name'),
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address')
    )
    
    db.session.add(supplier)
    db.session.commit()
    
    return jsonify(supplier.to_dict()), 201


@bp.route('/<int:supplier_id>', methods=['PUT'])
def update_supplier(supplier_id):
    """Update an existing supplier"""
    supplier = Supplier.query.get_or_404(supplier_id)
    data = request.get_json()
    
    if 'name' in data:
        supplier.name = data['name']
    if 'contact_name' in data:
        supplier.contact_name = data['contact_name']
    if 'email' in data:
        supplier.email = data['email']
    if 'phone' in data:
        supplier.phone = data['phone']
    if 'address' in data:
        supplier.address = data['address']
    
    db.session.commit()
    
    return jsonify(supplier.to_dict()), 200


@bp.route('/<int:supplier_id>', methods=['DELETE'])
def delete_supplier(supplier_id):
    """Delete a supplier"""
    supplier = Supplier.query.get_or_404(supplier_id)
    
    # Check if supplier has products
    if supplier.products:
        return jsonify({'error': 'Cannot delete supplier with associated products'}), 400
    
    db.session.delete(supplier)
    db.session.commit()
    
    return jsonify({'message': 'Supplier deleted successfully'}), 200
