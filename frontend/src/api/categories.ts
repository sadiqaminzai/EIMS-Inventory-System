import apiClient from './client';

export interface CategoryDto {
  id: number;
  name: string;
  details?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const categoryApi = {
  list: async () => (await apiClient.get<CategoryDto[]>('/categories')).data,
  create: async (data: Partial<CategoryDto>) => (await apiClient.post<CategoryDto>('/categories', data)).data,
  update: async (id: string, data: Partial<CategoryDto>) => (await apiClient.put<CategoryDto>(`/categories/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/categories/${id}`); },
};
