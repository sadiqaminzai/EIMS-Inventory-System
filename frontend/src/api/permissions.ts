import apiClient from './client';

export interface PermissionDto {
  id: number;
  name: string;
  guard_name?: string | null;
}

export const permissionApi = {
  list: async () => (await apiClient.get<PermissionDto[]>('/permissions')).data,
  create: async (data: { name: string }) => (await apiClient.post<PermissionDto>('/permissions', data)).data,
  update: async (id: string, data: { name: string }) => (await apiClient.put<PermissionDto>(`/permissions/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/permissions/${id}`); },
};
