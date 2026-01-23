import apiClient from './client';

export interface OrderItem {
  product_id: number;
  quantity: number;
  bonus?: number;
  batch_no?: string | null;
  expiry_date?: string | null;
  discount?: number;
  discount_percent?: number;
  tax?: number;
  tax_percent?: number;
  unit_price: number;
}

export interface CreateOrderRequest {
  type: 'purchase' | 'sale' | 'return_in' | 'return_out';
  party_id: number; // Supplier ID or Customer ID
  items: OrderItem[];
  date: string;
  paid_amount?: number;
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

  createReturnOut: async (data: CreateOrderRequest) => {
    return await apiClient.post('/transactions/return-out', data);
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

  updateReturnOut: async (id: string, data: CreateOrderRequest) => {
    return await apiClient.put(`/transactions/return-out/${id}`, data);
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

  deleteReturnOut: async (id: string) => {
    return await apiClient.delete(`/transactions/return-out/${id}`);
  },

  getHistory: async (params?: { type?: string; page?: number }) => {
    return await apiClient.get('/transactions', { params });
  },
};
