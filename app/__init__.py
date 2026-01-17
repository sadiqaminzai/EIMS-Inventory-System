from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os

db = SQLAlchemy()

def create_app(config=None):
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///inventory.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    if config:
        app.config.update(config)
    
    # Initialize extensions
    db.init_app(app)
    CORS(app)
    
    # Register blueprints
    from app.routes import products, categories, suppliers, transactions
    app.register_blueprint(products.bp)
    app.register_blueprint(categories.bp)
    app.register_blueprint(suppliers.bp)
    app.register_blueprint(transactions.bp)
    
    # Create tables
    with app.app_context():
        db.create_all()
    
    @app.route('/')
    def index():
        return {
            'message': 'Enterprise Inventory Management API',
            'version': '1.0.0',
            'endpoints': {
                'products': '/api/products',
                'categories': '/api/categories',
                'suppliers': '/api/suppliers',
                'transactions': '/api/transactions'
            }
        }
    
    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200
    
    return app
