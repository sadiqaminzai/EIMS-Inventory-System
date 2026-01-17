import json

def test_get_categories_empty(client):
    """Test getting categories when database is empty"""
    response = client.get('/api/categories')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data == []

def test_create_category(client):
    """Test creating a new category"""
    category_data = {
        'name': 'Electronics',
        'description': 'Electronic devices'
    }
    
    response = client.post('/api/categories',
                          data=json.dumps(category_data),
                          content_type='application/json')
    assert response.status_code == 201
    data = json.loads(response.data)
    assert data['name'] == 'Electronics'
    assert data['description'] == 'Electronic devices'

def test_create_category_missing_name(client):
    """Test creating a category without name"""
    response = client.post('/api/categories',
                          data=json.dumps({'description': 'Test'}),
                          content_type='application/json')
    assert response.status_code == 400

def test_create_category_duplicate_name(client):
    """Test creating a category with duplicate name"""
    category_data = {'name': 'Duplicate'}
    
    # Create first category
    client.post('/api/categories',
               data=json.dumps(category_data),
               content_type='application/json')
    
    # Try to create second category with same name
    response = client.post('/api/categories',
                          data=json.dumps(category_data),
                          content_type='application/json')
    assert response.status_code == 400

def test_get_category(client, sample_category):
    """Test getting a specific category"""
    response = client.get(f'/api/categories/{sample_category}')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['id'] == sample_category
    assert data['name'] == 'Electronics'

def test_update_category(client, sample_category):
    """Test updating a category"""
    update_data = {
        'name': 'Updated Electronics',
        'description': 'Updated description'
    }
    
    response = client.put(f'/api/categories/{sample_category}',
                         data=json.dumps(update_data),
                         content_type='application/json')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['name'] == 'Updated Electronics'

def test_delete_category(client):
    """Test deleting a category without products"""
    # Create a category
    category_data = {'name': 'To Delete'}
    response = client.post('/api/categories',
                          data=json.dumps(category_data),
                          content_type='application/json')
    category_id = json.loads(response.data)['id']
    
    # Delete the category
    response = client.delete(f'/api/categories/{category_id}')
    assert response.status_code == 200
