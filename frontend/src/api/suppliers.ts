import apiClient from './client';

export interface SupplierDto {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_id?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PendingSupplierRowDto {
  supplier_id: number;
  supplier_name: string;
  open_orders: number;
  total_due: number;
}

export interface SupplierPendingSummaryDto {
  total_suppliers: number;
  total_due: number;
  suppliers: PendingSupplierRowDto[];
}

export interface SupplierLedgerAllocationDto {
  id: number;
  payment_id: number;
  payment_serial?: string | null;
  payment_date?: string | null;
  allocated_amount: number;
}

export interface SupplierLedgerOrderDto {
  id: number;
  serial_no: string;
  transaction_date?: string | null;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
  allocations: SupplierLedgerAllocationDto[];
  days_open?: number | null;
}

export interface SupplierLedgerSummaryDto {
  total_invoiced: number;
  total_paid: number;
  total_due: number;
  total_paid_out: number;
  total_allocated: number;
  unallocated_payment: number;
}

export interface SupplierLedgerDto {
  supplier: SupplierDto;
  summary: SupplierLedgerSummaryDto;
  orders: SupplierLedgerOrderDto[];
}

export interface SupplierAgingSummaryDto {
  '0_30': number;
  '31_60': number;
  '61_90': number;
  '90_plus': number;
  total_due: number;
}

export interface SupplierAgingSupplierDto extends SupplierAgingSummaryDto {
  supplier_id: number;
  supplier_name: string;
  open_orders: number;
}

export interface SupplierAgingOrderDto {
  order_id: number;
  serial_no: string;
  supplier_id: number;
  supplier_name: string;
  transaction_date: string;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  days_overdue: number;
  aging_bucket: string;
}

export interface SupplierAgingDto {
  as_of_date: string;
  summary: SupplierAgingSummaryDto;
  suppliers: SupplierAgingSupplierDto[];
  orders: SupplierAgingOrderDto[];
}

export const supplierApi = {
  list: async () => (await apiClient.get<SupplierDto[]>('/suppliers')).data,
  create: async (data: Partial<SupplierDto>) => (await apiClient.post<SupplierDto>('/suppliers', data)).data,
  update: async (id: string, data: Partial<SupplierDto>) => (await apiClient.put<SupplierDto>(`/suppliers/${id}`, data)).data,
  remove: async (id: string) => { await apiClient.delete(`/suppliers/${id}`); },
  pendingSummary: async () => (await apiClient.get<SupplierPendingSummaryDto>('/suppliers/pending-summary')).data,
  ledger: async (supplierId: number | string) => (await apiClient.get<SupplierLedgerDto>(`/suppliers/${supplierId}/ledger`)).data,
  aging: async (asOfDate?: string) => (
    await apiClient.get<SupplierAgingDto>('/reports/supplier-aging', {
      params: asOfDate ? { as_of_date: asOfDate } : undefined,
    })
  ).data,
};
