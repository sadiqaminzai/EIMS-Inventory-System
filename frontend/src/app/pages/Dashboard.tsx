import { useStore } from '../../store/index';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Wallet,
  Users,
  Banknote,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  format, parseISO, isWithinInterval,
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subDays, subMonths,
} from 'date-fns';
import { formatDateTime } from '../utils/dateTime';
import { formatNumber, formatCompact, percentChange } from '../utils/number';
import { clsx } from 'clsx';
import { useMemo, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { TransactionForm } from '../components/forms/TransactionForm';
import { toast } from 'sonner';

// --- Date range helpers ---

type RangeKey = 'today' | 'week' | 'month' | 'year' | 'custom';

interface Range {
  start: Date;
  end: Date;
  label: string;
}

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const buildRange = (key: RangeKey, customFrom: string, customTo: string): Range => {
  const now = new Date();
  switch (key) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
        label: 'This Week',
      };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now), label: 'This Month' };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now), label: 'This Year' };
    case 'custom': {
      const from = customFrom ? startOfDay(parseISO(customFrom)) : startOfDay(now);
      const to = customTo ? endOfDay(parseISO(customTo)) : endOfDay(now);
      const valid = from <= to ? { from, to } : { from: to, to: from };
      return {
        start: valid.from,
        end: valid.to,
        label: `${format(valid.from, 'MMM d')} – ${format(valid.to, 'MMM d, yyyy')}`,
      };
    }
  }
};

/** Equal-length window immediately preceding the given range — used for trend %. */
const previousRange = ({ start, end }: Range): Range => {
  const len = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - len);
  return { start: prevStart, end: prevEnd, label: 'previous period' };
};

const inRange = (dateStr: string | undefined, range: Range): boolean => {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return isWithinInterval(d, { start: range.start, end: range.end });
};

// --- Presentational components ---

interface Trend {
  value: number | null;
  /** true for metrics where an increase is unfavourable (purchases, receivables). */
  invert?: boolean;
}

const TrendChip = ({ trend }: { trend: Trend }) => {
  if (trend.value === null) {
    return <span className="text-xs font-medium text-gray-400">— no prior data</span>;
  }
  const up = trend.value >= 0;
  const favourable = trend.invert ? !up : up;
  return (
    <div
      className={clsx(
        'flex items-center gap-1 text-xs font-semibold',
        favourable ? 'text-emerald-600' : 'text-rose-600',
      )}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      <span>{Math.abs(trend.value).toFixed(1)}%</span>
      <span className="font-normal text-gray-400">vs prev</span>
    </div>
  );
};

const StatCard = ({
  title, value, subtext, icon: Icon, accent, trend,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: any;
  accent: { text: string; bg: string; ring: string };
  trend?: Trend;
}) => (
  <div className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
    <div className={clsx('absolute -right-5 -top-5 h-20 w-20 rounded-full opacity-10 blur-xl', accent.bg)} />
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <h3 className="mt-1 truncate text-xl font-bold tracking-tight text-gray-900">{value}</h3>
        {subtext && <p className="mt-0.5 text-[11px] text-gray-400">{subtext}</p>}
      </div>
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1', accent.bg, accent.ring)}>
        <Icon className={clsx('h-4 w-4', accent.text)} />
      </div>
    </div>
    {trend && <div className="mt-2">{<TrendChip trend={trend} />}</div>}
  </div>
);

