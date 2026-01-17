import json

def test_create_transaction_in(client, sample_product):
    """Test creating a stock IN transaction"""
    transaction_data = {
        'product_id': sample_product,
        'transaction_type': 'IN',
        'quantity': 5,
        'unit_price': 999.99,
        'notes': 'Restocking'
    }
    
    response = client.post('/api/transactions',
                          data=json.dumps(transaction_data),
                          content_type='application/json')
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['transaction_type'] == 'IN'
    assert data['quantity'] == 5
    
    # Verify product quantity increased
    product_response = client.get(f'/api/products/{sample_product}')
    product_data = json.loads(product_response.data)
    assert product_data['quantity'] == 15  # Original 10 + 5

def test_create_transaction_out(client, sample_product):
    """Test creating a stock OUT transaction"""
    transaction_data = {
        'product_id': sample_product,
        'transaction_type': 'OUT',
        'quantity': 3,
        'notes': 'Sale'
    }
    
    response = client.post('/api/transactions',
                          data=json.dumps(transaction_data),
                          content_type='application/json')
    assert response.status_code == 201
    
    # Verify product quantity decreased
    product_response = client.get(f'/api/products/{sample_product}')
    product_data = json.loads(product_response.data)
    assert product_data['quantity'] == 7  # Original 10 - 3

def test_create_transaction_insufficient_stock(client, sample_product):
    """Test creating OUT transaction with insufficient stock"""
    transaction_data = {
        'product_id': sample_product,
        'transaction_type': 'OUT',
        'quantity': 100  # More than available
    }
    
    response = client.post('/api/transactions',
                          data=json.dumps(transaction_data),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'Insufficient stock' in data['error']

def test_create_transaction_invalid_type(client, sample_product):
    """Test creating transaction with invalid type"""
    transaction_data = {
        'product_id': sample_product,
        'transaction_type': 'INVALID',
        'quantity': 5
    }
    
    response = client.post('/api/transactions',
                          data=json.dumps(transaction_data),
                          content_type='application/json')
    assert response.status_code == 400

def test_get_transactions(client, sample_product):
    """Test getting all transactions"""
    # Create a transaction first
    transaction_data = {
        'product_id': sample_product,
        'transaction_type': 'IN',
        'quantity': 5
    }
    client.post('/api/transactions',
               data=json.dumps(transaction_data),
               content_type='application/json')
    
    response = client.get('/api/transactions')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) > 0

def test_get_transaction_summary(client, sample_product):
    """Test getting transaction summary"""
    # Create some transactions
    client.post('/api/transactions',
               data=json.dumps({
                   'product_id': sample_product,
                   'transaction_type': 'IN',
                   'quantity': 10,
                   'unit_price': 100.0
               }),
               content_type='application/json')
    
    client.post('/api/transactions',
               data=json.dumps({
                   'product_id': sample_product,
                   'transaction_type': 'OUT',
                   'quantity': 5,
                   'unit_price': 100.0
               }),
               content_type='application/json')
    
    response = client.get('/api/transactions/summary')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'total_transactions' in data
    assert 'transactions_in' in data
    assert 'transactions_out' in data
    assert data['total_transactions'] == 2
