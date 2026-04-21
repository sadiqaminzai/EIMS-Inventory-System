import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { clsx } from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Save, Tag, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore, Account, Transaction } from '../../store';
import { accountTransactionCategoryApi, AccountTransactionCategoryDto, AccountTransactionCategoryType } from '../../api/accountTransactionCategories';
import { DenseTable } from '../components/ui/DenseTable';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/button';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { formatDateTime } from '../utils/dateTime';

export type FinanceTab = 'expenses' | 'expense-categories' | 'other-income' | 'other-income-categories';
type CategoryStatus = 'active' | 'inactive';

type FinancePageProps = {
  embedded?: boolean;
  forcedTab?: FinanceTab;
};

type FinanceCategory = {
  id: string;
  name: string;
  type: AccountTransactionCategoryType;
  details?: string;
  status: CategoryStatus;
  created_at?: string;
  updated_at?: string;
};

type TransactionFormValues = {
  date: string;
  account_id: string;
  category: string;
  amount: number;
  currency: 'USD' | 'AFN';
  payment_method: string;
  reference_id?: string;
  description?: string;
  attachment_file?: FileList;
  remove_attachment?: boolean;
};

type CategoryFormValues = {
  name: string;
  details?: string;
  status: CategoryStatus;
};

const mapCategoryDto = (item: AccountTransactionCategoryDto): FinanceCategory => ({
  id: String(item.id),
  name: item.name,
  type: item.type,
  details: item.details ?? '',
  status: (item.status ?? 'active') as CategoryStatus,
  created_at: item.created_at,
  updated_at: item.updated_at,
});

