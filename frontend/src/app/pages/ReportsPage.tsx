import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Eye, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  reportApi,
  brandApi,
  inventoryApi,
  type DownloadedReport,
  type ReportFilters,
  type ReportFormat,
  type ReportResponse,
  type ReportRow,
  type BrandDto,
  type Product,
} from '../../api';
import { useStore } from '../../store';
import { Modal } from '../components/ui/Modal';
import { DEFAULT_REPORT_MODULE_KEY, REPORT_MODULE_MENU_ITEMS, type ReportModuleKey } from '../reports/reportMeta';

type ReportKey =
  | 'customer-wise'
  | 'brand-wise'
  | 'product-wise'
  | 'batch-wise'
  | 'expiry-wise'
  | 'product-batch-wise'
  | 'date-wise-sales'
  | 'sales-and-stock'
  | 'sales-and-stock-batch-wise'
  | 'available-stock'
  | 'customer-ledger'
  | 'customer-aging'
  | 'supplier-aging'
  | 'invoice-purchase-summary'
  | 'invoice-purchase-return-summary'
  | 'invoice-sales-summary'
  | 'invoice-sales-return-summary'
  | 'invoice-quotation-summary'
  | 'profit-analysis';

interface OptionItem {
  id: number;
  name: string;
}

interface FilterState {
  from_date: string;
  to_date: string;
  as_of_date: string;
  search: string;
  customer_id: string;
  brand_id: string;
  product_id: string;
  batch_no: string;
  near_expiry_days: string;
  include_profit: boolean;
  show_only_positive_stock: boolean;
  show_only_expiry_date: boolean;
  show_with_cost_price: boolean;
  per_page: number;
}

interface ReportModuleOption {
  key: string;
  label: string;
  reportKey: ReportKey;
  type?: 'checkbox' | 'dropdown';
}

interface ReportModuleDefinition {
  key: ReportModuleKey;
  label: string;
  description?: string;
  options: ReportModuleOption[];
}

