import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, Printer, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  brandApi,
  customerApi,
  inventoryApi,
  reportApi,
  type DownloadedReport,
  type ReportFilters,
  type ReportFormat,
  type ReportResponse,
  type ReportRow,
} from '../../api';
import { useStore } from '../../store';
import { Modal } from '../components/ui/Modal';

type ReportKey =
  | 'customer-wise'
  | 'brand-wise'
  | 'product-wise'
  | 'batch-wise'
  | 'expiry-wise'
  | 'product-batch-wise'
  | 'date-wise-sales'
  | 'sales-and-stock'
  | 'available-stock'
  | 'customer-ledger';

interface OptionItem {
  id: number;
  name: string;
}

interface FilterState {
  from_date: string;
  to_date: string;
  search: string;
  customer_id: string;
  brand_id: string;
  product_id: string;
  batch_no: string;
  near_expiry_days: string;
  include_profit: boolean;
  per_page: number;
}

interface ReportDefinition {
  key: ReportKey;
  label: string;
  description: string;
  chartType: 'bar' | 'line';
  defaultSortBy: string;
  defaultSortDir: 'asc' | 'desc';
  filters: {
    customer: boolean;
    brand: boolean;
    product: boolean;
    batch: boolean;
    nearExpiry: boolean;
    includeProfit: boolean;
  };
  allowsDrilldown: boolean;
  fetch: (filters: ReportFilters) => Promise<ReportResponse>;
  export: (format: ReportFormat, filters: ReportFilters) => Promise<DownloadedReport>;
}

const NUMBER_FORMAT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const INITIAL_FILTERS: FilterState = {
  from_date: '',
  to_date: '',
  search: '',
  customer_id: '',
  brand_id: '',
  product_id: '',
  batch_no: '',
  near_expiry_days: '30',
  include_profit: false,
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
    filters: { customer: false, brand: false, product: true, batch: true, nearExpiry: false, includeProfit: false },
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
    filters: { customer: false, brand: false, product: false, batch: false, nearExpiry: true, includeProfit: false },
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
    filters: { customer: false, brand: false, product: true, batch: true, nearExpiry: false, includeProfit: false },
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
    filters: { customer: false, brand: false, product: true, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.salesAndStock,
    export: reportApi.salesAndStockExport,
  },
  'available-stock': {
    key: 'available-stock',
    label: 'Available Stock',
    description: 'On-hand stock by product and batch.',
    chartType: 'bar',
    defaultSortBy: 'available_quantity',
    defaultSortDir: 'desc',
    filters: { customer: false, brand: false, product: true, batch: true, nearExpiry: false, includeProfit: false },
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
    filters: { customer: true, brand: false, product: false, batch: false, nearExpiry: false, includeProfit: false },
    allowsDrilldown: false,
    fetch: reportApi.customerLedger,
    export: reportApi.customerLedgerExport,
  },
};

