import apiClient from './client';

export interface BrandDto {
  id: number;
  name: string;
  details?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const brandApi = {
  list: async () => (await apiClient.get<BrandDto[]>('/brands')).data,
  create: async (data: Partial<BrandDto>) => (await apiClient.post<BrandDto>('/brands', data)).data,
  update: async (id: string, data: Partial<BrandDto>) => (await apiClient.put<BrandDto>(`/brands/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/brands/${id}`); },
};
