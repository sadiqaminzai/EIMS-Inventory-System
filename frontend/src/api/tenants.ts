import apiClient from './client';

export interface TenantDto {
  id: number;
  name: string;
  slug?: string | null;
  is_active?: boolean;
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  license_no?: string | null;
  license_issue?: string | null;
  license_expiry?: string | null;
  license_type?: string | null;
  max_users?: number | null;
  license_status?: string | null;
}

export const tenantApi = {
  list: async () => (await apiClient.get<TenantDto[]>('/tenants')).data,
  create: async (data: Partial<TenantDto> | FormData) => {
    if (data instanceof FormData) {
      return (await apiClient.post<TenantDto>('/tenants', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }
    return (await apiClient.post<TenantDto>('/tenants', data)).data;
  },
  update: async (id: string, data: Partial<TenantDto> | FormData) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) {
        data.append('_method', 'PUT');
      }
      return (await apiClient.post<TenantDto>(`/tenants/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }
    return (await apiClient.put<TenantDto>(`/tenants/${id}`, data)).data;
  },
  remove: async (id: string) => { await apiClient.delete(`/tenants/${id}`); },
};
