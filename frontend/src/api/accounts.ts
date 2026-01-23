import apiClient from './client';

export interface AccountDto {
  id: number;
  serial_no?: string;
  name: string;
  type: string;
  currency: string;
  account_number?: string | null;
  balance: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const accountApi = {
  list: async () => (await apiClient.get<AccountDto[]>('/accounts')).data,
  create: async (data: Partial<AccountDto>) => (await apiClient.post<AccountDto>('/accounts', data)).data,
  update: async (id: string, data: Partial<AccountDto>) => (await apiClient.put<AccountDto>(`/accounts/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/accounts/${id}`); },
};
