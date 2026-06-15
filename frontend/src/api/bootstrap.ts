import apiClient from './client';

export interface BootstrapPayload {
  tenant: unknown;
  printSettings: unknown;
  brands: unknown[];
  categories: unknown[];
  countries: unknown[];
  products: unknown;
  suppliers: unknown[];
  customers: unknown[];
  accounts: unknown[];
  transactions: unknown[];
  purchases: unknown;
  sales: unknown;
  returns: unknown;
  returnOuts: unknown;
  quotations: unknown;
  users: unknown[];
  roles: unknown[];
  permissions: unknown[];
  clients: unknown[];
}

export const bootstrapApi = {
  get: async () => (await apiClient.get<BootstrapPayload>('/bootstrap')).data,
};
