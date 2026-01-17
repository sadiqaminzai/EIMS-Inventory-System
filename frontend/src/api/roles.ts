import apiClient from './client';

export interface RoleDto {
  id: number;
  name: string;
  description?: string | null;
  permissions?: Record<string, boolean> | null;
}

export const roleApi = {
  list: async () => (await apiClient.get<RoleDto[]>('/roles')).data,
  create: async (data: Partial<RoleDto>) => (await apiClient.post<RoleDto>('/roles', data)).data,
  update: async (id: string, data: Partial<RoleDto>) => (await apiClient.put<RoleDto>(`/roles/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/roles/${id}`); },
};
