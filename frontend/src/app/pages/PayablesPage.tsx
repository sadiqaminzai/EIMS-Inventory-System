import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  supplierApi,
  PendingSupplierRowDto,
  SupplierAgingDto,
  SupplierLedgerDto,
  SupplierPendingSummaryDto,
} from '../../api/suppliers';
import { useStore } from '../../store';
import { DenseTable } from '../components/ui/DenseTable';
import { Modal } from '../components/ui/Modal';

const formatAmount = (value: number) => Number(value || 0).toFixed(2);

export const PayablesPage = () => {
  const { hasPermission } = useStore();
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const ledgerPageSize = 12;

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<SupplierPendingSummaryDto | null>(null);
  const [aging, setAging] = useState<SupplierAgingDto | null>(null);

  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [activeLedger, setActiveLedger] = useState<SupplierLedgerDto | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const [pendingData, agingData] = await Promise.all([
        supplierApi.pendingSummary(),
        supplierApi.aging(asOfDate),
      ]);

      setPendingSummary(pendingData);
      setAging(agingData);
    } catch {
      toast.error('Failed to load payable tracking data');
    } finally {
      setOverviewLoading(false);
    }
  };

  const openLedger = async (supplierId: number) => {
    setLedgerLoading(true);
    try {
      const ledger = await supplierApi.ledger(supplierId);
      setActiveLedger(ledger);
      setLedgerPage(1);
    } catch {
      toast.error('Failed to load supplier ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const pendingRows = useMemo(
    () => pendingSummary?.suppliers ?? [],
    [pendingSummary]
  );

  const agingRows = useMemo(
    () => aging?.suppliers ?? [],
    [aging]
  );

  const canViewPayables = hasPermission('supplier.view') || hasPermission('purchase.view') || hasPermission('invoices.view');
  const canStartPayment = hasPermission('account.transactions.create') || hasPermission('account.transaction.payment');

  if (!canViewPayables) {
    return <div>Access Denied</div>;
  }

  const openPaymentFromLedger = (params: {
    dueAmount: number;
    orderId?: number;
    invoiceNo?: string;
    autoAllocate: boolean;
  }) => {
    if (!activeLedger || params.dueAmount <= 0) return;

    navigate('/accounts', {
      state: {
        openPaymentWith: {
          payment_type: 'payable',
          supplier_id: Number(activeLedger.supplier.id),
          supplier_name: activeLedger.supplier.name,
          order_id: params.orderId,
          invoice_no: params.invoiceNo,
          due_amount: Number(params.dueAmount || 0),
          auto_allocate: params.autoAllocate,
        },
      },
    });
  };

  const handlePayNow = (order: SupplierLedgerDto['orders'][number]) => {
    openPaymentFromLedger({
      dueAmount: Number(order.due_amount || 0),
      orderId: Number(order.id),
      invoiceNo: order.serial_no,
      autoAllocate: false,
    });
  };

  const handlePayWithoutInvoice = () => {
    if (!activeLedger) return;

    openPaymentFromLedger({
      dueAmount: Number(activeLedger.summary.total_due || 0),
      autoAllocate: true,
    });
  };

  const ledgerOrders = activeLedger?.orders || [];
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerOrders.length / ledgerPageSize));
  const currentLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
  const paginatedLedgerOrders = ledgerOrders.slice(
    (currentLedgerPage - 1) * ledgerPageSize,
    currentLedgerPage * ledgerPageSize
  );
  const ledgerStart = ledgerOrders.length === 0 ? 0 : ((currentLedgerPage - 1) * ledgerPageSize) + 1;
  const ledgerEnd = Math.min(currentLedgerPage * ledgerPageSize, ledgerOrders.length);

  const pendingColumns = [
    {
      header: 'Supplier',
      accessorKey: 'supplier_name' as keyof PendingSupplierRowDto,
      sortable: true,
    },
    {
      header: 'Open Invoices',
      accessorKey: 'open_orders' as keyof PendingSupplierRowDto,
      sortable: true,
    },
    {
      header: 'Total Due',
      accessorKey: 'total_due' as keyof PendingSupplierRowDto,
      sortable: true,
      cell: (row: PendingSupplierRowDto) => (
        <span className="font-semibold text-red-600">{formatAmount(row.total_due)}</span>
      ),
    },
    {
      header: 'Actions',
      cell: (row: PendingSupplierRowDto) => (
        <button
          type="button"
          onClick={() => void openLedger(row.supplier_id)}
          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
        >
          <Eye className="h-3.5 w-3.5" />
          Ledger
        </button>
      ),
    },
  ];

  const agingColumns = [
    {
      header: 'Supplier',
      accessorKey: 'supplier_name' as const,
      sortable: true,
    },
    {
      header: '0-30',
      accessorKey: '0_30' as const,
      sortable: true,
      cell: (row: any) => formatAmount(row['0_30']),
    },
    {
      header: '31-60',
      accessorKey: '31_60' as const,
      sortable: true,
      cell: (row: any) => formatAmount(row['31_60']),
    },
    {
      header: '61-90',
      accessorKey: '61_90' as const,
      sortable: true,
      cell: (row: any) => formatAmount(row['61_90']),
    },
    {
      header: '90+',
      accessorKey: '90_plus' as const,
      sortable: true,
      cell: (row: any) => <span className="font-semibold text-red-600">{formatAmount(row['90_plus'])}</span>,
    },
    {
      header: 'Total Due',
      accessorKey: 'total_due' as const,
      sortable: true,
      cell: (row: any) => <span className="font-semibold">{formatAmount(row.total_due)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Payables Tracking</h2>
            <p className="text-xs text-gray-500">Track pending supplier purchase invoices, payment allocations, and aging buckets.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor="supplier-aging-as-of-date" className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">Aging As Of</label>
              <input
                id="supplier-aging-as-of-date"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                title="Aging as of date"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
              disabled={overviewLoading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {overviewLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="text-[11px] uppercase text-gray-500">Suppliers with Due</div>
            <div className="mt-1 text-lg font-bold text-gray-900">{pendingSummary?.total_suppliers ?? 0}</div>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="text-[11px] uppercase text-red-600">Total Payable</div>
            <div className="mt-1 text-lg font-bold text-red-700">{formatAmount(pendingSummary?.total_due ?? 0)}</div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="text-[11px] uppercase text-amber-600">Aging 61-90</div>
            <div className="mt-1 text-lg font-bold text-amber-700">{formatAmount(aging?.summary['61_90'] ?? 0)}</div>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <div className="text-[11px] uppercase text-red-600">Aging 90+</div>
            <div className="mt-1 text-lg font-bold text-red-700">{formatAmount(aging?.summary['90_plus'] ?? 0)}</div>
          </div>
        </div>
      </div>

      <DenseTable
        data={pendingRows}
        columns={pendingColumns as any}
        title="Supplier Pending Summary"
        canSearch
        canExport
        canAdd={false}
      />

      <DenseTable
        data={agingRows as any[]}
        columns={agingColumns as any}
        title="Supplier Aging"
        canSearch
        canExport
        canAdd={false}
      />

      <Modal
        open={!!activeLedger}
        onOpenChange={(open) => {
          if (!open) {
            setActiveLedger(null);
            setLedgerPage(1);
          }
        }}
        title={activeLedger ? `Ledger - ${activeLedger.supplier.name}` : 'Ledger'}
        size="xl"
      >
        {ledgerLoading && <div className="text-sm text-gray-500">Loading ledger...</div>}

        {!ledgerLoading && activeLedger && (
          <div className="space-y-4">
            {canStartPayment && Number(activeLedger.summary.total_due || 0) > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-[11px] text-blue-700">
                  Pay without selecting invoice uses auto allocation (FIFO). You can edit the amount before saving.
                </p>
                <button
                  type="button"
                  onClick={handlePayWithoutInvoice}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Pay Without Invoice
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-gray-200 p-2">
                <div className="text-[11px] uppercase text-gray-500">Invoiced</div>
                <div className="text-sm font-semibold">{formatAmount(activeLedger.summary.total_invoiced)}</div>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-2">
                <div className="text-[11px] uppercase text-green-600">Paid</div>
                <div className="text-sm font-semibold text-green-700">{formatAmount(activeLedger.summary.total_paid)}</div>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2">
                <div className="text-[11px] uppercase text-red-600">Due</div>
                <div className="text-sm font-semibold text-red-700">{formatAmount(activeLedger.summary.total_due)}</div>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2">
                <div className="text-[11px] uppercase text-blue-600">Unallocated Payment</div>
                <div className="text-sm font-semibold text-blue-700">{formatAmount(activeLedger.summary.unallocated_payment)}</div>
              </div>
            </div>

            <div className="overflow-auto rounded-md border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Invoice</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Due</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Linked Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLedgerOrders.map((order) => (
                    <tr key={order.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{order.serial_no}</td>
                      <td className="px-3 py-2">{order.transaction_date || '-'}</td>
                      <td className="px-3 py-2 text-right">{formatAmount(order.net_amount)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{formatAmount(order.paid_amount)}</td>
                      <td className="px-3 py-2 text-right text-red-700">{formatAmount(order.due_amount)}</td>
                      <td className="px-3 py-2 uppercase">{order.payment_status}</td>
                      <td className="px-3 py-2">
                        {Number(order.due_amount || 0) > 0 && canStartPayment ? (
                          <button
                            type="button"
                            onClick={() => handlePayNow(order)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Pay Invoice
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {order.allocations.length > 0 ? (
                          <div className="space-y-1">
                            {order.allocations.map((allocation) => (
                              <div key={allocation.id} className="rounded bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                                {allocation.payment_serial || `Payment #${allocation.payment_id}`} - {formatAmount(allocation.allocated_amount)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No allocation yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ledgerOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                        No invoices found for this supplier.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {ledgerOrders.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                <span>
                  Showing {ledgerStart} to {ledgerEnd} of {ledgerOrders.length} invoices
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLedgerPage((page) => Math.max(1, page - 1))}
                    disabled={currentLedgerPage === 1}
                    className="rounded border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span>Page {currentLedgerPage} / {ledgerTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setLedgerPage((page) => Math.min(ledgerTotalPages, page + 1))}
                    disabled={currentLedgerPage >= ledgerTotalPages}
                    className="rounded border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
