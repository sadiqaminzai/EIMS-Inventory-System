import apiClient from './client';

export interface UserDto {
  id: number;
  name: string;
  email: string;
  role_id: number;
  is_active: boolean;
  avatar?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  role?: { id: number; name: string };
}

export const userApi = {
  list: async () => (await apiClient.get<UserDto[]>('/users')).data,
  create: async (data: FormData | { name: string; email: string; password: string; role_id?: number; role_name?: string; is_active?: boolean; tenant_id?: string | number }) => {
    if (data instanceof FormData) {
      return (await apiClient.post<UserDto>('/users', data, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    }
    return (await apiClient.post<UserDto>('/users', data)).data;
  },
  update: async (id: string, data: FormData | { name: string; email: string; password?: string; role_id?: number; role_name?: string; is_active?: boolean; tenant_id?: string | number }) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) {
        data.append('_method', 'PUT');
      }
      return (await apiClient.post<UserDto>(`/users/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    }
    return (await apiClient.put<UserDto>(`/users/${id}`, data)).data;
  },
  remove: async (id: string) => { await apiClient.delete(`/users/${id}`); },
};
