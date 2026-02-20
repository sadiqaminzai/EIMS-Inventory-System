import { create } from 'zustand';
import { toast } from 'sonner';
import { inventoryApi } from '../api/inventory';
import { brandApi } from '../api/brands';
import { categoryApi } from '../api/categories';
import { countryApi } from '../api/countries';
import { supplierApi } from '../api/suppliers';
import { customerApi } from '../api/customers';
import { userApi } from '../api/users';
import { roleApi } from '../api/roles';
import { permissionApi } from '../api/permissions';
import { tenantApi } from '../api/tenants';
import { accountApi } from '../api/accounts';
import { accountTransactionApi } from '../api/accountTransactions';
import { settingsApi } from '../api/settings';
import { transactionApi } from '../api/transactions';
import { paymentApi } from '../api/payments';

// --- Types ---

export type Role = string;

export type Permission = string;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant_id: string;
  tenant_name?: string;
  avatar?: string;
  status: 'active' | 'inactive';
  must_change_password?: boolean;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}


export interface Tenant {
  id: string;
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  whatsapp?: string;
  website?: string;
  license_no: string; // License Key
  license_issue: string; // License Start Date
  license_expiry: string;
  license_type: 'Trial' | 'Monthly' | 'Yearly' | 'Lifetime';
  max_users: number;
  license_status: 'Active' | 'Expired' | 'Suspended';
}

export interface BaseEntity {
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

export interface RoleItem {
  id: number;
  name: string;
  tenant_id?: string;
  tenant_name?: string;
  description?: string | null;
  permissions?: Record<string, boolean> | null;
}

export interface PermissionItem {
  id: number;
  name: string;
}

export interface Brand extends BaseEntity { id: string; name: string; details?: string; status: 'active' | 'inactive'; }
export interface Category extends BaseEntity { id: string; name: string; details?: string; status: 'active' | 'inactive'; }
export interface Country extends BaseEntity { id: string; name: string; details?: string; status: 'active' | 'inactive'; }
export interface Product extends BaseEntity {
  id: string;
  category_id?: string | null;
  model_no: string;
  sku?: string;
  name: string;
  description?: string;
  photo?: string;
  photo_file?: File;
  image_url?: string;
  unit_of_measure?: string | null;
  cost_price: number;
  sale_price: number;
  brand_id: string;
  country_id: string;
  status: 'active' | 'inactive';
  stock_qty: number;
}

export interface Supplier extends BaseEntity {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
}

export interface Customer extends BaseEntity {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
}

export interface PurchaseItem {
  order_item_id?: string;
  product_id: string;
  cost_price: number;
  batch_no: string;
  quantity: number;
  bonus: number;
  mfg_date: string;
  exp_date: string;
  discount: number;
  discount_percent?: number;
  tax: number;
  tax_percent?: number;
  amount: number;
}

export interface Purchase extends BaseEntity {
  id: string;
  invoice_no: string;
  supplier_id: string;
  purchase_date: string;
  items: PurchaseItem[];
  sub_total: number;
  total_discount: number;
  total_tax: number;
  grand_total: number;
  paid_amount?: number;
}

export interface SalesItem {
  order_item_id?: string;
  product_id: string;
  sale_price: number;
  batch_no: string;
  quantity: number;
  bonus: number;
  discount: number;
  discount_percent?: number;
  tax: number;
  tax_percent?: number;
  amount: number;
  exp_date?: string;
}

export interface Sale extends BaseEntity {
  id: string;
  invoice_no: string;
  customer_id: string;
  supplier_id?: string;
  invoice_type?: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'quotation';
  sale_date: string;
  items: SalesItem[];
  sub_total: number;
  total_discount: number;
  total_tax: number;
  net_payable: number;
  paid_amount?: number;
}

export interface ReturnItem {
  order_item_id?: string;
  product_id: string;
  batch_no: string;
  quantity: number;
  bonus: number;
  sale_price: number;
  discount: number;
  discount_percent?: number;
  tax: number;
  tax_percent?: number;
  amount: number;
  exp_date?: string;
}

export interface Return extends BaseEntity {
  id: string;
  invoice_no: string;
  customer_id: string;
  return_date: string;
  items: ReturnItem[];
  sub_total: number;
  total_discount: number;
  total_tax: number;
  total_amount: number;
  net_amount?: number;
  paid_amount?: number;
}

export interface Expense extends BaseEntity {
  id: string;
  title: string;
  description?: string;
  amount: number;
  expense_date: string;
  attachment?: string;
}

export interface Account extends BaseEntity {
  id: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile Money';
  account_number?: string;
  balance: number;
  currency: string;
  status: 'active' | 'inactive';
}

export interface Transaction extends BaseEntity {
  id: string;
  date: string;
  type: 'Income' | 'Expense' | 'Transfer';
  category: string; // Used for Expense Category or Income Source
  amount: number;
  currency: 'USD' | 'AFN';
  exchange_rate?: number;
  account_id: string;
  to_account_id?: string;
  reference_id?: string; // Could be Invoice ID
  contact_id?: string; // Customer ID or Supplier ID
  description?: string;
  payment_method: string;
  attachment?: string;
}

export interface PaymentDetail {
  customer_id: string;
  debit_amount: number;
  credit_amount: number;
  balance_amount: number;
  remarks?: string;
}

export interface Payment extends BaseEntity {
  id: string;
  serial_no?: string;
  date: string;
  account_id: string;
  currency: string;
  salesman?: string;
  booker?: string;
  notes?: string;
  details: PaymentDetail[];
}

export interface PrintSettings {
  show_product_image: boolean;
  show_header_logo: boolean;
  show_footer_signature: boolean;
  show_batch?: boolean;
  show_exp_date?: boolean;
  show_bonus?: boolean;
}

// --- Store ---

interface AppState {
  // Current Session
  currentUser: User;
  tenant: Tenant;
  