const TransactionEntryForm = ({
  mode,
  accounts,
  categories,
  initialData,
  onSave,
  onCancel,
}: {
  mode: AccountTransactionCategoryType;
  accounts: Account[];
  categories: FinanceCategory[];
  initialData?: Transaction;
  onSave: (values: TransactionFormValues) => void;
  onCancel: () => void;
}) => {
  const defaultAccount = accounts.find((account) => /cash in hand/i.test(account.name)) ?? accounts[0];

  const defaultCurrency = (initialData?.currency as 'USD' | 'AFN' | undefined)
    ?? ((defaultAccount?.currency as 'USD' | 'AFN' | undefined) || 'USD');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TransactionFormValues>({
    defaultValues: initialData
      ? {
          date: initialData.date,
          account_id: initialData.account_id,
          category: initialData.category,
          amount: Number(initialData.amount || 0),
          currency: (initialData.currency as 'USD' | 'AFN') || 'USD',
          payment_method: initialData.payment_method || 'Cash',
          reference_id: initialData.reference_id || '',
          description: initialData.description || '',
        }
      : {
          date: new Date().toISOString().slice(0, 10),
          account_id: defaultAccount?.id || '',
          category: '',
          amount: 0,
          currency: defaultCurrency,
          payment_method: 'Cash',
          reference_id: '',
          description: '',
          remove_attachment: false,
        }
  });

  const selectedAccountId = watch('account_id');
  const selectedCategory = watch('category');
  const selectedAttachmentFile = watch('attachment_file');
  const hasNewAttachment = Boolean(selectedAttachmentFile && selectedAttachmentFile.length > 0);

  useEffect(() => {
    const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
    if (selectedAccount?.currency) {
      setValue('currency', selectedAccount.currency as 'USD' | 'AFN');
    }
  }, [selectedAccountId, accounts, setValue]);

  const categoryOptions = categories
    .filter((category) => category.status === 'active' || category.name === selectedCategory)
    .map((category) => ({ value: category.name, label: category.name }));

  const modeLabel = mode === 'expense' ? 'Expense' : 'Other Income';

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DenseInput
          label="Date"
          type="date"
          {...register('date', { required: 'Required' })}
          error={errors.date?.message}
        />

        <DenseSelect
          label="Account"
          options={accounts.map((account) => ({
            value: account.id,
            label: `${account.name} (${account.currency})`,
          }))}
          {...register('account_id', { required: 'Required' })}
          error={errors.account_id?.message}
        />

        <DenseSelect
          label={mode === 'expense' ? 'Expense Category' : 'Other Income Category'}
          options={categoryOptions}
          {...register('category', { required: 'Required' })}
          error={errors.category?.message}
        />

        <DenseInput
          label="Amount"
          type="number"
          step="0.01"
          min="0"
          {...register('amount', {
            required: 'Required',
            valueAsNumber: true,
            min: { value: 0.01, message: 'Amount must be greater than zero' },
          })}
          error={errors.amount?.message}
        />

        <DenseSelect
          label="Currency"
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'AFN', label: 'AFN' },
          ]}
          {...register('currency', { required: 'Required' })}
          error={errors.currency?.message}
        />

        <DenseSelect
          label="Payment Method"
          options={[
            { value: 'Cash', label: 'Cash' },
            { value: 'Bank Transfer', label: 'Bank Transfer' },
            { value: 'Mobile Money', label: 'Mobile Money' },
            { value: 'Cheque', label: 'Cheque' },
          ]}
          {...register('payment_method', { required: 'Required' })}
          error={errors.payment_method?.message}
        />

        <div className="md:col-span-2">
          <DenseInput label="Reference (Optional)" {...register('reference_id')} />
        </div>

        <div className="md:col-span-2 flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase text-gray-500">Document (Optional)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
            className="h-8 text-xs border border-gray-300 rounded px-2 py-1 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100"
            {...register('attachment_file')}
          />
          <span className="text-[10px] text-gray-500">Allowed: PDF, image, DOC, XLS, CSV, TXT (max 10MB).</span>

          {initialData?.attachment && (
            <a
              href={initialData.attachment}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
            >
              View current document
            </a>
          )}

          {initialData?.attachment && !hasNewAttachment && (
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                {...register('remove_attachment')}
              />
              Remove current document
            </label>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col gap-0.5">
          <label className="text-[10px] font-semibold uppercase text-gray-500">Description</label>
          <textarea
            className="min-h-[84px] text-xs border border-gray-300 rounded px-2 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder={`Add ${modeLabel.toLowerCase()} note (optional)`}
            {...register('description')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <X size={14} /> Cancel
        </Button>
        <Button type="submit" size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Save size={14} /> Save {modeLabel}
        </Button>
      </div>
    </form>
  );
};

const CategoryEntryForm = ({
  mode,
  initialData,
  onSave,
  onCancel,
}: {
  mode: AccountTransactionCategoryType;
  initialData?: FinanceCategory;
  onSave: (values: CategoryFormValues) => void;
  onCancel: () => void;
}) => {
  const modeLabel = mode === 'expense' ? 'Expense Category' : 'Other Income Category';

  const { register, handleSubmit, formState: { errors } } = useForm<CategoryFormValues>({
    defaultValues: initialData
      ? {
          name: initialData.name,
          details: initialData.details || '',
          status: initialData.status,
        }
      : {
          name: '',
          details: '',
          status: 'active',
        }
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4">
      <DenseInput
        label={`${modeLabel} Name`}
        {...register('name', { required: 'Required' })}
        error={errors.name?.message}
      />

      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold uppercase text-gray-500">Details</label>
        <textarea
          className="min-h-[84px] text-xs border border-gray-300 rounded px-2 py-2 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          placeholder="Optional notes about this category"
          {...register('details')}
        />
      </div>

      <DenseSelect
        label="Status"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ]}
        {...register('status', { required: true })}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="gap-2">
          <X size={14} /> Cancel
        </Button>
        <Button type="submit" size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Save size={14} /> Save Category
        </Button>
      </div>
    </form>
  );
};

