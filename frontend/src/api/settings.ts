import apiClient from './client';

export interface TenantProfileDto {
  id: number;
  name: string;
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

export interface PrintSettingsDto {
  show_product_image: boolean;
  show_header_logo: boolean;
  show_footer_signature: boolean;
  show_batch?: boolean;
  show_exp_date?: boolean;
  show_bonus?: boolean;
}

export const settingsApi = {
  getTenantProfile: async () => (await apiClient.get<TenantProfileDto>('/settings/tenant')).data,
  updateTenantProfile: async (data: Partial<TenantProfileDto> | FormData) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) {
        data.append('_method', 'PUT');
      }
      return (await apiClient.post<TenantProfileDto>('/settings/tenant', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }
    return (await apiClient.put<TenantProfileDto>('/settings/tenant', data)).data;
  },
  getPrintSettings: async () => (await apiClient.get<PrintSettingsDto>('/settings/print')).data,
  updatePrintSettings: async (data: PrintSettingsDto) => (await apiClient.put<PrintSettingsDto>('/settings/print', data)).data,
};
