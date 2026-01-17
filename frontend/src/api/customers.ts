import apiClient from './client';

export interface CustomerDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  billing_address: string;
  shipping_address: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const customerApi = {
  list: async () => (await apiClient.get<CustomerDto[]>('/customers')).data,
  create: async (data: Partial<CustomerDto>) => (await apiClient.post<CustomerDto>('/customers', data)).data,
  update: async (id: string, data: Partial<CustomerDto>) => (await apiClient.put<CustomerDto>(`/customers/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/customers/${id}`); },
};