const REPORT_PERMISSION_MAP: Record<ReportKey, string[]> = {
  'customer-wise': ['manage_orders', 'sales.view', 'invoices.view', 'customer.view', 'report.view', 'reports.view'],
  'brand-wise': ['manage_orders', 'sales.view', 'invoices.view', 'manage_products', 'brand.view', 'report.view', 'reports.view'],
  'product-wise': ['manage_orders', 'sales.view', 'invoices.view', 'manage_products', 'product.view', 'report.view', 'reports.view'],
  'batch-wise': ['manage_inventory', 'inventory.view', 'purchase.view', 'report.view', 'reports.view'],
  'expiry-wise': ['manage_inventory', 'inventory.view', 'purchase.view', 'report.view', 'reports.view'],
  'product-batch-wise': ['manage_inventory', 'inventory.view', 'manage_products', 'product.view', 'report.view', 'reports.view'],
  'date-wise-sales': ['manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  'sales-and-stock': ['manage_inventory', 'inventory.view', 'manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  'available-stock': ['manage_inventory', 'inventory.view', 'report.view', 'reports.view'],
  'customer-ledger': ['manage_orders', 'sales.view', 'invoices.view', 'customer.view', 'report.view', 'reports.view'],
};

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
  const { hasPermission } = useStore();

  const [activeReportKey, setActiveReportKey] = useState<ReportKey>('customer-wise');
  const [reportData, setReportData] = useState<ReportResponse>(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);

  const [sortBy, setSortBy] = useState(REPORT_DEFINITIONS['customer-wise'].defaultSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(REPORT_DEFINITIONS['customer-wise'].defaultSortDir);
  const [page, setPage] = useState(1);

  const [draftFilters, setDraftFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);

  const [customers, setCustomers] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [products, setProducts] = useState<OptionItem[]>([]);

  const [drilldownCustomer, setDrilldownCustomer] = useState<OptionItem | null>(null);
  const [drilldownData, setDrilldownData] = useState<ReportResponse>(EMPTY_REPORT);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownPage, setDrilldownPage] = useState(1);

  const requestToken = useRef(0);

  const visibleReports = Object.values(REPORT_DEFINITIONS).filter((report) =>
    (REPORT_PERMISSION_MAP[report.key] ?? []).some((permission) => hasPermission(permission))
  );

  const activeReport = REPORT_DEFINITIONS[activeReportKey];

  const canViewReports = visibleReports.length > 0;

  useEffect(() => {
    if (visibleReports.length === 0) {
      return;
    }

    if (!visibleReports.some((report) => report.key === activeReportKey)) {
      setActiveReportKey(visibleReports[0].key);
    }
  }, [activeReportKey, visibleReports]);

  useEffect(() => {
    setSortBy(activeReport.defaultSortBy);
    setSortDir(activeReport.defaultSortDir);
    setPage(1);
  }, [activeReport.defaultSortBy, activeReport.defaultSortDir]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [customerResult, brandResult, productResult] = await Promise.allSettled([
          customerApi.list(),
          brandApi.list(),
          inventoryApi.getProducts(),
        ]);

        const customerRows = customerResult.status === 'fulfilled' ? customerResult.value : [];
        const brandRows = brandResult.status === 'fulfilled' ? brandResult.value : [];
        const productPayload = productResult.status === 'fulfilled' ? productResult.value : [];

        setCustomers((customerRows ?? []).map((item: any) => ({ id: Number(item.id), name: String(item.name) })));
        setBrands((brandRows ?? []).map((item: any) => ({ id: Number(item.id), name: String(item.name) })));

        const productsData = Array.isArray(productPayload)
          ? productPayload
          : Array.isArray(productPayload?.data)
            ? productPayload.data
            : [];

        setProducts(productsData.map((item: any) => ({ id: Number(item.id), name: String(item.name) })));
        if (customerResult.status === 'rejected' && brandResult.status === 'rejected' && productResult.status === 'rejected') {
          toast.error('Failed to load report filter options');
        }
      } catch {
        toast.error('Failed to load report filter options');
      }
    };

    void loadFilterOptions();
  }, []);

  const requestFilters = useMemo<ReportFilters>(() => {
    const filters: ReportFilters = {
      page,
      per_page: appliedFilters.per_page,
      search: appliedFilters.search || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      from_date: appliedFilters.from_date || undefined,
      to_date: appliedFilters.to_date || undefined,
    };

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

    return filters;
  }, [activeReport.filters, appliedFilters, page, sortBy, sortDir]);

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

  useEffect(() => {
    if (!canViewReports) return;
    void loadReport();
  }, [canViewReports, loadReport]);

  const handleExport = async (format: ReportFormat) => {
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

  const summaryEntries = useMemo(() => Object.entries(reportData.summary ?? {}), [reportData.summary]);

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

  const chartData = useMemo(() => {
    if (!reportData.charts?.x_key || !reportData.charts?.y_key) {
      return [];
    }

    const xKey = reportData.charts.x_key;
    const yKey = reportData.charts.y_key;

    return reportData.data.slice(0, 12).map((row) => ({
      label: String(row[xKey] ?? ''),
      value: Number(row[yKey] ?? 0),
    }));
  }, [reportData.charts, reportData.data]);

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
            <h2 className="text-lg font-bold text-gray-900">Inventory Report Module</h2>
            <p className="text-xs text-gray-500">Comprehensive analytics, export, and drill-down reports for sales and inventory.</p>
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
              disabled={!!exporting}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
            </button>

            <button
              type="button"
              onClick={() => void handleExport('pdf')}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              disabled={!!exporting}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 hover:bg-violet-100"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          {visibleReports.map((report) => (
            <button
              key={report.key}
              type="button"
              onClick={() => setActiveReportKey(report.key)}
              className={`rounded-md border px-2 py-2 text-left text-xs transition ${
                activeReportKey === report.key
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold">{report.label}</div>
              <div className="mt-0.5 line-clamp-2 text-[10px] text-gray-500">{report.description}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">From Date</label>
            <input
              type="date"
              value={draftFilters.from_date}
              onChange={(event) => setDraftFilters((current) => ({ ...current, from_date: event.target.value }))}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
              title="From Date"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">To Date</label>
            <input
              type="date"
              value={draftFilters.to_date}
              onChange={(event) => setDraftFilters((current) => ({ ...current, to_date: event.target.value }))}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
              title="To Date"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Search</label>
            <input
              type="text"
              placeholder="Search report rows"
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
              title="Search report rows"
            />
          </div>

          {activeReport.filters.customer && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Customer</label>
              <select
                value={draftFilters.customer_id}
                onChange={(event) => setDraftFilters((current) => ({ ...current, customer_id: event.target.value }))}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                title="Customer"
              >
                <option value="">All Customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeReport.filters.brand && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Brand</label>
              <select
                value={draftFilters.brand_id}
                onChange={(event) => setDraftFilters((current) => ({ ...current, brand_id: event.target.value }))}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                title="Brand"
              >
                <option value="">All Brands</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeReport.filters.product && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Product</label>
              <select
                value={draftFilters.product_id}
                onChange={(event) => setDraftFilters((current) => ({ ...current, product_id: event.target.value }))}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                title="Product"
              >
                <option value="">All Products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </div>
          )}

          {activeReport.filters.batch && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Batch No</label>
              <input
                type="text"
                value={draftFilters.batch_no}
                onChange={(event) => setDraftFilters((current) => ({ ...current, batch_no: event.target.value }))}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                placeholder="Batch number"
                title="Batch number"
              />
            </div>
          )}

          {activeReport.filters.nearExpiry && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Near Expiry Days</label>
              <input
                type="number"
                min={1}
                max={365}
                value={draftFilters.near_expiry_days}
                onChange={(event) => setDraftFilters((current) => ({ ...current, near_expiry_days: event.target.value }))}
                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                title="Near Expiry Days"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Rows Per Page</label>
            <select
              value={draftFilters.per_page}
              onChange={(event) => setDraftFilters((current) => ({ ...current, per_page: Number(event.target.value) }))}
              className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
              title="Rows Per Page"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {activeReport.filters.includeProfit && (
            <div className="flex items-end">
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-gray-300 px-2 text-xs">
                <input
                  type="checkbox"
                  checked={draftFilters.include_profit}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, include_profit: event.target.checked }))}
                />
                Include Profit
              </label>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Summary Metrics</h3>
            <span className="text-[11px] uppercase tracking-wide text-gray-500">{activeReport.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {summaryEntries.length === 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-500">
                No summary data available.
              </div>
            )}

            {summaryEntries.map(([key, value]) => (
              <div key={key} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-[10px] uppercase text-gray-500">{toTitle(key)}</div>
                <div className="mt-1 text-sm font-semibold text-gray-900">{formatDisplayValue(key, value)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-gray-900">Chart Preview</div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeReport.chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={10} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={10} tick={{ fill: '#6b7280' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" fontSize={10} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={10} tick={{ fill: '#6b7280' }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Detailed Report Data</h3>
          <div className="text-[11px] text-gray-500">
            {loading ? 'Loading rows...' : `${reportData.pagination?.total ?? reportData.data.length} records`}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                {tableColumns.map(([key, label]) => (
                  <th key={key} className="px-3 py-2 text-left font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1"
                    >
                      {label}
                      {sortBy === key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  </th>
                ))}
                {activeReport.allowsDrilldown && <th className="px-3 py-2 text-left font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && reportData.data.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColumns.length + (activeReport.allowsDrilldown ? 1 : 0)}
                    className="px-3 py-8 text-center text-xs text-gray-500"
                  >
                    No data found for the selected filters.
                  </td>
                </tr>
              )}

              {reportData.data.map((row, index) => (
                <tr key={`row-${index}`} className="hover:bg-gray-50">
                  {tableColumns.map(([key]) => {
                    const rawValue = row[key];
                    const alignRight = typeof rawValue === 'number' || isCurrencyLike(key) || isCountLike(key);

                    return (
                      <td key={`${key}-${index}`} className={`px-3 py-2 ${alignRight ? 'text-right' : 'text-left'} text-gray-700`}>
                        {formatDisplayValue(key, rawValue)}
                      </td>
                    );
                  })}

                  {activeReport.allowsDrilldown && (
                    <td className="px-3 py-2">
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
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs">
            <div className="text-gray-600">
              Page {reportData.pagination.current_page} of {reportData.pagination.last_page} • Total {reportData.pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={reportData.pagination.current_page <= 1}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(reportData.pagination?.last_page || current, current + 1))}
                disabled={reportData.pagination.current_page >= reportData.pagination.last_page}
                className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
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
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  {Object.entries(drilldownData.columns ?? {}).map(([key, label]) => (
                    <th key={key} className="px-3 py-2 text-left font-semibold">{label}</th>
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
                      <td key={`${key}-${rowIndex}`} className="px-3 py-2 text-gray-700">
                        {formatDisplayValue(key, row[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {drilldownData.pagination && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDrilldownPage((current) => Math.max(1, current - 1))}
                disabled={drilldownData.pagination.current_page <= 1}
                className="rounded-md border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-gray-600">
                Page {drilldownData.pagination.current_page} of {drilldownData.pagination.last_page}
              </span>
              <button
                type="button"
                onClick={() => setDrilldownPage((current) => Math.min(drilldownData.pagination?.last_page || current, current + 1))}
                disabled={drilldownData.pagination.current_page >= drilldownData.pagination.last_page}
                className="rounded-md border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
