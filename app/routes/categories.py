from flask import Blueprint, request, jsonify
from app import db
from app.models import Category

bp = Blueprint('categories', __name__, url_prefix='/api/categories')

@bp.route('', methods=['GET'])
def get_categories():
    """Get all categories"""
    categories = Category.query.all()
    return jsonify([category.to_dict() for category in categories]), 200


@bp.route('/<int:category_id>', methods=['GET'])
def get_category(category_id):
    """Get a specific category by ID"""
    category = Category.query.get_or_404(category_id)
    return jsonify(category.to_dict()), 200


@bp.route('', methods=['POST'])
def create_category():
    """Create a new category"""
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    # Check if category name already exists
    if Category.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Category name already exists'}), 400
    
    category = Category(
        name=data['name'],
        description=data.get('description')
    )
    
    db.session.add(category)
    db.session.commit()
    
    return jsonify(category.to_dict()), 201


@bp.route('/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """Update an existing category"""
    category = Category.query.get_or_404(category_id)
    data = request.get_json()
    
    # Check if name is being changed and if it already exists
    if data.get('name') and data['name'] != category.name:
        if Category.query.filter_by(name=data['name']).first():
            return jsonify({'error': 'Category name already exists'}), 400
    
    if 'name' in data:
        category.name = data['name']
    if 'description' in data:
        category.description = data['description']
    
    db.session.commit()
    
    return jsonify(category.to_dict()), 200


@bp.route('/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """Delete a category"""
    category = Category.query.get_or_404(category_id)
    
    # Check if category has products
    if category.products:
        return jsonify({'error': 'Cannot delete category with associated products'}), 400
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({'message': 'Category deleted successfully'}), 200