  // Master Data
  users: User[]; // List of all users in the tenant
  roles: RoleItem[]; // List of roles from backend
  permissions: PermissionItem[]; // List of permissions from backend
  rolePermissions: Record<string, Permission[]>; // Dynamic permissions map
  permissionsCatalog: Permission[]; // List of available permissions
  clients: Tenant[]; // List of all tenants (for Super Admin)
  brands: Brand[];
  categories: Category[];
  countries: Country[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  
  // Transactions
  purchases: Purchase[];
  sales: Sale[];
  returns: Return[];
  accounts: Account[];
  transactions: Transaction[];

  // Settings
  printSettings: PrintSettings;

  // Actions
  updateCurrentUser: (data: Partial<User>) => void;
  updateTenant: (data: Partial<Tenant>) => void;
  updatePrintSettings: (data: Partial<PrintSettings>) => void;
  bootstrapData: () => void;

  // User Management
  addUser: (data: User) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // Role Management
  addRole: (data: { name: string; description?: string | null; permissions?: Permission[]; tenant_id?: string }) => void;
  updateRole: (id: string, data: { name: string; description?: string | null; permissions?: Permission[]; tenant_id?: string }) => void;
  deleteRole: (id: string) => void;
  updateRolePermissions: (roleId: string, roleName: string, permissions: Permission[]) => void;

  // Permission Management
  addPermission: (data: { name: string }) => void;
  updatePermission: (id: string, data: { name: string }) => void;
  deletePermission: (id: string) => void;

  // Client (Tenant) Management
  addClient: (data: Tenant) => void;
  updateClient: (id: string, data: Partial<Tenant>) => void;
  deleteClient: (id: string) => void;

  // CRUD Helpers
  addBrand: (data: Omit<Brand, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateBrand: (id: string, data: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;

  addCategory: (data: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addCountry: (data: Omit<Country, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateCountry: (id: string, data: Partial<Country>) => void;
  deleteCountry: (id: string) => void;

  addProduct: (data: Omit<Product, 'id' | 'stock_qty' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addSupplier: (data: Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addCustomer: (data: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  addPurchase: (data: Omit<Purchase, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updatePurchase: (id: string, data: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  addSale: (data: Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateSale: (id: string, data: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  addReturn: (data: Omit<Return, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateReturn: (id: string, data: Partial<Return>) => void;
  deleteReturn: (id: string) => void;
  
  // Account Management
  addAccount: (data: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateAccount: (id: string, data: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addTransaction: (data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addPayment: (data: Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;
  updatePayment: (id: string, data: Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>) => void;

  // Permission Check
  hasPermission: (perm: Permission) => boolean;
}

// --- Initial Data ---
const INITIAL_TENANT: Tenant = {
  id: '',
  name: '',
  logo: '',
  address: '',
  phone: '',
  email: '',
  whatsapp: '',
  website: '',
  license_no: '',
  license_issue: '',
  license_expiry: '',
  license_type: 'Trial',
  max_users: 0,
  license_status: 'Active',
};

const INITIAL_USER: User = {
  id: '',
  name: '',
  email: '',
  role: '',
  tenant_id: '',
  avatar: '',
  status: 'active',
  must_change_password: false,
};

const mapRoleFromBackend = (role?: string): Role => role ?? '';

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return undefined;
  if (value.startsWith('data:image/')) return value;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const assetBase = apiBase.replace(/\/api\/v1\/?$/, '');
  if (value.startsWith('http://localhost:8000http://localhost/')) {
    return value.replace('http://localhost:8000http://localhost', assetBase);
  }
  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/storage/')) {
      return `${assetBase}/media${parsed.pathname.replace('/storage', '')}`;
    }
    return value;
  } catch {
    // Not a full URL, continue
  }
  if (value.includes('/storage/')) {
    const idx = value.indexOf('/storage/');
    return `${assetBase}/media${value.slice(idx + '/storage'.length)}`;
  }
  if (value.startsWith('/')) return `${assetBase}${value}`;
  if (value.startsWith('storage/')) return `${assetBase}/media/${value.replace('storage/', '')}`;
  return `${assetBase}/${value}`;
};

// --- Permissions Logic ---
const INITIAL_PERMISSIONS_MAP: Record<string, Permission[]> = {};
const DEFAULT_PERMISSIONS: Permission[] = [
  // Inventory main + sub modules
  'inventory.view',
  'partners.view',
  'invoices.view',
  'product.view', 'product.create', 'product.edit', 'product.delete', 'product.search', 'product.export', 'product.print',
  'brand.view', 'brand.create', 'brand.edit', 'brand.delete', 'brand.search', 'brand.export', 'brand.print',
  'country.view', 'country.create', 'country.edit', 'country.delete', 'country.search', 'country.export', 'country.print',

  // Partners
  'supplier.view', 'supplier.create', 'supplier.edit', 'supplier.delete', 'supplier.search', 'supplier.export', 'supplier.print',
  'customer.view', 'customer.create', 'customer.edit', 'customer.delete', 'customer.search', 'customer.export', 'customer.print',

  // Orders & returns
  'purchase.view', 'purchase.create', 'purchase.edit', 'purchase.delete', 'purchase.search', 'purchase.export', 'purchase.print',
  'sales.view', 'sales.create', 'sales.edit', 'sales.delete', 'sales.search', 'sales.export', 'sales.print',
  'return_in.view', 'return_in.create', 'return_in.edit', 'return_in.delete', 'return_in.search', 'return_in.export', 'return_in.print',
  'return_out.view', 'return_out.create', 'return_out.edit', 'return_out.delete', 'return_out.search', 'return_out.export', 'return_out.print',

  // Accounts
  'account.view',
  'account.transactions.view', 'account.transactions.create', 'account.transactions.edit', 'account.transactions.delete', 'account.transactions.search', 'account.transactions.export', 'account.transactions.print',
  'account.accounts.view', 'account.accounts.create', 'account.accounts.edit', 'account.accounts.delete', 'account.accounts.search', 'account.accounts.export', 'account.accounts.print',
  'account.transaction.payment', 'account.transaction.income', 'account.transaction.expense', 'account.transaction.transfer',
  'account.transaction.save', 'account.transaction.cancel',

  // Settings & users
  'settings.view', 'settings.edit', 'settings.general', 'settings.print', 'settings.clients', 'settings.users', 'settings.roles', 'settings.permissions', 'settings.profile', 'settings.backup',
  'user.view', 'user.create', 'user.edit', 'user.delete', 'user.search', 'user.export', 'user.print',
  'role.view', 'role.create', 'role.edit', 'role.delete', 'role.search', 'role.export', 'role.print',
  'permission.view', 'permission.edit', 'permission.search', 'permission.export',
  'client.view', 'client.create', 'client.edit', 'client.delete', 'client.search', 'client.export', 'client.print',
];

export const useStore = create<AppState>((set, get) => ({
  currentUser: INITIAL_USER,
  tenant: INITIAL_TENANT,
  users: [],
  roles: [],
  permissions: [],
  rolePermissions: INITIAL_PERMISSIONS_MAP,
  permissionsCatalog: [],
  clients: [],
  brands: [],
  categories: [],
  countries: [],
  products: [],
  suppliers: [],
  customers: [],
  purchases: [],
  sales: [],
  returns: [],
  accounts: [],
  transactions: [],
  
  printSettings: {
    show_product_image: true,
    show_header_logo: true,
    show_footer_signature: true,
    show_batch: true,
    show_exp_date: true,
    show_bonus: true,
  },

  // Actions
  updateCurrentUser: (data) => {
    set((state) => {
      const nextUser = { ...state.currentUser, ...data };
      localStorage.setItem('current_user', JSON.stringify(nextUser));
      return { currentUser: nextUser };
    });
  },
  updatePrintSettings: async (data) => {
    try {
      const updated = await settingsApi.updatePrintSettings(data as any);
      toast.info('Print settings saved');
      set(() => ({ printSettings: updated }));
    } catch {
      toast.error('Failed to update print settings');
    }
  },
  updateTenant: async (data) => {
    try {
      // Build FormData if there's a logo file, otherwise send as JSON
      const { logo_file, logo, license_no, license_expiry, license_issue, license_type, license_status, max_users, id, ...rest } = data as any;
      
      let payload: FormData | Record<string, any>;
      if (logo_file instanceof File) {
        payload = new FormData();
        Object.entries(rest).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            (payload as FormData).append(key, String(value));
          }
        });
        (payload as FormData).append('logo', logo_file);
      } else {
        payload = rest;
      }
      
      const updated = await settingsApi.updateTenantProfile(payload as any);
      toast.info('Company profile saved');
      set(() => ({ tenant: updated as any }));
    } catch {
      toast.error('Failed to update company profile');
    }
  },
  bootstrapData: async () => {
    try {
      // Get current user's role to determine what to load
      const currentRole = get().currentUser.role?.toLowerCase();
      const isSuperAdmin = currentRole === 'superadmin';

      // Base requests that all authenticated users can access
      const baseRequests = [
        settingsApi.getTenantProfile(),
        settingsApi.getPrintSettings(),
        brandApi.list(),
        categoryApi.list(),
        countryApi.list(),
        inventoryApi.getProducts(),
        supplierApi.list(),
        customerApi.list(),
        accountApi.list(),
        accountTransactionApi.list(),
        transactionApi.getHistory({ type: 'purchase' }),
        transactionApi.getHistory({ type: 'sale' }),
        transactionApi.getHistory({ type: 'return_in' }),
        transactionApi.getHistory({ type: 'return_out' }),
        transactionApi.getHistory({ type: 'quotation' }),
      ];

      const baseLabels = [
        'Tenant Profile',
        'Print Settings',
        'Brands',
        'Categories',
        'Countries',
        'Products',
        'Suppliers',
        'Customers',
        'Accounts',
        'Transactions',
        'Purchases',
        'Sales',
        'Returns (In)',
        'Returns (Out)',
        'Quotations',
      ];

      const currentPermissions = get().currentUser.permissions ?? [];
      const canViewUsers = isSuperAdmin || currentPermissions.includes('user.view') || currentPermissions.includes('manage_users');

      const userRequests = canViewUsers ? [userApi.list()] : [];
      const userLabels = canViewUsers ? ['Users'] : [];

      // Admin-only requests (roles, permissions, clients)
      const adminRequests = isSuperAdmin ? [
        roleApi.list(),
        permissionApi.list(),
        tenantApi.list(),
      ] : [];

      const adminLabels = isSuperAdmin ? [
        'Roles',
        'Permissions',
        'Clients',
      ] : [];

      const requests = [...baseRequests, ...userRequests, ...adminRequests];
      const labels = [...baseLabels, ...userLabels, ...adminLabels];

      const results = await Promise.allSettled(requests);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const reason = result.reason;
          // Don't show toast for 403 errors - permission denied is expected for some users
          if (reason?.response?.status !== 403) {
            console.error(`Failed to load ${labels[index]}`, reason);
            toast.error(`Failed to load ${labels[index]}`);
          }
        }
      });

      const unwrap = <T>(index: number, fallback: T): T =>
        results[index]?.status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<T>).value : fallback;

      const tenant = unwrap(0, INITIAL_TENANT as any);
      const printSettings = unwrap(1, {} as any);
      const brands = unwrap(2, [] as any[]);
      const categories = unwrap(3, [] as any[]);
      const countries = unwrap(4, [] as any[]);
      const products = unwrap(5, [] as any);
      const suppliers = unwrap(6, [] as any[]);
      const customers = unwrap(7, [] as any[]);
      const accounts = unwrap(8, [] as any[]);
      const transactions = unwrap(9, [] as any[]);
      const purchases = unwrap(10, [] as any);
      const sales = unwrap(11, [] as any);
      const returns = unwrap(12, [] as any);
      const returnOuts = unwrap(13, [] as any);
      const quotations = unwrap(14, [] as any);

      // Admin-only data (with offset for base requests)
      const userIndex = 15;
      const roleIndex = userIndex + (canViewUsers ? 1 : 0);
      const permissionIndex = roleIndex + (isSuperAdmin ? 1 : 0);
      const clientIndex = permissionIndex + (isSuperAdmin ? 1 : 0);

      const users = canViewUsers ? unwrap(userIndex, [] as any[]) : [];
      const _roles = isSuperAdmin ? unwrap(roleIndex, [] as any[]) : [];
      const _permissions = isSuperAdmin ? unwrap(permissionIndex, [] as any[]) : [];
      const clients = isSuperAdmin ? unwrap(clientIndex, [] as any[]) : [];

      const productList = Array.isArray(products?.data) ? products.data : (products?.data?.data ?? products?.data ?? products);
      const purchaseOrders = Array.isArray(purchases?.data) ? purchases.data : (purchases?.data?.data ?? purchases?.data ?? purchases);
      const saleOrders = Array.isArray(sales?.data) ? sales.data : (sales?.data?.data ?? sales?.data ?? sales);
      const returnOrders = Array.isArray(returns?.data) ? returns.data : (returns?.data?.data ?? returns?.data ?? returns);
      const returnOutOrders = Array.isArray(returnOuts?.data) ? returnOuts.data : (returnOuts?.data?.data ?? returnOuts?.data ?? returnOuts);
      const quotationOrders = Array.isArray(quotations?.data) ? quotations.data : (quotations?.data?.data ?? quotations?.data ?? quotations);

      const userMap = new Map<string, string>();
      users.forEach((u) => {
        userMap.set(String(u.id), u.name);
      });
      const tenantMap = new Map<string, string>();
      clients.forEach((t) => {
        tenantMap.set(String(t.id), t.name ?? '');
      });
      const currentUser = get().currentUser;
      const resolveUser = (id?: number | string | null) => {
        if (!id) return 'System';
        const idStr = String(id).trim();
        if (!idStr) return 'System';
        if (currentUser?.id && String(currentUser.id) === idStr) {
          return currentUser.name ?? 'System';
        }
        const fromMap = userMap.get(idStr);
        if (fromMap) return fromMap;
        const asNumber = Number(idStr);
        if (Number.isNaN(asNumber)) return idStr;
        return `User #${idStr}`;
      };
      const toDateInput = (value?: string) => {
        if (!value) return '';
        return value.slice(0, 10);
      };

      const roleList: RoleItem[] = (_roles ?? []).map((r: any) => ({
        id: Number(r.id),
        name: r.name,
        tenant_id: r.tenant_id !== undefined && r.tenant_id !== null ? String(r.tenant_id) : undefined,
        tenant_name: (r.tenant_name ?? tenantMap.get(String(r.tenant_id ?? '')) ?? ''),
        description: r.description ?? null,
        permissions: r.permissions ?? null,
      }));

      const rolePermissions: Record<string, Permission[]> = roleList.reduce((acc, role) => {
        const permsSource = role.permissions ?? {};
        const perms = Array.isArray(permsSource)
          ? permsSource
          : Object.entries(permsSource)
              .filter(([, enabled]) => Boolean(enabled))
              .map(([key]) => key);
        acc[role.name] = perms as Permission[];
        return acc;
      }, {} as Record<string, Permission[]>);

      const permissionsList = (_permissions ?? []).map((p: any) => ({
        id: Number(p.id),
        name: String(p.name ?? ''),
      })).filter((p: any) => p.name);

      const permissionsCatalog = Array.from(
        new Set([
          ...DEFAULT_PERMISSIONS,
          ...permissionsList.map((p) => p.name),
          ...roleList.flatMap((role) =>
            Array.isArray(role.permissions)
              ? role.permissions
              : Object.keys(role.permissions ?? {})
          )
        ])
      )
        .filter((perm) => !String(perm).startsWith('manage_')) as Permission[];

      set(() => ({
        tenant: {
          ...INITIAL_TENANT,
          ...tenant,
          logo: resolveAssetUrl((tenant as any).logo) ?? '',
          id: String(tenant.id ?? ''),
        },
        printSettings: printSettings as any,
        brands: (Array.isArray(brands) ? brands : []).map((b) => ({
          id: String(b.id),
          name: b.name,
          details: b.details ?? undefined,
          status: (b.status ?? 'active') as any,
          created_at: b.created_at,
          updated_at: b.updated_at,
          created_by: resolveUser((b as any).created_by),
          updated_by: resolveUser((b as any).updated_by),
        })),
        categories: (Array.isArray(categories) ? categories : []).map((c) => ({
          id: String(c.id),
          name: c.name,
          details: c.details ?? undefined,
          status: (c.status ?? 'active') as any,
          created_at: c.created_at,
          updated_at: c.updated_at,
          created_by: resolveUser((c as any).created_by),
          updated_by: resolveUser((c as any).updated_by),
        })),
        countries: (Array.isArray(countries) ? countries : []).map((c) => ({
          id: String(c.id),
          name: c.name,
          details: c.details ?? undefined,
          status: (c.status ?? 'active') as any,
          created_at: c.created_at,
          updated_at: c.updated_at,
          created_by: resolveUser((c as any).created_by),
          updated_by: resolveUser((c as any).updated_by),
        })),
        products: (productList || []).map((p: any) => ({
          id: String(p.id),
          category_id: p.category_id !== undefined && p.category_id !== null ? String(p.category_id) : null,
          model_no: p.model_no ?? p.sku ?? '',
          sku: p.sku ?? undefined,
          name: p.name,
          description: p.description,
          photo: resolveAssetUrl(p.photo ?? p.image_url),
          image_url: resolveAssetUrl(p.image_url),
          unit_of_measure: p.unit_of_measure ?? null,
          cost_price: Number(p.cost_price ?? 0),
          sale_price: Number(p.sale_price ?? 0),
          brand_id: p.brand_id ? String(p.brand_id) : '',
          country_id: p.country_id ? String(p.country_id) : '',
          status: (p.status ?? 'active') as any,
          stock_qty: Number(p.stock_qty ?? p.current_stock ?? 0),
          created_at: p.created_at,
          updated_at: p.updated_at,
          created_by: resolveUser(p.created_by),
          updated_by: resolveUser(p.updated_by),
        })),
        suppliers: (Array.isArray(suppliers) ? suppliers : []).map((s) => ({
          id: String(s.id),
          name: s.name,
          email: s.email,
          phone: s.phone,
          address: s.address,
          status: (s.status ?? 'active') as any,
          created_at: s.created_at,
          updated_at: s.updated_at,
          created_by: resolveUser((s as any).created_by),
          updated_by: resolveUser((s as any).updated_by),
        })),
        customers: (Array.isArray(customers) ? customers : []).map((c) => ({
          id: String(c.id),
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.billing_address ?? c.shipping_address ?? '',
          status: (c.status ?? 'active') as any,
          created_at: c.created_at,
          updated_at: c.updated_at,
          created_by: resolveUser((c as any).created_by),
          updated_by: resolveUser((c as any).updated_by),
        })),
        users: (Array.isArray(users) ? users : []).map((u) => ({
          id: String(u.id),
          name: u.name,
          email: u.email,
          role: mapRoleFromBackend(u.role?.name),
          tenant_id: String((u as any).tenant_id ?? ''),
          tenant_name: tenantMap.get(String((u as any).tenant_id ?? '')) ?? '',
          avatar: resolveAssetUrl((u as any).avatar) ?? '',
          status: u.is_active ? 'active' : 'inactive',
          created_at: (u as any).created_at,
          updated_at: (u as any).updated_at,
          created_by: resolveUser((u as any).created_by),
          updated_by: resolveUser((u as any).updated_by),
        })),
        roles: roleList,
        permissions: permissionsList,
        rolePermissions,
        permissionsCatalog,
        clients: (Array.isArray(clients) ? clients : []).map((t) => ({
          id: String(t.id),
          name: t.name,
          logo: resolveAssetUrl(t.logo) ?? '',
          address: t.address ?? '',
          phone: t.phone ?? '',
          email: t.email ?? '',
          whatsapp: '',
          website: t.website ?? '',
          license_no: t.license_no ?? '',
          license_issue: t.license_issue ?? '',
          license_expiry: t.license_expiry ?? '',
          license_type: (t.license_type ?? 'Trial') as any,
          max_users: t.max_users ?? 0,
          license_status: (t.license_status ?? 'Active') as any,
        })),
        accounts: (Array.isArray(accounts) ? accounts : []).map((a) => ({
          id: String(a.id),
          name: a.name,
          type: a.type as any,
          account_number: a.account_number ?? undefined,
          balance: Number(a.balance ?? 0),
          currency: a.currency ?? 'USD',
          status: (a.status ?? 'active') as any,
          created_at: a.created_at,
          updated_at: a.updated_at,
          created_by: resolveUser((a as any).created_by),
          updated_by: resolveUser((a as any).updated_by),
        })),
        transactions: (Array.isArray(transactions) ? transactions : []).map((t) => ({
          id: String(t.id),
          date: t.date,
          type: t.type as any,
          category: t.category ?? '',
          amount: Number(t.amount ?? 0),
          currency: (t.currency ?? 'USD') as any,
          exchange_rate: t.exchange_rate ?? undefined,
          account_id: String(t.account_id),
          to_account_id: t.to_account_id ? String(t.to_account_id) : undefined,
          reference_id: t.reference_id ?? undefined,
          contact_id: t.contact_id ? String(t.contact_id) : undefined,
          description: t.description ?? undefined,
          payment_method: t.payment_method ?? '',
          attachment: t.attachment ?? undefined,
          created_by: resolveUser((t as any).created_by),
          updated_by: resolveUser((t as any).updated_by),
        })),
        purchases: (purchaseOrders || []).map((o: any) => ({
          id: String(o.id),
          invoice_no: o.serial_no ?? o.reference_number ?? '',
          supplier_id: String(o.party_id ?? ''),
          purchase_date: toDateInput(o.transaction_date ?? ''),
          items: (o.items ?? []).map((i: any) => ({
            order_item_id: String(i.id ?? ''),
            product_id: String(i.product_id ?? ''),
            cost_price: Number(i.unit_price ?? 0),
            batch_no: String(i.batch_no ?? ''),
            quantity: Number(i.quantity ?? 0),
            bonus: Number(i.bonus ?? 0),
            mfg_date: '',
            exp_date: i.exp_date ?? '',
            discount: Number(i.discount ?? 0),
            discount_percent: Number(i.discount_percent ?? 0),
            tax: Number(i.tax ?? 0),
            tax_percent: Number(i.tax_percent ?? 0),
            amount: Number(i.total_price ?? 0),
          })),
          sub_total: Number(o.total_amount ?? 0),
          total_discount: Number(o.total_discount ?? 0),
          total_tax: Number(o.total_tax ?? 0),
            grand_total: Number(o.net_amount ?? o.total_amount ?? 0),
          paid_amount: Number(o.paid_amount ?? 0),
          created_by: resolveUser(o.created_by),
          updated_by: resolveUser(o.updated_by),
          created_at: o.created_at,
          updated_at: o.updated_at,
        })),
        sales: [
          ...(saleOrders || []).map((o: any) => ({
          id: String(o.id),
          invoice_no: o.serial_no ?? o.reference_number ?? '',
          customer_id: String(o.party_id ?? ''),
          supplier_id: '',
          invoice_type: 'sale' as const,
          sale_date: toDateInput(o.transaction_date ?? ''),
          items: (o.items ?? []).map((i: any) => ({
            order_item_id: String(i.id ?? ''),
            product_id: String(i.product_id ?? ''),
            sale_price: Number(i.unit_price ?? 0),
            batch_no: String(i.batch_no ?? ''),
            quantity: Number(i.quantity ?? 0),
            bonus: Number(i.bonus ?? 0),
            exp_date: i.exp_date ?? '',
            discount: Number(i.discount ?? 0),
            discount_percent: Number(i.discount_percent ?? 0),
            tax: Number(i.tax ?? 0),
            tax_percent: Number(i.tax_percent ?? 0),
            amount: Number(i.total_price ?? 0),
          })),
          sub_total: Number(o.total_amount ?? 0),
          total_discount: Number(o.total_discount ?? 0),
          total_tax: Number(o.total_tax ?? 0),
          net_payable: Number(o.net_amount ?? o.total_amount ?? 0),
          paid_amount: Number(o.paid_amount ?? 0),
          created_by: resolveUser(o.created_by),
          updated_by: resolveUser(o.updated_by),
          created_at: o.created_at,
          updated_at: o.updated_at,
        })),
          ...(purchaseOrders || []).map((o: any) => ({
            id: String(o.id),
            invoice_no: o.serial_no ?? o.reference_number ?? '',
            customer_id: '',
            supplier_id: String(o.party_id ?? ''),
            invoice_type: 'purchase' as const,
             sale_date: toDateInput(o.transaction_date ?? ''),
            items: (o.items ?? []).map((i: any) => ({
              order_item_id: String(i.id ?? ''),
              product_id: String(i.product_id ?? ''),
              sale_price: Number(i.unit_price ?? 0),
              batch_no: String(i.batch_no ?? ''),
              quantity: Number(i.quantity ?? 0),
              bonus: Number(i.bonus ?? 0),
              exp_date: i.exp_date ?? '',
              discount: Number(i.discount ?? 0),
              discount_percent: Number(i.discount_percent ?? 0),
              tax: Number(i.tax ?? 0),
              tax_percent: Number(i.tax_percent ?? 0),
              amount: Number(i.total_price ?? 0),
            })),
            sub_total: Number(o.total_amount ?? 0),
            total_discount: Number(o.total_discount ?? 0),
            total_tax: Number(o.total_tax ?? 0),
            net_payable: Number(o.net_amount ?? o.total_amount ?? 0),
            paid_amount: Number(o.paid_amount ?? 0),
            created_by: resolveUser(o.created_by),
            updated_by: resolveUser(o.updated_by),
            created_at: o.created_at,
            updated_at: o.updated_at,
          })),
          ...(returnOrders || []).map((o: any) => ({
            id: String(o.id),
            invoice_no: o.serial_no ?? o.reference_number ?? '',
            customer_id: String(o.party_id ?? ''),
            supplier_id: '',
            invoice_type: 'return_in' as const,
            sale_date: toDateInput(o.transaction_date ?? ''),
            items: (o.items ?? []).map((i: any) => ({
              order_item_id: String(i.id ?? ''),
              product_id: String(i.product_id ?? ''),
              sale_price: Number(i.unit_price ?? 0),
              batch_no: String(i.batch_no ?? ''),
              quantity: Number(i.quantity ?? 0),
              bonus: Number(i.bonus ?? 0),
              exp_date: i.exp_date ?? '',
              discount: Number(i.discount ?? 0),
              discount_percent: Number(i.discount_percent ?? 0),
              tax: Number(i.tax ?? 0),
              tax_percent: Number(i.tax_percent ?? 0),
              amount: Number(i.total_price ?? 0),
            })),
            sub_total: Number(o.total_amount ?? 0),
            total_discount: Number(o.total_discount ?? 0),
            total_tax: Number(o.total_tax ?? 0),
            net_payable: Number(o.net_amount ?? o.total_amount ?? 0),
            paid_amount: Number(o.paid_amount ?? 0),
            created_by: resolveUser(o.created_by),
            updated_by: resolveUser(o.updated_by),
            created_at: o.created_at,
            updated_at: o.updated_at,
          })),
          ...(returnOutOrders || []).map((o: any) => ({
            id: String(o.id),
            invoice_no: o.serial_no ?? o.reference_number ?? '',
            customer_id: '',
            supplier_id: String(o.party_id ?? ''),
            invoice_type: 'return_out' as const,
            sale_date: toDateInput(o.transaction_date ?? ''),
            items: (o.items ?? []).map((i: any) => ({
              order_item_id: String(i.id ?? ''),
              product_id: String(i.product_id ?? ''),
              sale_price: Number(i.unit_price ?? 0),
              batch_no: String(i.batch_no ?? ''),
              quantity: Number(i.quantity ?? 0),
              bonus: Number(i.bonus ?? 0),
              exp_date: i.exp_date ?? '',
              discount: Number(i.discount ?? 0),
              discount_percent: Number(i.discount_percent ?? 0),
              tax: Number(i.tax ?? 0),
              tax_percent: Number(i.tax_percent ?? 0),
              amount: Number(i.total_price ?? 0),
            })),
            sub_total: Number(o.total_amount ?? 0),
            total_discount: Number(o.total_discount ?? 0),
            total_tax: Number(o.total_tax ?? 0),
            net_payable: Number(o.net_amount ?? o.total_amount ?? 0),
            paid_amount: Number(o.paid_amount ?? 0),
            created_by: resolveUser(o.created_by),
            updated_by: resolveUser(o.updated_by),
            created_at: o.created_at,
            updated_at: o.updated_at,
          })),
          ...(quotationOrders || []).map((o: any) => ({
            id: String(o.id),
            invoice_no: o.serial_no ?? o.reference_number ?? '',
            customer_id: String(o.party_id ?? ''),
            supplier_id: '',
            invoice_type: 'quotation' as const,
            sale_date: toDateInput(o.transaction_date ?? ''),
            items: (o.items ?? []).map((i: any) => ({
              order_item_id: String(i.id ?? ''),
              product_id: String(i.product_id ?? ''),
              sale_price: Number(i.unit_price ?? 0),
              batch_no: String(i.batch_no ?? ''),
              quantity: Number(i.quantity ?? 0),
              bonus: Number(i.bonus ?? 0),
              exp_date: i.exp_date ?? '',
              discount: Number(i.discount ?? 0),
              discount_percent: Number(i.discount_percent ?? 0),
              tax: Number(i.tax ?? 0),
              tax_percent: Number(i.tax_percent ?? 0),
              amount: Number(i.total_price ?? 0),
            })),
            sub_total: Number(o.total_amount ?? 0),
            total_discount: Number(o.total_discount ?? 0),
            total_tax: Number(o.total_tax ?? 0),
            net_payable: Number(o.net_amount ?? o.total_amount ?? 0),
            paid_amount: Number(o.paid_amount ?? 0),
            created_by: resolveUser(o.created_by),
            updated_by: resolveUser(o.updated_by),
            created_at: o.created_at,
            updated_at: o.updated_at,
          })),
        ],
        returns: (returnOrders || []).map((o: any) => ({
          id: String(o.id),
          invoice_no: o.serial_no ?? o.reference_number ?? '',
          customer_id: String(o.party_id ?? ''),
          return_date: toDateInput(o.transaction_date ?? ''),
          items: (o.items ?? []).map((i: any) => ({
            product_id: String(i.product_id ?? ''),
            sale_price: Number(i.unit_price ?? 0),
            batch_no: '',
            quantity: Number(i.quantity ?? 0),
            bonus: 0,
            exp_date: '',
            discount: Number(i.discount ?? 0),
            tax: Number(i.tax ?? 0),
            amount: Number(i.total_price ?? 0),
          })),
          sub_total: Number(o.total_amount ?? 0),
          total_discount: Number(o.total_discount ?? 0),
          total_tax: Number(o.total_tax ?? 0),
          total_amount: Number(o.total_amount ?? 0),
          net_amount: Number(o.net_amount ?? o.total_amount ?? 0),
          paid_amount: Number(o.paid_amount ?? 0),
          created_by: resolveUser(o.created_by),
          updated_by: resolveUser(o.updated_by),
          created_at: o.created_at,
          updated_at: o.updated_at,
        })),
      }));
    } catch {
      toast.error('Failed to load data');
    }
  },

  addUser: async (data) => {
    try {
      const roleValue = (data.role as string) ?? '';
      const parsedRoleId = Number(roleValue);
      const selectedTenantId = (data as any).tenant_id ?? get().tenant.id;
      const roleIdFromList = get().roles.find((r) =>
        String(r.name).toLowerCase() === String(roleValue).toLowerCase()
        && (!r.tenant_id || String(r.tenant_id) === String(selectedTenantId))
      )?.id;
      const hasRoleId = roleValue !== '' && Number.isFinite(parsedRoleId) && String(parsedRoleId) === String(roleValue);
      const resolvedRoleId = hasRoleId ? parsedRoleId : (roleIdFromList ?? undefined);

      let created;
      const avatarFile = (data as any).avatar_file as File | undefined;
      if (avatarFile) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        form.append('email', data.email ?? '');
        form.append('password', (data as any).password || 'password');
        if (resolvedRoleId !== undefined) {
          form.append('role_id', String(resolvedRoleId));
        } else {
          form.append('role_name', roleValue);
        }
        form.append('is_active', data.status !== 'inactive' ? '1' : '0');
        if ((data as any).tenant_id) form.append('tenant_id', String((data as any).tenant_id));
        form.append('avatar', avatarFile);
        created = await userApi.create(form as any);
      } else {
        created = await userApi.create({
          name: data.name,
          email: data.email,
          password: (data as any).password || 'password',
          role_id: resolvedRoleId,
          role_name: resolvedRoleId === undefined ? roleValue : undefined,
          is_active: data.status !== 'inactive',
          tenant_id: (data as any).tenant_id,
        });
      }

      toast.success('User added successfully');
      set((state) => ({
        users: [...state.users, {
          id: String(created.id),
          name: created.name,
          email: created.email,
          role: mapRoleFromBackend(created.role?.name),
          tenant_id: String((created as any).tenant_id ?? (data as any).tenant_id ?? state.tenant.id),
          tenant_name: state.clients.find((t) => String(t.id) === String((created as any).tenant_id ?? (data as any).tenant_id ?? state.tenant.id))?.name ?? state.tenant.name,
          avatar: resolveAssetUrl((created as any).avatar) ?? '',
          status: created.is_active ? 'active' : 'inactive',
        }]
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to add user';
      toast.error(String(msg));
    }
  },
  updateUser: async (id, data) => {
    try {
      const roleValue = (data.role as string) ?? '';
      const parsedRoleId = Number(roleValue);
      const selectedTenantId = (data as any).tenant_id ?? get().tenant.id;
      const roleIdFromList = get().roles.find((r) =>
        String(r.name).toLowerCase() === String(roleValue).toLowerCase()
        && (!r.tenant_id || String(r.tenant_id) === String(selectedTenantId))
      )?.id;
      const hasRoleId = roleValue !== '' && Number.isFinite(parsedRoleId) && String(parsedRoleId) === String(roleValue);
      const resolvedRoleId = hasRoleId ? parsedRoleId : (roleIdFromList ?? undefined);

      let updated;
      const avatarFile = (data as any).avatar_file as File | undefined;
      if (avatarFile) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        form.append('email', data.email ?? '');
        if ((data as any).password) form.append('password', (data as any).password);
        if (resolvedRoleId !== undefined) {
          form.append('role_id', String(resolvedRoleId));
        } else {
          form.append('role_name', roleValue);
        }
        form.append('is_active', data.status !== 'inactive' ? '1' : '0');
        if ((data as any).tenant_id) form.append('tenant_id', String((data as any).tenant_id));
        form.append('avatar', avatarFile);
        form.append('_method', 'PUT');
        updated = await userApi.update(id, form as any);
      } else {
        updated = await userApi.update(id, {
          name: data.name ?? '',
          email: data.email ?? '',
          password: (data as any).password || undefined,
          role_id: resolvedRoleId,
          role_name: resolvedRoleId === undefined ? roleValue : undefined,
          is_active: data.status !== 'inactive',
          tenant_id: (data as any).tenant_id,
        });
      }

      toast.info('User updated successfully');
      set((state) => ({
        users: state.users.map((u) => u.id === id ? {
          ...u,
          name: updated.name,
          email: updated.email,
          role: mapRoleFromBackend(updated.role?.name),
          status: updated.is_active ? 'active' : 'inactive',
          avatar: resolveAssetUrl((updated as any).avatar) ?? '',
        } : u)
      }));
    } catch {
      toast.error('Failed to update user');
    }
  },
  deleteUser: async (id) => {
    try {
      await userApi.remove(id);
      toast.error('User deleted successfully');
      set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
    } catch {
      toast.error('Failed to delete user');
    }
  },

  addRole: async (data) => {
    try {
      const perms: Record<string, boolean> = {};
      (data.permissions ?? []).forEach((p) => { perms[p] = true; });
      await roleApi.create({
        name: data.name,
        description: data.description ?? null,
        permissions: perms,
        tenant_id: data.tenant_id,
      });
      toast.success('Role added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add role');
    }
  },
  updateRole: async (id, data) => {
    try {
      const perms: Record<string, boolean> = {};
      (data.permissions ?? []).forEach((p) => { perms[p] = true; });
      await roleApi.update(id, {
        name: data.name,
        description: data.description ?? null,
        permissions: perms,
        tenant_id: data.tenant_id,
      });
      toast.info('Role updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update role');
    }
  },
  deleteRole: async (id) => {
    try {
      await roleApi.remove(id);
      toast.error('Role deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete role');
    }
  },

  updateRolePermissions: async (roleId, roleName, permissions) => {
    try {
      const perms: Record<string, boolean> = {};
      permissions.forEach((p) => { perms[p] = true; });
      const role = get().roles.find((r) => String(r.id) === String(roleId)) || get().roles.find((r) => r.name === roleName);
      await roleApi.update(String(roleId), {
        name: role?.name ?? roleName,
        description: role?.description ?? null,
        permissions: perms,
      });
      toast.info(`${roleName} permissions updated`);
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update role permissions');
    }
  },

  addPermission: async (data) => {
    try {
      await permissionApi.create({ name: data.name });
      toast.success('Permission added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add permission');
    }
  },
  updatePermission: async (id, data) => {
    try {
      await permissionApi.update(id, { name: data.name });
      toast.info('Permission updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update permission');
    }
  },
  deletePermission: async (id) => {
    try {
      await permissionApi.remove(id);
      toast.error('Permission deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete permission');
    }
  },

  addClient: async (data) => {
    try {
      const logoFile = (data as any).logo_file as any;
      const resolvedLogo = logoFile instanceof File ? logoFile : undefined;
      let created;
      if (resolvedLogo) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        form.append('slug', data.name?.toLowerCase().replace(/\s+/g, '-') ?? '');
        form.append('is_active', '1');
        form.append('logo', resolvedLogo);
        if (data.address) form.append('address', data.address);
        if (data.phone) form.append('phone', data.phone);
        if (data.email) form.append('email', data.email);
        if (data.website) form.append('website', data.website);
        if (data.license_no) form.append('license_no', data.license_no);
        if (data.license_issue) form.append('license_issue', data.license_issue);
        if (data.license_expiry) form.append('license_expiry', data.license_expiry);
        if (data.license_type) form.append('license_type', data.license_type);
        if (data.max_users !== undefined) form.append('max_users', String(data.max_users));
        if (data.license_status) form.append('license_status', data.license_status);
        created = await tenantApi.create(form as any);
      } else {
        const payload: any = {
          name: data.name,
          slug: data.name.toLowerCase().replace(/\s+/g, '-'),
          is_active: true,
          logo: data.logo ?? undefined,
          address: data.address ?? undefined,
          phone: data.phone ?? undefined,
          email: data.email ?? undefined,
          website: data.website ?? undefined,
          license_no: data.license_no ?? undefined,
          license_issue: data.license_issue ?? undefined,
          license_expiry: data.license_expiry ?? undefined,
          license_type: data.license_type ?? undefined,
          max_users: data.max_users ?? undefined,
          license_status: data.license_status ?? undefined,
        };
        if (typeof payload.logo === 'string') {
          delete payload.logo;
        }
        created = await tenantApi.create(payload);
      }
      toast.success('Client registered successfully');
      set((state) => ({ clients: [...state.clients, {
        ...data,
        id: String(created.id),
      }] }));
    } catch {
      toast.error('Failed to create client');
    }
  },
  updateClient: async (id, data) => {
    try {
      const logoFile = (data as any).logo_file as any;
      const resolvedLogo = logoFile instanceof File ? logoFile : undefined;
      let updated;
      if (resolvedLogo) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        if (data.name) form.append('slug', data.name.toLowerCase().replace(/\s+/g, '-'));
        form.append('is_active', '1');
        form.append('logo', resolvedLogo);
        if (data.address) form.append('address', data.address);
        if (data.phone) form.append('phone', data.phone);
        if (data.email) form.append('email', data.email);
        if (data.website) form.append('website', data.website);
        if (data.license_no) form.append('license_no', data.license_no);
        if (data.license_issue) form.append('license_issue', data.license_issue);
        if (data.license_expiry) form.append('license_expiry', data.license_expiry);
        if (data.license_type) form.append('license_type', data.license_type);
        if (data.max_users !== undefined) form.append('max_users', String(data.max_users));
        if (data.license_status) form.append('license_status', data.license_status);
        updated = await tenantApi.update(id, form as any);
      } else {
        const payload: any = {
          name: data.name,
          slug: data.name?.toLowerCase().replace(/\s+/g, '-') || undefined,
          is_active: true,
          logo: data.logo ?? undefined,
          address: data.address ?? undefined,
          phone: data.phone ?? undefined,
          email: data.email ?? undefined,
          website: data.website ?? undefined,
          license_no: data.license_no ?? undefined,
          license_issue: data.license_issue ?? undefined,
          license_expiry: data.license_expiry ?? undefined,
          license_type: data.license_type ?? undefined,
          max_users: data.max_users ?? undefined,
          license_status: data.license_status ?? undefined,
        };
        if (typeof payload.logo === 'string') {
          delete payload.logo;
        }
        updated = await tenantApi.update(id, payload);
      }
      toast.info('Client updated successfully');
      set((state) => ({ clients: state.clients.map((c) => c.id === id ? { ...c, ...data, id: String(updated.id) } : c) }));
    } catch {
      toast.error('Failed to update client');
    }
  },
  deleteClient: async (id) => {
    try {
      await tenantApi.remove(id);
      toast.error('Client deleted successfully');
      set((state) => ({ clients: state.clients.filter((c) => c.id !== id) }));
    } catch {
      toast.error('Failed to delete client');
    }
  },

  addBrand: async (data) => {
    try {
      await brandApi.create(data);
      toast.success('Brand added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add brand');
    }
  },
  updateBrand: async (id, data) => {
    try {
      await brandApi.update(id, data);
      toast.info('Brand updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update brand');
    }
  },
  deleteBrand: async (id) => {
    try {
      await brandApi.remove(id);
      toast.error('Brand deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete brand');
    }
  },

  addCategory: async (data) => {
    try {
      await categoryApi.create(data);
      toast.success('Category added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add category');
    }
  },
  updateCategory: async (id, data) => {
    try {
      await categoryApi.update(id, data);
      toast.info('Category updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update category');
    }
  },
  deleteCategory: async (id) => {
    try {
      await categoryApi.remove(id);
      toast.error('Category deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete category');
    }
  },

  addCountry: async (data) => {
    try {
      await countryApi.create(data);
      toast.success('Country added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add country');
    }
  },
  updateCountry: async (id, data) => {
    try {
      await countryApi.update(id, data);
      toast.info('Country updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update country');
    }
  },
  deleteCountry: async (id) => {
    try {
      await countryApi.remove(id);
      toast.error('Country deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete country');
    }
  },

  addProduct: async (data) => {
    try {
      let photoFile = (data as any).photo_file as File | FileList | undefined;
      if (photoFile && 'length' in photoFile) {
        photoFile = photoFile[0];
      }
      const resolvedPhoto = photoFile instanceof File ? photoFile : undefined;
      if (resolvedPhoto) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        form.append('model_no', data.model_no ?? '');
        if (data.description) form.append('description', data.description);
        if (data.category_id) form.append('category_id', String(data.category_id));
        if (data.brand_id) form.append('brand_id', String(data.brand_id));
        if (data.country_id) form.append('country_id', String(data.country_id));
        if (data.unit_of_measure) form.append('unit_of_measure', String(data.unit_of_measure));
        if (data.cost_price !== undefined) form.append('cost_price', String(data.cost_price));
        if (data.sale_price !== undefined) form.append('sale_price', String(data.sale_price));
        if (data.status) form.append('status', String(data.status));
        form.append('photo', resolvedPhoto);
        await inventoryApi.createProduct(form as any);
      } else {
        const { photo, photo_file, ...rest } = data as any;
        await inventoryApi.createProduct({
          ...rest,
          category_id: data.category_id ? Number(data.category_id) : undefined,
          brand_id: data.brand_id ? Number(data.brand_id) : undefined,
          country_id: data.country_id ? Number(data.country_id) : undefined,
        } as any);
      }
      toast.success('Product added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add product');
    }
  },
  updateProduct: async (id, data) => {
    try {
      let photoFile = (data as any).photo_file as File | FileList | undefined;
      if (photoFile && 'length' in photoFile) {
        photoFile = photoFile[0];
      }
      const resolvedPhoto = photoFile instanceof File ? photoFile : undefined;
      if (resolvedPhoto) {
        const form = new FormData();
        form.append('name', data.name ?? '');
        form.append('model_no', data.model_no ?? '');
        if (data.description) form.append('description', data.description);
        if (data.category_id) form.append('category_id', String(data.category_id));
        if (data.brand_id) form.append('brand_id', String(data.brand_id));
        if (data.country_id) form.append('country_id', String(data.country_id));
        if (data.unit_of_measure) form.append('unit_of_measure', String(data.unit_of_measure));
        if (data.cost_price !== undefined) form.append('cost_price', String(data.cost_price));
        if (data.sale_price !== undefined) form.append('sale_price', String(data.sale_price));
        if (data.status) form.append('status', String(data.status));
        form.append('photo', resolvedPhoto);
        await inventoryApi.updateProduct(Number(id), form as any);
      } else {
        const { photo, photo_file, ...rest } = data as any;
        await inventoryApi.updateProduct(Number(id), {
          ...rest,
          category_id: data.category_id ? Number(data.category_id) : undefined,
          brand_id: data.brand_id ? Number(data.brand_id) : undefined,
          country_id: data.country_id ? Number(data.country_id) : undefined,
        } as any);
      }
      toast.info('Product updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update product');
    }
  },
  deleteProduct: async (id) => {
    try {
      await inventoryApi.deleteProduct(Number(id));
      toast.error('Product deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete product');
    }
  },

  addSupplier: async (data) => {
    try {
      await supplierApi.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        status: data.status,
      });
      toast.success('Supplier added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add supplier');
    }
  },
  updateSupplier: async (id, data) => {
    try {
      await supplierApi.update(id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        status: data.status,
      });
      toast.info('Supplier updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update supplier');
    }
  },
  deleteSupplier: async (id) => {
    try {
      await supplierApi.remove(id);
      toast.error('Supplier deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete supplier');
    }
  },

  addCustomer: async (data) => {
    try {
      await customerApi.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        billing_address: data.address,
        shipping_address: data.address,
        status: data.status,
      });
      toast.success('Customer added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add customer');
    }
  },
  updateCustomer: async (id, data) => {
    try {
      await customerApi.update(id, {
        name: data.name,
        email: data.email,
        phone: data.phone,
        billing_address: data.address,
        shipping_address: data.address,
        status: data.status,
      });
      toast.info('Customer updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update customer');
    }
  },
  deleteCustomer: async (id) => {
    try {
      await customerApi.remove(id);
      toast.error('Customer deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete customer');
    }
  },

  addPurchase: async (data) => {
    try {
      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      await transactionApi.createPurchase({
        type: 'purchase',
        party_id: Number(data.supplier_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.cost_price,
        })),
        date: data.purchase_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      });
      toast.success('Purchase recorded successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to record purchase');
    }
  },

