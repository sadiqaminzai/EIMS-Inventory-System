import pytest
from app import create_app, db
from app.models import Product, Category, Supplier, Transaction

@pytest.fixture
def app():
    """Create application for testing"""
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:'
    })
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def sample_category(app):
    """Create a sample category"""
    with app.app_context():
        category = Category(name='Electronics', description='Electronic items')
        db.session.add(category)
        db.session.commit()
        return category.id

@pytest.fixture
def sample_supplier(app):
    """Create a sample supplier"""
    with app.app_context():
        supplier = Supplier(
            name='Tech Supplier',
            contact_name='John Doe',
            email='john@tech.com'
        )
        db.session.add(supplier)
        db.session.commit()
        return supplier.id

@pytest.fixture
def sample_product(app, sample_category, sample_supplier):
    """Create a sample product"""
    with app.app_context():
        product = Product(
            name='Test Laptop',
            sku='TEST-001',
            description='A test laptop',
            unit_price=999.99,
            quantity=10,
            reorder_level=5,
            category_id=sample_category,
            supplier_id=sample_supplier
        )
        db.session.add(product)
        db.session.commit()
        return product.id
