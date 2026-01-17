import apiClient from './client';

export interface AccountTransactionDto {
  id: number;
  date: string;
  type: string;
  category?: string | null;
  amount: number;
  currency: string;
  exchange_rate?: number | null;
  account_id: number;
  to_account_id?: number | null;
  reference_id?: string | null;
  contact_id?: number | null;
  description?: string | null;
  payment_method?: string | null;
  attachment?: string | null;
}

export const accountTransactionApi = {
  list: async (params?: { type?: string }) => (await apiClient.get<AccountTransactionDto[]>('/account-transactions', { params })).data,
  create: async (data: Partial<AccountTransactionDto>) => (await apiClient.post<AccountTransactionDto>('/account-transactions', data)).data,
  update: async (id: string, data: Partial<AccountTransactionDto>) => (await apiClient.put<AccountTransactionDto>(`/account-transactions/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/account-transactions/${id}`); },
};
