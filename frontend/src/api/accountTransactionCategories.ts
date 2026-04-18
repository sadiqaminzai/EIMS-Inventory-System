import apiClient from './client';

export type AccountTransactionCategoryType = 'expense' | 'other_income';

export interface AccountTransactionCategoryDto {
  id: number;
  name: string;
  type: AccountTransactionCategoryType;
  details?: string | null;
  status?: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
  created_by?: number | string | null;
  updated_by?: number | string | null;
}

export const accountTransactionCategoryApi = {
  list: async (params?: { type?: AccountTransactionCategoryType; status?: 'active' | 'inactive' | 'all' }) => (
    await apiClient.get<AccountTransactionCategoryDto[]>('/account-transaction-categories', { params })
  ).data,
  create: async (data: Partial<AccountTransactionCategoryDto>) => (
    await apiClient.post<AccountTransactionCategoryDto>('/account-transaction-categories', data)
  ).data,
  update: async (id: string, data: Partial<AccountTransactionCategoryDto>) => (
    await apiClient.put<AccountTransactionCategoryDto>(`/account-transaction-categories/${id}`, data)
  ).data,
  remove: async (id: string) => {
    await apiClient.delete(`/account-transaction-categories/${id}`);
  },
};
