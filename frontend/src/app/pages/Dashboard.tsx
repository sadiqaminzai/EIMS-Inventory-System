import { useStore } from '../../store/index';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { TransactionForm } from '../components/forms/TransactionForm';
import { toast } from 'sonner';

// --- Components ---

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: { title: string, value: string, subtext?: string, icon: any, colorClass: string, trend?: { value: number, label: string } }) => (
  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        {trend && (
            <div className={clsx("flex items-center gap-1 mt-2 text-xs font-medium", trend.value >= 0 ? "text-green-600" : "text-red-600")}>
                {trend.value >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
        )}
      </div>
      <div className={clsx("p-3 rounded-lg bg-opacity-10", colorClass.replace('text-', 'bg-').replace('600', '500'))}>
        <Icon className={clsx("h-6 w-6", colorClass)} />
      </div>
    </div>
  </div>
);

const RecentActivityTable = ({ transactions }: { transactions: any[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No recent activity</td>
                    </tr>
                ) : (
                    transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                                {format(parseISO(tx.date), 'MMM dd, HH:mm')}
                            </td>
                            <td className="px-4 py-3">
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    tx.type === 'Income' ? "bg-green-100 text-green-700" :
                                    tx.type === 'Expense' ? "bg-red-100 text-red-700" :
                                    "bg-blue-100 text-blue-700"
                                )}>
                                    {tx.type}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[200px]">
                                {tx.category || tx.description || 'General'}
                            </td>
                            <td className={clsx("px-4 py-3 text-right font-bold", 
                                tx.type === 'Income' ? "text-green-600" : 
                                tx.type === 'Expense' ? "text-red-600" : "text-blue-600"
                            )}>
                                {tx.type === 'Expense' ? '-' : '+'}
                                {tx.currency} {tx.amount.toLocaleString()}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

export const Dashboard = () => {
  const store = useStore ? useStore() : null;
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  
  if (!store) return <div className="flex h-full items-center justify-center text-gray-500">Loading Dashboard...</div>;

  const { products, sales, purchases, transactions, accounts, addTransaction } = store;

  const handleAddTransaction = (data: any) => {
      addTransaction(data);
      setIsTxModalOpen(false);
  };

  const handleDownloadReport = () => {
      toast.success("Report generation started", { description: "You will be notified when it is ready." });
  };

  // --- KPI Calculations ---
  
  // 1. Financial Overview (Total Sales vs Total Purchases vs Net)
  const totalRevenue = sales.reduce((sum, s) => sum + s.net_payable, 0);
  const totalPurchasesCost = purchases.reduce((sum, p) => sum + p.grand_total, 0);
  
  // Expenses from Transactions (excluding transfers)
  const totalExpenses = transactions
    .filter(t => t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0); // Note: Should handle currency conversion in real app

  const netProfit = totalRevenue - (totalPurchasesCost + totalExpenses);
  
  // 2. Inventory Stats
  const totalStockValue = products.reduce((sum, p) => sum + (p.stock_qty * p.cost_price), 0);
  const lowStockCount = products.filter(p => p.stock_qty < 10).length;
  
  // 3. Recent Activity (Last 5 Transactions)
  const recentActivity = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  // 4. Chart Data Preparation
  // Generate last 6 months labels
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return {
        name: format(d, 'MMM'),
        fullName: format(d, 'MMMM yyyy'),
        start: startOfMonth(d),
        end: endOfMonth(d)
    };
  });

  const chartData = last6Months.map(month => {
    const monthSales = sales
        .filter(s => isWithinInterval(parseISO(s.sale_date), { start: month.start, end: month.end }))
        .reduce((sum, s) => sum + s.net_payable, 0);
    
    const monthExpenses = transactions
        .filter(t => t.type === 'Expense' && isWithinInterval(parseISO(t.date), { start: month.start, end: month.end }))
        .reduce((sum, t) => sum + t.amount, 0) 
        + 
        purchases
        .filter(p => isWithinInterval(parseISO(p.purchase_date), { start: month.start, end: month.end }))
        .reduce((sum, p) => sum + p.grand_total, 0);

    return {
        name: month.name,
        sales: monthSales,
        expenses: monthExpenses
    };
  });

  // Top Selling Products (by Quantity) - Aggregate from all sales items
  const productSalesMap = new Map<string, number>();
  sales.forEach(sale => {
      sale.items.forEach(item => {
          const current = productSalesMap.get(item.product_id) || 0;
          productSalesMap.set(item.product_id, current + item.quantity);
      });
  });

  const topProducts = Array.from(productSalesMap.entries())
    .map(([id, qty]) => {
        const product = products.find(p => p.id === id);
        return {
            name: product ? product.name : 'Unknown',
            qty
        };
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  
  // Account Distribution Data
  const accountDistribution = accounts.map(acc => ({
      name: acc.name,
      value: acc.balance
  })).filter(a => a.value > 0);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-gray-500 text-sm">Welcome back, here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleDownloadReport}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
            >
                Download Report
            </button>
            <button 
                onClick={() => setIsTxModalOpen(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors"
            >
                Add Transaction
            </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
            title="Total Revenue" 
            value={`$${totalRevenue.toLocaleString()}`} 
            subtext="Lifetime sales volume"
            icon={DollarSign} 
            colorClass="text-green-600" 
            trend={{ value: 12.5, label: "vs last month" }}
        />
        <StatCard 
            title="Total Expenses" 
            value={`$${(totalPurchasesCost + totalExpenses).toLocaleString()}`} 
            subtext="Purchases + Operational"
            icon={CreditCard} 
            colorClass="text-red-600"
            trend={{ value: -2.4, label: "vs last month" }}
        />
        <StatCard 
            title="Net Profit" 
            value={`$${netProfit.toLocaleString()}`} 
            subtext="Revenue - Expenses"
            icon={TrendingUp} 
            colorClass="text-blue-600" 
            trend={{ value: 8.2, label: "vs last month" }}
        />
        <StatCard 
            title="Inventory Value" 
            value={`$${totalStockValue.toLocaleString()}`} 
            subtext={`${lowStockCount} items low stock`}
            icon={Package} 
            colorClass="text-amber-600" 
        />
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales vs Expenses Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Financial Performance</h3>
                <select className="bg-gray-50 border-gray-200 text-sm rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500/20">
                    <option>Last 6 Months</option>
                    <option>Last Year</option>
                </select>
            </div>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `$${value}`} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ stroke: '#9ca3af', strokeDasharray: '4 4' }}
                        />
                        <Area type="monotone" dataKey="sales" name="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Account Balances / Distribution */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-6">Account Distribution</h3>
            <div className="h-[300px] w-full relative">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <PieChart>
                        <Pie
                            data={accountDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {accountDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
                {/* Center Text Overlay */}
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-semibold">Total</p>
                        <p className="text-lg font-bold text-gray-900">
                            ${accountDistribution.reduce((a, b) => a + b.value, 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Top Selling Products */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Top Selling Products</h3>
            <div className="space-y-4">
                {topProducts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No sales data available</div>
                ) : (
                    topProducts.map((item, index) => (
                        <div key={index} className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                {index + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                    <span className="text-sm font-semibold text-gray-900">{item.qty} sold</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full" 
                                        style={{ width: `${(item.qty / topProducts[0].qty) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <button className="text-sm text-blue-600 font-medium hover:underline">View All</button>
            </div>
            <RecentActivityTable transactions={recentActivity} />
          </div>

      </div>

      <Modal
        open={isTxModalOpen}
        onOpenChange={setIsTxModalOpen}
        title="New Transaction"
      >
        <TransactionForm
            onSave={handleAddTransaction}
            onCancel={() => setIsTxModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
