import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, Transaction, Payment } from '@/store';
import { Button } from '@/app/components/ui/button';
import { DenseInput, DenseSelect } from '@/app/components/ui/Form';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Paperclip, Scan, Save, X, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { SearchableSelect } from '@/app/components/ui/SearchableSelect';
import { paymentApi } from '@/api/payments';

export const TransactionForm = ({ initialData, paymentData, onSave, onCancel }: { initialData?: Transaction, paymentData?: Payment, onSave: (data: any) => void, onCancel: () => void }) => {
    // Safety check for useStore
    const store = useStore ? useStore() : null;
    if (!store) return <div className="p-4 text-center text-gray-500">Loading form...</div>;

    const { accounts, customers, sales, returns, currentUser } = store;
    const [nextSerial, setNextSerial] = useState<string>('');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const didAutoFocus = useRef(false);
    const isPaymentEdit = !!paymentData;
    const paymentDefaults = useMemo(() => (paymentData ? {
        type: 'Payment' as any,
        date: new Date(paymentData.date).toISOString().split('T')[0],
        account_id: paymentData.account_id,
        currency: paymentData.currency,
        salesman: paymentData.salesman || '',
        booker: paymentData.booker || currentUser?.name || '',
        notes: paymentData.notes || '',
        payment_details: (paymentData.details || []).map((d) => ({
            customer_id: d.customer_id,
            paid_now: d.credit_amount,
            remarks: d.remarks || ''
        }))
    } : null), [paymentData, currentUser?.name]);

    const initialDefaults = useMemo(() => (initialData ? {
        ...initialData,
        date: new Date(initialData.date).toISOString().split('T')[0],
        payment_details: []
    } : null), [initialData]);

    const newDefaults = {
        date: new Date().toISOString().split('T')[0],
        type: 'Payment' as any,
        payment_method: 'Cash',
        currency: 'USD',
        salesman: '',
        booker: currentUser?.name || '',
        notes: '',
        payment_details: [{ customer_id: '', paid_now: '', remarks: '' }]
    };

    const { register, control, handleSubmit, watch, setValue, reset } = useForm({
        defaultValues: paymentDefaults || initialDefaults || newDefaults
    });

    const type = watch('type');
    const showPaymentMode = type === 'Payment' && (!initialData || isPaymentEdit);

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
                : [{ customer_id: '', debit_amount: '', paid_now: '', remarks: '' }];
            reset({ ...paymentDefaults, payment_details: details });
            return;
        }

        if (initialDefaults) {
            reset(initialDefaults);
        }
    }, [paymentDefaults, initialDefaults, reset]);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    const pendingByCustomer = useMemo(() => {
        const salesTotals = new Map<string, { total: number; paid: number }>();
        sales
            .filter(s => s.invoice_type === 'sale')
            .forEach(s => {
                const key = String(s.customer_id || '');
                if (!key) return;
                const current = salesTotals.get(key) || { total: 0, paid: 0 };
                current.total += Number(s.net_payable || 0);
                current.paid += Number(s.paid_amount || 0);
                salesTotals.set(key, current);
            });

        const returnTotals = new Map<string, number>();
        returns.forEach(r => {
            const key = String(r.customer_id || '');
            if (!key) return;
            const current = returnTotals.get(key) || 0;
            returnTotals.set(key, current + Number(r.net_amount || r.total_amount || 0));
        });

        const pendingMap = new Map<string, number>();
        salesTotals.forEach((val, key) => {
            const returned = returnTotals.get(key) || 0;
            const pending = Math.max(val.total - val.paid - returned, 0);
            pendingMap.set(key, Number(pending.toFixed(2)));
        });

        return pendingMap;
    }, [sales, returns]);

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'payment_details' as const,
    });

    const paymentDetails = watch('payment_details') || [];

    useEffect(() => {
        const last = [...paymentDetails].reverse().find((d: any) => d?.customer_id);
        if (last?.customer_id) {
            setSelectedCustomerId(String(last.customer_id));
        }
    }, [paymentDetails]);

    const totals = paymentDetails.reduce(
        (acc: { pending: number; received: number; remaining: number }, row: any) => {
            const customerId = String(row?.customer_id || '');
            const pending = customerId ? (pendingByCustomer.get(customerId) || 0) : 0;
            const received = Number(row?.paid_now || 0);
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
        append({ customer_id: '', paid_now: '', remarks: '' });
        focusCustomerRow(newIndex);
    };

    const handleRowKeyDown = (e: React.KeyboardEvent, isLastRow: boolean) => {
        if (e.key === 'Enter' && isLastRow) {
            e.preventDefault();
            addRowAndFocus();
        }
    };

    const onSubmit = (data: any) => {
        if (data.type === 'Payment' && showPaymentMode) {
            const details = (data.payment_details || [])
                .filter((d: any) => d.customer_id)
                .map((d: any) => {
                    const pending = Number(pendingByCustomer.get(String(d.customer_id || '')) || 0);
                    const received = Number(d.paid_now || 0);
                    return {
                        customer_id: Number(d.customer_id),
                        debit_amount: Number(pending.toFixed(2)),
                        credit_amount: Number(received.toFixed(2)),
                        balance_amount: Number(Math.max(pending - received, 0).toFixed(2)),
                        remarks: d.remarks || ''
                    };
                })
                .filter((d: any) => d.credit_amount > 0 || d.debit_amount > 0);

            onSave({
                kind: 'payment',
                payment_id: paymentData?.id,
                date: data.date,
                account_id: data.account_id,
                currency: data.currency,
                salesman: data.salesman,
                booker: data.booker,
                notes: data.notes,
                details,
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
                    {['Payment', 'Income', 'Expense', 'Transfer'].map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                value={t} 
                                {...register('type')} 
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
                    ))}
                </div>
            </div>

            {showPaymentMode ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                            {...register('currency')} 
                        />
                        <DenseInput label="Salesman" {...register('salesman')} placeholder="e.g. Ahmad" />
                        <DenseInput label="Booker" {...register('booker')} placeholder="e.g. Admin" disabled className="bg-gray-50" />
                    </div>
                    <div className="grid grid-cols-1">
                        <DenseInput label="Notes" {...register('notes')} placeholder="Received by..." />
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                            <p className="text-xs font-semibold text-gray-600 uppercase">Payment Details</p>
                            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRowAndFocus}>
                                <Plus size={14} /> Add Customer
                            </Button>
                        </div>
                        <div className="overflow-auto min-h-[180px] max-h-[240px]">
                            <table className="w-full text-xs table-fixed">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="px-2 py-2 w-10">S.No</th>
                                        <th className="px-2 py-2 text-left w-56">Customer</th>
                                        <th className="px-2 py-2 text-left w-48">Remarks</th>
                                        <th className="px-2 py-2 text-right w-24">Credit</th>
                                        <th className="px-2 py-2 text-right w-24">Due</th>
                                        <th className="px-2 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {fields.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-3 py-6 text-center text-gray-400">No customers added</td>
                                        </tr>
                                    )}
                                    {fields.map((field, index) => {
                                        const current = paymentDetails?.[index] || {};
                                        const customerId = String(current?.customer_id || '');
                                        const debit = customerId ? (pendingByCustomer.get(customerId) || 0) : 0;
                                        const paidNow = Number(current?.paid_now || 0);
                                        const dueNow = Math.max(debit - paidNow, 0);
                                        const isLastRow = index === fields.length - 1;

                                        return (
                                            <tr
                                                key={field.id}
                                                className="hover:bg-blue-50/40"
                                                onClick={() => {
                                                    if (current?.customer_id) {
                                                        setSelectedCustomerId(String(current.customer_id));
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
                                                                options={customerOptions}
                                                                value={field.value}
                                                                onChange={(val) => {
                                                                    field.onChange(val);
                                                                    setSelectedCustomerId(String(val || ''));
                                                                }}
                                                                placeholder="Select Customer"
                                                                width="220px"
                                                                triggerId={`payment-customer-${index}`}
                                                            />
                                                        )}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <DenseInput
                                                        {...register(`payment_details.${index}.remarks`)}
                                                        placeholder="Remarks"
                                                        onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <DenseInput
                                                        type="number"
                                                        step="0.01"
                                                        className="text-right"
                                                        onKeyDown={(e) => handleRowKeyDown(e, isLastRow)}
                                                        {...register(`payment_details.${index}.paid_now`)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-right font-medium">{dueNow.toFixed(2)}</td>
                                                <td className="px-2 py-2 text-center">
                                                    <button type="button" aria-label="Remove customer row" className="text-red-500 hover:text-red-700" onClick={() => remove(index)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
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
                                <span className="font-semibold">Current Balance:</span>
                                <span>{(pendingByCustomer.get(selectedCustomerId) || 0).toFixed(2)}</span>
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
                                options={customerOptions}
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