  updatePurchase: async (id, data) => {
    try {
      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      await transactionApi.updatePurchase(id, {
        type: 'purchase',
        party_id: Number(data.supplier_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.cost_price,
        })),
        date: data.purchase_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      });
      toast.info('Purchase updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update purchase');
    }
  },

  deletePurchase: async (id) => {
    try {
      await transactionApi.deletePurchase(id);
      toast.error('Purchase deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete purchase');
    }
  },

  addSale: async (data) => {
    try {
      const invoiceType = data.invoice_type || 'sale';
      const isSupplier = invoiceType === 'purchase' || invoiceType === 'return_out';

      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      const request = {
        type: invoiceType,
        party_id: Number(isSupplier ? data.supplier_id : data.customer_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.sale_price,
        })),
        date: data.sale_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      } as const;

      if (invoiceType === 'quotation') {
        await transactionApi.createQuotation(request);
        toast.success('Quotation recorded successfully');
      } else if (invoiceType === 'purchase') {
        await transactionApi.createPurchase(request);
        toast.success('Purchase recorded successfully');
      } else if (invoiceType === 'return_in') {
        await transactionApi.createReturnIn(request);
        toast.success('Return recorded successfully');
      } else if (invoiceType === 'return_out') {
        await transactionApi.createReturnOut(request);
        toast.success('Return out recorded successfully');
      } else {
        await transactionApi.createSale(request);
        toast.success('Sale recorded successfully');
      }

      await get().bootstrapData();
    } catch {
      toast.error('Failed to record invoice');
    }
  },

  updateSale: async (id, data) => {
    try {
      const invoiceType = data.invoice_type || 'sale';
      const isSupplier = invoiceType === 'purchase' || invoiceType === 'return_out';

      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      const request = {
        type: invoiceType,
        party_id: Number(isSupplier ? data.supplier_id : data.customer_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.sale_price,
        })),
        date: data.sale_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      } as const;

      if (invoiceType === 'quotation') {
        await transactionApi.updateQuotation(id, request);
        toast.info('Quotation updated successfully');
      } else if (invoiceType === 'purchase') {
        await transactionApi.updatePurchase(id, request);
        toast.info('Purchase updated successfully');
      } else if (invoiceType === 'return_in') {
        await transactionApi.updateReturnIn(id, request);
        toast.info('Return updated successfully');
      } else if (invoiceType === 'return_out') {
        await transactionApi.updateReturnOut(id, request);
        toast.info('Return out updated successfully');
      } else {
        await transactionApi.updateSale(id, request);
        toast.info('Sale updated successfully');
      }

      await get().bootstrapData();
    } catch {
      toast.error('Failed to update invoice');
    }
  },

  deleteSale: async (id) => {
    try {
      const existing = get().sales.find((s) => s.id === id);
      const invoiceType = existing?.invoice_type || 'sale';

      if (invoiceType === 'quotation') {
        await transactionApi.deleteQuotation(id);
        toast.error('Quotation deleted successfully');
      } else if (invoiceType === 'purchase') {
        await transactionApi.deletePurchase(id);
        toast.error('Purchase deleted successfully');
      } else if (invoiceType === 'return_in') {
        await transactionApi.deleteReturnIn(id);
        toast.error('Return deleted successfully');
      } else if (invoiceType === 'return_out') {
        await transactionApi.deleteReturnOut(id);
        toast.error('Return out deleted successfully');
      } else {
        await transactionApi.deleteSale(id);
        toast.error('Sale deleted successfully');
      }

      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete invoice');
    }
  },

  addReturn: async (data) => {
    try {
      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      await transactionApi.createReturnIn({
        type: 'return_in',
        party_id: Number(data.customer_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.sale_price,
        })),
        date: data.return_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      });
      toast.success('Return recorded successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to record return');
    }
  },

  updateReturn: async (id, data) => {
    try {
      const sanitizedItems = data.items.filter((i) => String(i.product_id ?? '').trim());
      await transactionApi.updateReturnIn(id, {
        type: 'return_in',
        party_id: Number(data.customer_id),
        items: sanitizedItems.map((i) => ({
          product_id: Number(i.product_id),
          quantity: i.quantity,
          bonus: i.bonus ?? 0,
          batch_no: i.batch_no ?? null,
          expiry_date: i.exp_date ?? null,
          discount: i.discount ?? 0,
          discount_percent: i.discount_percent ?? 0,
          tax: i.tax ?? 0,
          tax_percent: i.tax_percent ?? 0,
          unit_price: i.sale_price,
        })),
        date: data.return_date,
        paid_amount: Number(data.paid_amount ?? 0),
        notes: '',
      });
      toast.info('Return updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update return');
    }
  },

  deleteReturn: async (id) => {
    try {
      await transactionApi.deleteReturnIn(id);
      toast.error('Return deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete return');
    }
  },

  addAccount: async (data) => {
    try {
      await accountApi.create(data as any);
      toast.success('Account added successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add account');
    }
  },
  updateAccount: async (id, data) => {
    try {
      await accountApi.update(id, data as any);
      toast.info('Account updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update account');
    }
  },
  deleteAccount: async (id) => {
    try {
      await accountApi.remove(id);
      toast.error('Account deleted successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete account');
    }
  },

  addTransaction: async (data) => {
    try {
      const created = await accountTransactionApi.create({
        date: data.date,
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        exchange_rate: data.exchange_rate,
        account_id: Number(data.account_id),
        to_account_id: data.to_account_id ? Number(data.to_account_id) : undefined,
        reference_id: data.reference_id,
        contact_id: data.contact_id ? Number(data.contact_id) : undefined,
        description: data.description,
        payment_method: data.payment_method,
        attachment: data.attachment,
      });
      toast.success('Transaction added successfully');
      set((state) => ({ transactions: [...state.transactions, {
        ...data,
        id: String(created.id),
      }] }));
      await get().bootstrapData();
    } catch {
      toast.error('Failed to add transaction');
    }
  },

  addPayment: async (data) => {
    try {
      await paymentApi.create({
        date: data.date,
        account_id: Number(data.account_id),
        currency: data.currency,
        salesman: data.salesman,
        booker: data.booker,
        notes: data.notes,
        details: data.details.map((d) => ({
          customer_id: Number(d.customer_id),
          debit_amount: d.debit_amount,
          credit_amount: d.credit_amount,
          balance_amount: d.balance_amount,
          remarks: d.remarks,
        })),
      } as any);
      toast.success('Payment recorded successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to record payment');
    }
  },

  updatePayment: async (id, data) => {
    try {
      await paymentApi.update(id, {
        date: data.date,
        account_id: Number(data.account_id),
        currency: data.currency,
        salesman: data.salesman,
        booker: data.booker,
        notes: data.notes,
        details: data.details.map((d) => ({
          customer_id: Number(d.customer_id),
          debit_amount: d.debit_amount,
          credit_amount: d.credit_amount,
          balance_amount: d.balance_amount,
          remarks: d.remarks,
        })),
      } as any);
      toast.info('Payment updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update payment');
    }
  },

  updateTransaction: async (id, data) => {
    try {
      await accountTransactionApi.update(id, {
        date: data.date,
        type: data.type,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        exchange_rate: data.exchange_rate,
        account_id: Number(data.account_id),
        to_account_id: data.to_account_id ? Number(data.to_account_id) : undefined,
        reference_id: data.reference_id,
        contact_id: data.contact_id ? Number(data.contact_id) : undefined,
        description: data.description,
        payment_method: data.payment_method,
        attachment: data.attachment,
      });
      toast.info('Transaction updated successfully');
      await get().bootstrapData();
    } catch {
      toast.error('Failed to update transaction');
    }
  },

  deleteTransaction: async (id) => {
    try {
      await accountTransactionApi.remove(id);
      toast.error('Transaction deleted successfully');
      set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
      await get().bootstrapData();
    } catch {
      toast.error('Failed to delete transaction');
    }
  },

  hasPermission: (perm) => {
    const role = get().currentUser.role;
    const aliases: Record<string, string> = {
      'product.view': 'manage_products',
      'product.create': 'manage_products',
      'product.edit': 'manage_products',
      'product.delete': 'manage_products',
      'product.search': 'manage_products',
      'product.export': 'manage_products',
      'product.print': 'manage_products',
      'brand.view': 'manage_products',
      'brand.create': 'manage_products',
      'brand.edit': 'manage_products',
      'brand.delete': 'manage_products',
      'brand.search': 'manage_products',
      'brand.export': 'manage_products',
      'brand.print': 'manage_products',
      'country.view': 'manage_products',
      'country.create': 'manage_products',
      'country.edit': 'manage_products',
      'country.delete': 'manage_products',
      'country.search': 'manage_products',
      'country.export': 'manage_products',
      'country.print': 'manage_products',
      'inventory.view': 'manage_products',
      'partners.view': 'manage_inventory',
      'invoices.view': 'manage_orders',
      'supplier.view': 'manage_inventory',
      'supplier.create': 'manage_inventory',
      'supplier.edit': 'manage_inventory',
      'supplier.delete': 'manage_inventory',
      'supplier.search': 'manage_inventory',
      'supplier.export': 'manage_inventory',
      'supplier.print': 'manage_inventory',
      'customer.view': 'manage_inventory',
      'customer.create': 'manage_inventory',
      'customer.edit': 'manage_inventory',
      'customer.delete': 'manage_inventory',
      'customer.search': 'manage_inventory',
      'customer.export': 'manage_inventory',
      'customer.print': 'manage_inventory',
      'purchase.view': 'manage_inventory',
      'purchase.create': 'manage_inventory',
      'purchase.edit': 'manage_inventory',
      'purchase.delete': 'manage_inventory',
      'purchase.search': 'manage_inventory',
      'purchase.export': 'manage_inventory',
      'purchase.print': 'manage_inventory',
      'sales.view': 'manage_orders',
      'sales.create': 'manage_orders',
      'sales.edit': 'manage_orders',
      'sales.delete': 'manage_orders',
      'sales.search': 'manage_orders',
      'sales.export': 'manage_orders',
      'sales.print': 'manage_orders',
      'return.view': 'manage_orders',
      'return.create': 'manage_orders',
      'return.edit': 'manage_orders',
      'return.delete': 'manage_orders',
      'return.search': 'manage_orders',
      'return.export': 'manage_orders',
      'return.print': 'manage_orders',
      'return_in.view': 'manage_orders',
      'return_in.create': 'manage_orders',
      'return_in.edit': 'manage_orders',
      'return_in.delete': 'manage_orders',
      'return_in.search': 'manage_orders',
      'return_in.export': 'manage_orders',
      'return_in.print': 'manage_orders',
      'return_out.view': 'manage_orders',
      'return_out.create': 'manage_orders',
      'return_out.edit': 'manage_orders',
      'return_out.delete': 'manage_orders',
      'return_out.search': 'manage_orders',
      'return_out.export': 'manage_orders',
      'return_out.print': 'manage_orders',
      'account.view': 'manage_orders',
      'account.transactions.view': 'manage_orders',
      'account.transactions.create': 'manage_orders',
      'account.transactions.edit': 'manage_orders',
      'account.transactions.delete': 'manage_orders',
      'account.transactions.search': 'manage_orders',
      'account.transactions.export': 'manage_orders',
      'account.transactions.print': 'manage_orders',
      'account.accounts.view': 'manage_orders',
      'account.accounts.create': 'manage_orders',
      'account.accounts.edit': 'manage_orders',
      'account.accounts.delete': 'manage_orders',
      'account.accounts.search': 'manage_orders',
      'account.accounts.export': 'manage_orders',
      'account.accounts.print': 'manage_orders',
      'account.transaction.payment': 'manage_orders',
      'account.transaction.income': 'manage_orders',
      'account.transaction.expense': 'manage_orders',
      'account.transaction.transfer': 'manage_orders',
      'account.transaction.save': 'manage_orders',
      'account.transaction.cancel': 'manage_orders',
      'settings.view': 'manage_users',
      'settings.edit': 'manage_users',
      'settings.general': 'manage_users',
      'settings.print': 'manage_users',
      'settings.clients': 'manage_users',
      'settings.users': 'manage_users',
      'settings.roles': 'manage_users',
      'settings.permissions': 'manage_users',
      'settings.profile': 'manage_users',
      'user.view': 'manage_users',
      'user.create': 'manage_users',
      'user.edit': 'manage_users',
      'user.delete': 'manage_users',
      'user.search': 'manage_users',
      'user.export': 'manage_users',
      'user.print': 'manage_users',
      'role.view': 'manage_users',
      'role.create': 'manage_users',
      'role.edit': 'manage_users',
      'role.delete': 'manage_users',
      'role.search': 'manage_users',
      'role.export': 'manage_users',
      'role.print': 'manage_users',
      'permission.view': 'manage_users',
      'permission.edit': 'manage_users',
      'permission.search': 'manage_users',
      'permission.export': 'manage_users',
      'client.view': 'manage_users',
      'client.create': 'manage_users',
      'client.edit': 'manage_users',
      'client.delete': 'manage_users',
      'client.search': 'manage_users',
      'client.export': 'manage_users',
      'client.print': 'manage_users',
    };
    
    // Superadmin has access to everything
    if (role?.toLowerCase() === 'superadmin') {
      return true;
    }
    
    // Get user's permissions from their profile
    const userPermissions = get().currentUser.permissions ?? [];
    
    // Check ONLY the exact permission the user has
    // This ensures granular permissions are respected
    return userPermissions.includes(perm);
  }
}));
