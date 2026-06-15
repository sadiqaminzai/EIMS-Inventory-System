import apiClient from './client';

export type ReportFormat = 'csv' | 'pdf';

export interface ReportFilters {
  from_date?: string;
  to_date?: string;
  as_of_date?: string;
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  customer_id?: number;
  supplier_id?: number;
  brand_id?: number;
  product_id?: number;
  batch_no?: string;
  near_expiry_days?: number;
  include_profit?: boolean;
  client_id?: string;
  show_only_positive_stock?: boolean;
  show_only_expiry_date?: boolean;
  show_with_cost_price?: boolean;
  type?: string;
  group_by?: string;
}

export interface ReportPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ReportChartMeta {
  x_key: string;
  y_key: string;
}

export type ReportRow = Record<string, string | number | boolean | null>;

export interface ReportResponse<T extends ReportRow = ReportRow> {
  data: T[];
  summary: Record<string, string | number | boolean | null>;
  columns: Record<string, string>;
  charts?: ReportChartMeta | null;
  pagination: ReportPagination | null;
}

export interface DownloadedReport {
  filename: string;
  blob: Blob;
  mimeType: string;
}

interface PagedResponse<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

interface InvoiceHistoryRow {
  id: number;
  serial_no?: string;
  transaction_date?: string;
  transaction_type?: string;
  party_id?: number;
  net_amount?: number;
  paid_amount?: number;
  due_amount?: number;
}

const normalizeParams = (params?: Record<string, unknown>) => {
  if (!params) return undefined;

  return Object.entries(params).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return acc;
    }

    if (typeof value === 'boolean') {
      acc[key] = value ? 1 : 0;
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
};

const fetchReport = async <T extends ReportRow>(endpoint: string, filters?: ReportFilters): Promise<ReportResponse<T>> => {
  const response = await apiClient.get<ReportResponse<T>>(endpoint, {
    params: normalizeParams(filters),
  });

  return response.data;
};

const parseFilename = (contentDisposition?: string | null): string | null => {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
};

const exportReport = async (endpoint: string, format: ReportFormat, filters?: ReportFilters): Promise<DownloadedReport> => {
  const response = await apiClient.get(endpoint, {
    params: normalizeParams({ ...filters, format }),
    responseType: 'blob',
  });

  const mimeType = String(response.headers['content-type'] || 'application/octet-stream');
  const filename = parseFilename(response.headers['content-disposition']) || `report.${format}`;

  return {
    filename,
    blob: response.data,
    mimeType,
  };
};

const fetchAgingReport = async (endpoint: string, filters?: ReportFilters): Promise<ReportResponse> => {
  const as_of_date = filters?.to_date || filters?.from_date || undefined;
  const response = await apiClient.get(endpoint, {
    params: normalizeParams({
      as_of_date,
      customer_id: filters?.customer_id,
      supplier_id: filters?.supplier_id,
    }),
  });

  const payload = response.data ?? {};
  const data: ReportRow[] = Array.isArray(payload.orders) ? payload.orders : [];
  const columns = data[0]
    ? Object.keys(data[0]).reduce<Record<string, string>>((acc, key) => {
      acc[key] = key.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
      return acc;
    }, {})
    : {};

  return {
    data,
    summary: payload.summary ?? {},
    columns,
    charts: null,
    pagination: null,
  };
};

