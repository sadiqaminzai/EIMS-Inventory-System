import apiClient from './client';

export interface AccountTransactionDto {
  id: number;
  serial_no?: string | null;
  date: string;
  type: string;
  category_type?: 'expense' | 'other_income' | null;
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
  attachment_file?: File;
  remove_attachment?: boolean;
}

export const accountTransactionApi = {
  list: async (params?: { type?: string; category_type?: 'expense' | 'other_income' }) => (await apiClient.get<AccountTransactionDto[]>('/account-transactions', { params })).data,
  create: async (data: Partial<AccountTransactionDto> | FormData) => {
    if (data instanceof FormData) {
      return (await apiClient.post<AccountTransactionDto>('/account-transactions', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }

    return (await apiClient.post<AccountTransactionDto>('/account-transactions', data)).data;
  },
  update: async (id: string, data: Partial<AccountTransactionDto> | FormData) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) {
        data.append('_method', 'PUT');
      }

      return (await apiClient.post<AccountTransactionDto>(`/account-transactions/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    }

    return (await apiClient.put<AccountTransactionDto>(`/account-transactions/${id}`, data)).data;
  },
  remove: async (id: string) => { await apiClient.delete(`/account-transactions/${id}`); },
};
