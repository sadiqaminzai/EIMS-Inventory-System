import apiClient from './client';

export type ReportFormat = 'csv' | 'pdf';

export interface ReportFilters {
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  customer_id?: number;
  brand_id?: number;
  product_id?: number;
  batch_no?: string;
  near_expiry_days?: number;
  include_profit?: boolean;
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

export const reportApi = {
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

  availableStock: (filters?: ReportFilters) => fetchReport('/reports/available-stock', filters),
  availableStockExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/available-stock/export', format, filters),

  customerLedger: (filters?: ReportFilters) => fetchReport('/reports/customer-ledger', filters),
  customerLedgerExport: (format: ReportFormat, filters?: ReportFilters) => exportReport('/reports/customer-ledger/export', format, filters),
};