interface ReportDefinition {
  key: ReportKey;
  label: string;
  description: string;
  chartType: 'bar' | 'line';
  defaultSortBy: string;
  defaultSortDir: 'asc' | 'desc';
  dateFilter: 'none' | 'single' | 'range';
  filters: {
    customer: boolean;
    brand: boolean;
    product: boolean;
    batch: boolean;
    nearExpiry: boolean;
    includeProfit: boolean;
  };
  allowsDrilldown: boolean;
  supportsExport?: boolean;
  fetch: (filters: ReportFilters) => Promise<ReportResponse>;
  export: (format: ReportFormat, filters: ReportFilters) => Promise<DownloadedReport>;
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const INITIAL_FILTERS: FilterState = {
  from_date: '',
  to_date: '',
  as_of_date: '',
  search: '',
  customer_id: '',
  brand_id: '',
  product_id: '',
  batch_no: '',
  near_expiry_days: '30',
  include_profit: false,
  show_only_positive_stock: false,
  show_only_expiry_date: false,
  show_with_cost_price: false,
  per_page: 25,
};

const EMPTY_REPORT: ReportResponse = {
  data: [],
  summary: {},
  columns: {},
  charts: null,
  pagination: null,
};

const REPORT_DEFINITIONS: Record<ReportKey, ReportDefinition> = {
  'customer-wise': {
    key: 'customer-wise',
    label: 'Customer Wise',
    description: 'Sales, paid amount, and balance by customer with invoice drill-down.',
    chartType: 'bar',
    defaultSortBy: 'total_sales',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: true, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: true,
    fetch: reportApi.customerWise,
    export: reportApi.customerWiseExport,
  },
  'brand-wise': {
    key: 'brand-wise',
    label: 'Brand Wise',
    description: 'Total sold quantity and revenue grouped by brand.',
    chartType: 'bar',
    defaultSortBy: 'total_revenue',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: true, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.brandWise,
    export: reportApi.brandWiseExport,
  },
  'product-wise': {
    key: 'product-wise',
    label: 'Product Wise',
    description: 'Sales quantity and value at product level.',
    chartType: 'bar',
    defaultSortBy: 'total_sales_amount',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: true, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.productWise,
    export: reportApi.productWiseExport,
  },
  'batch-wise': {
    key: 'batch-wise',
    label: 'Batch Wise',
    description: 'Batch purchase, sold, and remaining stock quantities.',
    chartType: 'bar',
    defaultSortBy: 'remaining_qty',
    defaultSortDir: 'desc',
    dateFilter: 'single',
    filters: { customer: false, brand: true, product: true, batch: true, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.batchWise,
    export: reportApi.batchWiseExport,
  },
  'expiry-wise': {
    key: 'expiry-wise',
    label: 'Expiry Wise',
    description: 'Track batches by expiry date, days to expiry, and near-expiry status.',
    chartType: 'line',
    defaultSortBy: 'expiry_date',
    defaultSortDir: 'asc',
    dateFilter: 'range',
    filters: { customer: false, brand: true, product: true, batch: false, nearExpiry: true, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.expiryWise,
    export: reportApi.expiryWiseExport,
  },
  'product-batch-wise': {
    key: 'product-batch-wise',
    label: 'Product Batch Wise',
    description: 'Batch pricing and stock remaining by product.',
    chartType: 'bar',
    defaultSortBy: 'stock_remaining',
    defaultSortDir: 'desc',
    dateFilter: 'single',
    filters: { customer: false, brand: true, product: true, batch: true, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.productBatchWise,
    export: reportApi.productBatchWiseExport,
  },
  'date-wise-sales': {
    key: 'date-wise-sales',
    label: 'Date Wise Sales',
    description: 'Daily sales trend with optional profit calculation.',
    chartType: 'line',
    defaultSortBy: 'date',
    defaultSortDir: 'asc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: true },
    allowsDrilldown: false,
    fetch: reportApi.dateWiseSales,
    export: reportApi.dateWiseSalesExport,
  },
  'sales-and-stock': {
    key: 'sales-and-stock',
    label: 'Sales and Stock',
    description: 'Opening stock, purchased, sold, and closing stock per product.',
    chartType: 'bar',
    defaultSortBy: 'closing_stock',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: true, product: true, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.salesAndStock,
    export: reportApi.salesAndStockExport,
  },
  'sales-and-stock-batch-wise': {
    key: 'sales-and-stock-batch-wise',
    label: 'Sales and Stock Batch Wise',
    description: 'Opening stock, purchased, sold, and closing stock by batch.',
    chartType: 'bar',
    defaultSortBy: 'closing_stock',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: true, product: true, batch: true, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.salesAndStockBatchWise,
    export: reportApi.salesAndStockBatchWiseExport,
  },
  'available-stock': {
    key: 'available-stock',
    label: 'Available Stock',
    description: 'On-hand stock by product and batch.',
    chartType: 'bar',
    defaultSortBy: 'available_quantity',
    defaultSortDir: 'desc',
    dateFilter: 'single',
    filters: { customer: false, brand: true, product: true, batch: true, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.availableStock,
    export: reportApi.availableStockExport,
  },
  'customer-ledger': {
    key: 'customer-ledger',
    label: 'Customer Ledger',
    description: 'Running debit-credit balance per customer ledger entries.',
    chartType: 'line',
    defaultSortBy: 'date',
    defaultSortDir: 'asc',
    dateFilter: 'range',
    filters: { customer: true, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.customerLedger,
    export: reportApi.customerLedgerExport,
  },
  'customer-aging': {
    key: 'customer-aging',
    label: 'Customer Aging',
    description: 'Customer due aging buckets and overdue invoice details.',
    chartType: 'bar',
    defaultSortBy: 'due_amount',
    defaultSortDir: 'desc',
    dateFilter: 'none',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.customerAging,
    export: async () => Promise.reject(new Error('Export is not available for customer aging report yet.')),
  },
  'supplier-aging': {
    key: 'supplier-aging',
    label: 'Supplier Aging',
    description: 'Supplier due aging buckets and overdue purchase details.',
    chartType: 'bar',
    defaultSortBy: 'due_amount',
    defaultSortDir: 'desc',
    dateFilter: 'none',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.supplierAging,
    export: async () => Promise.reject(new Error('Export is not available for supplier aging report yet.')),
  },
  'invoice-purchase-summary': {
    key: 'invoice-purchase-summary',
    label: 'Purchase Invoice Summary',
    description: 'Purchase invoices summary report.',
    chartType: 'bar',
    defaultSortBy: 'transaction_date',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.invoicePurchaseSummary,
    export: async () => Promise.reject(new Error('Export is not available for invoice summary yet.')),
  },
  'invoice-purchase-return-summary': {
    key: 'invoice-purchase-return-summary',
    label: 'Purchase Return Summary',
    description: 'Purchase return invoices summary report.',
    chartType: 'bar',
    defaultSortBy: 'transaction_date',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.invoicePurchaseReturnSummary,
    export: async () => Promise.reject(new Error('Export is not available for invoice summary yet.')),
  },
  'invoice-sales-summary': {
    key: 'invoice-sales-summary',
    label: 'Sales Summary',
    description: 'Sales invoices summary report.',
    chartType: 'bar',
    defaultSortBy: 'transaction_date',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.invoiceSalesSummary,
    export: async () => Promise.reject(new Error('Export is not available for invoice summary yet.')),
  },
  'invoice-sales-return-summary': {
    key: 'invoice-sales-return-summary',
    label: 'Sales Return Summary',
    description: 'Sales return invoices summary report.',
    chartType: 'bar',
    defaultSortBy: 'transaction_date',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.invoiceSalesReturnSummary,
    export: async () => Promise.reject(new Error('Export is not available for invoice summary yet.')),
  },
  'invoice-quotation-summary': {
    key: 'invoice-quotation-summary',
    label: 'Quotation Summary',
    description: 'Quotation invoices summary report.',
    chartType: 'bar',
    defaultSortBy: 'transaction_date',
    defaultSortDir: 'desc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    supportsExport: false,
    fetch: reportApi.invoiceQuotationSummary,
    export: async () => Promise.reject(new Error('Export is not available for invoice summary yet.')),
  },
  'profit-analysis': {
    key: 'profit-analysis',
    label: 'Profit',
    description: 'Date wise profit analysis report.',
    chartType: 'line',
    defaultSortBy: 'date',
    defaultSortDir: 'asc',
    dateFilter: 'range',
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: true },
    allowsDrilldown: false,
    fetch: (filters) => reportApi.dateWiseSales({ ...filters, include_profit: true }),
    export: (format, filters) => reportApi.dateWiseSalesExport(format, { ...filters, include_profit: true }),
  },
};

const REPORT_MODULE_DEFINITIONS: ReportModuleDefinition[] = [
  {
    key: 'available-stock',
    label: 'Available Stock Report (ASR)',
    options: [
      { key: 'all', label: 'All', reportKey: 'available-stock' },
      { key: 'batch-wise', label: 'Batch Wise', reportKey: 'batch-wise' },
      { key: 'brand', label: 'Brand', reportKey: 'available-stock', type: 'dropdown' },
      { key: 'product', label: 'Product Wise', reportKey: 'available-stock', type: 'dropdown' },
    ],
  },
  {
    key: 'sales-and-stock',
    label: 'Sales and Stock Report (SSR)',
    options: [
      { key: 'all', label: 'All', reportKey: 'sales-and-stock' },
      { key: 'batch-wise', label: 'Batch Wise', reportKey: 'sales-and-stock-batch-wise' },
      { key: 'brand-wise', label: 'Brand', reportKey: 'sales-and-stock', type: 'dropdown' },
      { key: 'product-wise', label: 'Products', reportKey: 'sales-and-stock', type: 'dropdown' },
    ],
  },
  {
    key: 'expiry-report',
    label: 'Expiry Status Report (ESR)',
    options: [
      { key: 'all', label: 'All', reportKey: 'expiry-wise' },
      { key: 'brand-wise', label: 'Brand', reportKey: 'brand-wise', type: 'dropdown' },
      { key: 'product-wise', label: 'Products', reportKey: 'expiry-wise', type: 'dropdown' },
      { key: 'expiry-date', label: 'ExpiryDate', reportKey: 'expiry-wise', type: 'checkbox' },
      { key: 'with-cost-price', label: 'WithCostPrice', reportKey: 'expiry-wise', type: 'checkbox' },
    ],
  },
  {
    key: 'invoice-summary',
    label: 'Invoice Summary Report (ISR)',
    options: [
      { key: 'purchase', label: 'Purchase', reportKey: 'invoice-purchase-summary' },
      { key: 'purchase-return', label: 'Purchase Return', reportKey: 'invoice-purchase-return-summary' },
      { key: 'sales', label: 'Sales', reportKey: 'invoice-sales-summary' },
      { key: 'sales-return', label: 'Sales Return', reportKey: 'invoice-sales-return-summary' },
      { key: 'quotation', label: 'Quotation', reportKey: 'invoice-quotation-summary' },
    ],
  },
  {
    key: 'customer',
    label: 'Customer Report (CR)',
    options: [
      { key: 'aging', label: 'Customer Aging', reportKey: 'customer-aging' },
      { key: 'ledger', label: 'Customer Ledger', reportKey: 'customer-ledger' },
    ],
  },
  {
    key: 'supplier',
    label: 'Supplier Report (SR)',
    options: [
      { key: 'aging', label: 'Supplier Aging', reportKey: 'supplier-aging' },
    ],
  },
  {
    key: 'profit',
    label: 'Profit Analysis Report (PAR)',
    options: [
      { key: 'analysis', label: 'Profit Analysis', reportKey: 'profit-analysis' },
    ],
  },
];

const toTitle = (input: string): string => input
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (match) => match.toUpperCase());

const isLikelyDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}/.test(value);

const isCurrencyLike = (key: string): boolean => /(sales|revenue|amount|paid|balance|price|profit|debit|credit|due)/i.test(key);

const isCountLike = (key: string): boolean => /(qty|quantity|count|total|stock|invoices|customers|products|batches|days)/i.test(key);

const formatDisplayValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'number') {
    if (isCountLike(key) && !isCurrencyLike(key)) {
      return NUMBER_FORMAT.format(value);
    }

    if (isCurrencyLike(key)) {
      return NUMBER_FORMAT.format(value);
    }

    return NUMBER_FORMAT.format(value);
  }

  if (typeof value === 'string') {
    if (isLikelyDate(value)) {
      return new Date(value).toLocaleDateString();
    }

    return value;
  }

  return String(value);
};

const downloadBlob = (file: DownloadedReport) => {
  const blobUrl = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
};

export const ReportsPage = () => {
  const { hasPermission, currentUser, tenant } = useStore();
  const navigate = useNavigate();
  const { moduleKey } = useParams<{ moduleKey?: string }>();
  const [activeModuleKey, setActiveModuleKey] = useState<ReportModuleKey>(DEFAULT_REPORT_MODULE_KEY);
  const [activeOptionKey, setActiveOptionKey] = useState('all');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set(['all']));
  const [activeReportKey, setActiveReportKey] = useState<ReportKey>('available-stock');
  const [reportData, setReportData] = useState<ReportResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [expiryProducts, setExpiryProducts] = useState<Product[]>([]);
  const [expiryProductsLoading, setExpiryProductsLoading] = useState(false);

