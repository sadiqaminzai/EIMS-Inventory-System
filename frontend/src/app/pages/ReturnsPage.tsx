import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { useStore, Return } from '../../store';
import { Modal } from '../components/ui/Modal';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Trash2, Plus, Printer, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateTime } from '../utils/dateTime';
import { InvoiceTemplate } from '../components/print/InvoiceTemplate';
import { PrintHandler } from '../components/print/PrintHandler';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const ReturnForm = ({ initialData, onSave, onCancel }: { initialData?: Return, onSave: (data: any) => void, onCancel: () => void }) => {
  const { customers, products, currentUser, returns, purchases, printSettings } = useStore();
  const nextId = returns.length > 0 ? Math.max(...returns.map(r => parseInt(r.invoice_no) || 0)) + 1 : 1;

  const emptyItem = { product_id: '', batch_no: '', quantity: 1, sale_price: 0, amount: 0, bonus: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, exp_date: '' };

  const { register, control, handleSubmit, setValue, watch, setFocus, formState: { errors }, getValues } = useForm({
    shouldUnregister: true,
    defaultValues: initialData || {
      customer_id: '',
      return_date: format(new Date(), 'yyyy-MM-dd'),
      invoice_no: nextId.toString(),
      items: [emptyItem],
      sub_total: 0,
      total_discount: 0,
      total_tax: 0,
      total_amount: 0,
      created_by: currentUser.id
    }
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const handleRemoveItem = (index: number) => {
    const current = getValues('items') || [];
    const next = current.filter((_: any, i: number) => i !== index);
    if (next.length === 0) {
      replace([emptyItem]);
    } else {
      replace(next);
    }
  };

  useEffect(() => {
    let sub = 0;
    let disc = 0;
    let tax = 0;

    items.forEach((item, index) => {
      // Only calculate if we have valid numeric data
      const quantity = Number(item.quantity) || 0;
      const salePrice = Number(item.sale_price) || 0;
      const discountPercent = Number(item.discount_percent) || 0;
      const taxPercent = Number(item.tax_percent) || 0;
      
      const lineTotal = quantity * salePrice;
      const itemDiscount = (lineTotal * discountPercent) / 100;
      const itemTax = ((lineTotal - itemDiscount) * taxPercent) / 100;
      const amount = lineTotal - itemDiscount + itemTax;

      // Always update calculations to ensure consistency
      setValue(`items.${index}.amount`, amount);
      setValue(`items.${index}.discount`, itemDiscount);
      setValue(`items.${index}.tax`, itemTax);
      
      sub += lineTotal;
      disc += itemDiscount;
      tax += itemTax;
    });
    
    setValue('sub_total', sub);
    setValue('total_discount', disc);
    setValue('total_tax', tax);
    setValue('total_amount', sub - disc + tax);
  }, [items, setValue]);

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setValue(`items.${index}.sale_price`, prod.sale_price);
      
      // Auto-fill Batch and Exp Date from latest purchase (simplest heuristic for "stock")
      const sortedPurchases = [...purchases].sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());
      
      for (const purchase of sortedPurchases) {
          const item = purchase.items.find(i => i.product_id === productId);
          if (item) {
              setValue(`items.${index}.batch_no`, item.batch_no);
              setValue(`items.${index}.exp_date`, item.exp_date);
              break; 
          }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      append(emptyItem);
      setTimeout(() => {
        setFocus(`items.${index + 1}.product_id`);
      }, 50);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <Controller
          control={control}
          name="customer_id"
          rules={{ required: true }}
          render={({ field }) => (
            <SearchableSelect
                label="Customer"
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                value={field.value}
                onChange={field.onChange}
                error={errors.customer_id?.message as string}
            />
          )}
        />
        <DenseInput label="Return Date" type="date" {...register('return_date', { required: true })} />
        <DenseInput label="Return No" {...register('invoice_no')} readOnly />
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 rounded">
        <table className="w-full text-left border-collapse text-xs min-w-[900px]">
          <thead className="bg-gray-100 sticky top-0 font-semibold text-gray-600">
            <tr>
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 w-24">Batch</th>
              <th className="px-2 py-2 w-24">Exp</th>
              <th className="px-2 py-2 w-16">Qty</th>
              <th className="px-2 py-2 w-16">Bonus</th>
              <th className="px-2 py-2 w-24">Price</th>
              <th className="px-2 py-2 w-16">Disc %</th>
              <th className="px-2 py-2 w-16">Tax %</th>
              <th className="px-2 py-2 w-24 text-right">Amount</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, index) => (
              <tr key={field.id} className="hover:bg-blue-50">
                <td className="px-2 py-1 text-center text-gray-500">{index + 1}</td>
                <td className="px-2 py-1">
                  <Controller
                    control={control}
                    name={`items.${index}.product_id`}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <SearchableSelect
                        options={products.map(p => ({ value: p.id, label: p.name }))}
                        value={field.value}
                        onChange={(val) => {
                            field.onChange(val);
                            handleProductChange(index, val);
                        }}
                        placeholder="Select Product"
                        width="300px"
                      />
                    )}
                  />
                </td>
                <td className="px-2 py-1"><input className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.batch_no`)} /></td>
                <td className="px-2 py-1"><input type="date" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.exp_date`)} /></td>
                <td className="px-2 py-1"><input type="number" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.quantity`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.bonus`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.sale_price`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" step="0.01" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.discount_percent`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" step="0.01" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.tax_percent`, { valueAsNumber: true })} onKeyDown={(e) => handleKeyDown(e, index)} /></td>
                <td className="px-2 py-1 text-right font-medium text-gray-700">${items[index]?.amount?.toFixed(2)}</td>
                <td className="px-2 py-1 text-center">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)} className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3 w-3" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => append(emptyItem)} className="text-blue-600 hover:text-blue-800">
          <Plus className="h-3 w-3 mr-1" /> Add Item
        </Button>
      </div>
      
      {/* Footer Totals - Single Row */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs bg-gray-50 p-3 rounded border">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Items:</span>
            <span className="font-bold text-gray-900">{items.length}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Qty:</span>
            <span className="font-bold text-blue-600">{items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</span>
          </div>
          
          {/* Only show bonus if enabled in settings */}
          {printSettings?.show_bonus && (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Bonus:</span>
              <span className="font-bold text-green-600">{items.reduce((sum, item) => sum + (item.bonus || 0), 0)}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Sub Total:</span>
            <span className="font-bold text-gray-900">${watch('sub_total').toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Discount:</span>
            <span className="font-bold text-red-600">-${watch('total_discount').toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Tax:</span>
            <span className="font-bold text-blue-600">+${watch('total_tax').toFixed(2)}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Total Refund:</span>
            <span className="font-bold text-blue-700">${watch('total_amount').toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
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

export const ReturnsPage = () => {
  const { returns, customers, products, tenant, printSettings, addReturn, updateReturn, deleteReturn, hasPermission } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<Return | undefined>(undefined);
  const [viewReturn, setViewReturn] = useState<Return | null>(null);
  const [printData, setPrintData] = useState<Return | null>(null);

  const handleSave = (data: any) => {
    if (editingReturn) {
      updateReturn(editingReturn.id, data);
    } else {
      addReturn(data);
    }
    setIsOpen(false);
    setEditingReturn(undefined);
  };

  const handleEdit = (ret: Return) => {
    setEditingReturn(ret);
    setIsOpen(true);
  };

  const handleAdd = () => {
    setEditingReturn(undefined);
    setIsOpen(true);
  };

  const handleDelete = (ret: Return) => {
    if (!window.confirm('Delete this return record?')) return;
    deleteReturn(ret.id);
  };

  const onPrint = (ret: Return) => {
    setPrintData(ret);
  };

  const handleDownload = async (ret: Return) => {
    const customer = customers.find(c => c.id === ret.customer_id);
    await generateInvoicePDF('Return', ret, tenant, products, customer, printSettings);
  };

  const enrichedReturns = returns.map(r => ({
    ...r,
    customer_name: customers.find(c => c.id === r.customer_id)?.name || ''
  }));

  const columns = [
    { header: 'S.NO', accessorKey: 'invoice_no' as keyof Return, sortable: true },
    { header: 'Customer', accessorKey: 'customer_name', sortable: true, cell: (i: any) => i.customer_name || '-' },
    { header: 'Total', accessorKey: 'total_amount', sortable: true, cell: (i: Return) => i.total_amount.toFixed(2) },
    { header: 'Date', accessorKey: 'return_date' as keyof Return, sortable: true },
    { 
      header: 'Actions', 
      cell: (i: Return) => (
        <div className="flex items-center gap-1">
          <ActionButtons 
            onView={hasPermission('return_in.view') ? () => setViewReturn(i) : undefined} 
            onEdit={hasPermission('return_in.edit') ? () => handleEdit(i) : undefined}
            onDelete={hasPermission('return_in.delete') ? () => handleDelete(i) : undefined}
            onDownload={hasPermission('return_in.export') ? () => handleDownload(i) : undefined}
          />
          {hasPermission('return_in.print') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onPrint(i)} className="h-8 w-8 text-gray-600 hover:bg-gray-100" title="Print">
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print Return</TooltipContent>
            </Tooltip>
          )}
        </div>
      ) 
    }
  ];

  if (!hasPermission('return_in.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable 
        data={enrichedReturns} 
        columns={columns as any} 
        title="Sales Returns" 
        onAdd={handleAdd} 
        canAdd={hasPermission('return_in.create')} 
        addLabel="Return" 
        canSearch={hasPermission('return_in.search')}
        canExport={hasPermission('return_in.export')}
      />
      
      <Modal
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setEditingReturn(undefined);
        }}
        title={editingReturn ? "Edit Return" : "New Return"}
        size="xl"
      >
        <ReturnForm key={editingReturn?.id ?? 'new'} initialData={editingReturn} onSave={handleSave} onCancel={() => setIsOpen(false)} />
      </Modal>

      <Modal open={!!viewReturn} onOpenChange={(o) => !o && setViewReturn(null)} title="Return Details" size="full">
        {viewReturn && (
            <div className="flex flex-col h-full bg-gray-100">
                 <div className="flex-1 overflow-auto flex justify-center p-0">
                    <div className="bg-white shadow-lg h-fit scale-[0.9] origin-top my-4 print:fixed print:top-0 print:left-0 print:m-0 print:p-0 print:w-[210mm] print:h-auto print:scale-100 print:shadow-none print:z-[9999]">
                        <InvoiceTemplate data={viewReturn} type="return" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white gap-4 shrink-0 z-10 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>
                        <span className="block font-semibold">Created By</span>
                        {viewReturn.created_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Created At</span>
                        {formatDateTime(viewReturn.created_at)}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewReturn.updated_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated At</span>
                        {formatDateTime(viewReturn.updated_at)}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setViewReturn(null)}>Close</Button>
                      <Button variant="outline" onClick={() => handleDownload(viewReturn)}>
                          Download PDF
                      </Button>
                      <Button onClick={() => window.print()}>
                          <Printer className="mr-2 h-4 w-4" />
                          Print
                      </Button>
                    </div>
                 </div>
            </div>
        )}
      </Modal>

      {printData && (
        <PrintHandler 
            data={printData} 
            type="return"
            partyName={customers.find(c => c.id === printData.customer_id)?.name}
            onAfterPrint={() => setPrintData(null)} 
        />
      )}
    </>
  );
};
