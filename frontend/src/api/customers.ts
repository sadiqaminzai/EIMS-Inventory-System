import apiClient from './client';

export interface CustomerDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  billing_address: string;
  shipping_address: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PendingCustomerRowDto {
  customer_id: number;
  customer_name: string;
  open_orders: number;
  total_due: number;
}

export interface PendingSummaryDto {
  total_customers: number;
  total_due: number;
  customers: PendingCustomerRowDto[];
}

export interface LedgerAllocationDto {
  id: number;
  payment_id: number;
  payment_serial?: string | null;
  payment_date?: string | null;
  allocated_amount: number;
}

export interface LedgerAdjustmentDto {
  id: number;
  type: string;
  amount: number;
  reason?: string | null;
  created_at?: string | null;
}

export interface LedgerOrderDto {
  id: number;
  serial_no: string;
  transaction_date?: string | null;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  allocations: LedgerAllocationDto[];
  adjustments: LedgerAdjustmentDto[];
  days_open?: number | null;
}

export interface CustomerLedgerSummaryDto {
  total_invoiced: number;
  total_paid: number;
  total_due: number;
  total_adjustments: number;
  total_received: number;
  total_allocated: number;
  unallocated_credit: number;
}

export interface CustomerLedgerDto {
  customer: CustomerDto;
  summary: CustomerLedgerSummaryDto;
  orders: LedgerOrderDto[];
}

export interface CustomerAgingSummaryDto {
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
  total_due: number;
}

export interface CustomerAgingCustomerDto extends CustomerAgingSummaryDto {
  customer_id: number;
  customer_name: string;
  open_orders: number;
}

export interface CustomerAgingOrderDto {
  order_id: number;
  serial_no: string;
  customer_id: number;
  customer_name: string;
  transaction_date: string;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  days_overdue: number;
  aging_bucket: string;
}

export interface CustomerAgingDto {
  as_of_date: string;
  summary: CustomerAgingSummaryDto;
  customers: CustomerAgingCustomerDto[];
  orders: CustomerAgingOrderDto[];
}

export const customerApi = {
  list: async () => (await apiClient.get<CustomerDto[]>('/customers')).data,
  create: async (data: Partial<CustomerDto>) => (await apiClient.post<CustomerDto>('/customers', data)).data,
  update: async (id: string, data: Partial<CustomerDto>) => (await apiClient.put<CustomerDto>(`/customers/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/customers/${id}`); },
  pendingSummary: async () => (await apiClient.get<PendingSummaryDto>('/customers/pending-summary')).data,
  ledger: async (customerId: number | string) => (await apiClient.get<CustomerLedgerDto>(`/customers/${customerId}/ledger`)).data,
  aging: async (asOfDate?: string) => (
    await apiClient.get<CustomerAgingDto>('/reports/customer-aging', {
      params: asOfDate ? { as_of_date: asOfDate } : undefined,
    })
  ).data,
};