export const FinancePage = ({ embedded = false, forcedTab }: FinancePageProps = {}) => {
  const {
    hasPermission,
    accounts,
    transactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    bootstrapData,
  } = useStore();

  const canView = hasPermission('account.transactions.view') || hasPermission('account.view');
  const canCreate = hasPermission('account.transactions.create');
  const canEdit = hasPermission('account.transactions.edit');
  const canDelete = hasPermission('account.transactions.delete');

  const canAddExpense = canCreate && hasPermission('account.transaction.expense');
  const canAddOtherIncome = canCreate && hasPermission('account.transaction.income');

  const tabs = [
    { id: 'expenses' as const, label: 'Expenses', icon: ArrowUpRight },
    { id: 'expense-categories' as const, label: 'Expense Categories', icon: Tag },
    { id: 'other-income' as const, label: 'Other Income', icon: ArrowDownLeft },
    { id: 'other-income-categories' as const, label: 'Other Income Categories', icon: Tag },
  ];

  const [activeTab, setActiveTab] = useState<FinanceTab>(forcedTab ?? 'expenses');
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<AccountTransactionCategoryType>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | undefined>(undefined);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<AccountTransactionCategoryType>('expense');
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | undefined>(undefined);
  const [categoryToDelete, setCategoryToDelete] = useState<FinanceCategory | undefined>(undefined);

  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseAccountFilter, setExpenseAccountFilter] = useState('all');
  const [otherIncomeCategoryFilter, setOtherIncomeCategoryFilter] = useState('all');
  const [otherIncomeAccountFilter, setOtherIncomeAccountFilter] = useState('all');

  useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
    }
  }, [forcedTab]);

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const items = await accountTransactionCategoryApi.list();
      setCategories((items || []).map(mapCategoryDto));
    } catch {
      toast.error('Failed to load expense and income categories');
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const otherIncomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'other_income'),
    [categories]
  );

  const otherIncomeCategoryNames = useMemo(
    () => new Set(otherIncomeCategories.map((category) => category.name.toLowerCase())),
    [otherIncomeCategories]
  );

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const expenseTransactions = useMemo(() => {
    const base = transactions.filter((transaction) => transaction.type === 'Expense');

    return base.filter((transaction) => {
      if (transaction.category_type) {
        return transaction.category_type === 'expense';
      }
      return true;
    });
  }, [transactions]);

  const otherIncomeTransactions = useMemo(() => {
    const base = transactions.filter((transaction) => transaction.type === 'Income');

    return base.filter((transaction) => {
      if (transaction.category_type) {
        return transaction.category_type === 'other_income';
      }
      return Boolean(transaction.category && otherIncomeCategoryNames.has(transaction.category.toLowerCase()));
    });
  }, [transactions, otherIncomeCategoryNames]);

  const filteredExpenseTransactions = useMemo(() => {
    return expenseTransactions.filter((transaction) => {
      if (expenseAccountFilter !== 'all' && transaction.account_id !== expenseAccountFilter) {
        return false;
      }
      if (expenseCategoryFilter !== 'all' && (transaction.category || '') !== expenseCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [expenseTransactions, expenseAccountFilter, expenseCategoryFilter]);

  const filteredOtherIncomeTransactions = useMemo(() => {
    return otherIncomeTransactions.filter((transaction) => {
      if (otherIncomeAccountFilter !== 'all' && transaction.account_id !== otherIncomeAccountFilter) {
        return false;
      }
      if (otherIncomeCategoryFilter !== 'all' && (transaction.category || '') !== otherIncomeCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [otherIncomeTransactions, otherIncomeAccountFilter, otherIncomeCategoryFilter]);

  const openAddTransaction = (mode: AccountTransactionCategoryType) => {
    setTransactionMode(mode);
    setEditingTransaction(undefined);
    setIsTransactionModalOpen(true);
  };

  const openEditTransaction = (transaction: Transaction, mode: AccountTransactionCategoryType) => {
    setTransactionMode(mode);
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const openAddCategory = (mode: AccountTransactionCategoryType) => {
    setCategoryMode(mode);
    setEditingCategory(undefined);
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (category: FinanceCategory) => {
    setCategoryMode(category.type);
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleSaveTransaction = async (values: TransactionFormValues) => {
    const attachmentFile = values.attachment_file?.[0];
    const removeAttachment = Boolean(values.remove_attachment && !attachmentFile);

    const payload = {
      date: values.date,
      type: (transactionMode === 'expense' ? 'Expense' : 'Income') as Transaction['type'],
      category_type: transactionMode,
      category: values.category,
      amount: Number(values.amount || 0),
      currency: values.currency,
      account_id: values.account_id,
      payment_method: values.payment_method,
      reference_id: values.reference_id || undefined,
      description: values.description || undefined,
      attachment_file: attachmentFile,
      remove_attachment: removeAttachment,
    };

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload);
    } else {
      await addTransaction(payload as any);
    }

    setIsTransactionModalOpen(false);
    setEditingTransaction(undefined);
    await bootstrapData();
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    await deleteTransaction(transactionToDelete.id);
    setTransactionToDelete(undefined);
  };

  const handleSaveCategory = async (values: CategoryFormValues) => {
    try {
      if (editingCategory) {
        await accountTransactionCategoryApi.update(editingCategory.id, {
          name: values.name,
          type: categoryMode,
          details: values.details || undefined,
          status: values.status,
        });
        toast.info('Category updated successfully');
      } else {
        await accountTransactionCategoryApi.create({
          name: values.name,
          type: categoryMode,
          details: values.details || undefined,
          status: values.status,
        });
        toast.success('Category added successfully');
      }

      setIsCategoryModalOpen(false);
      setEditingCategory(undefined);
      await loadCategories();
    } catch {
      toast.error('Failed to save category');
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      await accountTransactionCategoryApi.remove(categoryToDelete.id);
      toast.info('Category deleted successfully');
      setCategoryToDelete(undefined);
      await loadCategories();
    } catch {
      toast.error('Failed to delete category');
    }
  };

  const transactionColumns = (mode: AccountTransactionCategoryType) => [
    {
      header: 'Date',
      accessorKey: 'date' as keyof Transaction,
      sortable: true,
      cell: (item: Transaction) => formatDateTime(item.date),
    },
    {
      header: 'Account',
      accessorKey: 'account_id' as keyof Transaction,
      sortable: true,
      cell: (item: Transaction) => {
        const account = accountById.get(item.account_id);
        return account ? `${account.name} (${account.currency})` : '-';
      },
    },
    {
      header: 'Category',
      accessorKey: 'category' as keyof Transaction,
      sortable: true,
      cell: (item: Transaction) => item.category || '-',
    },
    {
      header: 'Amount',
      accessorKey: 'amount' as keyof Transaction,
      sortable: true,
      cell: (item: Transaction) => (
        <span className={clsx('font-semibold', mode === 'expense' ? 'text-red-600' : 'text-green-600')}>
          {mode === 'expense' ? '-' : '+'}{item.currency} {Number(item.amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Method',
      accessorKey: 'payment_method' as keyof Transaction,
      sortable: true,
      cell: (item: Transaction) => item.payment_method || '-',
    },
    {
      header: 'Description',
      accessorKey: 'description' as keyof Transaction,
      cell: (item: Transaction) => item.description || '-',
    },
    {
      header: 'Document',
      accessorKey: 'attachment' as keyof Transaction,
      cell: (item: Transaction) => item.attachment ? (
        <a
          href={item.attachment}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
        >
          View
        </a>
      ) : '-',
    },
    {
      header: 'Actions',
      width: '120px',
      cell: (item: Transaction) => (
        <ActionButtons
          onEdit={canEdit ? () => openEditTransaction(item, mode) : undefined}
          onDelete={canDelete ? () => setTransactionToDelete(item) : undefined}
        />
      ),
    },
  ];

  const categoryColumns = (type: AccountTransactionCategoryType) => {
    const usageMap = new Map<string, number>();

    const source = type === 'expense' ? expenseTransactions : otherIncomeTransactions;

    source.forEach((transaction) => {
      const key = (transaction.category || '').trim().toLowerCase();
      if (!key) return;
      usageMap.set(key, (usageMap.get(key) || 0) + 1);
    });

    return [
      {
        header: 'Name',
        accessorKey: 'name' as keyof FinanceCategory,
        sortable: true,
      },
      {
        header: 'Usage',
        accessorKey: 'name' as keyof FinanceCategory,
        sortable: false,
        cell: (item: FinanceCategory) => usageMap.get(item.name.trim().toLowerCase()) || 0,
      },
      {
        header: 'Status',
        accessorKey: 'status' as keyof FinanceCategory,
        sortable: true,
        cell: (item: FinanceCategory) => (
          <span
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] uppercase font-bold',
              item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            )}
          >
            {item.status}
          </span>
        ),
      },
      {
        header: 'Details',
        accessorKey: 'details' as keyof FinanceCategory,
        cell: (item: FinanceCategory) => item.details || '-',
      },
      {
        header: 'Created At',
        accessorKey: 'created_at' as keyof FinanceCategory,
        sortable: true,
        cell: (item: FinanceCategory) => formatDateTime(item.created_at),
      },
      {
        header: 'Actions',
        width: '120px',
        cell: (item: FinanceCategory) => (
          <ActionButtons
            onEdit={canEdit ? () => openEditCategory(item) : undefined}
            onDelete={canDelete ? () => setCategoryToDelete(item) : undefined}
          />
        ),
      },
    ];
  };

  if (!canView) {
    return <div>Access Denied</div>;
  }

  const currentTab = forcedTab ?? activeTab;
  const transactionModalTitle = `${editingTransaction ? 'Edit' : 'Add'} ${transactionMode === 'expense' ? 'Expense' : 'Other Income'}`;
  const categoryModalTitle = `${editingCategory ? 'Edit' : 'Add'} ${categoryMode === 'expense' ? 'Expense Category' : 'Other Income Category'}`;

  return (
    <div className={embedded ? 'space-y-4' : 'flex flex-col h-full space-y-4'}>
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 pt-2 rounded-t-lg shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-gray-500" />
            <h1 className="text-xl font-bold text-gray-900">Finance Management</h1>
          </div>
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap',
                  currentTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <tab.icon className={clsx('mr-2 h-4 w-4', currentTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500')} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      <div className={clsx('bg-white border border-gray-200 shadow-sm p-4 overflow-hidden', embedded ? 'rounded-lg' : 'flex-1 rounded-b-lg')}>
        {currentTab === 'expenses' && (
          <DenseTable
            data={filteredExpenseTransactions}
            columns={transactionColumns('expense')}
            title="Expenses"
            canAdd={canAddExpense}
            canExportPdf
            canExportExcel
            onAdd={() => openAddTransaction('expense')}
            headerAfterSearch={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="text-xs border border-gray-300 rounded h-7 px-2"
                  value={expenseCategoryFilter}
                  onChange={(event) => setExpenseCategoryFilter(event.target.value)}
                  aria-label="Filter expenses by category"
                >
                  <option value="all">All Categories</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
                <select
                  className="text-xs border border-gray-300 rounded h-7 px-2"
                  value={expenseAccountFilter}
                  onChange={(event) => setExpenseAccountFilter(event.target.value)}
                  aria-label="Filter expenses by account"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
            }
          />
        )}

        {currentTab === 'expense-categories' && (
          <DenseTable
            data={expenseCategories}
            columns={categoryColumns('expense')}
            title="Expense Categories"
            canAdd={canCreate}
            onAdd={() => openAddCategory('expense')}
            canExportPdf
            canExportExcel
            headerAfterSearch={
              <div className="text-xs text-gray-500">
                {isLoadingCategories ? 'Loading categories...' : `Total: ${expenseCategories.length}`}
              </div>
            }
          />
        )}

        {currentTab === 'other-income' && (
          <DenseTable
            data={filteredOtherIncomeTransactions}
            columns={transactionColumns('other_income')}
            title="Other Income"
            canAdd={canAddOtherIncome}
            onAdd={() => openAddTransaction('other_income')}
            canExportPdf
            canExportExcel
            headerAfterSearch={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="text-xs border border-gray-300 rounded h-7 px-2"
                  value={otherIncomeCategoryFilter}
                  onChange={(event) => setOtherIncomeCategoryFilter(event.target.value)}
                  aria-label="Filter other income by category"
                >
                  <option value="all">All Categories</option>
                  {otherIncomeCategories.map((category) => (
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
                </select>
                <select
                  className="text-xs border border-gray-300 rounded h-7 px-2"
                  value={otherIncomeAccountFilter}
                  onChange={(event) => setOtherIncomeAccountFilter(event.target.value)}
                  aria-label="Filter other income by account"
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>
            }
          />
        )}

        {currentTab === 'other-income-categories' && (
          <DenseTable
            data={otherIncomeCategories}
            columns={categoryColumns('other_income')}
            title="Other Income Categories"
            canAdd={canCreate}
            onAdd={() => openAddCategory('other_income')}
            canExportPdf
            canExportExcel
            headerAfterSearch={
              <div className="text-xs text-gray-500">
                {isLoadingCategories ? 'Loading categories...' : `Total: ${otherIncomeCategories.length}`}
              </div>
            }
          />
        )}
      </div>

      <Modal
        open={isTransactionModalOpen}
        onOpenChange={(open) => {
          setIsTransactionModalOpen(open);
          if (!open) {
            setEditingTransaction(undefined);
          }
        }}
        title={transactionModalTitle}
        size="md"
      >
        <TransactionEntryForm
          mode={transactionMode}
          accounts={accounts}
          categories={categories.filter((category) => category.type === transactionMode)}
          initialData={editingTransaction}
          onSave={handleSaveTransaction}
          onCancel={() => {
            setIsTransactionModalOpen(false);
            setEditingTransaction(undefined);
          }}
        />
      </Modal>

      <Modal
        open={isCategoryModalOpen}
        onOpenChange={(open) => {
          setIsCategoryModalOpen(open);
          if (!open) {
            setEditingCategory(undefined);
          }
        }}
        title={categoryModalTitle}
        size="md"
      >
        <CategoryEntryForm
          mode={categoryMode}
          initialData={editingCategory}
          onSave={handleSaveCategory}
          onCancel={() => {
            setIsCategoryModalOpen(false);
            setEditingCategory(undefined);
          }}
        />
      </Modal>

      <ConfirmationDialog
        open={Boolean(transactionToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setTransactionToDelete(undefined);
          }
        }}
        title="Delete Transaction"
        description="This action will delete the selected transaction and update account balances. Continue?"
        onConfirm={handleConfirmDeleteTransaction}
        confirmLabel="Delete"
      />

      <ConfirmationDialog
        open={Boolean(categoryToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setCategoryToDelete(undefined);
          }
        }}
        title="Delete Category"
        description="This action will remove the selected category. Existing transactions will keep their saved category text."
        onConfirm={handleConfirmDeleteCategory}
        confirmLabel="Delete"
      />
    </div>
  );
};
