import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useStore, Account, Transaction, Payment } from '../../store';
import { Button } from '../components/ui/button';
import { DenseTable } from '../components/ui/DenseTable';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useForm, Controller } from 'react-hook-form';
import { Plus, Wallet, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Building2, Smartphone, Banknote, Paperclip, Scan, Calendar, Filter, Save, X, Printer } from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { formatDateTime, formatDateTimeLong } from '../utils/dateTime';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Combobox } from '../components/ui/Combobox';
import { TransactionForm } from '../components/forms/TransactionForm';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { paymentApi } from '../../api/payments';
import { FinancePage, FinanceTab } from './FinancePage';

type LedgerPaymentPrefillState = {
    openPaymentWith?: {
        payment_type?: 'receivable' | 'payable';
        customer_id?: number;
        customer_name?: string;
        supplier_id?: number;
        supplier_name?: string;
        order_id?: number;
        invoice_no?: string;
        due_amount: number;
        auto_allocate?: boolean;
    };
};

type AccountsTab = 'accounts' | 'transactions' | FinanceTab;
const financeTabIds: FinanceTab[] = ['expenses', 'expense-categories', 'other-income', 'other-income-categories'];

// --- Account Form ---
const AccountForm = ({ initialData, onSave, onCancel }: { initialData?: Account, onSave: (data: any) => void, onCancel: () => void }) => {
    const { register, handleSubmit, formState: { errors }, watch } = useForm({ 
        defaultValues: initialData || { type: 'Cash', currency: 'USD', status: 'active', balance: 0 } 
    });
    const type = watch('type');

    return (
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <DenseInput label="Account Name" {...register('name', { required: 'Required' })} error={errors.name?.message?.toString()} placeholder="e.g. Main Cash, Chase Bank" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DenseSelect 
                    label="Type"  
                    options={[
                        { value: 'Cash', label: 'Cash' },
                        { value: 'Bank', label: 'Bank' },
                        { value: 'Mobile Money', label: 'Mobile Money' }
                    ]}
                    {...register('type')} 
                />
                <DenseInput label="Currency" {...register('currency')} />
            </div>

            {type !== 'Cash' && (
                <DenseInput label="Account Number" {...register('account_number')} />
            )}

            {!initialData && (
                <DenseInput label="Opening Balance" type="number" step="0.01" {...register('balance', { valueAsNumber: true })} />
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                <Button type="button" variant="outline" onClick={onCancel} size="sm" className="gap-2">
                    <X size={14} /> Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                    <Save size={14} /> Save
                </Button>
            </div>
        </form>
    );
};

// --- Account Details View ---
const AccountDetails = ({ account }: { account: Account }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <div className={clsx("text-3xl font-bold", account.balance < 0 ? "text-red-600" : "text-emerald-600")}>
                        {account.currency} {account.balance.toLocaleString()}
                    </div>
                </div>
                <div className={clsx("p-3 rounded-full", 
                    account.type === 'Bank' ? "bg-blue-100 text-blue-600" : 
                    account.type === 'Mobile Money' ? "bg-purple-100 text-purple-600" : 
                    "bg-green-100 text-green-600"
                )}>
                    {account.type === 'Bank' ? <Building2 size={32} /> : account.type === 'Mobile Money' ? <Smartphone size={32} /> : <Banknote size={32} />}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Account Name</label>
                    <p className="mt-1 font-medium text-gray-900">{account.name}</p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Status</label>
                    <p className="mt-1">
                        <span className={clsx("px-2 py-0.5 rounded text-xs font-medium capitalize", 
                            account.status === 'active' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                            {account.status}
                        </span>
                    </p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Currency</label>
                    <p className="mt-1 font-medium text-gray-900">{account.currency}</p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Type</label>
                    <p className="mt-1 font-medium text-gray-900">{account.type}</p>
                </div>
                {account.account_number && (
                    <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Account Number</label>
                        <p className="mt-1 font-mono text-gray-900 bg-gray-50 p-2 rounded border border-gray-200 inline-block">
                            {account.account_number}
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mt-2">
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Created</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{account.created_by || 'System'}</p>
                        <p className="text-gray-400">{formatDateTimeLong(account.created_at)}</p>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{account.updated_by || 'System'}</p>
                        <p className="text-gray-400">{formatDateTimeLong(account.updated_at)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Transaction Details View ---
const TransactionDetails = ({ transaction, accounts, customers }: { transaction: Transaction, accounts: Account[], customers: any[] }) => {
    const acc = accounts.find(a => a.id === transaction.account_id);
    const toAcc = transaction.to_account_id ? accounts.find(a => a.id === transaction.to_account_id) : null;
    const customer = customers.find(c => c.id === transaction.contact_id);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                    <p className="text-sm text-gray-500 mb-1">Amount</p>
                    <div className={clsx("text-3xl font-bold", 
                        transaction.type === 'Income' ? "text-green-600" : 
                        transaction.type === 'Expense' ? "text-red-600" : 
                        "text-blue-600"
                    )}>
                        {transaction.type === 'Expense' ? '-' : '+'}
                        {transaction.currency} {transaction.amount.toLocaleString()}
                    </div>
                </div>
                <div className={clsx("p-3 rounded-full",
                    transaction.type === 'Income' ? "bg-green-100 text-green-700" :
                    transaction.type === 'Expense' ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                )}>
                    {transaction.type === 'Income' ? <ArrowDownLeft size={32} /> : 
                     transaction.type === 'Expense' ? <ArrowUpRight size={32} /> : 
                     <ArrowRightLeft size={32} />}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Date</label>
                    <p className="mt-1 font-medium text-gray-900">{format(new Date(transaction.date), 'MMMM dd, yyyy')}</p>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Type</label>
                    <p className="mt-1 font-medium text-gray-900">{transaction.type}</p>
                </div>

                <div className="col-span-2 border-t border-gray-100 my-2 pt-4">
                     {transaction.type === 'Transfer' ? (
                        <div className="flex items-center gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">From</label>
                                <p className="mt-1 font-medium text-gray-900">{acc?.name}</p>
                            </div>
                            <div className="text-gray-400">→</div>
                            <div>
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">To</label>
                                <p className="mt-1 font-medium text-gray-900">{toAcc?.name}</p>
                            </div>
                        </div>
                     ) : (
                         <div>
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Account</label>
                            <p className="mt-1 font-medium text-gray-900">{acc?.name} ({acc?.currency})</p>
                        </div>
                     )}
                </div>

                {transaction.type === 'Income' && customer && (
                    <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</label>
                        <p className="mt-1 font-medium text-gray-900">{customer.name}</p>
                    </div>
                )}

                {transaction.type === 'Expense' && transaction.category && (
                    <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Category</label>
                        <p className="mt-1 font-medium text-gray-900">{transaction.category}</p>
                    </div>
                )}

                {transaction.description && (
                    <div className="col-span-2">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Description</label>
                        <p className="mt-1 text-gray-700 bg-gray-50 p-3 rounded-md text-sm">{transaction.description}</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mt-2">
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Created</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{transaction.created_by || 'System'}</p>
                        <p className="text-gray-400">{formatDateTimeLong(transaction.created_at)}</p>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{transaction.updated_by || 'System'}</p>
                        <p className="text-gray-400">{formatDateTimeLong(transaction.updated_at)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PaymentDetails = ({ payment, tenant, accounts, customers, suppliers, onClose }: { payment: Payment, tenant: any, accounts: Account[], customers: any[], suppliers: any[], onClose: () => void }) => {
    const account = accounts.find(a => a.id === payment.account_id);
    const paymentType = (payment as any).payment_type === 'payable' ? 'payable' : 'receivable';
    const partyLabel = paymentType === 'payable' ? 'Supplier' : 'Customer';
    const paymentTitle = paymentType === 'payable' ? 'PAYMENT VOUCHER' : 'PAYMENT RECEIPT';

    const formatDate = (value?: string | null) => value ? format(new Date(value), 'PPP') : '-';
    const resolvePartyName = (detail: any) => {
        if (paymentType === 'payable') {
            return suppliers.find((s) => String(s.id) === String(detail.supplier_id || ''))?.name || '-';
        }

        return customers.find((c) => String(c.id) === String(detail.customer_id || ''))?.name || '-';
    };

    const totalPaid = (payment.details || []).reduce((sum, d) => sum + Number(d.credit_amount || 0), 0);
    const totalDue = (payment.details || []).reduce((sum, d) => sum + Number(d.debit_amount || 0), 0);
    const totalBalance = (payment.details || []).reduce((sum, d) => sum + Number(d.balance_amount || 0), 0);
    const currencySymbol = payment.currency === 'AFN' ? '؋' : '$';

    return (
                <div className="flex flex-col h-full bg-gray-100">
                        <style>
                                {`
                                @media print {
                                    @page { size: A4; margin: 8mm; }
                          body * { visibility: hidden !important; }
                          .payment-print-only, .payment-print-only * { visibility: visible !important; }
                          .payment-print-only {
                            position: fixed !important;
                            top: 0;
                            left: 0;
                            width: 210mm !important;
                            min-height: 297mm !important;
                            background: white !important;
                          }
                                    .payment-print {
                                        width: calc(210mm - 16mm) !important;
                                        min-height: calc(297mm - 16mm) !important;
                                        margin: 0 auto !important;
                                        box-shadow: none !important;
                                        transform: none !important;
                                        position: relative !important;
                                    }
                                    .payment-scroll {
                                        overflow: visible !important;
                                        height: auto !important;
                                    }
                                }
                                `}
                        </style>

                    <div className="payment-print-only">
                        <div className="payment-print bg-white w-full min-h-[297mm]">
                            <div className="p-6 flex flex-col min-h-[297mm]">
                                <div className="flex items-start justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        {tenant?.logo ? (
                                            <div className="h-16 w-16 rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                                                <ImageWithFallback src={tenant.logo} alt={tenant?.name || 'Owner'} className="h-full w-full object-cover" />
                                            </div>
                                        ) : null}
                                        <div>
                                            <div className="text-xl font-bold text-gray-900">{tenant?.name || 'Owner'}</div>
                                            <div className="text-xs text-gray-500 space-y-0.5">
                                                <div>{tenant?.address || '-'}</div>
                                                <div>{tenant?.phone || '-'} {tenant?.email ? `| ${tenant.email}` : ''}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right pr-2">
                                        <div className="text-[20px] font-bold text-blue-600 leading-tight">{paymentTitle}</div>
                                        <div className="text-xs text-gray-500">Serial: {payment.serial_no || payment.id}</div>
                                        <div className="text-xs text-gray-500">Date: {formatDate(payment.date)}</div>
                                        <div className="text-xs text-gray-500">Printed: {formatDateTime(new Date().toISOString())}</div>
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden mt-4">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-600">
                                            <tr>
                                                <th className="px-3 py-2 text-left w-12">S.No</th>
                                                <th className="px-3 py-2 text-left">{partyLabel}</th>
                                                <th className="px-3 py-2 text-right w-28">Due</th>
                                                <th className="px-3 py-2 text-right w-28">Paid</th>
                                                <th className="px-3 py-2 text-right w-28">Balance</th>
                                                <th className="px-3 py-2 text-left">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(payment.details || []).map((d, idx) => {
                                                return (
                                                    <tr key={`print-${(d as any).customer_id ?? (d as any).supplier_id ?? idx}-${idx}`}>
                                                        <td className="px-3 py-2">{idx + 1}</td>
                                                        <td className="px-3 py-2">{resolvePartyName(d)}</td>
                                                        <td className="px-3 py-2 text-right">{Number(d.debit_amount || 0).toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right">{Number(d.credit_amount || 0).toFixed(2)}</td>
                                                        <td className="px-3 py-2 text-right">{Number(d.balance_amount || 0).toFixed(2)}</td>
                                                        <td className="px-3 py-2">{d.remarks || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className="flex items-center justify-end gap-6 px-3 py-2 border-t bg-gray-50 text-xs text-gray-700">
                                        <div><span className="font-semibold">Total Due:</span> {currencySymbol} {totalDue.toFixed(2)}</div>
                                        <div><span className="font-semibold">Total Paid:</span> {currencySymbol} {totalPaid.toFixed(2)}</div>
                                        <div><span className="font-semibold">Total Balance:</span> {currencySymbol} {totalBalance.toFixed(2)}</div>
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 pb-12">
                                    {payment.notes?.trim() ? (
                                        <div className="border rounded-lg p-4">
                                            <div className="text-xs text-gray-500">Notes</div>
                                            <div className="text-sm">{payment.notes}</div>
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-3 gap-8 pt-8">
                                        <div className="border-t border-gray-300 pt-2 text-xs">
                                            Salesman Signature
                                            <div className="text-[11px] text-gray-500 mt-1">{payment.salesman || '-'}</div>
                                        </div>
                                        <div />
                                        <div className="border-t border-gray-300 pt-2 text-xs">
                                            Booker Signature
                                            <div className="text-[11px] text-gray-500 mt-1">{payment.booker || '-'}</div>
                                        </div>
                                    </div>

                                    <div className="payment-footer text-xs text-gray-500 mt-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>Printed: {formatDateTime(new Date().toISOString())}</div>
                                            <div>Created: {formatDateTime(payment.created_at)}</div>
                                            <div>Updated: {formatDateTime(payment.updated_at)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                        <div className="payment-scroll flex-1 overflow-auto flex justify-center p-0">
                                <div className="payment-print bg-white shadow-lg h-fit w-full max-w-[210mm] min-h-[297mm] scale-[0.97] origin-top my-4 print:m-0 print:p-0 print:h-auto print:scale-100 print:shadow-none print:z-[9999]">
                    <div className="p-6 flex flex-col min-h-[297mm]">
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex items-center gap-4">
                                {tenant?.logo ? (
                                    <div className="h-16 w-16 rounded-md overflow-hidden border border-gray-200 bg-gray-50">
                                        <ImageWithFallback src={tenant.logo} alt={tenant?.name || 'Owner'} className="h-full w-full object-cover" />
                                    </div>
                                ) : null}
                                <div>
                                    <div className="text-xl font-bold text-gray-900">{tenant?.name || 'Owner'}</div>
                                    <div className="text-xs text-gray-500 space-y-0.5">
                                        <div>{tenant?.address || '-'}</div>
                                        <div>{tenant?.phone || '-'} {tenant?.email ? `| ${tenant.email}` : ''}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pr-2">
                                <div className="text-[20px] font-bold text-blue-600 leading-tight">{paymentTitle}</div>
                                <div className="text-xs text-gray-500">Serial: {payment.serial_no || payment.id}</div>
                                <div className="text-xs text-gray-500">Date: {formatDate(payment.date)}</div>
                                <div className="text-xs text-gray-500">Printed: {formatDateTime(new Date().toISOString())}</div>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-12">S.No</th>
                                        <th className="px-3 py-2 text-left">{partyLabel}</th>
                                        <th className="px-3 py-2 text-right w-28">Due</th>
                                        <th className="px-3 py-2 text-right w-28">Paid</th>
                                        <th className="px-3 py-2 text-right w-28">Balance</th>
                                        <th className="px-3 py-2 text-left">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {(payment.details || []).map((d, idx) => {
                                        return (
                                            <tr key={`${(d as any).customer_id ?? (d as any).supplier_id ?? idx}-${idx}`}>
                                                <td className="px-3 py-2">{idx + 1}</td>
                                                <td className="px-3 py-2">{resolvePartyName(d)}</td>
                                                <td className="px-3 py-2 text-right">{Number(d.debit_amount || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right">{Number(d.credit_amount || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right">{Number(d.balance_amount || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2">{d.remarks || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="flex items-center justify-end gap-6 px-3 py-2 border-t bg-gray-50 text-xs text-gray-700">
                                <div><span className="font-semibold">Total Due:</span> {currencySymbol} {totalDue.toFixed(2)}</div>
                                <div><span className="font-semibold">Total Paid:</span> {currencySymbol} {totalPaid.toFixed(2)}</div>
                                <div><span className="font-semibold">Total Balance:</span> {currencySymbol} {totalBalance.toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="mt-auto pt-6 pb-12">
                            {payment.notes?.trim() ? (
                                <div className="border rounded-lg p-4">
                                    <div className="text-xs text-gray-500">Notes</div>
                                    <div className="text-sm">{payment.notes}</div>
                                </div>
                            ) : null}

                            <div className="grid grid-cols-3 gap-8 pt-8">
                                <div className="border-t border-gray-300 pt-2 text-xs">
                                    Salesman Signature
                                    <div className="text-[11px] text-gray-500 mt-1">{payment.salesman || '-'}</div>
                                </div>
                                <div />
                                <div className="border-t border-gray-300 pt-2 text-xs">
                                    Booker Signature
                                    <div className="text-[11px] text-gray-500 mt-1">{payment.booker || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="payment-footer text-xs text-gray-500 mt-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>Printed: {formatDateTime(new Date().toISOString())}</div>
                                <div>Created: {formatDateTime(payment.created_at)}</div>
                                <div>Updated: {formatDateTime(payment.updated_at)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white gap-4 shrink-0 z-10 print:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                        <span className="block font-semibold">Created By</span>
                        {payment.created_by || 'System'}
                    </div>
                    <div>
                        <span className="block font-semibold">Created At</span>
                        {formatDateTime(payment.created_at)}
                    </div>
                    <div>
                        <span className="block font-semibold">Updated By</span>
                        {payment.updated_by || 'System'}
                    </div>
                    <div>
                        <span className="block font-semibold">Updated At</span>
                        {formatDateTime(payment.updated_at)}
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const AccountsPage = () => {
    // Attempt to destructure updateTransaction. If it's missing in store type but present in runtime, this works.
    // If missing in runtime, we'll handle it carefully.
    const store = useStore();
    const { accounts, transactions, addAccount, updateAccount, deleteAccount, addTransaction, addPayment, updatePayment, deleteTransaction, hasPermission, customers, suppliers, tenant, currentUser } = store;
    const location = useLocation();
    const navigate = useNavigate();
    
    // Fallback for updateTransaction if it doesn't exist in store
    const updateTransaction = (store as any).updateTransaction || ((id: string, data: any) => {
        console.warn('updateTransaction not implemented in store', id, data);
        alert('Update transaction feature is not available in the backend yet.');
    });

    const tabs = [
        { id: 'transactions' as const, label: 'Transactions', perm: 'account.transactions.view' },
        { id: 'accounts' as const, label: 'Accounts', perm: 'account.accounts.view' },
        { id: 'expenses' as const, label: 'Expenses', perm: 'account.transactions.view' },
        { id: 'expense-categories' as const, label: 'Expense Categories', perm: 'account.transactions.view' },
        { id: 'other-income' as const, label: 'Other Income', perm: 'account.transactions.view' },
        { id: 'other-income-categories' as const, label: 'Other Income Categories', perm: 'account.transactions.view' }
    ];
    const visibleTabs = tabs.filter((tab) => hasPermission(tab.perm as any));
    const [activeTab, setActiveTab] = useState<AccountsTab>(
        (visibleTabs[0]?.id as AccountsTab) || 'transactions'
    );

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.id === activeTab)) {
            setActiveTab(visibleTabs[0].id as AccountsTab);
        }
    }, [visibleTabs, activeTab]);

    useEffect(() => {
        const prefill = (location.state as LedgerPaymentPrefillState | null)?.openPaymentWith;
        if (!prefill) return;

        const prefillType = prefill.payment_type === 'payable' ? 'payable' : 'receivable';

        const fallbackAccount =
            accounts.find((account) => /cash in hand/i.test(account.name)) ||
            accounts.find((account) => account.type === 'Cash') ||
            accounts[0];

        const dueAmount = Number(prefill.due_amount || 0);
        const paidNow = dueAmount > 0 ? dueAmount.toFixed(2) : '';
        const shouldAutoAllocate = prefill.auto_allocate ?? !prefill.order_id;

        setPaymentPrefill({
            date: new Date().toISOString().split('T')[0],
            type: 'Payment',
            payment_type: prefillType,
            payment_method: 'Cash',
            currency: fallbackAccount?.currency || 'USD',
            account_id: fallbackAccount?.id || '',
            salesman: '',
            booker: currentUser?.name || '',
            notes: prefill.invoice_no
                ? (prefillType === 'payable'
                    ? `Payment made for ${prefill.invoice_no}`
                    : `Payment received for ${prefill.invoice_no}`)
                : (prefillType === 'payable'
                    ? (prefill.supplier_name ? `Payment made to ${prefill.supplier_name}` : '')
                    : (prefill.customer_name ? `Payment received from ${prefill.customer_name}` : '')),
            payment_details: [
                {
                    customer_id: prefillType === 'receivable' ? String(prefill.customer_id ?? '') : '',
                    supplier_id: prefillType === 'payable' ? String(prefill.supplier_id ?? '') : '',
                    paid_now: paidNow,
                    remarks: prefill.invoice_no ? `Against ${prefill.invoice_no}` : '',
                    auto_allocate: shouldAutoAllocate,
                    allocations: !shouldAutoAllocate && prefill.order_id
                        ? [{ order_id: String(prefill.order_id), amount: paidNow || '' }]
                        : [],
                },
            ],
        });

        setEditingTransaction(undefined);
        setEditingPayment(undefined);
        setActiveTab('transactions');
        setIsTransactionModalOpen(true);

        navigate(location.pathname, { replace: true, state: null });
    }, [location.state, location.pathname, navigate, accounts, currentUser?.name]);
    
    // Account Modals
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isViewAccountModalOpen, setIsViewAccountModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | undefined>(undefined);
    const [viewingAccount, setViewingAccount] = useState<Account | undefined>(undefined);
    
    // Transaction Modals
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isViewTransactionModalOpen, setIsViewTransactionModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
    const [viewingTransaction, setViewingTransaction] = useState<Transaction | undefined>(undefined);
    const [editingPayment, setEditingPayment] = useState<Payment | undefined>(undefined);
    const [viewingPayment, setViewingPayment] = useState<Payment | undefined>(undefined);
    const [paymentPrefill, setPaymentPrefill] = useState<any | undefined>(undefined);
        const isPaymentTransaction = (item: Transaction) => (item.type === 'Income' || item.type === 'Expense')
            && (item.category === 'Customer Receipts' || item.category === 'Supplier Payments');

        const handleViewTransaction = async (item: Transaction) => {
            const isPaymentTx = isPaymentTransaction(item);

            if (isPaymentTx && item.reference_id) {
                try {
                    const payment = await paymentApi.getBySerial(item.reference_id);
                    setViewingPayment(payment as any);
                    return;
                } catch {
                    if (!Number.isNaN(Number(item.reference_id))) {
                        try {
                            const payment = await paymentApi.get(Number(item.reference_id));
                            setViewingPayment(payment as any);
                            return;
                        } catch {
                            // fall through to transaction view
                        }
                    }
                }
            }

            setViewingTransaction(item);
            setIsViewTransactionModalOpen(true);
        };
    
    // Deletion
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'account' | 'transaction'>('account');

    // Date Filter State
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    const handleEditTransaction = async (item: Transaction) => {
        setPaymentPrefill(undefined);
        setEditingTransaction(item);
        setEditingPayment(undefined);

        const isPaymentTx = isPaymentTransaction(item);

        if (isPaymentTx && item.reference_id) {
            try {
                const payment = await paymentApi.getBySerial(item.reference_id);
                setEditingPayment(payment as any);
            } catch {
                if (!Number.isNaN(Number(item.reference_id))) {
                    try {
                        const payment = await paymentApi.get(Number(item.reference_id));
                        setEditingPayment(payment as any);
                    } catch {
                        setEditingPayment(undefined);
                    }
                } else {
                    setEditingPayment(undefined);
                }
            }
        }

        setIsTransactionModalOpen(true);
    };

    if (!hasPermission('account.view')) return <div>Access Denied</div>;
    if (visibleTabs.length === 0) return <div>Access Denied</div>;

    // --- Calculations ---

    // 1. Current Total Balances (Split by Currency) - derived from Accounts
    const totalBalanceUSD = accounts
        .filter(acc => acc.currency === 'USD')
        .reduce((sum, acc) => sum + acc.balance, 0);
    
    const totalBalanceAFN = accounts
        .filter(acc => acc.currency === 'AFN')
        .reduce((sum, acc) => sum + acc.balance, 0);

    // 2. Filter Transactions by Date
    const filteredTransactions = transactions.filter(t => {
        const tDate = parseISO(t.date);
        return isWithinInterval(tDate, {
            start: parseISO(dateRange.start),
            end: parseISO(dateRange.end)
        });
    });

    const accountLedgerTransactions = filteredTransactions
        .filter((transaction) => transaction.type === 'Transfer' || isPaymentTransaction(transaction));

    // 3. Calculate Income/Expenses from Filtered Transactions (Split by Currency)
    const incomeUSD = filteredTransactions
        .filter(t => t.type === 'Income' && t.currency === 'USD')
        .reduce((sum, t) => sum + t.amount, 0);

    const incomeAFN = filteredTransactions
        .filter(t => t.type === 'Income' && t.currency === 'AFN')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenseUSD = filteredTransactions
        .filter(t => t.type === 'Expense' && t.currency === 'USD')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenseAFN = filteredTransactions
        .filter(t => t.type === 'Expense' && t.currency === 'AFN')
        .reduce((sum, t) => sum + t.amount, 0);


    const accountColumns = [
        {
            header: 'Name',
            accessorKey: 'name' as keyof Account,
            sortable: true,
            cell: (item: Account) => (
                <div className="flex items-center gap-3">
                    <div className={clsx("p-2 rounded-lg", 
                        item.type === 'Bank' ? "bg-blue-100 text-blue-600" : 
                        item.type === 'Mobile Money' ? "bg-purple-100 text-purple-600" : 
                        "bg-green-100 text-green-600"
                    )}>
                        {item.type === 'Bank' ? <Building2 size={16} /> : item.type === 'Mobile Money' ? <Smartphone size={16} /> : <Banknote size={16} />}
                    </div>
                    <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.account_number || item.type}</div>
                    </div>
                </div>
            )
        },
        { header: 'Currency', accessorKey: 'currency' as keyof Account, sortable: true },
        { 
            header: 'Balance', 
            accessorKey: 'balance' as keyof Account,
            sortable: true,
            cell: (item: Account) => (
                <span className={clsx("font-bold", item.balance < 0 ? "text-red-600" : "text-green-700")}>
                    {item.currency} {item.balance.toLocaleString()}
                </span>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status' as keyof Account,
            sortable: true,
            cell: (item: Account) => (
                <span className={clsx("px-2 py-0.5 rounded text-xs font-medium capitalize", 
                    item.status === 'active' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                    {item.status}
                </span>
            )
        },
        {
            header: 'Actions',
            width: '120px',
            cell: (item: Account) => (
                <ActionButtons 
                    onView={hasPermission('account.accounts.view') ? () => { setViewingAccount(item); setIsViewAccountModalOpen(true); } : undefined}
                    onEdit={hasPermission('account.accounts.edit') ? () => { setEditingAccount(item); setIsAccountModalOpen(true); } : undefined}
                    onDelete={hasPermission('account.accounts.delete') ? () => { setDeleteId(item.id); setDeleteType('account'); } : undefined}
                />
            )
        }
    ];

    const resolveTransactionCustomerName = (transaction: Transaction) => {
        const directCustomer = customers.find(c => String(c.id) === String(transaction.contact_id || ''));
        if (directCustomer?.name) return directCustomer.name;

        const description = String(transaction.description || '').trim();
        if (description) {
            const fromMatch = description.match(/payment\s+received\s+from\s+(.+)/i);
            if (fromMatch?.[1]) {
                return fromMatch[1].trim();
            }

            const forMatch = description.match(/payment\s+received\s+for\s+(\d+)/i);
            if (forMatch?.[1]) {
                const byId = customers.find(c => String(c.id) === String(forMatch[1]));
                if (byId?.name) return byId.name;
            }
        }

        if (transaction.reference_id) {
            const byReferenceId = customers.find(c => String(c.id) === String(transaction.reference_id));
            if (byReferenceId?.name) return byReferenceId.name;
        }

        return '';
    };

    const enrichedTransactions = accountLedgerTransactions.map(t => {
        const customerName = resolveTransactionCustomerName(t);
        const acc = accounts.find(a => a.id === t.account_id);
        const toAcc = t.to_account_id ? accounts.find(a => a.id === t.to_account_id) : null;
        
        let details = t.description || '';
        if (customerName) details += ` ${customerName}`;
        if (t.category) details += ` ${t.category}`;
        if (t.type === 'Transfer') details += ' Transfer';
        if (t.reference_id) details += ` ${t.reference_id}`;

        return {
            ...t,
            details_search: details,
            customer_name: customerName,
            account_name: acc?.name || '',
            to_account_name: toAcc?.name || ''
        };
    });

    const sortedTransactions = [...enrichedTransactions].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : new Date(a.date).getTime();
        const bTime = b.created_at ? new Date(b.created_at).getTime() : new Date(b.date).getTime();
        return bTime - aTime;
    });

    const isFinanceTabActive = financeTabIds.includes(activeTab as FinanceTab);

    const transactionColumns = [
        { 
            header: 'Date', 
            accessorKey: 'date' as keyof Transaction,
            sortable: true,
            cell: (item: Transaction) => format(new Date(item.date), 'MMM dd, yyyy')
        },
        {
            header: 'Type',
            accessorKey: 'type' as keyof Transaction,
            sortable: true,
            cell: (item: Transaction) => (
                <span className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium w-fit",
                    item.type === 'Income' ? "bg-green-100 text-green-700" :
                    item.type === 'Expense' ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                )}>
                    {item.type === 'Income' ? <ArrowDownLeft size={12} /> : 
                     item.type === 'Expense' ? <ArrowUpRight size={12} /> : 
                     <ArrowRightLeft size={12} />}
                    {item.type}
                </span>
            )
        },
        {
            header: 'Details',
            accessorKey: 'details_search', // Searchable key
            cell: (item: Transaction) => {
                const transactionWithCustomer = item as Transaction & { customer_name?: string };
                return (
                    <div>
                        <div className="font-medium text-gray-900">
                            {item.type === 'Income' && transactionWithCustomer.customer_name
                                ? transactionWithCustomer.customer_name
                                : (item.category || 'Transfer')}
                        </div>
                        <div className="text-xs text-gray-500">{item.description || '-'}</div>
                    </div>
                )
            }
        },
        {
            header: 'Customer',
            accessorKey: 'customer_name',
            sortable: true,
            cell: (item: any) => (
                <span className="text-xs">{item.customer_name || '-'}</span>
            )
        },
        {
            header: 'Account',
            accessorKey: 'account_name', // Searchable key
            sortable: true,
            cell: (item: Transaction) => {
                const acc = accounts.find(a => a.id === item.account_id);
                const toAcc = item.to_account_id ? accounts.find(a => a.id === item.to_account_id) : null;
                return (
                    <div className="text-xs">
                        <div>{acc?.name}</div>
                        {toAcc && <div className="text-gray-400">→ {toAcc.name}</div>}
                    </div>
                );
            }
        },
        {
            header: 'Amount',
            accessorKey: 'amount' as keyof Transaction,
            sortable: true,
            cell: (item: Transaction) => (
                <span className={clsx("font-bold", 
                    item.type === 'Income' ? "text-green-600" : 
                    item.type === 'Expense' ? "text-red-600" : 
                    "text-blue-600"
                )}>
                    {item.type === 'Expense' ? '-' : '+'}
                    {item.currency} {item.amount.toLocaleString()}
                </span>
            )
        },
        {
            header: 'Actions',
            width: '100px',
            cell: (item: Transaction) => (
                <ActionButtons 
                    onView={hasPermission('account.transactions.view') ? () => { handleViewTransaction(item); } : undefined}
                    onEdit={hasPermission('account.transactions.edit') ? () => { handleEditTransaction(item); } : undefined}
                    onDelete={hasPermission('account.transactions.delete') ? () => { setDeleteId(item.id); setDeleteType('transaction'); } : undefined}
                />
            )
        }
    ];

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="bg-white border-b border-gray-200 px-6 pt-2 rounded-t-lg shadow-sm shrink-0">
                 <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-gray-500" />
                        <h1 className="text-xl font-bold text-gray-900">Accounts & Finance</h1>
                    </div>
                    {/* Date filter aligned to the right inside the header */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                        <Calendar size={16} className="text-gray-500" />
                        <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            title="Start date"
                            aria-label="Start date"
                            className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-32"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            title="End date"
                            aria-label="End date"
                            className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-32"
                        />
                    </div>
                 </div>
                 
                 <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
                                activeTab === tab.id 
                                    ? "border-blue-500 text-blue-600" 
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden px-4 pt-2 pb-4">
                {/* Account Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Balance (USD)</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">${totalBalanceUSD.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Balance (AFN)</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">؋{totalBalanceAFN.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Net Income (This Month)</p>
                        <div className="mt-1">
                            <p className={clsx("text-lg font-bold", incomeUSD - expenseUSD >= 0 ? "text-green-600" : "text-red-600")}>
                                ${(incomeUSD - expenseUSD).toLocaleString()}
                            </p>
                            <p className={clsx("text-xs font-medium", incomeAFN - expenseAFN >= 0 ? "text-green-600" : "text-red-600")}>
                                ؋{(incomeAFN - expenseAFN).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Expenses (This Month)</p>
                        <div className="mt-1">
                            <p className="text-lg font-bold text-red-600">${expenseUSD.toLocaleString()}</p>
                            <p className="text-xs font-medium text-red-600">؋{expenseAFN.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {activeTab === 'accounts' ? (
                    <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 overflow-hidden">
                        <DenseTable 
                            data={accounts} 
                            columns={accountColumns} 
                            title="Accounts"
                            canSearch={hasPermission('account.accounts.search')}
                            canExport={hasPermission('account.accounts.export')}
                            canAdd={hasPermission('account.accounts.create')}
                            onAdd={() => {
                                setEditingAccount(undefined);
                                setIsAccountModalOpen(true);
                            }}
                        />
                    </div>
                ) : activeTab === 'transactions' ? (
                    <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm p-4 overflow-hidden">
                        <DenseTable 
                            data={sortedTransactions} 
                            columns={transactionColumns as any} 
                            title="Transactions"
                            canSearch={hasPermission('account.transactions.search')}
                            canExport={hasPermission('account.transactions.export')}
                            canAdd={hasPermission('account.transactions.create')}
                            onAdd={() => {
                                setPaymentPrefill(undefined);
                                setEditingTransaction(undefined);
                                setIsTransactionModalOpen(true);
                            }}
                            defaultSort={{ key: 'created_at', direction: 'desc' }}
                        />
                    </div>
                ) : isFinanceTabActive ? (
                    <FinancePage embedded forcedTab={activeTab as FinanceTab} />
                ) : null
                }
            </div>

            {/* Account Modal */}
            <Modal
                open={isAccountModalOpen}
                onOpenChange={setIsAccountModalOpen}
                title={editingAccount ? "Edit Account" : "Add Account"}
            >
                <AccountForm 
                    initialData={editingAccount} 
                    onSave={(data) => {
                        if (editingAccount) updateAccount(editingAccount.id, data);
                        else addAccount(data);
                        setIsAccountModalOpen(false);
                    }} 
                    onCancel={() => setIsAccountModalOpen(false)} 
                />
            </Modal>

            {/* View Account Modal */}
            <Modal
                open={isViewAccountModalOpen}
                onOpenChange={setIsViewAccountModalOpen}
                title="Account Details"
            >
                {viewingAccount && <AccountDetails account={viewingAccount} />}
            </Modal>

            {/* Transaction Modal */}
            <Modal
                open={isTransactionModalOpen}
                onOpenChange={(open) => {
                    setIsTransactionModalOpen(open);
                    if (!open) {
                        setPaymentPrefill(undefined);
                        setEditingTransaction(undefined);
                        setEditingPayment(undefined);
                    }
                }}
                title={editingTransaction ? "Edit Transaction" : "New Transaction"}
                size="xl"
            >
                <TransactionForm 
                    initialData={editingPayment ? undefined : (paymentPrefill || editingTransaction)}
                    paymentData={editingPayment}
                    allowedTypesOverride={['Payment', 'Transfer']}
                    onSave={(data) => {
                        if (data?.kind === 'payment') {
                            if (data?.payment_id) {
                                updatePayment(String(data.payment_id), data);
                            } else {
                                addPayment(data);
                            }
                        } else if (editingTransaction) {
                            updateTransaction(editingTransaction.id, data);
                        } else {
                            addTransaction(data);
                        }
                        setPaymentPrefill(undefined);
                        setIsTransactionModalOpen(false);
                    }} 
                    onCancel={() => setIsTransactionModalOpen(false)} 
                />
            </Modal>

            {/* View Transaction Modal */}
            <Modal
                open={isViewTransactionModalOpen}
                onOpenChange={setIsViewTransactionModalOpen}
                title="Transaction Details"
            >
                {viewingTransaction && <TransactionDetails transaction={viewingTransaction} accounts={accounts} customers={customers} />}
            </Modal>

            <Modal
                open={!!viewingPayment}
                onOpenChange={(open) => {
                    if (!open) setViewingPayment(undefined);
                }}
                title="Payment Details"
                size="full"
            >
                {viewingPayment && (
                    <PaymentDetails
                        payment={viewingPayment}
                        tenant={tenant}
                        accounts={accounts}
                        customers={customers}
                        suppliers={suppliers}
                        onClose={() => setViewingPayment(undefined)}
                    />
                )}
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmationDialog 
                open={!!deleteId} 
                onOpenChange={(open) => !open && setDeleteId(null)}
                title={`Delete ${deleteType === 'account' ? 'Account' : 'Transaction'}`}
                description="Are you sure? This action cannot be undone."
                onConfirm={() => {
                    if (deleteId) {
                        if (deleteType === 'account') deleteAccount(deleteId);
                        else deleteTransaction(deleteId);
                        setDeleteId(null);
                    }
                }}
                confirmLabel="Delete"
            />
        </div>
    );
};
