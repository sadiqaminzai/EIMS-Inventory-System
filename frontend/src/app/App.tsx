import { lazy, Suspense } from 'react';
import { BrowserRouter, useRoutes, Navigate } from 'react-router';
import { Layout } from './Layout';
import { useStore } from '../store/index';
import { DEFAULT_REPORT_MODULE_KEY } from './reports/reportMeta';
// Use sonner directly to avoid missing ThemeProvider issue in local wrapper
import { Toaster } from 'sonner';

// Lazy-load page components so each route ships as its own chunk — keeps the
// initial bundle small and speeds up first load.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const PartnersPage = lazy(() => import('./pages/PartnersPage').then((m) => ({ default: m.PartnersPage })));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage').then((m) => ({ default: m.PurchasesPage })));
const SalesPage = lazy(() => import('./pages/SalesPage').then((m) => ({ default: m.SalesPage })));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage').then((m) => ({ default: m.ReturnsPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const PayablesPage = lazy(() => import('./pages/PayablesPage').then((m) => ({ default: m.PayablesPage })));
const ReceivablesPage = lazy(() => import('./pages/ReceivablesPage').then((m) => ({ default: m.ReceivablesPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PageFallback = () => (
  <div className="flex h-full w-full items-center justify-center py-20 text-sm text-gray-400">
    Loading…
  </div>
);

const isAuthenticated = () => Boolean(localStorage.getItem('auth_token'));

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const RedirectIfAuthed = ({ children }: { children: JSX.Element }) => {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Route-level RBAC: render children only if the user has any of the listed
// permissions (superadmin always passes). Otherwise redirect to the dashboard,
// which is permissive so there is never a redirect loop.
const RequirePermission = ({ anyOf, children }: { anyOf: string[]; children: JSX.Element }) => {
  const hasPermission = useStore((s) => s.hasPermission);
  if (anyOf.length === 0 || anyOf.some((perm) => hasPermission(perm))) {
    return children;
  }
  return <Navigate to="/dashboard" replace />;
};

// Define routes using the route object format
const routes = [
  { path: "/login", element: <Suspense fallback={<PageFallback />}><RedirectIfAuthed><LoginPage /></RedirectIfAuthed></Suspense> },
  {
    path: "/",
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // Dashboard is permissive (visible to all authenticated users); it is hidden
      // from the sidebar only when a role carries the 'dashboard.hide' permission.
      { path: "dashboard", element: <Dashboard /> },
      { path: "inventory", element: <RequirePermission anyOf={['inventory.view']}><InventoryPage /></RequirePermission> },
      { path: "partners", element: <RequirePermission anyOf={['partners.view']}><PartnersPage /></RequirePermission> },
      { path: "purchases", element: <RequirePermission anyOf={['purchase.view']}><PurchasesPage /></RequirePermission> },
      { path: "invoices", element: <RequirePermission anyOf={['invoices.view']}><SalesPage /></RequirePermission> },
      { path: "sales", element: <Navigate to="/invoices" replace /> },
      { path: "returns", element: <RequirePermission anyOf={['return.view', 'return_in.view', 'invoices.view']}><ReturnsPage /></RequirePermission> },
      { path: "accounts", element: <RequirePermission anyOf={['account.view']}><AccountsPage /></RequirePermission> },
      { path: "finance", element: <Navigate to="/accounts" replace /> },
      { path: "payables", element: <RequirePermission anyOf={['purchase.view']}><PayablesPage /></RequirePermission> },
      { path: "receivables", element: <RequirePermission anyOf={['invoices.view']}><ReceivablesPage /></RequirePermission> },
      { path: "reports", element: <Navigate to={`/reports/${DEFAULT_REPORT_MODULE_KEY}`} replace /> },
      // ReportsPage performs its own per-module permission check (Access Denied).
      { path: "reports/:moduleKey", element: <ReportsPage /> },
      { path: "settings", element: <RequirePermission anyOf={['settings.view', 'settings.general', 'settings.print', 'settings.profile', 'settings.users', 'settings.roles', 'settings.permissions', 'settings.clients']}><SettingsPage /></RequirePermission> },
      { path: "*", element: <Navigate to="/dashboard" replace /> }
    ]
  },
  { path: "*", element: <Navigate to="/login" replace /> }
];

// Component to render routes
const AppRoutes = () => {
  // Force update routes
  return useRoutes(routes);
};

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Toaster position="top-right" richColors />
      <AppRoutes />
    </BrowserRouter>
  );
}