const fetchInvoiceSummary = async (
  type: 'purchase' | 'return_out' | 'sale' | 'return_in' | 'quotation',
  filters?: ReportFilters,
): Promise<ReportResponse> => {
  const response = await apiClient.get<PagedResponse<InvoiceHistoryRow>>('/transactions', {
    params: normalizeParams({
      type,
      page: filters?.page,
    }),
  });

  const payload = response.data;
  const sourceRows = Array.isArray(payload?.data) ? payload.data : [];
  const normalizedRows = sourceRows
    .filter((row) => {
      if (filters?.from_date && row.transaction_date && row.transaction_date < filters.from_date) {
        return false;
      }
      if (filters?.to_date && row.transaction_date && row.transaction_date > filters.to_date) {
        return false;
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        return [row.serial_no, row.transaction_type, String(row.party_id ?? '')]
          .some((value) => String(value ?? '').toLowerCase().includes(search));
      }
      return true;
    })
    .map((row) => ({
      invoice_no: row.serial_no ?? `INV-${row.id}`,
      transaction_date: row.transaction_date ?? '',
      transaction_type: row.transaction_type ?? type,
      party_id: Number(row.party_id ?? 0),
      net_amount: Number(row.net_amount ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      due_amount: Number(row.due_amount ?? 0),
    }));

  const summary = normalizedRows.reduce(
    (acc, row) => {
      acc.total_invoices += 1;
      acc.total_net_amount += Number(row.net_amount ?? 0);
      acc.total_paid_amount += Number(row.paid_amount ?? 0);
      acc.total_due_amount += Number(row.due_amount ?? 0);
      return acc;
    },
    { total_invoices: 0, total_net_amount: 0, total_paid_amount: 0, total_due_amount: 0 },
  );

  return {
    data: normalizedRows,
    summary,
    columns: {
      invoice_no: 'Invoice No',
      transaction_date: 'Date',
      transaction_type: 'Type',
      party_id: 'Party ID',
      net_amount: 'Net Amount',
      paid_amount: 'Paid Amount',
      due_amount: 'Due Amount',
    },
    charts: {
      x_key: 'invoice_no',
      y_key: 'net_amount',
    },
    pagination: payload
      ? {
        current_page: Number(payload.current_page ?? 1),
        per_page: Number(payload.per_page ?? (normalizedRows.length || 1)),
        total: Number(payload.total ?? normalizedRows.length),
        last_page: Number(payload.last_page ?? 1),
      }
      : null,
  };
};

export const reportApi = {
  invoiceSummary: (filters?: ReportFilters) => fetchReport('/reports/invoice-summary', filters),
  invoiceSummaryExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/invoice-summary/export', format, filters),
  customerAnalysis: (filters?: ReportFilters) => fetchReport('/reports/customer-analysis', filters),
  customerAnalysisExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/customer-analysis/export', format, filters),
  supplierAnalysis: (filters?: ReportFilters) => fetchReport('/reports/supplier-analysis', filters),
  supplierAnalysisExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/supplier-analysis/export', format, filters),
  profitReport: (filters?: ReportFilters) => fetchReport('/reports/profit-analysis', filters),
  profitReportExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/profit-analysis/export', format, filters),

  customerWise: (filters?: ReportFilters) => fetchReport('/reports/customer-wise', filters),
  customerWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/customer-wise/export', format, filters),
  customerWiseInvoices: (customerId: number, filters?: ReportFilters) => fetchReport(`/reports/customer-wise/${customerId}/invoices`, filters),
  customerWiseInvoicesExport: (customerId: number, format: ReportFormat, filters?: ReportFilters) => exportReport(`/reports/customer-wise/${customerId}/invoices/export`, format, filters),

  brandWise: (filters?: ReportFilters) => fetchReport('/reports/brand-wise', filters),
  brandWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/brand-wise/export', format, filters),

  productWise: (filters?: ReportFilters) => fetchReport('/reports/product-wise', filters),
  productWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/product-wise/export', format, filters),

  batchWise: (filters?: ReportFilters) => fetchReport('/reports/batch-wise', filters),
  batchWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/batch-wise/export', format, filters),

  expiryWise: (filters?: ReportFilters) => fetchReport('/reports/expiry-wise', filters),
  expiryWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/expiry-wise/export', format, filters),

  productBatchWise: (filters?: ReportFilters) => fetchReport('/reports/product-batch-wise', filters),
  productBatchWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/product-batch-wise/export', format, filters),

  dateWiseSales: (filters?: ReportFilters) => fetchReport('/reports/date-wise-sales', filters),
  dateWiseSalesExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/date-wise-sales/export', format, filters),

  salesAndStock: (filters?: ReportFilters) => fetchReport('/reports/sales-and-stock', filters),
  salesAndStockExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/sales-and-stock/export', format, filters),
  salesAndStockBatchWise: (filters?: ReportFilters) => fetchReport('/reports/sales-and-stock-batch-wise', filters),
  salesAndStockBatchWiseExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/sales-and-stock-batch-wise/export', format, filters),

  availableStock: (filters?: ReportFilters) => fetchReport('/reports/available-stock', filters),
  availableStockExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/available-stock/export', format, filters),

  customerLedger: (filters?: ReportFilters) => fetchReport('/reports/customer-ledger', filters),
  customerLedgerExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/customer-ledger/export', format, filters),

  customerAging: (filters?: ReportFilters) => fetchAgingReport('/reports/customer-aging', filters),
  supplierAging: (filters?: ReportFilters) => fetchAgingReport('/reports/supplier-aging', filters),

  invoicePurchaseSummary: (filters?: ReportFilters) => fetchInvoiceSummary('purchase', filters),
  invoicePurchaseReturnSummary: (filters?: ReportFilters) => fetchInvoiceSummary('return_out', filters),
  invoiceSalesSummary: (filters?: ReportFilters) => fetchInvoiceSummary('sale', filters),
  invoiceSalesReturnSummary: (filters?: ReportFilters) => fetchInvoiceSummary('return_in', filters),
  invoiceQuotationSummary: (filters?: ReportFilters) => fetchInvoiceSummary('quotation', filters),
};
