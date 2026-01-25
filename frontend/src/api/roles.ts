import apiClient from './client';

export interface RoleDto {
  id: number;
  name: string;
  tenant_id?: number | string;
  tenant_name?: string;
  description?: string | null;
  permissions?: Record<string, boolean> | null;
}

export const roleApi = {
  list: async (params?: { tenant_id?: string | number }) => (
    await apiClient.get<RoleDto[]>('/roles', { params: params?.tenant_id ? { tenant_id: params.tenant_id } : undefined })
  ).data,
  create: async (data: Partial<RoleDto>) => (await apiClient.post<RoleDto>('/roles', data)).data,
  update: async (id: string, data: Partial<RoleDto>) => (await apiClient.put<RoleDto>(`/roles/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/roles/${id}`); },
};