  const [sortBy, setSortBy] = useState(REPORT_DEFINITIONS['available-stock'].defaultSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(REPORT_DEFINITIONS['available-stock'].defaultSortDir);
  const [page, setPage] = useState(1);

  const [draftFilters, setDraftFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  const [drilldownCustomer, setDrilldownCustomer] = useState<OptionItem | null>(null);
  const [drilldownData, setDrilldownData] = useState<ReportResponse>(EMPTY_REPORT);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownPage, setDrilldownPage] = useState(1);

  const requestToken = useRef(0);
  const printRef = useRef<HTMLDivElement | null>(null);

  const handlePrint = useCallback(() => {
    try {
      const companyName = tenant?.name || currentUser?.tenant_name || currentUser?.name || 'Company Name';
      const companyAddress = tenant?.address || '';
      const companyPhone = tenant?.phone || '';
      const companyEmail = tenant?.email || '';
      const companyLogo = tenant?.logo || '';
      const reportTitle = REPORT_DEFINITIONS[activeReportKey]?.label ?? 'Report';
      const printDate = new Date().toLocaleDateString();
      const printableColumns = tableColumns;
      const isLandscapePrint = activeReportKey === 'sales-and-stock';
      const totalItems = reportData.data.length;

      const formatPrintDate = (value?: string): string => {
        if (!value) return '-';

        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return value;

        return date.toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const getRowValue = (row: ReportRow, key: string) => Number((row as Record<string, unknown>)[key] ?? 0);

      const formatMoney = (value: number) => NUMBER_FORMAT.format(value);

      const totalAvailableQuantity = reportData.data.reduce((sum, row) => sum + getRowValue(row, 'available_quantity'), 0);
      // Determine which price to use: available-stock totals should be cost-based; other reports use sale price
      const priceKey = activeReportKey === 'available-stock' ? 'cost_price' : 'sale_price';

      // For generic reports that have movement quantities use the typical fields; for available-stock use 'net_amount' already provided by backend
      const totalOpeningAmount = reportData.data.reduce((sum, row) => {
        const quantity = getRowValue(row, 'opening_stock');
        return sum + (quantity * getRowValue(row, priceKey));
      }, 0);
      const totalPurchaseAmount = reportData.data.reduce((sum, row) => {
        return sum + (getRowValue(row, 'purchased') * getRowValue(row, priceKey));
      }, 0);
      const totalPurchaseReturnAmount = reportData.data.reduce((sum, row) => {
        return sum + (getRowValue(row, 'purchase_return') * getRowValue(row, priceKey));
      }, 0);
      const totalSaleAmount = reportData.data.reduce((sum, row) => {
        return sum + (getRowValue(row, 'sold') * getRowValue(row, priceKey));
      }, 0);
      const totalSalesReturnAmount = reportData.data.reduce((sum, row) => {
        return sum + (getRowValue(row, 'sales_return') * getRowValue(row, priceKey));
      }, 0);

      // Available Stock totals are sums of every item row.
      const totalNetAvailableAmount = activeReportKey === 'expiry-wise'
        ? Number(reportData.summary?.total_cost_amount ?? 0)
        : reportData.data.reduce((sum, row) => {
          return sum + (getRowValue(row, 'available_quantity') * getRowValue(row, 'cost_price'));
        }, 0);
      // Also compute Net Stock Amount in Sales Price by summing every row.
      const totalNetStockSalesPrice = activeReportKey === 'expiry-wise'
        ? Number(reportData.summary?.total_sale_amount ?? 0)
        : reportData.data.reduce(
          (sum, row) => sum + (getRowValue(row, 'available_quantity') * getRowValue(row, 'sale_price')),
          0,
        );

      const totalSalesNetAmount = activeReportKey === 'available-stock'
        ? totalNetAvailableAmount
        : reportData.data.reduce((sum, row) => sum + getRowValue(row, 'amount'), 0);

      const totalClosingStockAmount = activeReportKey === 'available-stock'
        ? totalNetStockSalesPrice
        : reportData.data.reduce((sum, row) => {
          const quantity = getRowValue(row, 'closing_stock');
          return sum + (quantity * getRowValue(row, priceKey));
        }, 0);

      const reportPeriod = (appliedFilters.from_date || appliedFilters.to_date)
        ? `From ${formatPrintDate(appliedFilters.from_date)} to ${formatPrintDate(appliedFilters.to_date)}`
        : (appliedFilters.as_of_date ? `As of ${formatPrintDate(appliedFilters.as_of_date)}` : '');

      const filters: string[] = [];
      if (appliedFilters.brand_id) filters.push(`Brand: ${brands.find((brand) => String(brand.id) === appliedFilters.brand_id)?.name ?? appliedFilters.brand_id}`);
      if (appliedFilters.product_id) filters.push(`Product: ${products.find((product) => String(product.id) === appliedFilters.product_id)?.name ?? appliedFilters.product_id}`);
      if (appliedFilters.show_only_positive_stock) filters.push('Positive stock only');
      if (appliedFilters.search) filters.push(`Search: ${appliedFilters.search}`);

      const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      const renderCellValue = (row: ReportRow, key: string) => {
        return formatDisplayValue(key, (row as Record<string, unknown>)[key]);
      };

      const html = `
        <html>
          <head>
            <title>${reportTitle}</title>
            <style>
              @page { size: A4 ${isLandscapePrint ? 'landscape' : 'portrait'}; margin: 0; }
              html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
              body { padding: 12mm; }
              .page { width: 100%; }
              .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 10px; }
              .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
              .logo { width: 72px; height: 72px; object-fit: contain; }
              .brand-info { border-left: 4px solid #111827; padding-left: 10px; min-width: 0; }
              .company { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.15; }
              .meta { font-size: 12px; color: #374151; margin-top: 4px; }
              .meta-line { font-size: 12px; color: #374151; margin-top: 4px; }
              .contact-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
              .contact-chip { display: inline-block; padding: 3px 8px; border: 1px solid #d1d5db; border-radius: 999px; background: #f9fafb; font-size: 11px; color: #1f2937; }
              .title { font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; text-align: right; }
              .report-period { margin: 0 0 10px 0; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); display: flex; align-items: center; gap: 10px; white-space: nowrap; overflow: hidden; }
              .period-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #4b5563; flex-shrink: 0; }
              .period-value { font-size: 13px; font-weight: 600; color: #111827; text-overflow: ellipsis; overflow: hidden; }
              .filters { margin: 0 0 12px 0; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; color: #374151; display: grid; gap: 4px; }
              .summary { margin: 12px 0 0 0; display: flex; flex-direction: column; gap: 12px; }
              .summary-row { display: grid; gap: 12px; }
              .summary-row.columns-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
              .summary-row.columns-6 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
              .summary-row.columns-2-expiry { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              /* second/third rows should use the same 6-column layout so a single card matches first-row card width */
              .summary-row.columns-2 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
              .summary-row.right-aligned .summary-card { grid-column: 6; }
              .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%); min-width: 0; }
              .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; white-space: nowrap; }
              .summary-value { margin-top: 4px; font-size: 16px; font-weight: 700; color: #111827; white-space: nowrap; }
              table { width: 100%; border-collapse: collapse; font-size: 12px; }
              th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
              th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; }
              tfoot td { font-weight: 700; background: #f9fafb; }
              tr, td, th { page-break-inside: avoid; break-inside: avoid; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <div class="brand">
                  ${companyLogo ? `<img class="logo" src="${escapeHtml(companyLogo)}" alt="Logo" />` : ''}
                  <div class="brand-info">
                    <div class="company">${escapeHtml(companyName)}</div>
                    <div class="meta-line">${escapeHtml(companyAddress)}</div>
                      ${companyPhone || companyEmail ? `<div class="contact-row">${companyPhone ? `<span class="contact-chip">Phone: ${escapeHtml(companyPhone)}</span>` : ''}${companyEmail ? `<span class="contact-chip">Email: ${escapeHtml(companyEmail)}</span>` : ''}</div>` : ''}
                  </div>
                </div>
                <div>
                  <div class="title">${escapeHtml(reportTitle)}</div>
                  <div class="meta" style="text-align:right;">Print Date: ${escapeHtml(printDate)}</div>
                </div>
              </div>
              ${reportPeriod ? `<div class="report-period"><span class="period-label">Report Period</span><span class="period-value">${escapeHtml(reportPeriod)}</span></div>` : ''}
              ${filters.length ? `<div class="filters">${filters.map((item) => `<div>${escapeHtml(item)}</div>`).join('')}</div>` : ''}

              <table>
                <thead>
                  <tr>
                    ${printableColumns.map(([key, label]) => {
                      const printableLabel = String(label);

                      return `<th>${escapeHtml(printableLabel)}</th>`;
                    }).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${reportData.data.length === 0 ? `<tr><td colspan="${printableColumns.length}" style="text-align:center; font-style:italic; color:#6b7280; padding:16px;">No records found</td></tr>` : reportData.data.map((row) => `
                    <tr>
                      ${printableColumns.map(([key]) => `<td>${escapeHtml(renderCellValue(row, key))}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="summary">
                ${activeReportKey === 'expiry-wise' ? `
                ${appliedFilters.show_with_cost_price ? `
                <div class="summary-row columns-3">
                  <div class="summary-card"><div class="summary-label">No. of Items</div><div class="summary-value">${totalItems}</div></div>
                  <div class="summary-card"><div class="summary-label">Total Amount in Cost Price</div><div class="summary-value">${formatMoney(totalNetAvailableAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">Total Amount in Sale Price</div><div class="summary-value">${formatMoney(totalNetStockSalesPrice)}</div></div>
                </div>
                ` : `
                <div class="summary-row columns-2-expiry">
                  <div class="summary-card"><div class="summary-label">No. of Items</div><div class="summary-value">${totalItems}</div></div>
                  <div class="summary-card"><div class="summary-label">Total Amount in Sale Price</div><div class="summary-value">${formatMoney(totalNetStockSalesPrice)}</div></div>
                </div>
                `}
                ` : activeReportKey === 'available-stock' ? `
                <div class="summary-row columns-6">
                  <div class="summary-card"><div class="summary-label">No. of Items</div><div class="summary-value">${totalItems}</div></div>
                  <div class="summary-card"><div class="summary-label">Available Quantity</div><div class="summary-value">${totalAvailableQuantity}</div></div>
                  <div class="summary-card"><div class="summary-label">Net Stock Amount (C.P)</div><div class="summary-value">${formatMoney(totalNetAvailableAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">Net Stock Amount (S. P.)</div><div class="summary-value">${formatMoney(totalNetStockSalesPrice)}</div></div>
                </div>
                ` : `
                <div class="summary-row columns-6">
                  <div class="summary-card"><div class="summary-label">No. of Items</div><div class="summary-value">${totalItems}</div></div>
                  <div class="summary-card"><div class="summary-label">Opening Amount</div><div class="summary-value">${formatMoney(totalOpeningAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">Purchase Amount</div><div class="summary-value">${formatMoney(totalPurchaseAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">P. Return Amount</div><div class="summary-value">${formatMoney(totalPurchaseReturnAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">Sale Amount</div><div class="summary-value">${formatMoney(totalSaleAmount)}</div></div>
                  <div class="summary-card"><div class="summary-label">S. Return Amount</div><div class="summary-value">${formatMoney(totalSalesReturnAmount)}</div></div>
                </div>
                <div class="summary-row columns-2 right-aligned">
                  <div class="summary-card"><div class="summary-label">Net Sales Amount</div><div class="summary-value">${formatMoney(totalSalesNetAmount)}</div></div>
                </div>
                <div class="summary-row columns-2 right-aligned">
                  <div class="summary-card"><div class="summary-label">Net Stock Amount</div><div class="summary-value">${formatMoney(totalClosingStockAmount)}</div></div>
                </div>
                `}
              </div>

            </div>
          </body>
        </html>
      `;

      const newWin = window.open('', '_blank', 'width=900,height=700');
      if (!newWin) {
        toast.error('Unable to open print window');
        return;
      }
      newWin.document.open();
      newWin.document.write(html);
      newWin.document.close();
      newWin.focus();
      // Give browser a moment to render before print
      setTimeout(() => {
        newWin.print();
        // Optionally close the window after printing
        // newWin.close();
      }, 250);
    } catch (err) {
      console.error(err);
      toast.error('Failed to print report');
    }
  }, [tenant, brands, products, appliedFilters, activeReportKey, reportData.columns, reportData.data]);

  // Check if current user is super admin
  const isSuperAdmin = useMemo(() => {
    const role = currentUser?.role?.toLowerCase();
    return role === 'super admin' || role === 'superadmin';
  }, [currentUser?.role]);

  const visibleModules = useMemo(() => {
    const allowedModuleKeys = new Set(
      REPORT_MODULE_MENU_ITEMS
        .filter((item) => item.permissions.some((permission) => hasPermission(permission)))
        .map((item) => item.key),
    );

    const filtered = REPORT_MODULE_DEFINITIONS.filter((module) => allowedModuleKeys.has(module.key));
    return filtered.length > 0 ? filtered : REPORT_MODULE_DEFINITIONS;
  }, [hasPermission]);

  const activeModule = useMemo(
    () => visibleModules.find((module) => module.key === activeModuleKey) ?? visibleModules[0] ?? null,
    [activeModuleKey, visibleModules],
  );

  const activeReport = REPORT_DEFINITIONS[activeReportKey];

  const canViewReports = visibleModules.length > 0;

  useEffect(() => {
    if (!canViewReports) {
      return;
    }

    const matchedModule = visibleModules.find((module) => module.key === moduleKey);
    const fallbackModule = visibleModules[0];
    const targetModule = matchedModule ?? fallbackModule;

    if (!targetModule) return;

    if (!matchedModule && moduleKey !== targetModule.key) {
      navigate(`/reports/${targetModule.key}`, { replace: true });
    }

    if (activeModuleKey !== targetModule.key) {
      setActiveModuleKey(targetModule.key);
    }
  }, [activeModuleKey, canViewReports, moduleKey, navigate, visibleModules]);

  useEffect(() => {
    if (!activeModule) return;

    // Ensure selectedOptions contains at least one valid option for the active module
    const moduleKeys = new Set(activeModule.options.map((o) => o.key));
    const nextSelected = new Set(Array.from(selectedOptions).filter((k) => moduleKeys.has(k)));
    if (nextSelected.size === 0) {
      nextSelected.add(activeModule.options[0].key);
    }

    // If active option key is not among selected, sync it to first selected
    const firstSelected = Array.from(nextSelected)[0];
    if (activeOptionKey !== firstSelected) setActiveOptionKey(firstSelected);

    // Set active report key to the first selected option's reportKey
    const selectedOption = activeModule.options.find((o) => o.key === firstSelected) ?? activeModule.options[0];
    if (activeReportKey !== selectedOption.reportKey) setActiveReportKey(selectedOption.reportKey);

    // sync selectedOptions if we filtered out invalid ones
    const equal = selectedOptions.size === nextSelected.size && Array.from(selectedOptions).every((v) => nextSelected.has(v));
    if (!equal) setSelectedOptions(nextSelected);
  }, [activeModule, selectedOptions, activeOptionKey, activeReportKey]);

  useEffect(() => {
    if (activeReportKey !== 'expiry-wise') return;

    if (draftFilters.brand_id || draftFilters.product_id || appliedFilters.brand_id || appliedFilters.product_id) {
      setDraftFilters((current) => ({
        ...current,
        brand_id: '',
        product_id: '',
      }));
      setAppliedFilters((current) => ({
        ...current,
        brand_id: '',
        product_id: '',
      }));
    }
  }, [activeReportKey]);

  useEffect(() => {
    setSortBy(activeReport.defaultSortBy);
    setSortDir(activeReport.defaultSortDir);
    setPage(1);
  }, [activeReport.defaultSortBy, activeReport.defaultSortDir]);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setBrandsLoading(true);
        const data = await brandApi.list();
        setBrands(data);
      } catch {
        toast.error('Failed to load brands');
      } finally {
        setBrandsLoading(false);
      }
    };

    void fetchBrands();
  }, []);

  // Load products for non-ESR reports based on selected brand
  useEffect(() => {
    if (activeReportKey === 'expiry-wise') {
      return;
    }

    const loadProducts = async (brandId?: string) => {
      try {
        setProductsLoading(true);
        const params: any = { per_page: 1000 };
        if (brandId) params.brand_id = brandId;
        else if (appliedFilters.brand_id) params.brand_id = appliedFilters.brand_id;
        const response = await inventoryApi.getProducts(params);
        setProducts(response.data || response);
      } catch {
        toast.error('Failed to load products');
      } finally {
        setProductsLoading(false);
      }
    };

    void loadProducts();
  }, [activeReportKey, appliedFilters.brand_id]);

  // ESR keeps its own product list so brand filtering stays local to expiry report only.
  useEffect(() => {
    if (activeReportKey !== 'expiry-wise') {
      return;
    }

    const loadExpiryProducts = async (brandId?: string) => {
      try {
        setExpiryProductsLoading(true);
        const params: any = { per_page: 1000 };
        if (brandId) params.brand_id = brandId;
        const response = await inventoryApi.getProducts(params);
        setExpiryProducts(response.data || response);
      } catch {
        toast.error('Failed to load products for expiry report');
      } finally {
        setExpiryProductsLoading(false);
      }
    };

    void loadExpiryProducts(appliedFilters.brand_id || undefined);
  }, [activeReportKey, appliedFilters.brand_id]);

  const requestFilters = useMemo<ReportFilters>(() => {
    const filters: ReportFilters = {
      page,
      per_page: appliedFilters.per_page,
      search: appliedFilters.search || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    };

    // Handle date filters based on report type
    if (activeReport.dateFilter === 'range') {
      filters.from_date = appliedFilters.from_date || undefined;
      filters.to_date = appliedFilters.to_date || undefined;
    } else if (activeReport.dateFilter === 'single') {
      filters.as_of_date = appliedFilters.as_of_date || undefined;
    }
    // 'none' dateFilter type doesn't include any date fields

    if (activeReport.filters.customer && appliedFilters.customer_id) {
      filters.customer_id = Number(appliedFilters.customer_id);
    }

    if (activeReport.filters.brand && appliedFilters.brand_id) {
      filters.brand_id = Number(appliedFilters.brand_id);
    }

    if (activeReport.filters.product && appliedFilters.product_id) {
      filters.product_id = Number(appliedFilters.product_id);
    }

    if (activeReport.filters.batch && appliedFilters.batch_no) {
      filters.batch_no = appliedFilters.batch_no;
    }

    if (activeReport.filters.nearExpiry && appliedFilters.near_expiry_days) {
      filters.near_expiry_days = Number(appliedFilters.near_expiry_days);
    }

    if (activeReport.filters.includeProfit) {
      filters.include_profit = appliedFilters.include_profit;
    }

    // Add show_only_positive_stock filter if enabled
    if (appliedFilters.show_only_positive_stock) {
      filters.show_only_positive_stock = true;
    }

    if (activeReportKey === 'expiry-wise' && appliedFilters.show_only_expiry_date) {
      filters.show_only_expiry_date = true;
    }

    if (activeReportKey === 'expiry-wise' && appliedFilters.show_with_cost_price) {
      filters.show_with_cost_price = true;
    }

    // Add client_id filter if user is not super admin
    if (!isSuperAdmin && currentUser?.tenant_id) {
      filters.client_id = currentUser.tenant_id;
    }

    return filters;
  }, [activeReport.dateFilter, activeReport.filters, appliedFilters, page, sortBy, sortDir, isSuperAdmin, currentUser?.tenant_id]);

  const loadReport = useCallback(async () => {
    const token = ++requestToken.current;
    setLoading(true);

    try {
      const payload = await activeReport.fetch(requestFilters);
      if (token !== requestToken.current) return;
      setReportData(payload);
    } catch {
      if (token !== requestToken.current) return;
      setReportData(EMPTY_REPORT);
      toast.error(`Failed to load ${activeReport.label.toLowerCase()} report`);
    } finally {
      if (token === requestToken.current) {
        setLoading(false);
      }
    }
  }, [activeReport, requestFilters]);

  const refreshReport = useCallback(async (filters: ReportFilters) => {
    const token = ++requestToken.current;
    setLoading(true);

    try {
      const payload = await activeReport.fetch(filters);
      if (token !== requestToken.current) return;
      setReportData(payload);
    } catch {
      if (token !== requestToken.current) return;
      setReportData(EMPTY_REPORT);
      toast.error(`Failed to load ${activeReport.label.toLowerCase()} report`);
    } finally {
      if (token === requestToken.current) {
        setLoading(false);
      }
    }
  }, [activeReport]);

  useEffect(() => {
    if (!canViewReports) return;
    void loadReport();
  }, [canViewReports, loadReport]);

  const handleExport = async (format: ReportFormat) => {
    if (activeReport.supportsExport === false) {
      toast.error('Export is not available for this report.');
      return;
    }

    setExporting(format);

    try {
      const file = await activeReport.export(format, requestFilters);
      downloadBlob(file);
      toast.success(`${activeReport.label} ${format.toUpperCase()} exported`);
    } catch {
      toast.error(`Failed to export ${activeReport.label.toLowerCase()} report`);
    } finally {
      setExporting(null);
    }
  };

  const handleApplyFilters = () => {
    setAppliedFilters({
      ...draftFilters,
      search: draftFilters.search.trim(),
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setPage(1);
    setSortBy(activeReport.defaultSortBy);
    setSortDir(activeReport.defaultSortDir);
  };

  const toggleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }

    setPage(1);
  };

  const tableColumns = useMemo(() => {
    const columns = Object.entries(reportData.columns ?? {});
    if (columns.length > 0) {
      return columns;
    }

    const firstRow = reportData.data[0];
    if (!firstRow) {
      return [];
    }

    return Object.keys(firstRow).map((key) => [key, toTitle(key)]);
  }, [reportData.columns, reportData.data]);

  const getReportCellValue = useCallback((row: ReportRow, key: string) => {
    const rawValue = (row as Record<string, unknown>)[key];

    return rawValue;
  }, []);

  const getReportColumnLabel = useCallback((key: string, label: string) => {
    return label;
  }, []);

  const openDrilldown = async (row: ReportRow) => {
    const customerId = Number(row.customer_id ?? 0);
    if (!customerId) return;

    setDrilldownCustomer({
      id: customerId,
      name: String(row.customer_name ?? 'Customer'),
    });
    setDrilldownPage(1);
  };

  const loadDrilldown = useCallback(async (customerId: number, currentPage: number) => {
    setDrilldownLoading(true);

    try {
      const payload = await reportApi.customerWiseInvoices(customerId, {
        from_date: appliedFilters.from_date || undefined,
        to_date: appliedFilters.to_date || undefined,
        page: currentPage,
        per_page: 10,
        sort_by: 'invoice_date',
        sort_dir: 'desc',
      });

      setDrilldownData(payload);
    } catch {
      toast.error('Failed to load customer invoice drill-down');
    } finally {
      setDrilldownLoading(false);
    }
  }, [appliedFilters.from_date, appliedFilters.to_date]);

  useEffect(() => {
    if (!drilldownCustomer) {
      setDrilldownData(EMPTY_REPORT);
      return;
    }

    void loadDrilldown(drilldownCustomer.id, drilldownPage);
  }, [drilldownCustomer, drilldownPage, loadDrilldown]);

  const exportDrilldown = async (format: ReportFormat) => {
    if (!drilldownCustomer) return;

    try {
      const file = await reportApi.customerWiseInvoicesExport(drilldownCustomer.id, format, {
        from_date: appliedFilters.from_date || undefined,
        to_date: appliedFilters.to_date || undefined,
      });

      downloadBlob(file);
      toast.success(`Customer invoices ${format.toUpperCase()} exported`);
    } catch {
      toast.error('Failed to export drill-down report');
    }
  };

  if (!canViewReports) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{activeModule?.label || 'Inventory Report Module'}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadReport()}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-100"
              disabled={loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={() => void handleExport('csv')}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 hover:bg-blue-100"
              disabled={!!exporting || activeReport.supportsExport === false}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
            </button>

            <button
              type="button"
              onClick={() => void handleExport('pdf')}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              disabled={!!exporting || activeReport.supportsExport === false}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
            </button>

            <button
              type="button"
              onClick={() => void handlePrint()}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 hover:bg-violet-100"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        {activeModule && (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
              {
                (() => {
                  return (
                    <>
                      {activeModule.options.map((option) => {
                        if (option.type === 'dropdown' && option.key.includes('brand')) {
                          return (
                            <select
                              key={option.key}
                              value={draftFilters.brand_id}
                              onChange={async (e) => {
                                const newBrandId = e.target.value;
                                setDraftFilters((current) => ({ ...current, brand_id: newBrandId, product_id: '' }));
                                setAppliedFilters((current) => ({ ...current, brand_id: newBrandId, product_id: '' }));
                                setPage(1);

                                // Fetch products for selected brand immediately so product dropdown updates
                                await (async () => {
                                  try {
                                    const params: any = { per_page: 1000 };
                                    if (newBrandId) params.brand_id = newBrandId;
                                    const response = await inventoryApi.getProducts(params);

                                    if (activeReportKey === 'expiry-wise') {
                                      setExpiryProducts(response.data || response);
                                    } else {
                                      setProducts(response.data || response);
                                    }
                                  } catch {
                                    toast.error('Failed to load products for selected brand');
                                  } finally {
                                    if (activeReportKey === 'expiry-wise') {
                                      setExpiryProductsLoading(false);
                                    } else {
                                      setProductsLoading(false);
                                    }
                                  }
                                })();
                                void refreshReport({
                                  ...requestFilters,
                                  page: 1,
                                  brand_id: newBrandId ? Number(newBrandId) : undefined,
                                  product_id: undefined,
                                });
                              }}
                              className="h-6 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={brandsLoading}
                              aria-label="Select Brand"
                            >
                              <option value="">All Brands</option>
                              {brands.map((brand) => (
                                <option key={brand.id} value={String(brand.id)}>
                                  {brand.name}
                                </option>
                              ))}
                            </select>
                          );
                        }

                        if (option.type === 'dropdown' && option.key.includes('product')) {
                          return (
                            <select
                              key={option.key}
                              value={draftFilters.product_id}
                              onChange={(e) => {
                                const newProductId = e.target.value;
                                setDraftFilters((current) => ({ ...current, product_id: newProductId }));
                                setAppliedFilters((current) => ({ ...current, product_id: newProductId }));
                                setPage(1);
                                void refreshReport({
                                  ...requestFilters,
                                  page: 1,
                                  product_id: newProductId ? Number(newProductId) : undefined,
                                });
                              }}
                              className="h-6 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={activeReportKey === 'expiry-wise' ? expiryProductsLoading : productsLoading}
                              aria-label="Select Product"
                            >
                              <option value="">All Products</option>
                              {(activeReportKey === 'expiry-wise' ? expiryProducts : products).map((product) => (
                                <option key={product.id} value={String(product.id)}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                          );
                        }

                        if (activeReportKey === 'expiry-wise' && option.key === 'expiry-date') {
                          return (
                            <label key={option.key} className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-1 py-0.5 text-xs hover:bg-white">
                              <input
                                type="checkbox"
                                checked={draftFilters.show_only_expiry_date}
                                onChange={(event) => {
                                  const val = event.target.checked;
                                  setDraftFilters((current) => ({ ...current, show_only_expiry_date: val }));
                                  setAppliedFilters((current) => ({ ...current, show_only_expiry_date: val }));
                                  setPage(1);
                                  void refreshReport({
                                    ...requestFilters,
                                    page: 1,
                                    show_only_expiry_date: val || undefined,
                                  });
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          );
                        }

                        if (activeReportKey === 'expiry-wise' && option.key === 'with-cost-price') {
                          return (
                            <label key={option.key} className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-1 py-0.5 text-xs hover:bg-white">
                              <input
                                type="checkbox"
                                checked={draftFilters.show_with_cost_price}
                                onChange={(event) => {
                                  const val = event.target.checked;
                                  setDraftFilters((current) => ({ ...current, show_with_cost_price: val }));
                                  setAppliedFilters((current) => ({ ...current, show_with_cost_price: val }));
                                  setPage(1);
                                  void refreshReport({
                                    ...requestFilters,
                                    page: 1,
                                    show_with_cost_price: val || undefined,
                                  });
                                }}
                              />
                              <span>WithCostPrice</span>
                            </label>
                          );
                        }

                        return (
                          <label key={option.key} className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-1 py-0.5 text-xs hover:bg-white">
                            <input
                              type="checkbox"
                              checked={selectedOptions.has(option.key)}
                              onChange={() => {
                                setSelectedOptions((prev) => {
                                  const next = new Set(prev);
                                  const isAll = option.key === 'all';

                                  if (next.has(option.key)) {
                                    next.delete(option.key);
                                  } else {
                                    if (isAll) {
                                      next.clear();
                                      next.add('all');
                                    } else {
                                      if (next.has('all')) next.delete('all');
                                      next.add(option.key);
                                    }
                                  }

                                  return next;
                                });
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}

                      {activeReportKey !== 'expiry-wise' && (
                        <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded px-1 py-0.5 text-xs hover:bg-white">
                          <input
                            type="checkbox"
                            checked={draftFilters.show_only_positive_stock}
                            onChange={(event) => {
                              const val = event.target.checked;
                              setDraftFilters((current) => ({ ...current, show_only_positive_stock: val }));
                              setAppliedFilters((current) => ({ ...current, show_only_positive_stock: val }));
                              setPage(1);
                            }}
                          />
                          <span>Available</span>
                        </label>
                      )}
                    </>
                  );
                })()
              }
            </div>
          </div>
        )}

      </section>

      <section className="flex w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 md:flex-row md:items-center md:gap-0">
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Detailed Report Data</h3>
            <div className="flex flex-wrap items-end gap-2">
              {activeReport.dateFilter === 'single' && (
                <input
                  type="date"
                  value={draftFilters.as_of_date}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, as_of_date: event.target.value }))}
                  className="h-7 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  title="As Of Date"
                />
              )}
              {activeReport.dateFilter === 'range' && (
                <>
                  <input
                    type="date"
                    value={draftFilters.from_date}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, from_date: event.target.value }))}
                    className="h-7 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="From Date"
                  />
                  <input
                    type="date"
                    value={draftFilters.to_date}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, to_date: event.target.value }))}
                    className="h-7 rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="To Date"
                  />
                </>
              )}
              <input
                type="text"
                placeholder="Search report rows..."
                value={draftFilters.search}
                onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                className="h-7 w-full rounded border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 md:w-56"
                title="Search report rows"
              />
              <button
                type="button"
                onClick={handleApplyFilters}
                className="inline-flex h-7 items-center rounded bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Search
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex h-7 items-center rounded border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="self-end text-xs text-gray-500 md:self-auto">
            {loading ? 'Loading rows...' : `${reportData.pagination?.total ?? reportData.data.length} records`}
          </div>
        </div>

        <div ref={printRef} className="overflow-x-auto overflow-y-visible">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-gray-100 text-xs font-semibold uppercase text-gray-600">
              <tr>
                {tableColumns.map(([key, label]) => (
                  <th key={key} className="whitespace-nowrap border-b border-gray-200 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="text-xs font-semibold uppercase">{String(getReportColumnLabel(key, String(label)))}</span>
                      {sortBy === key ? (
                        sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-blue-600" /> : <ArrowDown className="h-3 w-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                      )}
                    </button>
                  </th>
                ))}
                {activeReport.allowsDrilldown && <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
              {!loading && reportData.data.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColumns.length + (activeReport.allowsDrilldown ? 1 : 0)}
                    className="px-3 py-8 text-center italic text-gray-400"
                  >
                    No records found
                  </td>
                </tr>
              )}

              {reportData.data.map((row, index) => (
                <tr key={`row-${index}`} className="h-8 transition-colors hover:bg-blue-50">
                  {tableColumns.map(([key]) => {
                    const rawValue = getReportCellValue(row, key);
                    const alignRight = typeof rawValue === 'number' || isCurrencyLike(key) || isCountLike(key);

                    return (
                      <td key={`${key}-${index}`} className={`px-3 py-1 ${alignRight ? 'text-right' : 'text-left'} whitespace-nowrap`}>
                        {formatDisplayValue(key, rawValue)}
                      </td>
                    );
                  })}

                  {activeReport.allowsDrilldown && (
                    <td className="px-3 py-1">
                      <button
                        type="button"
                        onClick={() => void openDrilldown(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Invoices
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {reportData.pagination && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
            <div>
              Showing {reportData.pagination.total > 0 ? ((reportData.pagination.current_page - 1) * reportData.pagination.per_page) + 1 : 0} to{' '}
              {Math.min(reportData.pagination.current_page * reportData.pagination.per_page, reportData.pagination.total)} of {reportData.pagination.total} entries
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={reportData.pagination.current_page <= 1}
                className="rounded p-1 hover:bg-gray-200 disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>Page {reportData.pagination.current_page} of {Math.max(1, reportData.pagination.last_page)}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(reportData.pagination?.last_page || current, current + 1))}
                disabled={reportData.pagination.current_page >= reportData.pagination.last_page}
                className="rounded p-1 hover:bg-gray-200 disabled:opacity-50"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={!!drilldownCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldownCustomer(null);
            setDrilldownData(EMPTY_REPORT);
            setDrilldownPage(1);
          }
        }}
        title={drilldownCustomer ? `Invoices - ${drilldownCustomer.name}` : 'Invoices'}
        size="xl"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-gray-500">Customer invoice-level details from the selected customer-wise row.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void exportDrilldown('csv')}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void exportDrilldown('pdf')}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(drilldownData.summary ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
                <div className="text-[10px] uppercase text-gray-500">{toTitle(key)}</div>
                <div className="mt-1 text-xs font-semibold text-gray-800">{formatDisplayValue(key, value)}</div>
              </div>
            ))}
          </div>

          <div className="overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-100 text-xs font-semibold uppercase text-gray-600">
                <tr>
                  {Object.entries(drilldownData.columns ?? {}).map(([key, label]) => (
                    <th key={key} className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-left">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drilldownLoading && (
                  <tr>
                    <td className="px-3 py-3 text-gray-500" colSpan={Math.max(Object.keys(drilldownData.columns ?? {}).length, 1)}>
                      Loading invoice rows...
                    </td>
                  </tr>
                )}

                {!drilldownLoading && drilldownData.data.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-gray-500" colSpan={Math.max(Object.keys(drilldownData.columns ?? {}).length, 1)}>
                      No invoice rows available.
                    </td>
                  </tr>
                )}

                {!drilldownLoading && drilldownData.data.map((row, rowIndex) => (
                  <tr key={`invoice-row-${rowIndex}`}>
                    {Object.keys(drilldownData.columns ?? {}).map((key) => (
                      <td key={`${key}-${rowIndex}`} className="whitespace-nowrap px-3 py-1 text-gray-700">
                        {formatDisplayValue(key, row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {drilldownData.pagination && (
            <div className="flex items-center justify-between border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
              <div>
                Showing {drilldownData.pagination.total > 0 ? ((drilldownData.pagination.current_page - 1) * drilldownData.pagination.per_page) + 1 : 0} to{' '}
                {Math.min(drilldownData.pagination.current_page * drilldownData.pagination.per_page, drilldownData.pagination.total)} of {drilldownData.pagination.total} entries
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDrilldownPage((current) => Math.max(1, current - 1))}
                  disabled={drilldownData.pagination.current_page <= 1}
                  className="rounded p-1 hover:bg-gray-200 disabled:opacity-50"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-gray-600">
                  Page {drilldownData.pagination.current_page} of {drilldownData.pagination.last_page}
                </span>
                <button
                  type="button"
                  onClick={() => setDrilldownPage((current) => Math.min(drilldownData.pagination?.last_page || current, current + 1))}
                  disabled={drilldownData.pagination.current_page >= drilldownData.pagination.last_page}
                  className="rounded p-1 hover:bg-gray-200 disabled:opacity-50"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
