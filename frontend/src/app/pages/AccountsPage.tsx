import { useState, useEffect } from 'react';
import { useStore, Account, Transaction } from '../../store';
import { Button } from '../components/ui/button';
import { DenseTable } from '../components/ui/DenseTable';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { useForm, Controller } from 'react-hook-form';
import { Plus, Wallet, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Building2, Smartphone, Banknote, Paperclip, Scan, Calendar, Filter, Save, X } from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Combobox } from '../components/ui/Combobox';
import { TransactionForm } from '../components/forms/TransactionForm';

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
                        <p className="text-gray-400">{account.created_at ? format(new Date(account.created_at), 'PPP p') : '-'}</p>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{account.updated_by || 'System'}</p>
                        <p className="text-gray-400">{account.updated_at ? format(new Date(account.updated_at), 'PPP p') : '-'}</p>
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
                        <p className="text-gray-400">{transaction.created_at ? format(new Date(transaction.created_at), 'PPP p') : '-'}</p>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</label>
                    <div className="mt-1 text-xs text-gray-600">
                        <p>{transaction.updated_by || 'System'}</p>
                        <p className="text-gray-400">{transaction.updated_at ? format(new Date(transaction.updated_at), 'PPP p') : '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AccountsPage = () => {
    // Attempt to destructure updateTransaction. If it's missing in store type but present in runtime, this works.
    // If missing in runtime, we'll handle it carefully.
    const store = useStore();
    const { accounts, transactions, addAccount, updateAccount, deleteAccount, addTransaction, deleteTransaction, hasPermission, customers } = store;
    
    // Fallback for updateTransaction if it doesn't exist in store
    const updateTransaction = (store as any).updateTransaction || ((id: string, data: any) => {
        console.warn('updateTransaction not implemented in store', id, data);
        alert('Update transaction feature is not available in the backend yet.');
    });

    const [activeTab, setActiveTab] = useState<'accounts' | 'transactions'>('transactions');
    
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
    
    // Deletion
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'account' | 'transaction'>('account');

    // Date Filter State
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    if (!hasPermission('account.view')) return <div>Access Denied</div>;

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
                    onView={() => { setViewingAccount(item); setIsViewAccountModalOpen(true); }}
                    onEdit={hasPermission('account.edit') ? () => { setEditingAccount(item); setIsAccountModalOpen(true); } : undefined}
                    onDelete={hasPermission('account.delete') ? () => { setDeleteId(item.id); setDeleteType('account'); } : undefined}
                />
            )
        }
    ];

    const enrichedTransactions = filteredTransactions.map(t => {
        const customer = customers.find(c => c.id === t.contact_id);
        const acc = accounts.find(a => a.id === t.account_id);
        const toAcc = t.to_account_id ? accounts.find(a => a.id === t.to_account_id) : null;
        
        let details = t.description || '';
        if (t.type === 'Income' && customer) details += ` ${customer.name}`;
        if (t.category) details += ` ${t.category}`;
        if (t.type === 'Transfer') details += ' Transfer';

        return {
            ...t,
            details_search: details,
            account_name: acc?.name || '',
            to_account_name: toAcc?.name || ''
        };
    });

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
                const customer = customers.find(c => c.id === item.contact_id);
                return (
                    <div>
                        <div className="font-medium text-gray-900">
                            {item.type === 'Income' && customer ? customer.name : (item.category || 'Transfer')}
                        </div>
                        <div className="text-xs text-gray-500">{item.description || '-'}</div>
                    </div>
                )
            }
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
                    onView={() => { setViewingTransaction(item); setIsViewTransactionModalOpen(true); }}
                    onEdit={hasPermission('account.edit') ? () => { setEditingTransaction(item); setIsTransactionModalOpen(true); } : undefined}
                    onDelete={hasPermission('account.delete') ? () => { setDeleteId(item.id); setDeleteType('transaction'); } : undefined}
                />
            )
        }
    ];

    return (
        <div className="space-y-6">
            {/* Date Filter & Header Controls */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                   <div className="flex gap-4 items-center w-full md:w-auto">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                            <Calendar size={16} className="text-gray-500" />
                            <input 
                                type="date" 
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-32"
                            />
                            <span className="text-gray-400">-</span>
                            <input 
                                type="date" 
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 w-32"
                            />
                        </div>
                   </div>
                   
                   <div className="flex gap-2 w-full md:w-auto">
                       <div className="flex bg-gray-100 p-1 rounded-lg">
                           <button 
                                onClick={() => setActiveTab('transactions')}
                                className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-all", 
                                    activeTab === 'transactions' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                           >
                               Transactions
                           </button>
                           <button 
                                onClick={() => setActiveTab('accounts')}
                                className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-all", 
                                    activeTab === 'accounts' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                           >
                               Accounts
                           </button>
                       </div>
                       
                       <Button onClick={() => {
                           if (activeTab === 'accounts') {
                               setEditingAccount(undefined);
                               setIsAccountModalOpen(true);
                           } else {
                               setEditingTransaction(undefined);
                               setIsTransactionModalOpen(true);
                           }
                       }} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 rounded-full px-4">
                           <Plus className="h-4 w-4" />
                           <span>Add</span>
                       </Button>
                   </div>
                </div>
            </div>

            {/* Account Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <DenseTable 
                    data={accounts} 
                    columns={accountColumns} 
                    title="Accounts"
                    hideHeader
                />
            ) : (
                <DenseTable 
                    data={enrichedTransactions} 
                    columns={transactionColumns as any} 
                    title="Transactions"
                    hideHeader
                    defaultSort={{ key: 'date', direction: 'desc' }}
                />
            )}

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
                onOpenChange={setIsTransactionModalOpen}
                title={editingTransaction ? "Edit Transaction" : "New Transaction"}
            >
                <TransactionForm 
                    initialData={editingTransaction} 
                    onSave={(data) => {
                        if (editingTransaction) updateTransaction(editingTransaction.id, data);
                        else addTransaction(data);
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
