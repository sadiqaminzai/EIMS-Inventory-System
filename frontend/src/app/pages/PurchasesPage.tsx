import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { useStore, Purchase, PurchaseItem } from '../../store';
import { Modal } from '../components/ui/Modal';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Trash2, Plus, Printer, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { InvoiceTemplate } from '../components/print/InvoiceTemplate';
import { PrintHandler } from '../components/print/PrintHandler';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const PurchaseForm = ({ initialData, onSave, onCancel }: { initialData?: Purchase, onSave: (data: any) => void, onCancel: () => void }) => {
  const { suppliers, products, currentUser, purchases } = useStore();
  const nextId = purchases.length > 0 ? Math.max(...purchases.map(p => parseInt(p.invoice_no) || 0)) + 1 : 1;
  
  const { register, control, handleSubmit, setValue, watch, setFocus, formState: { errors } } = useForm({
    defaultValues: initialData || {
      supplier_id: '',
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      invoice_no: nextId.toString(),
      items: [{ product_id: '', batch_no: '', quantity: 1, bonus: 0, cost_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, mfg_date: '', exp_date: '' }],
      sub_total: 0,
      total_discount: 0,
      total_tax: 0,
      grand_total: 0,
      paid_amount: 0,
      created_by: currentUser.id
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  // Auto-calculate totals
  useEffect(() => {
    let sub = 0;
    let disc = 0;
    let tax = 0;

    items.forEach((item, index) => {
      const lineTotal = item.quantity * item.cost_price;
      const itemDiscount = (lineTotal * (item.discount_percent || 0)) / 100;
      const itemTax = ((lineTotal - itemDiscount) * (item.tax_percent || 0)) / 100;
      const amount = lineTotal - itemDiscount + itemTax;

      if (amount !== item.amount || itemDiscount !== item.discount || itemTax !== item.tax) {
        setValue(`items.${index}.amount`, amount);
        setValue(`items.${index}.discount`, itemDiscount);
        setValue(`items.${index}.tax`, itemTax);
      }
      
      sub += lineTotal;
      disc += itemDiscount;
      tax += itemTax;
    });

    setValue('sub_total', sub);
    setValue('total_discount', disc);
    setValue('total_tax', tax);
    setValue('grand_total', sub - disc + tax);
  }, [JSON.stringify(items.map(i => ({ q: i.quantity, c: i.cost_price, dp: i.discount_percent, tp: i.tax_percent }))), setValue]);

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setValue(`items.${index}.cost_price`, prod.cost_price);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      append({ product_id: '', batch_no: '', quantity: 1, bonus: 0, cost_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, mfg_date: '', exp_date: '' });
      // Small timeout to allow render
      setTimeout(() => {
        setFocus(`items.${index + 1}.product_id`);
      }, 50);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
        <Controller
          control={control}
          name="supplier_id"
          rules={{ required: 'Required' }}
          render={({ field }) => (
            <SearchableSelect
              label="Supplier"
              options={suppliers.map(s => ({ value: s.id, label: s.name }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.supplier_id?.message as string}
            />
          )}
        />
        <DenseInput label="Purchase Date" type="date" {...register('purchase_date', { required: 'Required' })} />
        <DenseInput label="Invoice No" {...register('invoice_no')} readOnly />
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-auto border border-gray-200 rounded">
        <table className="w-full text-left border-collapse text-xs min-w-[800px]">
          <thead className="bg-gray-100 sticky top-0 z-10 font-semibold text-gray-600">
            <tr>
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2 w-48">Product</th>
              <th className="px-2 py-2 w-24">Batch</th>
              <th className="px-2 py-2 w-20">Exp Date</th>
              <th className="px-2 py-2 w-16">Qty</th>
              <th className="px-2 py-2 w-16">Bonus</th>
              <th className="px-2 py-2 w-20">Cost</th>
              <th className="px-2 py-2 w-16">Disc %</th>
              <th className="px-2 py-2 w-16">Tax %</th>
              <th className="px-2 py-2 w-24">Amount</th>
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
                <td className="px-2 py-1"><input type="number" step="0.01" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.cost_price`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" step="0.01" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.discount_percent`, { valueAsNumber: true })} /></td>
                <td className="px-2 py-1"><input type="number" step="0.01" className="w-full h-7 px-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.tax_percent`, { valueAsNumber: true })} onKeyDown={(e) => handleKeyDown(e, index)} /></td>
                <td className="px-2 py-1 font-medium text-right text-gray-700">{items[index]?.amount?.toFixed(2)}</td>
                <td className="px-2 py-1 text-center">
                  <button type="button" onClick={() => remove(index)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Button 
          type="button" 
          variant="ghost" 
          size="sm"
          onClick={() => append({ product_id: '', batch_no: '', quantity: 1, bonus: 0, cost_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, mfg_date: '', exp_date: '' })} 
          className="text-blue-600 hover:text-blue-800"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Item
        </Button>
      </div>

      {/* Footer Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
        <div className="col-span-1 md:col-span-2"></div>
        <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-y-1 text-xs">
          <div className="text-gray-500 text-right pr-4">Sub Total:</div>
          <div className="font-bold text-right">{watch('sub_total').toFixed(2)}</div>
          
          <div className="text-gray-500 text-right pr-4">Discount:</div>
          <div className="font-bold text-right text-red-600">-{watch('total_discount').toFixed(2)}</div>
          
          <div className="text-gray-500 text-right pr-4">Tax:</div>
          <div className="font-bold text-right text-blue-600">+{watch('total_tax').toFixed(2)}</div>
          
          <div className="text-gray-900 font-bold text-right pr-4 text-sm pt-2 border-t border-gray-200">Grand Total:</div>
          <div className="font-bold text-right text-sm pt-2 border-t border-gray-200">${watch('grand_total').toFixed(2)}</div>
          
          <div className="text-gray-500 text-right pr-4 self-center">Paid Amount:</div>
          <div className="text-right">
             <input 
                type="number" 
                step="0.01"
                className="w-24 text-right border border-gray-300 rounded px-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                {...register('paid_amount', { valueAsNumber: true })} 
             />
          </div>

          <div className="text-gray-500 text-right pr-4 self-center">Remaining:</div>
          <div className="font-bold text-right text-orange-600">
             ${(watch('grand_total') - (watch('paid_amount') || 0)).toFixed(2)}
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

export const PurchasesPage = () => {
  const { purchases, suppliers, products, tenant, printSettings, addPurchase, updatePurchase, deletePurchase, hasPermission } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | undefined>(undefined);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [printData, setPrintData] = useState<Purchase | null>(null);

  const handleSave = (data: any) => {
    if (editingPurchase) {
      updatePurchase(editingPurchase.id, data);
    } else {
      addPurchase(data);
    }
    setIsModalOpen(false);
  };

  const handleEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingPurchase(undefined);
    setIsModalOpen(true);
  };

  const handleDelete = (purchase: Purchase) => {
    if (!window.confirm('Delete this purchase invoice?')) return;
    deletePurchase(purchase.id);
  };

  const onPrint = (purchase: Purchase) => {
    setPrintData(purchase);
  };

  const handleDownload = async (purchase: Purchase) => {
    const supplier = suppliers.find(s => s.id === purchase.supplier_id);
    await generateInvoicePDF('Purchase', purchase, tenant, products, supplier, printSettings);
  };

  const enrichedPurchases = purchases.map(p => ({
    ...p,
    supplier_name: suppliers.find(s => s.id === p.supplier_id)?.name || ''
  }));

  const columns = [
    { header: 'S.NO', accessorKey: 'invoice_no' as keyof Purchase, sortable: true },
    { header: 'Supplier', accessorKey: 'supplier_name', sortable: true, cell: (i: any) => i.supplier_name || '-' },
    { header: 'Total', accessorKey: 'grand_total', sortable: true, cell: (i: Purchase) => i.grand_total.toFixed(2) },
    { header: 'Paid', accessorKey: 'paid_amount', sortable: true, cell: (i: Purchase) => (i.paid_amount || 0).toFixed(2) },
    { header: 'Remaining', cell: (i: Purchase) => (i.grand_total - (i.paid_amount || 0)).toFixed(2) },
    { header: 'Inv Date', accessorKey: 'purchase_date' as keyof Purchase, sortable: true },
    { 
      header: 'Actions', 
      cell: (i: Purchase) => (
        <div className="flex items-center gap-1">
          <ActionButtons 
            onView={() => setViewPurchase(i)} 
            onEdit={hasPermission('purchase.edit') ? () => handleEdit(i) : undefined}
            onDelete={hasPermission('purchase.delete') ? () => handleDelete(i) : undefined}
            onDownload={() => handleDownload(i)} 
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => onPrint(i)} 
                className="h-8 w-8 text-gray-600 hover:bg-gray-100"
                title="Print Invoice"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Print Invoice</TooltipContent>
          </Tooltip>
        </div>
      ) 
    }
  ];

  if (!hasPermission('purchase.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable 
        data={enrichedPurchases} 
        columns={columns as any} 
        title="Purchase Invoices" 
        onAdd={handleAdd} 
        canAdd={hasPermission('purchase.create')} 
        addLabel="Invoice" 
      />
      
      <Modal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        title={editingPurchase ? "Edit Purchase Invoice" : "New Purchase Invoice"} 
        size="xl"
      >
        <PurchaseForm 
          initialData={editingPurchase} 
          onSave={handleSave} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>

      <Modal open={!!viewPurchase} onOpenChange={(o) => !o && setViewPurchase(null)} title="Purchase Details" size="full">
        {viewPurchase && (
            <div className="flex flex-col h-full bg-gray-100">
                 <div className="flex-1 overflow-auto flex justify-center p-0">
                    <div className="bg-white shadow-lg h-fit scale-[0.9] origin-top my-4 print:fixed print:top-0 print:left-0 print:m-0 print:p-0 print:w-[210mm] print:h-auto print:scale-100 print:shadow-none print:z-[9999]">
                        <InvoiceTemplate data={viewPurchase} type="purchase" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white gap-4 shrink-0 z-10 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>
                        <span className="block font-semibold">Created By</span>
                        {viewPurchase.created_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Created At</span>
                        {viewPurchase.created_at ? format(new Date(viewPurchase.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewPurchase.updated_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated At</span>
                        {viewPurchase.updated_at ? format(new Date(viewPurchase.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setViewPurchase(null)}>Close</Button>
                      <Button variant="outline" onClick={() => handleDownload(viewPurchase)}>
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
            type="purchase" 
            onAfterPrint={() => setPrintData(null)} 
        />
      )}
    </>
  );
};
