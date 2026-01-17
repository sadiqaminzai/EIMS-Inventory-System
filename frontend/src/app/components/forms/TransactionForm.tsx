import { useEffect } from 'react';
import { useStore, Transaction } from '@/store';
import { Button } from '@/app/components/ui/button';
import { DenseInput, DenseSelect } from '@/app/components/ui/Form';
import { useForm, Controller } from 'react-hook-form';
import { Paperclip, Scan, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Save, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Combobox } from '@/app/components/ui/Combobox';

export const TransactionForm = ({ initialData, onSave, onCancel }: { initialData?: Transaction, onSave: (data: any) => void, onCancel: () => void }) => {
    // Safety check for useStore
    const store = useStore ? useStore() : null;
    if (!store) return <div className="p-4 text-center text-gray-500">Loading form...</div>;

    const { accounts, customers } = store;
    const { register, control, handleSubmit, watch, setValue } = useForm({
        defaultValues: initialData ? {
            ...initialData,
            date: new Date(initialData.date).toISOString().split('T')[0]
        } : {
            date: new Date().toISOString().split('T')[0],
            type: 'Income',
            payment_method: 'Cash',
            currency: 'USD'
        }
    });

    const type = watch('type');

    // Update currency when type changes (only for new transactions or if user changes type)
    useEffect(() => {
        if (!initialData) {
            if (type === 'Income') {
                setValue('currency', 'USD');
            } else if (type === 'Expense') {
                setValue('currency', 'AFN');
            }
        }
    }, [type, setValue, initialData]);

    const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));

    return (
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="flex gap-4 border-b border-gray-200 pb-4">
                {['Income', 'Expense', 'Transfer'].map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            value={t} 
                            {...register('type')} 
                            className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className={clsx(
                            "text-sm font-medium px-3 py-1 rounded-full",
                            type === t && t === 'Income' ? "bg-green-100 text-green-800" :
                            type === t && t === 'Expense' ? "bg-red-100 text-red-800" :
                            type === t && t === 'Transfer' ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-600"
                        )}>{t}</span>
                    </label>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DenseInput label="Date" type="date" {...register('date', { required: true })} />
                <DenseSelect 
                    label="Currency"  
                    options={[
                        { value: 'USD', label: 'USD' },
                        { value: 'AFN', label: 'AFN' }
                    ]}
                    {...register('currency')} 
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DenseInput label="Amount" type="number" step="0.01" {...register('amount', { required: true, valueAsNumber: true })} />
                
                <DenseSelect 
                    label={type === 'Transfer' ? "From Account" : "Account"} 
                    options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                    {...register('account_id', { required: true })}
                />
            </div>

            {type === 'Transfer' ? (
                <div className="grid grid-cols-1">
                    <DenseSelect 
                        label="To Account" 
                        options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
                        {...register('to_account_id', { required: true })}
                    />
                </div>
            ) : type === 'Income' ? (
                <div className="grid grid-cols-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <Controller
                        name="contact_id"
                        control={control}
                        render={({ field }) => (
                            <Combobox 
                                options={customerOptions} 
                                value={field.value} 
                                onChange={field.onChange} 
                                placeholder="Select or search customer..."
                            />
                        )}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1">
                    <DenseInput label="Category" {...register('category', { required: true })} placeholder="e.g. Rent, Salary, Utilities" />
                </div>
            )}

            <DenseInput label="Description" {...register('description')} />

            {type === 'Expense' && (
                <div className="border rounded-md p-3 bg-gray-50 border-dashed border-gray-300">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Paperclip size={16} /> Attachment / Receipt
                    </label>
                    <div className="flex gap-2 items-center">
                        <input type="file" className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
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
