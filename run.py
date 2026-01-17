#!/usr/bin/env python3
"""
Enterprise Inventory Management System
Main application entry point
"""
from app import create_app
import os

if __name__ == '__main__':
    app = create_app()
    
    # Get port from environment or default to 5000
    port = int(os.getenv('PORT', 5000))
    
    # Run the application
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_ENV') == 'development'
    )
