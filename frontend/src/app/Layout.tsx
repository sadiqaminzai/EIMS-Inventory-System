import { Outlet, useLocation, useNavigate } from 'react-router';
import { useStore, Permission } from '../store/index';
import { 
  LayoutDashboard, 
  Package, 
  Tag, 
  Globe, 
  Users, 
  ShoppingCart, 
  TrendingUp, 
  Undo2, 
  FileText, 
  Settings,
  LogOut,
  Menu,
  Building2,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Briefcase,
  Wallet
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useIsMobile } from '../hooks/use-mobile';
import { Button } from './components/ui/button';
import { authApi } from '../api/auth';
import { toast } from 'sonner';

export const Layout = () => {
  // Add safety check for useStore (Force update)
  const store = useStore ? useStore() : null;
  
  if (!store) {
    return <div className="flex h-screen items-center justify-center">Loading Application Context (Please Refresh)...</div>;
  }

  const { tenant, currentUser, hasPermission, bootstrapData, updateCurrentUser } = store;
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const cached = localStorage.getItem('current_user');
    if (cached) {
      try {
        updateCurrentUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem('current_user');
      }
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      authApi.getProfile().then((profile) => {
        const roleMap: Record<string, 'Super Admin' | 'Admin' | 'Accountant'> = {
          superadmin: 'Super Admin',
          admin: 'Admin',
          manager: 'Admin',
          staff: 'Accountant',
          accountant: 'Accountant',
        };

        updateCurrentUser({
          id: String(profile.id),
          name: profile.name,
          email: profile.email,
          role: roleMap[(profile as any).role] ?? 'Admin',
          tenant_id: localStorage.getItem('tenant_id') ?? '1',
          status: 'active',
        });
      }).catch(() => undefined);
    }

    bootstrapData();
  }, [bootstrapData, updateCurrentUser]);

  const isActive = (path: string) => location.pathname === path;

  const CustomLink = ({ to, children, className, title }: any) => {
    const navigate = useNavigate();
    // Use navigate for navigation
    return (
      <a 
        href={to}
        onClick={(e) => {
          e.preventDefault();
          navigate(to);
        }}
        className={className}
        title={title}
      >
        {children}
      </a>
    );
  };

  const NavItem = ({ to, label, icon: Icon, perm }: { to: string, label: string, icon: any, perm?: Permission }) => {
    if (perm && !hasPermission(perm)) return null;
    
    const active = isActive(to);
    
    return (
      <CustomLink
        to={to}
        className={clsx(
          "flex items-center gap-3 px-3 py-1 rounded-md transition-colors text-sm font-medium",
          active 
            ? "bg-blue-50 text-blue-700" 
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
        title={collapsed && !isMobile ? label : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {(!collapsed || isMobile) && <span>{label}</span>}
      </CustomLink>
    );
  };

  const SectionHeader = ({ label, shortLabel }: { label: string, shortLabel: string }) => (
    <div className={clsx("text-[10px] font-bold text-gray-400 uppercase px-3 pt-2 pb-0.5", (collapsed && !isMobile) && "text-center")}>
      {(collapsed && !isMobile) ? shortLabel : label}
    </div>
  );

  const NavGroup = ({ label, icon: Icon, children }: { label: string, icon: any, children: React.ReactNode }) => {
    const [expanded, setExpanded] = useState(false);
    
    // Check if any child is active
    const hasActiveChild = React.Children.toArray(children).some((child: any) => 
       React.isValidElement(child) && child.props.to && isActive(child.props.to)
    );

    useEffect(() => {
        if (hasActiveChild) setExpanded(true);
    }, [hasActiveChild]);

    if (collapsed && !isMobile) {
        return (
            <div className="flex justify-center py-2 group relative">
                <Icon className="h-4 w-4 text-gray-500 group-hover:text-gray-900" />
                <div className="absolute left-full top-0 ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                    {label}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-1">
            <button 
                onClick={() => setExpanded(!expanded)}
                className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-sm font-medium",
                    hasActiveChild ? "text-blue-700 bg-blue-50/50" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
            >
                <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                </div>
                <ChevronDown className={clsx("h-3 w-3 transition-transform text-gray-400", expanded ? "rotate-180" : "")} />
            </button>
            {expanded && (
                <div className="pl-4 py-1 space-y-1 relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-gray-200">
                    {children}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-300 z-30",
          isMobile ? "fixed inset-y-0 left-0 h-full shadow-xl" : "relative",
          isMobile 
            ? (mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64")
            : (collapsed ? "w-16" : "w-64")
        )}
      >
        {/* Brand */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-8 w-8 rounded bg-blue-600 flex items-center justify-center shrink-0 text-white font-bold">
              {tenant.logo ? <img src={tenant.logo} alt="Logo" className="h-full w-full object-cover rounded" /> : tenant.name.charAt(0)}
            </div>
            {(!collapsed || isMobile) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-gray-900 text-sm truncate">{tenant.name}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Enterprise ERP</span>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0 scrollbar-thin scrollbar-thumb-gray-200">
          <NavItem to="/dashboard" label="Dashboard" icon={LayoutDashboard} />
          
          <NavItem to="/inventory" label="Inventory" icon={Package} perm="product.view" />
          <NavItem to="/partners" label="Partners" icon={Users} perm="customer.view" />

          <SectionHeader label="Operations" shortLabel="OPS" />
          <NavItem to="/purchases" label="Purchases" icon={ShoppingCart} perm="purchase.view" />
          <NavItem to="/sales" label="Sales" icon={TrendingUp} perm="sales.view" />
          <NavItem to="/returns" label="Returns" icon={Undo2} perm="return.view" />
          <NavItem to="/accounts" label="Accounts" icon={Wallet} perm="account.view" />

          <SectionHeader label="System" shortLabel="SYS" />
          {/* Reports removed as requested */}
          <NavItem to="/settings" label="Settings" icon={Settings} perm="settings.view" />
        </div>

        {/* Desktop Collapse Toggle */}
        {!isMobile && (
          <div className="p-2 border-t border-gray-200 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 text-gray-500 hover:text-gray-900"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src={currentUser.avatar} 
              alt="User" 
              className="h-8 w-8 rounded-full bg-gray-300" 
            />
            {(!collapsed || isMobile) && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.role}</p>
              </div>
            )}
            {(!collapsed || isMobile) && (
              <button 
                onClick={() => {
                  authApi.logout().catch(() => undefined).finally(() => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('tenant_id');
                    localStorage.removeItem('current_user');
                    toast.success('Logged out');
                    navigate('/login');
                  });
                }}
                className="text-gray-400 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-10 shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button 
                onClick={() => setMobileOpen(true)}
                className="p-2 hover:bg-gray-100 rounded text-gray-600"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            {!isMobile && (
              <div className="w-4" /> /* Spacer if needed, or remove */
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500 hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
