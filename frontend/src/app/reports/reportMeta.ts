export type ReportKey =
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

export interface ReportMenuItem {
  key: ReportKey;
  label: string;
  permissions: string[];
}

export type ReportModuleKey =
  | 'available-stock'
  | 'sales-and-stock'
  | 'expiry-report'
  | 'invoice-summary'
  | 'customer'
  | 'supplier'
  | 'profit';

export interface ReportModuleMenuItem {
  key: ReportModuleKey;
  label: string;
  permissions: string[];
}

export const DEFAULT_REPORT_KEY: ReportKey = 'customer-wise';

export const REPORT_MENU_ITEMS: ReportMenuItem[] = [
  {
    key: 'customer-wise',
    label: 'Customer Wise',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'customer.view', 'report.view', 'reports.view'],
  },
  {
    key: 'brand-wise',
    label: 'Brand Wise',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'manage_products', 'brand.view', 'report.view', 'reports.view'],
  },
  {
    key: 'product-wise',
    label: 'Product Wise',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'manage_products', 'product.view', 'report.view', 'reports.view'],
  },
  {
    key: 'batch-wise',
    label: 'Batch Wise',
    permissions: ['manage_inventory', 'inventory.view', 'purchase.view', 'report.view', 'reports.view'],
  },
  {
    key: 'expiry-wise',
    label: 'Expiry Wise',
    permissions: ['manage_inventory', 'inventory.view', 'purchase.view', 'report.view', 'reports.view'],
  },
  {
    key: 'product-batch-wise',
    label: 'Product Batch Wise',
    permissions: ['manage_inventory', 'inventory.view', 'manage_products', 'product.view', 'report.view', 'reports.view'],
  },
  {
    key: 'date-wise-sales',
    label: 'Date Wise Sales',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  },
  {
    key: 'sales-and-stock',
    label: 'Sales and Stock',
    permissions: ['manage_inventory', 'inventory.view', 'manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  },
  {
    key: 'available-stock',
    label: 'Available Stock',
    permissions: ['manage_inventory', 'inventory.view', 'report.view', 'reports.view'],
  },
  {
    key: 'customer-ledger',
    label: 'Customer Ledger',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'customer.view', 'report.view', 'reports.view'],
  },
];

export const DEFAULT_REPORT_MODULE_KEY: ReportModuleKey = 'available-stock';

export const REPORT_MODULE_MENU_ITEMS: ReportModuleMenuItem[] = [
  {
    key: 'available-stock',
    label: 'Available Stock',
    permissions: ['manage_inventory', 'inventory.view', 'report.view', 'reports.view'],
  },
  {
    key: 'sales-and-stock',
    label: 'Sales and Stock',
    permissions: ['manage_inventory', 'inventory.view', 'manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  },
  {
    key: 'expiry-report',
    label: 'Expiry Report',
    permissions: ['manage_inventory', 'inventory.view', 'purchase.view', 'report.view', 'reports.view'],
  },
  {
    key: 'invoice-summary',
    label: 'Invoice Summary',
    permissions: ['manage_inventory', 'purchase.view', 'manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  },
  {
    key: 'customer',
    label: 'Customer',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'customer.view', 'report.view', 'reports.view'],
  },
  {
    key: 'supplier',
    label: 'Supplier',
    permissions: ['manage_inventory', 'purchase.view', 'supplier.view', 'report.view', 'reports.view'],
  },
  {
    key: 'profit',
    label: 'Profit',
    permissions: ['manage_orders', 'sales.view', 'invoices.view', 'report.view', 'reports.view'],
  },
];
