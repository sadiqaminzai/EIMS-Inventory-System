import apiClient from './client';

export interface PaymentDetailDto {
  customer_id: number;
  debit_amount: number;
  credit_amount: number;
  balance_amount: number;
  remarks?: string | null;
}

export interface PaymentDto {
  id?: number;
  serial_no?: string;
  date: string;
  account_id: number;
  currency: string;
  salesman?: string | null;
  booker?: string | null;
  notes?: string | null;
  details: PaymentDetailDto[];
}

export const paymentApi = {
  list: async () => (await apiClient.get<PaymentDto[]>('/payments')).data,
  get: async (id: number | string) => (await apiClient.get<PaymentDto>(`/payments/${id}`)).data,
  getBySerial: async (serial: string) => (await apiClient.get<PaymentDto>(`/payments/serial/${encodeURIComponent(serial)}`)).data,
  create: async (data: PaymentDto) => (await apiClient.post<PaymentDto>('/payments', data)).data,
  update: async (id: number | string, data: PaymentDto) => (await apiClient.put<PaymentDto>(`/payments/${id}`, data)).data,
};
