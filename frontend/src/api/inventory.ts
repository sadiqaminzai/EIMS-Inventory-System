import apiClient from './client';

// Types mirroring the DB Schema
export interface Product {
  id: number;
  category_id?: number;
  sku?: string;
  model_no?: string;
  name: string;
  description?: string;
  unit_of_measure?: string;
  current_stock?: number; // From view_product_stock
  min_stock_level?: number;
  reorder_point?: number;
  image_url?: string;
  photo?: string;
  cost_price?: number;
  sale_price?: number;
  brand_id?: number;
  country_id?: number;
  status?: string;
  stock_qty?: number;
}

export interface InventoryBatch {
  id: number;
  batch_no: string | null;
  quantity_remaining: number;
  expiry_date: string | null;
  received_date: string;
}

export const inventoryApi = {
  // Products
  getProducts: async (params?: { page?: number; search?: string }) => {
    const response = await apiClient.get('/products', { params });
    return response.data;
  },

  getProduct: async (id: number) => {
    const response = await apiClient.get<Product>(`/products/${id}`);
    return response.data;
  },

  createProduct: async (data: Partial<Product>) => {
    if (data instanceof FormData) {
      const response = await apiClient.post('/products', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }
    const response = await apiClient.post('/products', data);
    return response.data;
  },

  updateProduct: async (id: number, data: Partial<Product>) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) {
        data.append('_method', 'PUT');
      }
      const response = await apiClient.post(`/products/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }
    const response = await apiClient.put(`/products/${id}`, data);
    return response.data;
  },

  deleteProduct: async (id: number) => {
    await apiClient.delete(`/products/${id}`);
  },

  // FIFO Batches
  getProductBatches: async (productId: number) => {
    const response = await apiClient.get<InventoryBatch[]>(`/products/${productId}/batches`);
    return response.data;
  },
};
