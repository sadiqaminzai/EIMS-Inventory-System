import apiClient from './client';

export interface SupplierDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const supplierApi = {
  list: async () => (await apiClient.get<SupplierDto[]>('/suppliers')).data,
  create: async (data: Partial<SupplierDto>) => (await apiClient.post<SupplierDto>('/suppliers', data)).data,
  update: async (id: string, data: Partial<SupplierDto>) => (await apiClient.put<SupplierDto>(`/suppliers/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/suppliers/${id}`); },
};
