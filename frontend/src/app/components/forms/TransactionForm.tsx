import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, Transaction, Payment } from '@/store';
import { Button } from '@/app/components/ui/button';
import { DenseInput, DenseSelect } from '@/app/components/ui/Form';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Paperclip, Scan, Save, X, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { SearchableSelect } from '@/app/components/ui/SearchableSelect';
import { paymentApi } from '@/api/payments';
import { toast } from 'sonner';

type FormAllocationRow = {
    order_id: string;
    amount: string | number;
};

type FormPaymentDetailRow = {
    customer_id: string | number;
    supplier_id?: string | number;
    paid_now: string | number;
    remarks?: string;
    auto_allocate?: boolean;
    allocations?: FormAllocationRow[];
};

type TransactionTypeOption = 'Payment' | 'Income' | 'Expense' | 'Transfer';

export const TransactionForm = ({ initialData, paymentData, allowedTypesOverride, onSave, onCancel }: { initialData?: Transaction, paymentData?: Payment, allowedTypesOverride?: TransactionTypeOption[], onSave: (data: any) => void, onCancel: () => void }) => {
    // Safety check for useStore
    const store = useStore ? useStore() : null;
    if (!store) return <div className="p-4 text-center text-gray-500">Loading form...</div>;

    const { accounts, customers, suppliers, sales, currentUser, hasPermission } = store;
    const [nextSerial, setNextSerial] = useState<string>('');
    const [selectedPartyId, setSelectedPartyId] = useState<string>('');
    const didAutoFocus = useRef(false);
    const isPaymentEdit = !!paymentData;
    const isPaymentPrefill = useMemo(
        () => Array.isArray((initialData as any)?.payment_details),
        [initialData]
    );

    const normalizedInitialPaymentDetails = useMemo(() => {
        if (!isPaymentPrefill) return [];

        const rows = (initialData as any)?.payment_details;
        if (!Array.isArray(rows)) return [];

        return rows.map((row: any) => ({
            customer_id: row?.customer_id ?? row?.supplier_id ?? '',
            paid_now: row?.paid_now ?? '',
            remarks: row?.remarks || '',
            auto_allocate: row?.auto_allocate !== false,
            allocations: Array.isArray(row?.allocations)
                ? row.allocations.map((allocation: any) => ({
                    order_id: String(allocation?.order_id ?? allocation?.sale_invoice_id ?? ''),
                    amount: allocation?.amount ?? '',
                }))
                : [],
        }));
    }, [isPaymentPrefill, initialData]);

    const paymentDefaults = useMemo(() => (paymentData ? {
        type: 'Payment' as any,
        payment_type: (paymentData as any).payment_type || 'receivable',
        date: new Date(paymentData.date).toISOString().split('T')[0],
        account_id: paymentData.account_id,
        currency: paymentData.currency,
        salesman: paymentData.salesman || '',
        booker: paymentData.booker || currentUser?.name || '',
        notes: paymentData.notes || '',
        payment_details: (paymentData.details || []).map((d) => ({
            customer_id: (d as any).customer_id ?? (d as any).supplier_id ?? '',
            paid_now: d.credit_amount,
            remarks: d.remarks || '',
            auto_allocate: !Array.isArray((d as any).allocations) || (d as any).allocations.length === 0,
            allocations: Array.isArray((d as any).allocations)
                ? (d as any).allocations.map((allocation: any) => ({
                    order_id: String(allocation.order_id ?? allocation.sale_invoice_id ?? ''),
                    amount: allocation.amount,
                }))
                : [],
        }))
    } : null), [paymentData, currentUser?.name]);

    const initialDefaults = useMemo(() => (initialData ? {
        ...initialData,
        date: new Date(initialData.date).toISOString().split('T')[0],
        payment_details: isPaymentPrefill ? normalizedInitialPaymentDetails : []
    } : null), [initialData, isPaymentPrefill, normalizedInitialPaymentDetails]);

    const newDefaults = {
        date: new Date().toISOString().split('T')[0],
        type: 'Payment' as any,
        payment_type: 'receivable' as const,
        payment_method: 'Cash',
        currency: 'USD',
        salesman: '',
        booker: currentUser?.name || '',
        notes: '',
        payment_details: [{ customer_id: '', paid_now: '', remarks: '', auto_allocate: true, allocations: [] }]
    };

    const { register, control, handleSubmit, watch, setValue, reset } = useForm({
        defaultValues: paymentDefaults || initialDefaults || newDefaults
    });

    const type = watch('type');
    const selectedAccountId = watch('account_id');
    const paymentType = watch('payment_type') === 'payable' ? 'payable' : 'receivable';
    const selectedCurrency = String(watch('currency') || 'USD').toUpperCase() === 'AFN' ? 'AFN' : 'USD';
    const partyLabel = paymentType === 'payable' ? 'Supplier' : 'Customer';
    const invoiceLabel = paymentType === 'payable' ? 'Purchase Invoice' : 'Invoice';
    const typePermissions: Record<TransactionTypeOption, string> = {
        Payment: 'account.transaction.payment',
        Income: 'account.transaction.income',
        Expense: 'account.transaction.expense', 
        Transfer: 'account.transaction.transfer'
    };
    const allTypes: TransactionTypeOption[] = ['Payment', 'Income', 'Expense', 'Transfer'];
    const visibleTypes = allowedTypesOverride?.length
        ? allTypes.filter((typeOption) => allowedTypesOverride.includes(typeOption))
        : allTypes;
    const allowedTypes = visibleTypes
        .filter((t) => hasPermission?.(typePermissions[t] as any));
    const showPaymentMode = type === 'Payment' && (!initialData || isPaymentEdit || isPaymentPrefill);

    // Ensure type is permitted (new transactions only)
    useEffect(() => {
        if (initialData || isPaymentEdit) return;
        if (type && !allowedTypes.includes(type)) {
            const fallback = allowedTypes[0] || 'Payment';
            setValue('type', fallback as any);
        }
    }, [allowedTypes, type, initialData, isPaymentEdit, setValue]);

    // Update currency when type changes (only for new transactions or if user changes type)
    useEffect(() => {
        if (!initialData && !isPaymentEdit) {
            if (type === 'Payment' || type === 'Income') {
                setValue('currency', 'USD');
            } else if (type === 'Expense') {
                setValue('currency', 'AFN');
            }
        }
    }, [type, setValue, initialData, isPaymentEdit]);

    useEffect(() => {
        const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
        if (!selectedAccount?.currency) return;

        const accountCurrency = String(selectedAccount.currency).toUpperCase() === 'AFN' ? 'AFN' : 'USD';
        setValue('currency', accountCurrency, { shouldDirty: true, shouldValidate: false });
    }, [selectedAccountId, accounts, setValue]);

    useEffect(() => {
        if (initialData || isPaymentEdit) return;
        const cashAccount = accounts.find(a => /cash in hand/i.test(a.name)) || accounts.find(a => a.type === 'Cash');
        if (cashAccount) {
            setValue('account_id', cashAccount.id);
        }
    }, [accounts, initialData, isPaymentEdit, setValue]);

    useEffect(() => {
        if (!showPaymentMode || isPaymentEdit) return;
        let active = true;
        const loadSerial = async () => {
            try {
                const payments = await paymentApi.list();
                const maxSerial = payments
                    .map(p => Number(p.serial_no || 0))
                    .reduce((max, n) => (n > max ? n : max), 0);
                if (active) setNextSerial(String(maxSerial + 1));
            } catch {
                if (active) setNextSerial('');
            }
        };
        loadSerial();
        return () => {
            active = false;
        };
    }, [showPaymentMode, isPaymentEdit]);

    useEffect(() => {
        if (paymentDefaults) {
            const details = paymentDefaults.payment_details?.length
                ? paymentDefaults.payment_details
                : [{ customer_id: '', paid_now: '', remarks: '', auto_allocate: true, allocations: [] }];
            reset({ ...paymentDefaults, payment_details: details });
            return;
        }

        if (initialDefaults) {
            reset(initialDefaults);
        }
    }, [paymentDefaults, initialDefaults, reset]);

    const partyOptions = useMemo(() => (
        paymentType === 'payable'
            ? suppliers.map((s) => ({ value: s.id, label: s.name }))
            : customers.map((c) => ({ value: c.id, label: c.name }))
    ), [paymentType, suppliers, customers]);

    const dueInvoicesByParty = useMemo(() => {
        const byParty = new Map<string, Array<{
            order_id: string;
            invoice_no: string;
            due_amount: number;
            sort_key: string;
        }>>();

        const targetInvoiceType = paymentType === 'payable' ? 'purchase' : 'sale';

        sales
            .filter((sale) => sale.invoice_type === targetInvoiceType)
            .filter((sale) => {
                const invoiceCurrency = String((sale as any).currency || 'USD').toUpperCase() === 'AFN' ? 'AFN' : 'USD';
                return invoiceCurrency === selectedCurrency;
            })
            .forEach((sale) => {
                const partyId = String(paymentType === 'payable' ? (sale.supplier_id || '') : (sale.customer_id || ''));
                if (!partyId) return;

                const due = Number(
                    Math.max(
                        Number(
                            sale.due_amount ?? (Number(sale.net_payable || 0) - Number(sale.paid_amount || 0))
                        ),
                        0
                    ).toFixed(2)
                );

                if (due <= 0) return;

                const entries = byParty.get(partyId) || [];
                entries.push({
                    order_id: String(sale.id),
                    invoice_no: sale.invoice_no || `Invoice #${sale.id}`,
                    due_amount: due,
                    sort_key: sale.sale_date || sale.created_at || '',
                });
                byParty.set(partyId, entries);
            });

        byParty.forEach((entries) => {
            entries.sort((a, b) => {
                if (a.sort_key === b.sort_key) return a.invoice_no.localeCompare(b.invoice_no);
                return a.sort_key.localeCompare(b.sort_key);
            });
        });

        return byParty;
    }, [sales, paymentType, selectedCurrency]);

    const pendingByParty = useMemo(() => {
        const pendingMap = new Map<string, number>();

        dueInvoicesByParty.forEach((entries, partyId) => {
            const totalDue = entries.reduce((sum, entry) => sum + Number(entry.due_amount || 0), 0);
            pendingMap.set(partyId, Number(totalDue.toFixed(2)));
        });

        return pendingMap;
    }, [dueInvoicesByParty]);

    const invoiceDueByOrderId = useMemo(() => {
        const dueMap = new Map<string, number>();

        dueInvoicesByParty.forEach((entries) => {
            entries.forEach((entry) => {
                dueMap.set(String(entry.order_id), Number(entry.due_amount || 0));
            });
        });

        return dueMap;
    }, [dueInvoicesByParty]);

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'payment_details' as const,
    });

    const paymentDetails = (watch('payment_details') || []) as FormPaymentDetailRow[];

    useEffect(() => {
        const last = [...paymentDetails].reverse().find((d: any) => d?.customer_id);
        if (last?.customer_id) {
            setSelectedPartyId(String(last.customer_id));
        }
    }, [paymentDetails]);

    const totals = paymentDetails.reduce(
        (acc: { pending: number; received: number; remaining: number }, row: FormPaymentDetailRow) => {
            const partyId = String(row?.customer_id || '');
            const pending = partyId ? (pendingByParty.get(partyId) || 0) : 0;
            const isAutoAllocate = row?.auto_allocate !== false;
            const manualAllocated = (Array.isArray(row?.allocations) ? row.allocations : [])
                .reduce((sum, allocation) => sum + Number(allocation?.amount || 0), 0);
            const received = isAutoAllocate
                ? Number(row?.paid_now || 0)
                : Number(row?.paid_now || 0) || Number(manualAllocated.toFixed(2));
            const remaining = Math.max(pending - received, 0);
            acc.pending += pending;
            acc.received += received;
            acc.remaining += remaining;
            return acc;
        },
        { pending: 0, received: 0, remaining: 0 }
    );

    const focusCustomerRow = (index: number) => {
        setTimeout(() => {
            const trigger = document.getElementById(`payment-customer-${index}`) as HTMLElement | null;
            if (trigger) trigger.focus();
        }, 50);
    };

    useEffect(() => {
        if (!showPaymentMode || fields.length === 0 || didAutoFocus.current) return;
        focusCustomerRow(0);
        didAutoFocus.current = true;
    }, [showPaymentMode, fields.length]);

    const addRowAndFocus = () => {
        const newIndex = fields.length;
        append({ customer_id: '', paid_now: '', remarks: '', auto_allocate: true, allocations: [] });
        focusCustomerRow(newIndex);
    };

    const setAllocationRowsForIndex = (paymentIndex: number, allocations: FormAllocationRow[]) => {
        setValue(`payment_details.${paymentIndex}.allocations` as any, allocations, {
            shouldDirty: true,
            shouldValidate: false,
        });
    };

    const updateAllocationRow = (paymentIndex: number, allocationIndex: number, patch: Partial<FormAllocationRow>) => {
        const currentRows = (paymentDetails?.[paymentIndex]?.allocations || []) as FormAllocationRow[];
        const updatedRows = currentRows.map((row, index) => (
            index === allocationIndex ? { ...row, ...patch } : row
        ));
        setAllocationRowsForIndex(paymentIndex, updatedRows);
    };

    const addAllocationRow = (paymentIndex: number) => {
        const partyId = String(paymentDetails?.[paymentIndex]?.customer_id || '');
        const invoiceOptions = dueInvoicesByParty.get(partyId) || [];
        const currentRows = (paymentDetails?.[paymentIndex]?.allocations || []) as FormAllocationRow[];
        const nextInvoice = invoiceOptions.find((invoice) => !currentRows.some((row) => row.order_id === invoice.order_id));

        setAllocationRowsForIndex(paymentIndex, [
            ...currentRows,
            { order_id: nextInvoice?.order_id || '', amount: '' },
        ]);
    };

    const removeAllocationRow = (paymentIndex: number, allocationIndex: number) => {
        const currentRows = (paymentDetails?.[paymentIndex]?.allocations || []) as FormAllocationRow[];
        setAllocationRowsForIndex(
            paymentIndex,
            currentRows.filter((_, index) => index !== allocationIndex)
        );
    };

    const handleRowKeyDown = (e: React.KeyboardEvent, isLastRow: boolean) => {
        if (e.key === 'Enter' && isLastRow) {
            e.preventDefault();
            addRowAndFocus();
        }
    };

    const onSubmit = (data: any) => {
        if (data.type === 'Payment' && showPaymentMode) {
            const selectedAccount = accounts.find((account) => String(account.id) === String(data.account_id));
            const accountCurrency = String(selectedAccount?.currency || data.currency || 'USD').toUpperCase() === 'AFN' ? 'AFN' : 'USD';
            const details: Array<{
                customer_id?: number;
                supplier_id?: number;
                debit_amount: number;
                credit_amount: number;
                balance_amount: number;
                remarks: string;
                allocations?: Array<{ order_id: number; amount: number }>;
            }> = [];

            for (const row of (data.payment_details || [])) {
                if (!row?.customer_id) continue;

                const partyId = Number(row.customer_id);
                const pending = Number(pendingByParty.get(String(row.customer_id || '')) || 0);
                const isAutoAllocate = row.auto_allocate !== false;

                const manualRows = Array.isArray(row.allocations) ? row.allocations : [];
                const manualAllocations: Array<{ order_id: number; amount: number }> = [];
                const seenOrderIds = new Set<string>();

                for (const allocation of manualRows) {
                    const orderId = String(allocation?.order_id || '').trim();
                    const amount = Number(allocation?.amount || 0);
                    if (!orderId || amount <= 0) continue;

                    if (seenOrderIds.has(orderId)) {
                        toast.error('Duplicate invoice selected in manual allocation rows.');
                        return;
                    }

                    const invoiceDue = Number(invoiceDueByOrderId.get(orderId) || 0);
                    if (invoiceDue > 0 && amount > invoiceDue + 0.01) {
                        toast.error('Manual allocation cannot exceed invoice due.');
                        return;
                    }

                    seenOrderIds.add(orderId);
                    manualAllocations.push({
                        order_id: Number(orderId),
                        amount: Number(amount.toFixed(2)),
                    });
                }

                const manualTotal = Number(
                    manualAllocations.reduce((sum, allocation) => sum + allocation.amount, 0).toFixed(2)
                );
                const enteredReceived = Number(row.paid_now || 0);
                const received = !isAutoAllocate && enteredReceived <= 0
                    ? manualTotal
                    : enteredReceived;

                if (!isAutoAllocate) {
                    if (manualAllocations.length === 0) {
                        toast.error('Add at least one manual invoice allocation or switch back to auto allocate.');
                        return;
                    }

                    if (manualTotal <= 0) {
                        toast.error('Manual allocation amount must be greater than zero.');
                        return;
                    }

                    if (manualTotal > received + 0.01) {
                        toast.error(`Manual allocation total cannot exceed ${partyLabel.toLowerCase()} payment amount.`);
                        return;
                    }
                }

                details.push({
                    ...(paymentType === 'payable'
                        ? { supplier_id: partyId }
                        : { customer_id: partyId }),
                    debit_amount: Number(pending.toFixed(2)),
                    credit_amount: Number(received.toFixed(2)),
                    balance_amount: Number(Math.max(pending - received, 0).toFixed(2)),
                    remarks: row.remarks || '',
                    allocations: !isAutoAllocate ? manualAllocations : undefined,
                });
            }

            const filteredDetails = details.filter((d) => d.credit_amount > 0 || d.debit_amount > 0);

            if (filteredDetails.length === 0) {
                toast.error(`Please add at least one ${partyLabel.toLowerCase()} payment row.`);
                return;
            }

            onSave({
                kind: 'payment',
                payment_id: paymentData?.id,
                payment_type: paymentType,
                date: data.date,
                account_id: data.account_id,
                currency: accountCurrency,
                salesman: data.salesman,
                booker: data.booker,
                notes: data.notes,
                details: filteredDetails,
            });
            return;
        }

        onSave(data);
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-4">
                <div className="flex items-end gap-3 flex-wrap">
                    <DenseInput label="Serial No" value={isPaymentEdit ? (paymentData?.serial_no || paymentData?.id || 'Auto') : (nextSerial || 'Auto')} readOnly className="bg-gray-50 w-28" />
                    <DenseInput label="Date" type="date" {...register('date', { required: true })} className="w-40" />
                </div>
                <div className="flex gap-3 flex-wrap justify-end w-full md:w-auto">
                    {visibleTypes.map((t) => {
                        const allowed = allowedTypes.includes(t);
                        return (
                            <label key={t} className={clsx("flex items-center gap-2", allowed ? "cursor-pointer" : "cursor-not-allowed opacity-40")}> 
                                <input 
                                    type="radio" 
                                    value={t} 
                                    {...register('type')} 
                                    disabled={!allowed}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className={clsx(
                                    "text-sm font-medium px-3 py-1 rounded-full",
                                    type === t && t === 'Payment' ? "bg-emerald-100 text-emerald-800" :
                                    type === t && t === 'Income' ? "bg-green-100 text-green-800" :
                                    type === t && t === 'Expense' ? "bg-red-100 text-red-800" :
                                    type === t && t === 'Transfer' ? "bg-blue-100 text-blue-800" :
                                    "bg-gray-100 text-gray-600"
                                )}>{t}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {showPaymentMode ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <DenseSelect
                            label="Payment For"
                            options={[
                                { value: 'receivable', label: 'Customer Receivable' },
                                { value: 'payable', label: 'Supplier Payable' },
                            ]}
                            {...register('payment_type')}
                        />
                        <DenseSelect 
                            label="Account" 
                            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                            {...register('account_id', { required: true })}
                        />
                        <DenseSelect 
                            label="Currency"  
                            options={[
                                { value: 'USD', label: 'USD' },
                                { value: 'AFN', label: 'AFN' }
                            ]}
                            disabled
                            {...register('currency')} 
                        />
                        <DenseInput label="Salesman" {...register('salesman')} placeholder="e.g. Ahmad" />
                        <DenseInput label="Booker" {...register('booker')} placeholder="e.g. Admin" disabled className="bg-gray-50" />
                    </div>
                    <div className="grid grid-cols-1">
                        <DenseInput
                            label="Notes"
                            {...register('notes')}
                            placeholder={paymentType === 'payable' ? 'Payment made to supplier...' : 'Received by...'}
                        />
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                            <p className="text-xs font-semibold text-gray-600 uppercase">Payment Details</p>
                            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRowAndFocus}>
                                <Plus size={14} /> Add {partyLabel}
                            </Button>
                        </div>
                        <div className="max-h-[420px] overflow-auto">
                            <div className="space-y-3 p-2 md:hidden">
                                {fields.length === 0 && (
                                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-center text-xs text-gray-400">
                                        No {partyLabel.toLowerCase()}s added
                                    </div>
                                )}

                                {fields.map((field, index) => {
                                    const current = paymentDetails?.[index] || ({} as FormPaymentDetailRow);
                                    const partyId = String(current?.customer_id || '');
                                    const debit = partyId ? (pendingByParty.get(partyId) || 0) : 0;
                                    const isAutoAllocate = current?.auto_allocate !== false;
                                    const allocationRows = (current?.allocations || []) as FormAllocationRow[];
                                    const allocatedTotal = allocationRows.reduce((sum, allocation) => sum + Number(allocation?.amount || 0), 0);
                                    const paidNow = isAutoAllocate
                                        ? Number(current?.paid_now || 0)
                                        : Number(current?.paid_now || 0) || Number(allocatedTotal.toFixed(2));
                                    const dueNow = Math.max(debit - paidNow, 0);
                                    const isLastRow = index === fields.length - 1;
                                    const invoiceOptions = dueInvoicesByParty.get(partyId) || [];

                                    return (
                                        <div key={field.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-semibold text-gray-700">{partyLabel} #{index + 1}</p>
                                                <button
                                                    type="button"
                                                    aria-label="Remove customer row"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => remove(index)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <Controller
                                                    name={`payment_details.${index}.customer_id`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <SearchableSelect
                                                            options={partyOptions}
                                                            value={field.value}
                                                            onChange={(val) => {
                                                                field.onChange(val);
                                                                setSelectedPartyId(String(val || ''));
                                                                setValue(`payment_details.${index}.auto_allocate` as any, true, {
                                                                    shouldDirty: true,
                                                                    shouldValidate: false,
                                                                });
                                                                setAllocationRowsForIndex(index, []);
                                                            }}
                                                            placeholder={`Select ${partyLabel}`}
                                                            width="100%"
                                                            triggerId={`payment-customer-${index}`}
                                                        />
                                                    )}
                                                />
                                                {partyId && (
                                                    <div className="text-[10px] text-amber-700">
                                                        {invoiceOptions.length > 0
                                                            ? `Outstanding ${debit.toFixed(2)} across ${invoiceOptions.length} invoice(s)`
                                                            : `No outstanding invoices for this ${partyLabel.toLowerCase()}`}
                                                    </div>
                                                )}

                                                <DenseInput
                                                    label="Remarks"
                                                    {...register(`payment_details.${index}.remarks`)}
                                                    placeholder="Remarks"
                                                    onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                />

                                                <DenseInput
                                                    label="Credit"
                                                    type="number"
                                                    step="0.01"
                                                    className="text-right"
                                                    onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                    {...register(`payment_details.${index}.paid_now`, {
                                                        onChange: (event) => {
                                                            if (!isAutoAllocate && allocationRows.length === 1) {
                                                                updateAllocationRow(index, 0, { amount: event.target.value });
                                                            }
                                                        },
                                                    })}
                                                />

                                                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px]">
                                                    <label className="inline-flex items-center gap-1 font-medium text-gray-600">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAutoAllocate}
                                                            onChange={(event) => {
                                                                const checked = event.target.checked;
                                                                setValue(`payment_details.${index}.auto_allocate` as any, checked, {
                                                                    shouldDirty: true,
                                                                    shouldValidate: false,
                                                                });
                                                                if (checked) {
                                                                    setAllocationRowsForIndex(index, []);
                                                                } else if (allocationRows.length === 0) {
                                                                    addAllocationRow(index);
                                                                }
                                                            }}
                                                        />
                                                        {isAutoAllocate ? 'Auto' : 'Manual'}
                                                    </label>
                                                    <span className="font-semibold text-orange-600">Due {dueNow.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {!isAutoAllocate && (
                                                <div className="mt-3 space-y-2 rounded border border-amber-100 bg-amber-50/30 p-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                                            Manual Invoice Allocation
                                                        </p>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-[11px]"
                                                            onClick={() => addAllocationRow(index)}
                                                            disabled={!partyId || invoiceOptions.length === 0}
                                                        >
                                                            <Plus size={12} className="mr-1" />
                                                            Add {invoiceLabel}
                                                        </Button>
                                                    </div>

                                                    {!partyId && (
                                                        <p className="text-[11px] text-gray-500">Select a {partyLabel.toLowerCase()} first to allocate against invoices.</p>
                                                    )}

                                                    {partyId && invoiceOptions.length === 0 && (
                                                        <p className="text-[11px] text-gray-500">No open invoices found for this {partyLabel.toLowerCase()}.</p>
                                                    )}

                                                    {partyId && invoiceOptions.length > 0 && allocationRows.length === 0 && (
                                                        <p className="text-[11px] text-gray-500">Add one or more invoice rows to allocate this payment manually.</p>
                                                    )}

                                                    {allocationRows.length > 0 && (
                                                        <div className="space-y-2">
                                                            {allocationRows.map((allocation, allocationIndex) => {
                                                                const selectedDue = Number(invoiceDueByOrderId.get(String(allocation.order_id || '')) || 0);

                                                                return (
                                                                    <div key={`${field.id}-allocation-mobile-${allocationIndex}`} className="rounded-md border border-gray-200 bg-white p-2">
                                                                        <div className="space-y-2">
                                                                            <select
                                                                                className="h-8 w-full rounded-md border border-gray-300 px-2 text-xs"
                                                                                value={allocation.order_id || ''}
                                                                                onChange={(event) => updateAllocationRow(index, allocationIndex, { order_id: event.target.value })}
                                                                                title="Select invoice"
                                                                                aria-label="Select invoice"
                                                                            >
                                                                                <option value="">Select Invoice</option>
                                                                                {invoiceOptions.map((invoice) => (
                                                                                    <option key={invoice.order_id} value={invoice.order_id}>
                                                                                        {invoice.invoice_no} - Due {invoice.due_amount.toFixed(2)}
                                                                                    </option>
                                                                                ))}
                                                                            </select>

                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    className="h-8 w-full rounded-md border border-gray-300 px-2 text-right text-xs"
                                                                                    value={allocation.amount ?? ''}
                                                                                    onChange={(event) => updateAllocationRow(index, allocationIndex, { amount: event.target.value })}
                                                                                    placeholder="0.00"
                                                                                />
                                                                                {selectedDue > 0 && (
                                                                                    <span className="whitespace-nowrap text-[10px] text-gray-500">/{selectedDue.toFixed(2)}</span>
                                                                                )}
                                                                                <button
                                                                                    type="button"
                                                                                    className="text-red-500 hover:text-red-700"
                                                                                    onClick={() => removeAllocationRow(index, allocationIndex)}
                                                                                    aria-label="Remove allocation row"
                                                                                >
                                                                                    <Trash2 size={13} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}

                                                            <div className="text-[11px] text-gray-600">
                                                                Total Allocated: <span className="font-semibold">{allocatedTotal.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <table className="hidden w-full table-fixed text-xs md:table">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="w-10 px-2 py-2">S.No</th>
                                        <th className="w-52 px-2 py-2 text-left">{partyLabel}</th>
                                        <th className="w-44 px-2 py-2 text-left">Remarks</th>
                                        <th className="w-24 px-2 py-2 text-left">Mode</th>
                                        <th className="w-24 px-2 py-2 text-right">Credit</th>
                                        <th className="w-24 px-2 py-2 text-right">Due</th>
                                        <th className="w-10 px-2 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {fields.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-6 text-center text-gray-400">No {partyLabel.toLowerCase()}s added</td>
                                        </tr>
                                    )}
                                    {fields.map((field, index) => {
                                        const current = paymentDetails?.[index] || ({} as FormPaymentDetailRow);
                                        const partyId = String(current?.customer_id || '');
                                        const debit = partyId ? (pendingByParty.get(partyId) || 0) : 0;
                                        const isAutoAllocate = current?.auto_allocate !== false;
                                        const allocationRows = (current?.allocations || []) as FormAllocationRow[];
                                        const allocatedTotal = allocationRows.reduce((sum, allocation) => sum + Number(allocation?.amount || 0), 0);
                                        const paidNow = isAutoAllocate
                                            ? Number(current?.paid_now || 0)
                                            : Number(current?.paid_now || 0) || Number(allocatedTotal.toFixed(2));
                                        const dueNow = Math.max(debit - paidNow, 0);
                                        const isLastRow = index === fields.length - 1;
                                        const invoiceOptions = dueInvoicesByParty.get(partyId) || [];

                                        return (
                                            <Fragment key={field.id}>
                                                <tr
                                                    className="hover:bg-blue-50/40"
                                                    onClick={() => {
                                                        if (current?.customer_id) {
                                                            setSelectedPartyId(String(current.customer_id));
                                                        }
                                                    }}
                                                >
                                                    <td className="px-2 py-2 text-center text-gray-500">{index + 1}</td>
                                                    <td className="px-2 py-2">
                                                        <Controller
                                                            name={`payment_details.${index}.customer_id`}
                                                            control={control}
                                                            render={({ field }) => (
                                                                <SearchableSelect
                                                                    options={partyOptions}
                                                                    value={field.value}
                                                                    onChange={(val) => {
                                                                        field.onChange(val);
                                                                        setSelectedPartyId(String(val || ''));
                                                                        setValue(`payment_details.${index}.auto_allocate` as any, true, {
                                                                            shouldDirty: true,
                                                                            shouldValidate: false,
                                                                        });
                                                                        setAllocationRowsForIndex(index, []);
                                                                    }}
                                                                    placeholder={`Select ${partyLabel}`}
                                                                    width="220px"
                                                                    triggerId={`payment-customer-${index}`}
                                                                />
                                                            )}
                                                        />
                                                        {partyId && (
                                                            <div className="mt-1 text-[10px] text-amber-700">
                                                                {invoiceOptions.length > 0
                                                                    ? `Outstanding ${debit.toFixed(2)} across ${invoiceOptions.length} invoice(s)`
                                                                    : `No outstanding invoices for this ${partyLabel.toLowerCase()}`}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <DenseInput
                                                            {...register(`payment_details.${index}.remarks`)}
                                                            placeholder="Remarks"
                                                            onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <label className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600">
                                                            <input
                                                                type="checkbox"
                                                                checked={isAutoAllocate}
                                                                onChange={(event) => {
                                                                    const checked = event.target.checked;
                                                                    setValue(`payment_details.${index}.auto_allocate` as any, checked, {
                                                                        shouldDirty: true,
                                                                        shouldValidate: false,
                                                                    });
                                                                    if (checked) {
                                                                        setAllocationRowsForIndex(index, []);
                                                                    } else if (allocationRows.length === 0) {
                                                                        addAllocationRow(index);
                                                                    }
                                                                }}
                                                            />
                                                            {isAutoAllocate ? 'Auto' : 'Manual'}
                                                        </label>
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <DenseInput
                                                            type="number"
                                                            step="0.01"
                                                            className="text-right"
                                                            onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                            {...register(`payment_details.${index}.paid_now`, {
                                                                onChange: (event) => {
                                                                    if (!isAutoAllocate && allocationRows.length === 1) {
                                                                        updateAllocationRow(index, 0, { amount: event.target.value });
                                                                    }
                                                                },
                                                            })}
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2 text-right font-medium">{dueNow.toFixed(2)}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        <button type="button" aria-label="Remove customer row" className="text-red-500 hover:text-red-700" onClick={() => remove(index)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>

                                                {!isAutoAllocate && (
                                                    <tr className="bg-amber-50/30">
                                                        <td colSpan={7} className="px-2 py-2">
                                                            <div className="space-y-2 rounded border border-amber-100 bg-white p-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                                                        Manual Invoice Allocation
                                                                    </p>
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 px-2 text-[11px]"
                                                                        onClick={() => addAllocationRow(index)}
                                                                        disabled={!partyId || invoiceOptions.length === 0}
                                                                    >
                                                                        <Plus size={12} className="mr-1" />
                                                                        Add {invoiceLabel}
                                                                    </Button>
                                                                </div>

                                                                {!partyId && (
                                                                    <p className="text-[11px] text-gray-500">Select a {partyLabel.toLowerCase()} first to allocate against invoices.</p>
                                                                )}

                                                                {partyId && invoiceOptions.length === 0 && (
                                                                    <p className="text-[11px] text-gray-500">No open invoices found for this {partyLabel.toLowerCase()}.</p>
                                                                )}

                                                                {partyId && invoiceOptions.length > 0 && allocationRows.length === 0 && (
                                                                    <p className="text-[11px] text-gray-500">Add one or more invoice rows to allocate this payment manually.</p>
                                                                )}

                                                                {allocationRows.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        {allocationRows.map((allocation, allocationIndex) => {
                                                                            const selectedDue = Number(invoiceDueByOrderId.get(String(allocation.order_id || '')) || 0);

                                                                            return (
                                                                                <div key={`${field.id}-allocation-${allocationIndex}`} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_130px_32px]">
                                                                                    <select
                                                                                        className="h-8 rounded-md border border-gray-300 px-2 text-xs"
                                                                                        value={allocation.order_id || ''}
                                                                                        onChange={(event) => updateAllocationRow(index, allocationIndex, { order_id: event.target.value })}
                                                                                        title="Select invoice"
                                                                                        aria-label="Select invoice"
                                                                                    >
                                                                                        <option value="">Select Invoice</option>
                                                                                        {invoiceOptions.map((invoice) => (
                                                                                            <option key={invoice.order_id} value={invoice.order_id}>
                                                                                                {invoice.invoice_no} - Due {invoice.due_amount.toFixed(2)}
                                                                                            </option>
                                                                                        ))}
                                                                                    </select>

                                                                                    <div className="flex items-center gap-2">
                                                                                        <input
                                                                                            type="number"
                                                                                            step="0.01"
                                                                                            className="h-8 w-full rounded-md border border-gray-300 px-2 text-right text-xs"
                                                                                            value={allocation.amount ?? ''}
                                                                                            onChange={(event) => updateAllocationRow(index, allocationIndex, { amount: event.target.value })}
                                                                                            placeholder="0.00"
                                                                                        />
                                                                                        {selectedDue > 0 && (
                                                                                            <span className="whitespace-nowrap text-[10px] text-gray-500">/{selectedDue.toFixed(2)}</span>
                                                                                        )}
                                                                                    </div>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="text-red-500 hover:text-red-700"
                                                                                        onClick={() => removeAllocationRow(index, allocationIndex)}
                                                                                        aria-label="Remove allocation row"
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        <div className="text-[11px] text-gray-600">
                                                                            Total Allocated: <span className="font-semibold">{allocatedTotal.toFixed(2)}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex flex-wrap gap-4 px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">Total Credit:</span>
                                <span>{totals.received.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">Total Due:</span>
                                <span>{totals.remaining.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-semibold">Current Pending:</span>
                                <span>{(pendingByParty.get(selectedPartyId) || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DenseInput label="Amount" type="number" step="0.01" {...register('amount', { required: true, valueAsNumber: true })} />
                    
                    <DenseSelect 
                        label={type === 'Transfer' ? "From Account" : "Account"} 
                        options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                        {...register('account_id', { required: true })}
                    />
                </div>
            )}

            {type === 'Transfer' ? (
                <div className="grid grid-cols-1">
                    <DenseSelect 
                        label="To Account" 
                        options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                        {...register('to_account_id', { required: true })}
                    />
                </div>
            ) : type === 'Income' && !showPaymentMode ? (
                <div className="grid grid-cols-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <Controller
                        name="contact_id"
                        control={control}
                        render={({ field }) => (
                            <SearchableSelect
                                options={customers.map(c => ({ value: c.id, label: c.name }))}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Select or search customer..."
                                width="300px"
                            />
                        )}
                    />
                </div>
            ) : type === 'Expense' ? (
                <div className="grid grid-cols-1">
                    <DenseInput label="Category" {...register('category', { required: true })} placeholder="e.g. Rent, Salary, Utilities" />
                </div>
            ) : null}

            {!showPaymentMode && type !== 'Payment' && <DenseInput label="Description" {...register('description')} />}

            {type === 'Expense' && (
                <div className="border rounded-md p-3 bg-gray-50 border-dashed border-gray-300">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Paperclip size={16} /> Attachment / Receipt
                    </label>
                    <div className="flex gap-2 items-center">
                        <input type="file" aria-label="Attachment" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        <Button type="button" variant="outline" size="sm" onClick={() => alert("Scan functionality would open camera here")}>
                            <Scan size={14} className="mr-1"/> Scan
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onCancel} 
                    size="sm" 
                    className="gap-2"
                    disabled={!hasPermission?.('account.transaction.cancel' as any)}
                >
                    <X size={14} /> Cancel
                </Button>
                <Button 
                    type="submit" 
                    size="sm" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    disabled={!hasPermission?.('account.transaction.save' as any)}
                >
                    <Save size={14} /> Save
                </Button>
            </div>
        </form>
    );
};