const RecentActivityTable = ({ transactions }: { transactions: any[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-sm">
      <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
        <tr>
          <th className="px-4 py-3 font-medium">Date</th>
          <th className="px-4 py-3 font-medium">Type</th>
          <th className="px-4 py-3 font-medium">Description</th>
          <th className="px-4 py-3 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {transactions.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No recent activity</td>
          </tr>
        ) : (
          transactions.map((tx) => (
            <tr key={tx.id} className="transition-colors hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                {formatDateTime(parseISO(tx.date), 'MMM dd, h:mm a')}
              </td>
              <td className="px-4 py-3">
                <span className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  tx.type === 'Income' ? 'bg-emerald-100 text-emerald-700'
                    : tx.type === 'Expense' ? 'bg-rose-100 text-rose-700'
                      : 'bg-blue-100 text-blue-700',
                )}>
                  {tx.type}
                </span>
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 font-medium text-gray-900">
                {tx.category || tx.description || 'General'}
              </td>
              <td className={clsx('px-4 py-3 text-right font-bold',
                tx.type === 'Income' ? 'text-emerald-600'
                  : tx.type === 'Expense' ? 'text-rose-600' : 'text-blue-600',
              )}>
                {tx.type === 'Expense' ? '-' : '+'}{formatNumber(tx.amount)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// --- Financial trend chart (independent of the KPI date filter) ---

type ChartMode = '30d' | '6m' | '12m';

const CHART_MODES: { key: ChartMode; label: string }[] = [
  { key: '30d', label: 'Last 30 Days' },
  { key: '6m', label: 'Last 6 Months' },
  { key: '12m', label: 'Last 12 Months' },
];

const buildBuckets = (mode: ChartMode) => {
  const now = new Date();
  if (mode === '30d') {
    return Array.from({ length: 30 }, (_, i) => {
      const d = subDays(now, 29 - i);
      return { name: format(d, 'MMM d'), start: startOfDay(d), end: endOfDay(d) };
    });
  }
  const months = mode === '6m' ? 6 : 12;
  return Array.from({ length: months }, (_, i) => {
    const d = subMonths(now, months - 1 - i);
    return { name: format(d, 'MMM'), start: startOfMonth(d), end: endOfMonth(d) };
  });
};

// --- Page ---

export const Dashboard = () => {
  const store = useStore ? useStore() : null;
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [chartMode, setChartMode] = useState<ChartMode>('6m');

  if (!store) return <div className="flex h-full items-center justify-center text-gray-500">Loading Dashboard...</div>;

  const { products, sales, purchases, transactions, customers, addTransaction } = store;

  const range = useMemo(() => buildRange(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo]);
  const prevRange = useMemo(() => previousRange(range), [range]);

  // --- Period metrics (computed for both current and previous window for trends) ---
  const metricsFor = (r: Range) => {
    const salesAmount = sales.filter(s => inRange(s.sale_date, r)).reduce((a, s) => a + (s.net_payable || 0), 0);
    const purchaseAmount = purchases.filter(p => inRange(p.purchase_date, r)).reduce((a, p) => a + (p.grand_total || 0), 0);
    const expenses = transactions.filter(t => t.type === 'Expense' && inRange(t.date, r)).reduce((a, t) => a + (t.amount || 0), 0);
    const receivables = sales.filter(s => inRange(s.sale_date, r)).reduce((a, s) => a + (s.due_amount || 0), 0);
    const totalPaid = sales.filter(s => inRange(s.sale_date, r)).reduce((a, s) => a + (s.paid_amount || 0), 0);
    const newCustomers = customers.filter(c => inRange(c.created_at, r)).length;
    const profit = salesAmount - purchaseAmount - expenses;
    return { salesAmount, purchaseAmount, expenses, receivables, totalPaid, newCustomers, profit };
  };

  const cur = useMemo(() => metricsFor(range), [range, sales, purchases, transactions, customers]);
  const prev = useMemo(() => metricsFor(prevRange), [prevRange, sales, purchases, transactions, customers]);

  // --- Snapshot metrics (not period-bound) ---
  const totalStockValue = products.reduce((sum, p) => sum + (p.stock_qty * p.cost_price), 0);
  const lowStockCount = products.filter(p => p.stock_qty < 10).length;

  // --- Recent activity ---
  const recentActivity = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [transactions],
  );

  // --- Financial trend chart ---
  const chartData = useMemo(() => buildBuckets(chartMode).map(bucket => {
    const r: Range = { start: bucket.start, end: bucket.end, label: bucket.name };
    const s = sales.filter(x => inRange(x.sale_date, r)).reduce((a, x) => a + (x.net_payable || 0), 0);
    const p = purchases.filter(x => inRange(x.purchase_date, r)).reduce((a, x) => a + (x.grand_total || 0), 0);
    const e = transactions.filter(x => x.type === 'Expense' && inRange(x.date, r)).reduce((a, x) => a + (x.amount || 0), 0);
    return { name: bucket.name, sales: s, purchases: p, profit: s - p - e };
  }), [chartMode, sales, purchases, transactions]);

  // --- Top selling products (period filtered) ---
  const topProducts = useMemo(() => {
    const map = new Map<string, number>();
    sales.filter(s => inRange(s.sale_date, range)).forEach(sale => {
      sale.items.forEach(item => map.set(item.product_id, (map.get(item.product_id) || 0) + item.quantity));
    });
    return Array.from(map.entries())
      .map(([id, qty]) => ({ name: products.find(p => p.id === id)?.name || 'Unknown', qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales, products, range]);

  // --- Period breakdown (Sales / Purchases / Expenses / Paid) ---
  const breakdown = [
    { label: 'Sales', value: cur.salesAmount, color: 'bg-emerald-500', text: 'text-emerald-600' },
    { label: 'Purchases', value: cur.purchaseAmount, color: 'bg-indigo-500', text: 'text-indigo-600' },
    { label: 'Expenses', value: cur.expenses, color: 'bg-rose-500', text: 'text-rose-600' },
    { label: 'Paid In', value: cur.totalPaid, color: 'bg-blue-500', text: 'text-blue-600' },
  ];
  const breakdownMax = Math.max(...breakdown.map(b => b.value), 1);

  const handleAddTransaction = (data: any) => { addTransaction(data); setIsTxModalOpen(false); };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      {/* Header + date filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{range.label}</span> · compared to the previous period.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => setRangeKey(p.key)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  rangeKey === p.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {rangeKey === 'custom' && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm">
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none"
              />
              <span className="text-gray-400">–</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="bg-transparent text-sm text-gray-700 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Sales Amount"
          value={formatNumber(cur.salesAmount)}
          subtext={`${sales.filter(s => inRange(s.sale_date, range)).length} invoices`}
          icon={TrendingUp}
          accent={{ text: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' }}
          trend={{ value: percentChange(cur.salesAmount, prev.salesAmount) }}
        />
        <StatCard
          title="Total Paid"
          value={formatNumber(cur.totalPaid)}
          subtext="Received against sales"
          icon={Banknote}
          accent={{ text: 'text-teal-600', bg: 'bg-teal-500/10', ring: 'ring-teal-500/20' }}
          trend={{ value: percentChange(cur.totalPaid, prev.totalPaid) }}
        />
        <StatCard
          title="Purchase Amount"
          value={formatNumber(cur.purchaseAmount)}
          subtext={`${purchases.filter(p => inRange(p.purchase_date, range)).length} orders`}
          icon={ShoppingCart}
          accent={{ text: 'text-indigo-600', bg: 'bg-indigo-500/10', ring: 'ring-indigo-500/20' }}
          trend={{ value: percentChange(cur.purchaseAmount, prev.purchaseAmount), invert: true }}
        />
        <StatCard
          title="Total Expenses"
          value={formatNumber(cur.expenses)}
          subtext="Operational expenses"
          icon={Receipt}
          accent={{ text: 'text-rose-600', bg: 'bg-rose-500/10', ring: 'ring-rose-500/20' }}
          trend={{ value: percentChange(cur.expenses, prev.expenses), invert: true }}
        />
        <StatCard
          title="Profit"
          value={formatNumber(cur.profit)}
          subtext="Sales − Purchases − Expenses"
          icon={Wallet}
          accent={{ text: 'text-blue-600', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' }}
          trend={{ value: percentChange(cur.profit, prev.profit) }}
        />
        <StatCard
          title="Total Customers"
          value={formatNumber(customers.length)}
          subtext={`+${cur.newCustomers} new this period`}
          icon={Users}
          accent={{ text: 'text-violet-600', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' }}
          trend={{ value: percentChange(cur.newCustomers, prev.newCustomers) }}
        />
        <StatCard
          title="Receivables (Due)"
          value={formatNumber(cur.receivables)}
          subtext="Outstanding from period sales"
          icon={AlertCircle}
          accent={{ text: 'text-amber-600', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20' }}
          trend={{ value: percentChange(cur.receivables, prev.receivables), invert: true }}
        />
        <StatCard
          title="Inventory Value"
          value={formatNumber(totalStockValue)}
          subtext={`${lowStockCount} items low on stock`}
          icon={Package}
          accent={{ text: 'text-slate-600', bg: 'bg-slate-500/10', ring: 'ring-slate-500/20' }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Financial Performance</h3>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {CHART_MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => setChartMode(m.key)}
                  className={clsx(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    chartMode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10}
                  interval="preserveStartEnd" minTickGap={24} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={formatCompact} width={48} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.15)' }}
                  formatter={(v: number) => formatNumber(v)}
                  cursor={{ stroke: '#9ca3af', strokeDasharray: '4 4' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="#10b981" strokeWidth={2.5} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorPurchases)" />
                <Area type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-gray-900">Period Breakdown</h3>
          <p className="mb-5 text-xs text-gray-400">{range.label}</p>
          <div className="flex-1 space-y-4">
            {breakdown.map(item => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">{item.label}</span>
                  <span className={clsx('text-sm font-bold', item.text)}>{formatNumber(item.value)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className={clsx('h-2 rounded-full transition-all', item.color)}
                    style={{ width: `${Math.max((item.value / breakdownMax) * 100, item.value > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-gray-700">Net Profit</span>
            <span className={clsx('text-lg font-bold', cur.profit >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {formatNumber(cur.profit)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-gray-900">Top Selling Products</h3>
          <p className="-mt-3 mb-4 text-xs text-gray-400">{range.label}</p>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No sales in this period</div>
            ) : (
              topProducts.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.qty} sold</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(item.qty / topProducts[0].qty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Recent Transactions</h3>
            <button className="text-sm font-medium text-blue-600 hover:underline">View All</button>
          </div>
          <RecentActivityTable transactions={recentActivity} />
        </div>
      </div>

      <Modal open={isTxModalOpen} onOpenChange={setIsTxModalOpen} title="New Transaction">
        <TransactionForm onSave={handleAddTransaction} onCancel={() => setIsTxModalOpen(false)} />
      </Modal>
    </div>
  );
};
