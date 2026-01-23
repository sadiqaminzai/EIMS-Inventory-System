import { BrowserRouter, useRoutes, Navigate } from 'react-router';
import { Layout } from './Layout';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { InventoryPage } from './pages/InventoryPage';
import { PartnersPage } from './pages/PartnersPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { SalesPage } from './pages/SalesPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
// Use sonner directly to avoid missing ThemeProvider issue in local wrapper
import { Toaster } from 'sonner';

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

// Define routes using the route object format
const routes = [
  { path: "/login", element: <RedirectIfAuthed><LoginPage /></RedirectIfAuthed> },
  {
    path: "/",
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "partners", element: <PartnersPage /> },
      { path: "purchases", element: <PurchasesPage /> },
      { path: "invoices", element: <SalesPage /> },
      { path: "sales", element: <Navigate to="/invoices" replace /> },
      { path: "returns", element: <ReturnsPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
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
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <AppRoutes />
    </BrowserRouter>
  );
}
