import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
import { useStore, Sale } from '../../store';
import { Modal } from '../components/ui/Modal';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Button } from '../components/ui/button';
import { Trash2, Plus, Printer, Save, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { InvoiceTemplate } from '../components/print/InvoiceTemplate';
import { PrintHandler } from '../components/print/PrintHandler';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const SaleForm = ({ initialData, onSave, onCancel }: { initialData?: Sale, onSave: (data: any) => void, onCancel: () => void }) => {
  const { customers, products, currentUser, sales, purchases, returns } = useStore();
  const nextId = sales.length > 0 ? Math.max(...sales.map(s => parseInt(s.invoice_no) || 0)) + 1 : 1;

  const { register, control, handleSubmit, setValue, watch, formState: { errors }, setFocus } = useForm({
    defaultValues: initialData || {
      customer_id: '',
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      invoice_no: nextId.toString(),
      items: [{ product_id: '', batch_no: '', quantity: 1, bonus: 0, sale_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, exp_date: '' }],
      sub_total: 0,
      total_discount: 0,
      total_tax: 0,
      net_payable: 0,
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
      const lineTotal = item.quantity * item.sale_price;
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
    setValue('net_payable', sub - disc + tax);
  }, [JSON.stringify(items.map(i => ({ q: i.quantity, p: i.sale_price, dp: i.discount_percent, tp: i.tax_percent }))), setValue]);

  const getBatchStock = (productId: string) => {
    const batchMap = new Map<string, { qty: number, exp: string, date: string }>();

    // Add from Purchases
    purchases.forEach(p => {
        p.items.forEach(i => {
            if (i.product_id === productId) {
                const b = i.batch_no || 'N/A';
                if (!batchMap.has(b)) {
                    batchMap.set(b, { 
                        qty: 0, 
                        exp: i.exp_date || '', 
                        date: p.purchase_date
                    });
                }
                const current = batchMap.get(b)!;
                current.qty += i.quantity + (i.bonus || 0);
                if (new Date(p.purchase_date) < new Date(current.date)) {
                    current.date = p.purchase_date;
                }
            }
        });
    });

    // Subtract from Sales
    sales.forEach(s => {
        s.items.forEach(i => {
            if (i.product_id === productId) {
                const b = i.batch_no || 'N/A';
                if (batchMap.has(b)) {
                    batchMap.get(b)!.qty -= (i.quantity + (i.bonus || 0));
                }
            }
        });
    });

    // Add back from Returns
    returns.forEach(r => {
        r.items.forEach(i => {
            if (i.product_id === productId) {
                const b = i.batch_no || 'N/A';
                if (batchMap.has(b)) {
                    batchMap.get(b)!.qty += (i.quantity + (i.bonus || 0));
                }
            }
        });
    });

    return Array.from(batchMap.entries())
        .map(([batch_no, data]) => ({ batch_no, ...data }))
        .filter(b => b.qty > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setValue(`items.${index}.sale_price`, prod.sale_price);
      
      const batches = getBatchStock(productId);
      
      // Calculate how much of each batch is used by *other* rows
      const currentItems = watch('items');
      const usedInOtherRows = new Map<string, number>();
      currentItems.forEach((item, idx) => {
          if (idx !== index && item.product_id === productId) {
              const b = item.batch_no || 'N/A';
              usedInOtherRows.set(b, (usedInOtherRows.get(b) || 0) + (item.quantity || 0) + (item.bonus || 0));
          }
      });

      let selectedBatch = null;
      for (const batch of batches) {
          const used = usedInOtherRows.get(batch.batch_no) || 0;
          if (batch.qty - used > 0) {
              selectedBatch = batch;
              break;
          }
      }

      if (selectedBatch) {
          setValue(`items.${index}.batch_no`, selectedBatch.batch_no === 'N/A' ? '' : selectedBatch.batch_no);
          setValue(`items.${index}.exp_date`, selectedBatch.exp);
      } else {
           setValue(`items.${index}.batch_no`, '');
           setValue(`items.${index}.exp_date`, '');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      append({ product_id: '', batch_no: '', quantity: 1, bonus: 0, sale_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, exp_date: '' });
      setTimeout(() => {
        setFocus(`items.${index + 1}.product_id`);
      }, 50);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <Controller
          control={control}
          name="customer_id"
          rules={{ required: 'Required' }}
          render={({ field }) => (
            <SearchableSelect 
              label="Customer" 
              options={customers.map(c => ({ value: c.id, label: c.name }))}
              value={field.value}
              onChange={field.onChange}
              className="bg-white"
              error={errors.customer_id?.message as string}
            />
          )}
        />
        <DenseInput label="Sale Date" type="date" {...register('sale_date', { required: 'Required' })} className="bg-white" />
        <DenseInput label="Invoice No" {...register('invoice_no')} readOnly className="bg-gray-100" />
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse text-xs min-w-[900px]">
          <thead className="bg-gray-100 sticky top-0 z-10 font-semibold text-gray-600">
            <tr>
              <th className="px-3 py-2 w-8">#</th>
              <th className="px-3 py-2 w-48">Product</th>
              <th className="px-3 py-2 w-24">Batch</th>
              <th className="px-3 py-2 w-24">Exp</th>
              <th className="px-3 py-2 w-16">Qty</th>
              <th className="px-3 py-2 w-16">Bonus</th>
              <th className="px-3 py-2 w-20">Price</th>
              <th className="px-3 py-2 w-16">Disc %</th>
              <th className="px-3 py-2 w-16">Tax %</th>
              <th className="px-3 py-2 w-24 text-right">Amount</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field, index) => (
              <tr key={field.id} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-3 py-2 text-center text-gray-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <Controller
                    control={control}
                    name={`items.${index}.product_id`}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <SearchableSelect
                        options={products.map(p => ({ 
                            value: p.id, 
                            label: `${p.name} (Qty: ${p.stock_qty})`,
                            disabled: p.stock_qty <= 0
                        }))}
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
                <td className="px-3 py-2"><input className="w-full h-7 px-2 border border-gray-300 rounded text-xs bg-gray-50 text-gray-500 focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.batch_no`)} readOnly tabIndex={-1} /></td>
                <td className="px-3 py-2"><input type="date" className="w-full h-7 px-2 border border-gray-300 rounded text-xs bg-gray-50 text-gray-500 focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.exp_date`)} readOnly tabIndex={-1} /></td>
                <td className="px-3 py-2 relative">
                  <input 
                    type="number" 
                    className={`w-full h-7 px-2 border rounded text-xs focus:ring-1 outline-none ${errors.items?.[index]?.quantity ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500'}`}
                    {...register(`items.${index}.quantity`, { 
                        valueAsNumber: true, 
                        min: 1,
                        validate: (value) => {
                            const item = items[index];
                            if (!item.product_id) return true;
                            
                            const batches = getBatchStock(item.product_id);
                            const currentBatchNo = item.batch_no || 'N/A';
                            
                            const batch = batches.find(b => b.batch_no === currentBatchNo);
                            
                            // Calculate required total including bonus
                            // Note: 'value' here is quantity. Item might have old quantity in it, so we use 'value' as current input.
                            // But we also need current bonus.
                            const currentBonus = item.bonus || 0;
                            const totalReq = (value || 0) + currentBonus;

                            if (!batch) {
                                // If we can't find the batch info, but we have the product, check total stock?
                                const prod = products.find(p => p.id === item.product_id);
                                if (prod && totalReq > prod.stock_qty) return `Max ${prod.stock_qty} (incl bonus)`;
                                return true; 
                            }

                            // Check usage in other rows
                            let usedInOtherRows = 0;
                            items.forEach((i, idx) => {
                                if (idx !== index && i.product_id === item.product_id) {
                                    const b = i.batch_no || 'N/A';
                                    if (b === currentBatchNo) {
                                        usedInOtherRows += (i.quantity || 0) + (i.bonus || 0);
                                    }
                                }
                            });
                            
                            const available = batch.qty - usedInOtherRows;
                            if (totalReq > available) return `Max ${available} (Total)`;
                            
                            return true;
                        }
                    })} 
                  />
                  {errors.items?.[index]?.quantity && (
                      <div className="absolute top-full left-0 z-50 bg-red-100 text-red-600 text-[10px] px-1 py-0.5 rounded shadow border border-red-200 mt-0.5 whitespace-nowrap">
                          {errors.items[index].quantity.message}
                      </div>
                  )}
                </td>
                <td className="px-3 py-2 relative">
                   <input 
                      type="number" 
                      className={`w-full h-7 px-2 border rounded text-xs focus:ring-1 outline-none ${errors.items?.[index]?.bonus ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500'}`}
                      {...register(`items.${index}.bonus`, { 
                          valueAsNumber: true,
                          validate: (value) => {
                              const item = items[index];
                              if (!item.product_id) return true;
                              
                              const batches = getBatchStock(item.product_id);
                              const currentBatchNo = item.batch_no || 'N/A';
                              const batch = batches.find(b => b.batch_no === currentBatchNo);
                              
                              const currentQty = item.quantity || 0;
                              const totalReq = currentQty + (value || 0);

                              if (!batch) {
                                  const prod = products.find(p => p.id === item.product_id);
                                  if (prod && totalReq > prod.stock_qty) return `Max ${prod.stock_qty}`;
                                  return true; 
                              }

                              let usedInOtherRows = 0;
                              items.forEach((i, idx) => {
                                  if (idx !== index && i.product_id === item.product_id) {
                                      const b = i.batch_no || 'N/A';
                                      if (b === currentBatchNo) {
                                          usedInOtherRows += (i.quantity || 0) + (i.bonus || 0);
                                      }
                                  }
                              });
                              
                              const available = batch.qty - usedInOtherRows;
                              if (totalReq > available) return `Max ${available}`;
                              
                              return true;
                          }
                      })} 
                   />
                   {errors.items?.[index]?.bonus && (
                      <div className="absolute top-full left-0 z-50 bg-red-100 text-red-600 text-[10px] px-1 py-0.5 rounded shadow border border-red-200 mt-0.5 whitespace-nowrap">
                          {errors.items[index].bonus.message}
                      </div>
                   )}
                </td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.sale_price`, { valueAsNumber: true })} /></td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.discount_percent`, { valueAsNumber: true })} /></td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.tax_percent`, { valueAsNumber: true })} onKeyDown={(e) => handleKeyDown(e, index)} /></td>
                <td className="px-3 py-2 font-medium text-right text-gray-700">${items[index]?.amount?.toFixed(2)}</td>
                <td className="px-3 py-2 text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Button 
            type="button" 
            variant="ghost" 
            onClick={() => append({ product_id: '', batch_no: '', quantity: 1, bonus: 0, sale_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, exp_date: '' })} 
            className="text-xs text-blue-600 font-semibold hover:text-blue-800 hover:bg-blue-50 h-8 px-3"
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
          
          <div className="text-gray-500 text-right pr-4">Total Discount:</div>
          <div className="font-bold text-right text-red-600">-{watch('total_discount').toFixed(2)}</div>
          
          <div className="text-gray-500 text-right pr-4">Total Tax:</div>
          <div className="font-bold text-right text-blue-600">+{watch('total_tax').toFixed(2)}</div>
          
          <div className="text-gray-900 font-bold text-right pr-4 text-sm pt-2 border-t border-gray-200">Net Payable:</div>
          <div className="font-bold text-right text-sm pt-2 border-t border-gray-200 text-green-700">${watch('net_payable').toFixed(2)}</div>
          
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
             ${(watch('net_payable') - (watch('paid_amount') || 0)).toFixed(2)}
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

export const SalesPage = () => {
  const { sales, customers, products, tenant, printSettings, addSale, updateSale, deleteSale, hasPermission } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | undefined>(undefined);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [printData, setPrintData] = useState<Sale | null>(null);

  const handleSave = (data: any) => {
    if (editingSale) {
      updateSale(editingSale.id, data);
    } else {
      addSale(data);
    }
    setIsModalOpen(false);
    setEditingSale(undefined);
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingSale(undefined);
    setIsModalOpen(true);
  };

  const handleDelete = (sale: Sale) => {
    if (!window.confirm('Delete this sale invoice?')) return;
    deleteSale(sale.id);
  };

  const onPrint = (sale: Sale) => {
    console.log('Initiating print for sale:', sale.invoice_no);
    setPrintData(sale);
  };

  const handleDownload = async (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customer_id);
    await generateInvoicePDF('Sale', sale, tenant, products, customer, printSettings);
  };

  const enrichedSales = sales.map(s => ({
    ...s,
    customer_name: customers.find(c => c.id === s.customer_id)?.name || ''
  }));

  const columns = [
    { header: 'S.NO', accessorKey: 'invoice_no' as keyof Sale, sortable: true },
    { header: 'Customer', accessorKey: 'customer_name', sortable: true, cell: (i: any) => i.customer_name || '-' },
    { header: 'Total', accessorKey: 'net_payable', sortable: true, cell: (i: Sale) => i.net_payable.toFixed(2) },
    { header: 'Paid', accessorKey: 'paid_amount', sortable: true, cell: (i: Sale) => (i.paid_amount || 0).toFixed(2) },
    { header: 'Remaining', cell: (i: Sale) => (i.net_payable - (i.paid_amount || 0)).toFixed(2) },
    { header: 'Inv Date', accessorKey: 'sale_date' as keyof Sale, sortable: true },
    { 
      header: 'Actions', 
      cell: (i: Sale) => (
        <div className="flex items-center gap-1">
          <ActionButtons 
            onView={() => setViewSale(i)} 
            onEdit={hasPermission('sales.edit') ? () => handleEdit(i) : undefined}
            onDelete={hasPermission('sales.delete') ? () => handleDelete(i) : undefined}
            onDownload={() => handleDownload(i)} 
          />
          <Tooltip>
            <TooltipTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    onClick={() => onPrint(i)}
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

  if (!hasPermission('sales.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable data={enrichedSales} columns={columns as any} title="Sales Invoices" onAdd={handleAdd} canAdd={hasPermission('sales.create')} addLabel="Sale" />
      
      <Modal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingSale(undefined);
        }}
        title={editingSale ? "Edit Sales Invoice" : "New Sales Invoice"}
        size="xl"
      >
        <SaleForm key={editingSale?.id ?? 'new'} initialData={editingSale} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)} title="Invoice Details" size="full">
        {viewSale && (
            <div className="flex flex-col h-full bg-gray-100">
                 <div className="flex-1 overflow-auto flex justify-center p-0">
                    <div className="bg-white shadow-lg h-fit scale-[0.9] origin-top my-4 print:fixed print:top-0 print:left-0 print:m-0 print:p-0 print:w-[210mm] print:h-auto print:scale-100 print:shadow-none print:z-[9999]">
                        <InvoiceTemplate data={viewSale} type="sale" />
                    </div>
                 </div>
                 <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-white gap-4 shrink-0 z-10 print:hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>
                        <span className="block font-semibold">Created By</span>
                        {viewSale.created_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Created At</span>
                        {viewSale.created_at ? format(new Date(viewSale.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewSale.updated_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated At</span>
                        {viewSale.updated_at ? format(new Date(viewSale.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setViewSale(null)}>Close</Button>
                      <Button variant="outline" onClick={() => handleDownload(viewSale)}>
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
            type="sale" 
            onAfterPrint={() => setPrintData(null)} 
        />
      )}
    </>
  );
};
