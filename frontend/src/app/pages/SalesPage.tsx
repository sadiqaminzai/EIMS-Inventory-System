import { useState, useEffect, useRef } from 'react';
import styles from './SalesPage.module.css';
import { useForm, useFieldArray, useWatch, Controller, useFormContext } from 'react-hook-form';
import { useStore, Sale } from '../../store';
import { inventoryApi, InventoryBatch } from '../../api/inventory';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Button } from '../components/ui/button';
import { Trash2, Plus, Printer, Save, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatDateTime } from '../utils/dateTime';
import { InvoiceTemplate } from '../components/print/InvoiceTemplate';
import { PrintHandler } from '../components/print/PrintHandler';
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const SaleForm = ({ initialData, onSave, onCancel }: { initialData?: Sale, onSave: (data: any) => void, onCancel: () => void }) => {
  const { customers, suppliers, products, currentUser, sales, purchases, returns, printSettings, hasPermission } = useStore();
  const resolveType = (s: Sale) => (s.invoice_type || 'sale') as 'sale' | 'purchase' | 'return_in' | 'return_out' | 'quotation';
  const getNextId = (type: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'quotation') => {
    const filtered = sales.filter(s => resolveType(s) === type);
    const max = filtered.length > 0 ? Math.max(...filtered.map(s => parseInt(s.invoice_no) || 0)) : 0;
    return max + 1;
  };

  const emptyItem = { product_id: '', batch_no: '', quantity: 1, bonus: 0, sale_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, exp_date: '' };

  const { register, control, handleSubmit, setValue, watch, trigger, formState: { errors }, setFocus, getValues } = useForm({
    shouldUnregister: true,
    defaultValues: initialData || {
      invoice_type: 'sale',
      customer_id: '',
      supplier_id: '',
      sale_date: format(new Date(), 'yyyy-MM-dd'),
      invoice_no: getNextId('sale').toString(),
      items: [emptyItem],
      sub_total: 0,
      total_discount: 0,
      total_tax: 0,
      net_payable: 0,
      paid_amount: 0,
      created_by: currentUser.id
    }
  });

  const normalizeDateInput = (value?: string | null) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const datePart = value.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? '' : format(parsed, 'yyyy-MM-dd');
  };

  const { fields, append, replace, remove } = useFieldArray({ control, name: 'items' });
  const items = useWatch({ control, name: 'items' }) || [];
  const handleRemoveItem = (index: number) => {
    if (fields.length <= 1) {
      replace([emptyItem]);
    } else {
      remove(index);
    }
  };
  const invoiceType = (watch('invoice_type') || 'sale') as 'sale' | 'purchase' | 'return_in' | 'return_out' | 'quotation';
  const [batchCache, setBatchCache] = useState<Record<number, InventoryBatch[]>>({});

  useEffect(() => {
    let active = true;
    const loadBatches = async () => {
      if (!products.length) return;
      try {
        const entries = await Promise.all(
          products.map(async (p) => [
            Number(p.id),
            await inventoryApi.getProductBatches(Number(p.id)),
          ] as const)
        );
        if (active) {
          setBatchCache(Object.fromEntries(entries));
        }
      } catch {
        // ignore batch fetch errors to avoid blocking UI
      }
    };
    loadBatches();
    return () => {
      active = false;
    };
  }, [products]);

  useEffect(() => {
    if (initialData) return;
    setValue('invoice_no', getNextId(invoiceType).toString());
  }, [invoiceType, initialData, setValue, sales.length]);

  useEffect(() => {
    if (invoiceType === 'purchase' || invoiceType === 'return_out') {
      setValue('customer_id', '');
    } else {
      setValue('supplier_id', '');
    }
  }, [invoiceType, setValue]);

  useEffect(() => {
    if (initialData) return;
    const useCostPrice = invoiceType === 'purchase' || invoiceType === 'return_out';
    const currentItems = getValues('items') || [];
    currentItems.forEach((item: any, index: number) => {
      if (!item?.product_id) return;
      const prod = products.find(p => p.id === item.product_id);
      if (!prod) return;
      const nextPrice = useCostPrice ? prod.cost_price : prod.sale_price;
      setValue(`items.${index}.sale_price`, nextPrice);
    });
  }, [invoiceType, products, setValue, getValues, initialData]);

  const calcLineAmount = (item: any) => {
    const quantity = Number(item?.quantity) || 0;
    const salePrice = Number(item?.sale_price) || 0;
    const discountPercent = Number(item?.discount_percent) || 0;
    const taxPercent = Number(item?.tax_percent) || 0;
    if (quantity <= 0 || salePrice <= 0) return 0;
    const lineTotal = quantity * salePrice;
    const itemDiscount = (lineTotal * discountPercent) / 100;
    const itemTax = ((lineTotal - itemDiscount) * taxPercent) / 100;
    return lineTotal - itemDiscount + itemTax;
  };

  // Auto-calculate totals with dynamic updates
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
      
      if (quantity > 0 && salePrice > 0) {
        const lineTotal = quantity * salePrice;
        const itemDiscount = (lineTotal * discountPercent) / 100;
        const itemTax = ((lineTotal - itemDiscount) * taxPercent) / 100;
        const amount = lineTotal - itemDiscount + itemTax;

        // Always update calculations to ensure consistency
        setValue(`items.${index}.amount`, Number(amount.toFixed(2)));
        setValue(`items.${index}.discount`, Number(itemDiscount.toFixed(2)));
        setValue(`items.${index}.tax`, Number(itemTax.toFixed(2)));
        
        sub += lineTotal;
        disc += itemDiscount;
        tax += itemTax;
      } else {
        // Clear amounts when quantity or price is 0
        setValue(`items.${index}.amount`, 0);
        setValue(`items.${index}.discount`, 0);
        setValue(`items.${index}.tax`, 0);
      }
    });

    setValue('sub_total', Number(sub.toFixed(2)));
    setValue('total_discount', Number(disc.toFixed(2)));
    setValue('total_tax', Number(tax.toFixed(2)));
    setValue('net_payable', Number((sub - disc + tax).toFixed(2)));
  }, [items, setValue]);

  // Add new row and focus on product field
  const addNewItem = () => {
    // Prevent double-add by disabling button during add, or debounce if needed
    append({ product_id: '', batch_no: '', quantity: 1, bonus: 0, sale_price: 0, discount_percent: 0, tax_percent: 0, discount: 0, tax: 0, amount: 0, exp_date: '' });
    setTimeout(() => focusProductSelect(fields.length), 0);
  };

  // Get total stock for a product (sum of all batches, including bonus)
  const getTotalStock = (productId: string) => {
    if (!productId) return 0;
    const cached = batchCache[Number(productId)] || [];
    if (cached.length > 0) {
      return cached.reduce((sum, b) => sum + (b.quantity_remaining || 0), 0);
    }
    const product = products.find(p => p.id === productId);
    return product ? product.stock_qty : 0;
  };

  // FIFO remaining stock for dropdown (first available batch after used in other rows)
  const getFifoRemainingStock = (productId: string) => {
    if (!productId) return 0;
    const batches = batchCache[Number(productId)] || [];
    if (batches.length === 0) {
      const product = products.find(p => p.id === productId);
      return product ? product.stock_qty : 0;
    }

    const used = items
      .filter(i => i.product_id === productId)
      .reduce((sum, i) => sum + (i.quantity || 0) + (i.bonus || 0), 0);

    let remainingUsed = used;
    for (const batch of batches) {
      const qty = batch.quantity_remaining || 0;
      if (remainingUsed <= 0) return qty;
      if (qty > remainingUsed) return qty - remainingUsed;
      remainingUsed -= qty;
    }
    return 0;
  };

  const getBatchStock = (productId: string) => {
    const cached = batchCache[Number(productId)] || [];
    if (cached.length > 0) {
      return cached
        .map((b) => ({
          batch_no: b.batch_no || 'N/A',
          qty: b.quantity_remaining,
          exp: normalizeDateInput(b.expiry_date),
          date: b.received_date,
        }))
        .filter(b => b.qty > 0)
        .sort((a, b) => {
          if (a.batch_no === 'N/A' && b.batch_no !== 'N/A') return -1;
          if (a.batch_no !== 'N/A' && b.batch_no === 'N/A') return 1;
          // Sort by batch_no numerically for FIFO
          const aBatch = parseInt(a.batch_no) || 0;
          const bBatch = parseInt(b.batch_no) || 0;
          return aBatch - bBatch;
        });
    }
    const batchMap = new Map<string, { qty: number, exp: string, date: string }>();

    // Add from Purchases
    purchases.forEach(p => {
        p.items.forEach(i => {
            if (i.product_id === productId) {
                const b = i.batch_no || 'N/A';
                if (!batchMap.has(b)) {
                    batchMap.set(b, { 
                        qty: 0, 
                    exp: normalizeDateInput(i.exp_date), 
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
        .sort((a, b) => {
          if (a.batch_no === 'N/A' && b.batch_no !== 'N/A') return -1;
          if (a.batch_no !== 'N/A' && b.batch_no === 'N/A') return 1;
          // Sort by batch_no numerically for FIFO
          const aBatch = parseInt(a.batch_no) || 0;
          const bBatch = parseInt(b.batch_no) || 0;
          return aBatch - bBatch;
        });
  };

  const getFifoBatchForRow = (productId: string, rowIndex: number) => {
    const batches = getBatchStock(productId);
    if (batches.length === 0) return { batch_no: '', exp: '' };

    const used = items
      .filter((i, idx) => idx !== rowIndex && i.product_id === productId)
      .reduce((sum, i) => sum + (i.quantity || 0) + (i.bonus || 0), 0);

    let remainingUsed = used;
    for (const batch of batches) {
      const qty = batch.qty || 0;
      if (remainingUsed <= 0) return { batch_no: batch.batch_no, exp: batch.exp };
      if (qty > remainingUsed) return { batch_no: batch.batch_no, exp: batch.exp };
      remainingUsed -= qty;
    }

    return { batch_no: '', exp: '' };
  };

  const focusProductSelect = (rowIndex: number) => {
    setTimeout(() => {
      const trigger = document.getElementById(`sales-item-product-${rowIndex}`) as HTMLElement | null;
      if (trigger) trigger.focus();
    }, 50);
  };

  const handleProductChange = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const useCostPrice = invoiceType === 'purchase' || invoiceType === 'return_out';
      setValue(`items.${index}.sale_price`, useCostPrice ? prod.cost_price : prod.sale_price);
      if (invoiceType === 'sale' || invoiceType === 'return_out') {
        const fifo = getFifoBatchForRow(productId, index);
        setValue(`items.${index}.batch_no`, fifo.batch_no || '');
        setValue(`items.${index}.exp_date`, fifo.exp || '');
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
      focusProductSelect(index + 1);
    }
  };

  const priceLabel = invoiceType === 'purchase' || invoiceType === 'return_out' ? 'Cost' : 'Price';
  const partyLabel = invoiceType === 'purchase' || invoiceType === 'return_out' ? 'Supplier' : 'Customer';
  const partyOptions = invoiceType === 'purchase' || invoiceType === 'return_out'
    ? suppliers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(s => ({ value: s.id, label: s.name }))
    : customers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(c => ({ value: c.id, label: c.name }));

  const invoiceTypeOptions = [
    { label: 'Sales', value: 'sale', perm: 'sales.create', title: 'Sales Invoice' },
    { label: 'S. Return', value: 'return_in', perm: 'return_in.create', title: 'Sales Return' },
    { label: 'Purchase', value: 'purchase', perm: 'purchase.create', title: 'Purchase Invoice' },
    { label: 'P. Return', value: 'return_out', perm: 'return_out.create', title: 'Purchase Return' },
    { label: 'Quotation', value: 'quotation', perm: 'sales.create', title: 'Quotation Invoice' },
  ];

  return (
    <form onSubmit={handleSubmit(onSave)} className="flex flex-col h-full">
      <div className="flex flex-col md:flex-row gap-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200 items-end">
        <div className="w-full md:w-[340px]">
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            {partyLabel.toUpperCase()}
            {((invoiceType === 'purchase' || invoiceType === 'return_out') && errors.supplier_id) || (invoiceType !== 'purchase' && invoiceType !== 'return_out' && errors.customer_id) ? (
              <span className="ml-2 text-xs text-red-500 font-normal align-middle">
                {invoiceType === 'purchase' || invoiceType === 'return_out' ? errors.supplier_id?.message : errors.customer_id?.message}
              </span>
            ) : null}
          </label>
          <Controller
            key={invoiceType === 'purchase' || invoiceType === 'return_out' ? 'supplier_id' : 'customer_id'}
            control={control}
            name={invoiceType === 'purchase' || invoiceType === 'return_out' ? 'supplier_id' : 'customer_id'}
            rules={{ required: 'Required' }}
            render={({ field }) => (
              <SearchableSelect 
                label=""
                options={partyOptions}
                value={field.value}
                onChange={field.onChange}
                className="bg-white"
                width="340px"
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Type</span>
          <div className={styles['invoice-type-radio-group']}>
            {invoiceTypeOptions.map((opt) => (
              <label
                key={opt.value}
                title={opt.title}
                className={styles['invoice-type-radio-label']}
              >
                <input
                  type="radio"
                  value={opt.value}
                  {...register('invoice_type')}
                  className="h-3 w-3 text-blue-600 accent-blue-600 mr-1"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-end gap-4">
          <DenseInput label="Invoice No" {...register('invoice_no')} readOnly className="bg-gray-100 w-[80px]" />
          <DenseInput label="Invoice Date" type="date" {...register('sale_date', { required: 'Required' })} className="bg-white w-[120px]" />
        </div>
      </div>

      <div className="flex-1 overflow-hidden border border-gray-200 rounded-lg shadow-sm">
        <div className="h-[220px] overflow-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead className="bg-gray-100 sticky top-0 z-10 font-semibold text-gray-600">
              <tr>
                <th className="px-3 py-2 w-8">#</th>
                <th className="px-3 py-2 w-48">Product</th>
                <th className="px-3 py-2 w-24">Batch</th>
                <th className="px-3 py-2 w-24">Exp</th>
                <th className="px-3 py-2 w-20">Qty</th>
                <th className="px-3 py-2 w-20">Bonus</th>
                <th className="px-3 py-2 w-24">{priceLabel}</th>
                <th className="px-3 py-2 w-20">Disc %</th>
                <th className="px-3 py-2 w-20">Tax %</th>
                <th className="px-3 py-2 w-28 text-right">Amount</th>
                <th className="px-3 py-2 w-8">
                  <button
                    type="button"
                    aria-label="Add item"
                    title="Add new item"
                    onClick={addNewItem}
                    className="flex items-center justify-center rounded-full border border-green-200 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-900 hover:border-green-400 h-6 w-6 p-0 m-0 transition-colors duration-150"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
            {fields.map((field, index) => (
              <tr key={field.id || index} className="hover:bg-blue-50/50 transition-colors">
                <td className="px-3 py-2 text-center text-gray-500">{index + 1}</td>
                <td className="px-3 py-2 w-48 max-w-[12rem] overflow-hidden">
                  <Controller
                    control={control}
                    name={`items.${index}.product_id`}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <SearchableSelect
                        options={products
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(p => {
                            if (invoiceType === 'quotation') {
                              return {
                                value: p.id,
                                label: p.name,
                                disabled: false
                              };
                            }
                            const useFifo = invoiceType === 'sale';
                            const fifoQty = getFifoRemainingStock(p.id);
                            const totalQty = getTotalStock(p.id);
                            const displayQty = useFifo ? fifoQty : totalQty;
                            return {
                              value: p.id,
                              label: `${p.name} (Qty: ${displayQty})`,
                              disabled: (invoiceType === 'sale' || invoiceType === 'return_out')
                                ? fifoQty <= 0
                                : false
                            };
                          })}
                        value={field.value}
                        onChange={(val) => {
                            field.onChange(val);
                            handleProductChange(index, val);
                        }}
                        placeholder="Select Product"
                        width="380px"
                        triggerId={`sales-item-product-${index}`}
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    {...register(`items.${index}.batch_no`)}
                    readOnly={invoiceType === 'sale'}
                    tabIndex={invoiceType === 'sale' ? -1 : 0}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    {...register(`items.${index}.exp_date`)}
                    readOnly={invoiceType === 'sale'}
                    tabIndex={invoiceType === 'sale' ? -1 : 0}
                  />
                </td>
                <td className="px-3 py-2 relative">
                  <input 
                    type="number" 
                    className={`w-full h-7 px-2 border rounded text-xs focus:ring-1 outline-none ${errors.items?.[index]?.quantity ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500'}`}
                    {...register(`items.${index}.quantity`, { 
                      valueAsNumber: true, 
                      min: 1,
                      onChange: () => trigger(),
                      validate: (value) => {
                        if (!value || value <= 0) return 'Required';
                        if (invoiceType === 'quotation') return true;
                        if (initialData && (invoiceType === 'sale' || invoiceType === 'return_out')) return true;
                        // --- original validation logic for other types ---
                        if (invoiceType === 'purchase' || invoiceType === 'return_in') return true;
                        const item = items[index];
                        if (!item.product_id) return true;
                        const batches = getBatchStock(item.product_id);
                        const currentBatchNo = item.batch_no || 'N/A';
                        const batch = batches.find(b => b.batch_no === currentBatchNo);
                        const currentBonus = item.bonus || 0;
                        const totalReq = (value || 0) + currentBonus;
                        if (!batch) {
                          const prod = products.find(p => p.id === item.product_id);
                          if (prod && totalReq > prod.stock_qty) return `Max ${prod.stock_qty} (incl bonus)`;
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
                        onChange: () => trigger(),
                        validate: (value) => {
                        if (invoiceType === 'quotation') return true;
                        if (initialData && (invoiceType === 'sale' || invoiceType === 'return_out')) return true;
                        if (invoiceType === 'purchase' || invoiceType === 'return_in') return true;
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
                     {invoiceType !== 'quotation' && errors.items?.[index]?.bonus && (
                      <div className="absolute top-full left-0 z-50 bg-red-100 text-red-600 text-[10px] px-1 py-0.5 rounded shadow border border-red-200 mt-0.5 whitespace-nowrap">
                        {errors.items[index].bonus.message}
                      </div>
                     )}
                </td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.sale_price`, { valueAsNumber: true, onChange: () => trigger() })} /></td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.discount_percent`, { valueAsNumber: true, onChange: () => trigger() })} /></td>
                <td className="px-3 py-2"><input type="number" step="0.01" className="w-full h-7 px-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" {...register(`items.${index}.tax_percent`, { valueAsNumber: true, onChange: () => trigger() })} onKeyDown={(e) => handleKeyDown(e, index)} /></td>
                <td className="px-3 py-2 font-medium text-right text-gray-700">
                  {calcLineAmount(items[index]).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
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
      </div>

      {/* Footer Totals - Single Row with Fixed Widths */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="relative text-xs bg-gray-50 p-4 rounded border h-10 overflow-hidden min-w-[1100px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Items:</span>
            <span className="font-bold text-gray-900">{items.length}</span>
          </div>
          <div className="absolute left-24 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Qty:</span>
            <span className="font-bold text-blue-600">{items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</span>
          </div>
          <div className="absolute left-40 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Total Stock:</span>
            <span className="font-bold text-gray-600">{[...new Set(items.map(i => i.product_id).filter(Boolean))].reduce((sum, pid) => sum + getTotalStock(pid), 0)}</span>
          </div>
          {printSettings?.show_bonus && (
            <div className="absolute left-64 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-gray-500">Bonus:</span>
              <span className="font-bold text-green-600">{items.reduce((sum, item) => sum + (item.bonus || 0), 0)}</span>
            </div>
          )}
          <div className="absolute left-80 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Sub Total:</span>
            <span className="font-bold text-gray-900">{watch('sub_total').toFixed(2)}</span>
          </div>
          <div className="absolute left-[470px] top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Discount:</span>
            <span className="font-bold text-red-600">-{watch('total_discount').toFixed(2)}</span>
          </div>
          <div className="absolute left-[620px] top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Tax:</span>
            <span className="font-bold text-blue-600">+{watch('total_tax').toFixed(2)}</span>
          </div>
          <div className="absolute left-[740px] top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Net Total:</span>
            <span className="font-bold text-purple-600">{watch('net_payable').toFixed(2)}</span>
          </div>
          <div className="absolute left-[880px] top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Paid:</span>
            <input
              type="number"
              step="0.01"
              className="w-20 text-xs text-right border border-gray-300 rounded px-1 font-bold text-green-600 focus:ring-1 focus:ring-blue-500 outline-none"
              {...register('paid_amount', { valueAsNumber: true, onChange: () => trigger() })}
            />
          </div>
          <div className="absolute left-[1020px] top-1/2 -translate-y-1/2 flex items-center gap-1">
            <span className="text-gray-500">Due:</span>
            <span className="font-bold text-orange-600">{(watch('net_payable') - (watch('paid_amount') || 0)).toFixed(2)}</span>
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
  const { sales, customers, suppliers, products, tenant, printSettings, addSale, updateSale, deleteSale, hasPermission } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | undefined>(undefined);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [printData, setPrintData] = useState<Sale | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'return_in' | 'purchase' | 'return_out' | 'quotation'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

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
    setDeleteTarget(sale);
  };

  const resolveInvoiceType = (sale: Sale) => (sale.invoice_type || 'sale');

  const onPrint = (sale: Sale) => {
    console.log('Initiating print for sale:', sale.invoice_no);
    setPrintData(sale);
  };

  const handleDownload = async (sale: Sale) => {
    const invoiceType = resolveInvoiceType(sale);
    const isSupplier = invoiceType === 'purchase' || invoiceType === 'return_out';
    const party = isSupplier
      ? suppliers.find(s => s.id === sale.supplier_id)
      : customers.find(c => c.id === sale.customer_id);

    const pdfType = invoiceType === 'purchase'
      ? 'Purchase'
      : invoiceType === 'return_out'
        ? 'ReturnOut'
        : invoiceType === 'return_in'
          ? 'ReturnIn'
          : invoiceType === 'quotation'
            ? 'Quotation'
            : 'Sale';

    await generateInvoicePDF(pdfType, sale, tenant, products, party, printSettings);
  };

  const enrichedSales = sales.map(s => {
    const invoiceType = resolveInvoiceType(s);
    const partyName = invoiceType === 'purchase' || invoiceType === 'return_out'
      ? suppliers.find(sp => sp.id === s.supplier_id)?.name
      : customers.find(c => c.id === s.customer_id)?.name;

    return {
      ...s,
      party_name: partyName || ''
    };
  });

  const typeLabel = (type: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'quotation') =>
    type === 'sale' ? 'Sales' :
    type === 'purchase' ? 'Purchase' :
    type === 'return_in' ? 'S. Return' :
    type === 'return_out' ? 'P. Return' : 'Quotation';

  const permPrefixForInvoice = (sale: Sale) => {
    const invoiceType = resolveInvoiceType(sale);
    if (invoiceType === 'purchase') return 'purchase';
    if (invoiceType === 'return_in') return 'return_in';
    if (invoiceType === 'return_out') return 'return_out';
    return 'sales';
  };

  const canInvoice = (sale: Sale, action: string) =>
    hasPermission(`${permPrefixForInvoice(sale)}.${action}` as any);

  const filteredSales = enrichedSales.filter((s) => {
    const invoiceType = resolveInvoiceType(s);
    return typeFilter === 'all' ? true : invoiceType === typeFilter;
  });

  const columns = [
    { header: 'S.NO', accessorKey: 'invoice_no' as keyof Sale, sortable: true },
    { header: 'Type', accessorKey: 'invoice_type' as keyof Sale, sortable: true, cell: (i: Sale) => typeLabel(resolveInvoiceType(i)) },
    { header: 'Party', accessorKey: 'party_name', sortable: true, cell: (i: any) => i.party_name || '-' },
    { header: 'Total', accessorKey: 'net_payable', sortable: true, cell: (i: Sale) => i.net_payable.toFixed(2) },
    { header: 'Paid', accessorKey: 'paid_amount', sortable: true, cell: (i: Sale) => (i.paid_amount || 0).toFixed(2) },
    { header: 'Remaining', cell: (i: Sale) => (i.net_payable - (i.paid_amount || 0)).toFixed(2) },
    { header: 'Inv Date', accessorKey: 'sale_date' as keyof Sale, sortable: true },
    { 
      header: 'Actions', 
      cell: (i: Sale) => (
        <div className="flex items-center gap-1">
          <ActionButtons 
            onView={canInvoice(i, 'view') ? () => setViewSale(i) : undefined} 
            onEdit={canInvoice(i, 'edit') ? () => handleEdit(i) : undefined}
            onDelete={canInvoice(i, 'delete') ? () => handleDelete(i) : undefined}
            onDownload={canInvoice(i, 'export') ? () => handleDownload(i) : undefined} 
          />
          {canInvoice(i, 'print') && (
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
          )}
        </div>
      ) 
    }
  ];

  if (!hasPermission('invoices.view')) return <div>Access Denied</div>;
  const canViewAny = hasPermission('sales.view') || hasPermission('purchase.view') || hasPermission('return_in.view') || hasPermission('return_out.view');
  if (!canViewAny) return <div>Access Denied</div>;

  return (
    <>
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete invoice"
        description="This will permanently delete the invoice, its items, and related inventory logs/batches."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteSale(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
      <DenseTable
        data={filteredSales}
        columns={columns as any}
        title="Invoices"
        headerAfterSearch={
          <div className="flex items-center gap-2 w-full md:w-auto md:ml-2">
            <span className="text-[10px] font-semibold uppercase text-gray-500 whitespace-nowrap">Type</span>
            <DenseSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'All' },
                ...(hasPermission('sales.view') ? [{ value: 'sale', label: 'Sales' }] : []),
                ...(hasPermission('return_in.view') ? [{ value: 'return_in', label: 'S. Return' }] : []),
                ...(hasPermission('purchase.view') ? [{ value: 'purchase', label: 'Purchase' }] : []),
                ...(hasPermission('return_out.view') ? [{ value: 'return_out', label: 'P. Return' }] : []),
                ...(hasPermission('sales.view') ? [{ value: 'quotation', label: 'Quotation' }] : [])
              ]}
              className="w-40"
            />
          </div>
        }
        onAdd={handleAdd}
        canAdd={hasPermission('sales.create') || hasPermission('purchase.create') || hasPermission('return_in.create') || hasPermission('return_out.create')}
        canSearch={hasPermission('sales.search') || hasPermission('purchase.search') || hasPermission('return_in.search') || hasPermission('return_out.search')}
        canExport={hasPermission('sales.export') || hasPermission('purchase.export') || hasPermission('return_in.export') || hasPermission('return_out.export')}
        addLabel="Invoice"
        defaultSort={{ key: 'created_at', direction: 'desc' }}
      />
      
      <Modal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setEditingSale(undefined);
        }}
        title={editingSale ? "Edit Invoice" : "New Invoice"}
        size="xl"
      >
        <SaleForm key={editingSale?.id ?? 'new'} initialData={editingSale} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal open={!!viewSale} onOpenChange={(o) => !o && setViewSale(null)} title="Invoice Details" size="full">
        {viewSale && (
            <div className="flex flex-col h-full bg-gray-100">
                 <div className="flex-1 overflow-auto flex justify-center p-0">
                    <div className="bg-white shadow-lg h-fit scale-[0.9] origin-top my-4 print:hidden">
                        <InvoiceTemplate data={viewSale} type={resolveInvoiceType(viewSale) as any} />
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
                        {formatDateTime(viewSale.created_at)}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewSale.updated_by || 'System'}
                      </div>
                      <div>
                        <span className="block font-semibold">Updated At</span>
                        {formatDateTime(viewSale.updated_at)}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => setViewSale(null)}>Close</Button>
                      <Button variant="outline" onClick={() => handleDownload(viewSale)}>
                          Download PDF
                      </Button>
                      <Button onClick={() => onPrint(viewSale)}>
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
            type={resolveInvoiceType(printData) as any}
            partyName={
              resolveInvoiceType(printData) === 'purchase' || resolveInvoiceType(printData) === 'return_out'
                ? suppliers.find(s => s.id === printData.supplier_id)?.name
                : customers.find(c => c.id === printData.customer_id)?.name
            }
            onAfterPrint={() => setPrintData(null)} 
        />
      )}
    </>
  );
};
