import json

def test_get_products_empty(client):
    """Test getting products when database is empty"""
    response = client.get('/api/products')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == []

def test_create_product(client, sample_category, sample_supplier):
    """Test creating a new product"""
    product_data = {
        'name': 'Test Product',
        'sku': 'TEST-SKU-001',
        'description': 'A test product',
        'unit_price': 99.99,
        'quantity': 10,
        'reorder_level': 5,
        'category_id': sample_category,
        'supplier_id': sample_supplier
    }
    
    response = client.post('/api/products', 
                          data=json.dumps(product_data),
                          content_type='application/json')
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['name'] == 'Test Product'
    assert data['sku'] == 'TEST-SKU-001'

def test_create_product_missing_fields(client):
    """Test creating a product without required fields"""
    response = client.post('/api/products',
                          data=json.dumps({'name': 'Test'}),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data

def test_create_product_duplicate_sku(client, sample_category, sample_supplier):
    """Test creating a product with duplicate SKU"""
    product_data = {
        'name': 'Product 1',
        'sku': 'DUPLICATE-SKU',
        'unit_price': 50.0,
        'category_id': sample_category,
        'supplier_id': sample_supplier
    }
    
    # Create first product
    response = client.post('/api/products',
                          data=json.dumps(product_data),
                          content_type='application/json')
    assert response.status_code == 201
    
    # Try to create second product with same SKU
    product_data['name'] = 'Product 2'
    response = client.post('/api/products',
                          data=json.dumps(product_data),
                          content_type='application/json')
    assert response.status_code == 400

def test_get_product(client, sample_product):
    """Test getting a specific product"""
    response = client.get(f'/api/products/{sample_product}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == sample_product
    assert data['name'] == 'Test Laptop'

def test_get_product_not_found(client):
    """Test getting a non-existent product"""
    response = client.get('/api/products/999')
    assert response.status_code == 404

def test_update_product(client, sample_product):
    """Test updating a product"""
    update_data = {
        'name': 'Updated Laptop',
        'unit_price': 1299.99
    }
    
    response = client.put(f'/api/products/{sample_product}',
                         data=json.dumps(update_data),
                         content_type='application/json')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['name'] == 'Updated Laptop'
    assert data['unit_price'] == 1299.99

def test_delete_product(client, sample_product):
    """Test deleting a product"""
    response = client.delete(f'/api/products/{sample_product}')
    assert response.status_code == 200
    
    # Verify product is deleted
    response = client.get(f'/api/products/{sample_product}')
    assert response.status_code == 404

def test_get_low_stock_products(client, sample_category, sample_supplier):
    """Test getting low stock products"""
    # Create product with low stock
    product_data = {
        'name': 'Low Stock Product',
        'sku': 'LOW-STOCK-001',
        'unit_price': 10.0,
        'quantity': 3,
        'reorder_level': 5,
        'category_id': sample_category,
        'supplier_id': sample_supplier
    }
    
    client.post('/api/products',
               data=json.dumps(product_data),
               content_type='application/json')
    
    response = client.get('/api/products/low-stock')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0
    assert data[0]['needs_reorder'] == True
