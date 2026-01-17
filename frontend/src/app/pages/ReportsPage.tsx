import { useState } from 'react';
import { useStore } from '../../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const ReportsPage = () => {
  const { hasPermission } = useStore();
  const [reportType, setReportType] = useState('sales');

  if (!hasPermission('report.view')) return <div>Access Denied</div>;

  const data = [
    { name: 'Mon', value: 4000 },
    { name: 'Tue', value: 3000 },
    { name: 'Wed', value: 2000 },
    { name: 'Thu', value: 2780 },
    { name: 'Fri', value: 1890 },
    { name: 'Sat', value: 2390 },
    { name: 'Sun', value: 3490 },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {['Sales Report', 'Purchase Report', 'Stock Report', 'Profit/Loss'].map((r) => (
          <button
            key={r}
            onClick={() => setReportType(r.toLowerCase().split(' ')[0])}
            className={`px-3 py-1.5 text-xs font-medium rounded ${reportType === r.toLowerCase().split(' ')[0] ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white rounded border border-gray-200 p-4 min-w-0 flex flex-col">
        <h3 className="text-sm font-bold text-gray-700 uppercase mb-4 shrink-0">{reportType.toUpperCase()} Overview</h3>
        <div className="relative h-64 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6">
          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Detailed Data</h4>
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Customer/Supplier</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td className="px-3 py-2">2024-01-0{i}</td>
                  <td className="px-3 py-2">INV-00{i}</td>
                  <td className="px-3 py-2">Client {String.fromCharCode(64 + i)}</td>
                  <td className="px-3 py-2 text-right">${(Math.random() * 1000).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
