import apiClient from './client';

export interface OrderItem {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface CreateOrderRequest {
  type: 'purchase' | 'sale' | 'return_in';
  party_id: number; // Supplier ID or Customer ID
  items: OrderItem[];
  date: string;
  notes?: string;
}

export const transactionApi = {
  createPurchase: async (data: CreateOrderRequest) => {
    return await apiClient.post('/transactions/purchase', data);
  },

  createSale: async (data: CreateOrderRequest) => {
    // Backend Logic:
    // 1. Check stock availability (SUM(batches) >= request)
    // 2. Lock rows
    // 3. Deduct from oldest batches (FIFO)
    // 4. Create Order + OrderItems
    return await apiClient.post('/transactions/sale', data);
  },

  createReturnIn: async (data: CreateOrderRequest) => {
    return await apiClient.post('/transactions/return-in', data);
  },

  updatePurchase: async (id: string, data: CreateOrderRequest) => {
    return await apiClient.put(`/transactions/purchase/${id}`, data);
  },

  updateSale: async (id: string, data: CreateOrderRequest) => {
    return await apiClient.put(`/transactions/sale/${id}`, data);
  },

  updateReturnIn: async (id: string, data: CreateOrderRequest) => {
    return await apiClient.put(`/transactions/return-in/${id}`, data);
  },

  deletePurchase: async (id: string) => {
    return await apiClient.delete(`/transactions/purchase/${id}`);
  },

  deleteSale: async (id: string) => {
    return await apiClient.delete(`/transactions/sale/${id}`);
  },

  deleteReturnIn: async (id: string) => {
    return await apiClient.delete(`/transactions/return-in/${id}`);
  },

  getHistory: async (params?: { type?: string; page?: number }) => {
    return await apiClient.get('/transactions', { params });
  },
};
