import { forwardRef } from 'react';
import { useStore, Sale, Purchase, Return } from '../../../store';
import { format } from 'date-fns';
import { formatDateTime } from '../../utils/dateTime';

interface InvoiceTemplateProps {
    data: Sale | Purchase | Return | null;
    type: 'sale' | 'purchase' | 'return' | 'return_in' | 'return_out' | 'quotation';
    id?: string;
}

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(({ data, type, id = 'invoice-template-container' }, ref) => {
    const { tenant, printSettings, customers, suppliers, products, currentUser } = useStore();

    const isSale = type === 'sale';
    const isQuotation = type === 'quotation';
    const isPurchase = type === 'purchase';
    const isReturn = type === 'return' || type === 'return_in';
    const isReturnOut = type === 'return_out';

  if (!data) {
     return (
        <div ref={ref} className="flex items-center justify-center h-full p-10 text-gray-400">
            Preparing document...
        </div>
     );
  }

  // --- Helpers ---

  const getParty = () => {
                if (isSale || isQuotation) return customers.find(c => c.id === (data as Sale).customer_id);
        if (isReturn) return customers.find(c => c.id === (data as Return).customer_id);
        if (isPurchase || isReturnOut) return suppliers.find(s => s.id === (data as Purchase).supplier_id);
    return null;
  };

  const party = getParty();

  const getDate = () => {
      if (isSale || isQuotation) return (data as Sale).sale_date;
      if (isPurchase) return (data as any).purchase_date || (data as any).sale_date;
      if (isReturn || isReturnOut) return (data as Return).return_date || (data as any).sale_date;
      return '';
  };

  const getFormattedDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
        return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch (e) {
        return dateStr;
    }
  };

    const getFormattedDateTime = (dateStr?: string) => formatDateTime(dateStr, 'dd/MM/yyyy h:mm a');

  // --- Footer Calculation ---
  const itemsCount = data.items.length;
  const totalQty = data.items.reduce((acc, item) => acc + item.quantity + (item.bonus || 0), 0);
  
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let paidAmount = 0;
    let totalAmount = 0;

  const hasPurchaseTotals = isPurchase && 'grand_total' in (data as any);

  if (hasPurchaseTotals) {
      const p = data as Purchase;
      totalDiscount = p.total_discount;
      totalTax = p.total_tax;
      totalAmount = p.sub_total;
      grandTotal = p.grand_total;
      paidAmount = p.paid_amount || 0;
  } else if (isSale || isReturnOut || isPurchase) {
      const s = data as Sale;
      totalDiscount = s.total_discount;
      totalTax = s.total_tax;
      totalAmount = s.sub_total;
      grandTotal = s.net_payable;
      paidAmount = s.paid_amount || 0;
  } else if (isReturn) {
      const r = data as Return;
      const fallbackTotal = (data as any).net_payable ?? r.sub_total ?? 0;
      totalDiscount = r.total_discount || 0; 
      totalTax = r.total_tax || 0;
      totalAmount = r.sub_total ?? 0;
      grandTotal = r.net_amount ?? r.total_amount ?? fallbackTotal;
      paidAmount = r.paid_amount ?? 0;
  }

    const fallbackTotalAmount = totalAmount || data.items.reduce((acc, item) => acc + (item.quantity * (('cost_price' in item || isPurchase || isReturnOut) ? ((item as any).cost_price ?? (item as any).sale_price ?? 0) : (item as any).sale_price ?? 0)), 0);
    const fallbackTotalDiscount = totalDiscount || data.items.reduce((acc, item) => acc + ((item as any).discount ?? 0), 0);
    const fallbackTotalTax = totalTax || data.items.reduce((acc, item) => acc + ((item as any).tax ?? 0), 0);
        const fallbackDiscountedSubtotal = data.items.reduce((acc, item) => {
            const qty = Number(item.quantity) || 0;
            const price = ('cost_price' in item || isPurchase || isReturnOut)
                ? ((item as any).cost_price ?? (item as any).sale_price ?? 0)
                : ((item as any).sale_price ?? 0);
            const lineTotal = qty * price;
            const itemDisc = Number((item as any).discount ?? 0);
            return acc + (lineTotal - itemDisc);
        }, 0);
        const fallbackNetAmount = (grandTotal || (fallbackTotalAmount - fallbackTotalDiscount + fallbackTotalTax));
    const remainingAmount = fallbackNetAmount - paidAmount;

  const renderFooter = () => (
    <div className="border-t-2 border-gray-800 bg-gray-50 p-4 flex justify-between items-start text-xs break-inside-avoid print:bg-gray-50">
        <div className="flex gap-8 pt-1">
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Items</span>
                <span className="font-bold text-gray-900 text-sm">{itemsCount}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Quantity</span>
                <span className="font-bold text-gray-900 text-sm">{totalQty}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Total</span>
                <span className="font-bold text-gray-900 text-sm">{fallbackDiscountedSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Discount</span>
                <span className="font-bold text-red-600 text-sm">-{fallbackTotalDiscount.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider mb-1">Tax</span>
                <span className="font-bold text-blue-600 text-sm">+{fallbackTotalTax.toFixed(2)}</span>
            </div>
        </div>
        
        <div className="flex flex-col items-end gap-1">
            <div className="flex gap-4 items-center justify-end w-48">
                <span className="font-bold text-gray-600 uppercase text-[10px]">Net:</span>
                <span className="font-bold text-gray-900 text-base">{fallbackNetAmount.toFixed(2)}</span>
            </div>
            <div className="flex gap-4 items-center justify-end w-48">
                <span className="font-bold text-gray-600 uppercase text-[10px]">Paid:</span>
                <span className="font-bold text-green-700 text-sm">{paidAmount.toFixed(2)}</span>
            </div>
            <div className="w-full border-t border-gray-200 my-0.5"></div>
            <div className="flex gap-4 items-center justify-end w-48">
                <span className="font-bold text-gray-900 uppercase text-[10px]">Balance:</span>
                <span className="font-bold text-orange-700 text-sm">{remainingAmount.toFixed(2)}</span>
            </div>
        </div>
    </div>
  );

  return (
    <div ref={ref} id={id} 
    className="bg-white mx-auto text-gray-900 leading-normal flex flex-col relative print:shadow-none" 
    style={{ width: '210mm', minHeight: '297mm', padding: '10mm' }}
    >
      <style>{`
        @media print {
            @page { 
                margin: 0; 
                size: A4; 
            }
            html, body {
                width: 100%;
                height: auto !important;
                margin: 0;
                padding: 0;
                overflow: visible !important;
            }
            #root {
                display: none !important;
            }
            /* Reset body height for print to allow scrolling/paging */
            @page {
                size: auto;
                margin: 0mm;
            }
            #${id} {
                display: block !important;
                position: relative !important;
                width: 100%;
                margin: 0;
                padding: 15mm !important;
                background: white;
                height: auto !important;
                overflow: visible !important;
            }
            .no-print {
                display: none !important;
            }
            /* --- Multi-page print comfort --- */
            tr, td, th {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            table {
                page-break-after: auto;
            }
            thead {
                display: table-header-group;
            }
            tfoot {
                display: table-footer-group;
            }
            .break-page {
                page-break-after: always;
            }
        }
      `}</style>
      
      {/* Main Table Wrapper to allow Header Repetition */}
      <table className="w-full h-full border-collapse">
        <thead className="table-header-group">
            {/* Header / Company Info - Repeats on every page */}
            <tr>
                <td colSpan={12} className="pb-4">
                    <div className="flex justify-between items-start w-full border-b-2 border-gray-800 pb-4">
                        <div className="flex gap-4 items-center w-full">
                            {printSettings.show_header_logo && tenant.logo && (
                                <img src={tenant.logo} alt="Logo" className="h-20 w-20 object-contain" />
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">{tenant.name}</h1>
                                <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                    <p>{tenant.address}</p>
                                    <p>{tenant.phone} | {tenant.email}</p>
                                    {tenant.license_no && <p>Lic No: {tenant.license_no}</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>

            {/* Bill To Info - Moved to Header */}
            <tr>
                <td colSpan={12} className="pb-4 pt-4">
                    <div className="flex gap-12 items-start">
                        {/* Left: Supplier/Customer Details */}
                        <div className="flex-1 bg-gray-50 p-4 rounded border border-gray-100 print:bg-gray-50">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                {isPurchase || isReturnOut ? 'Supplier Details' : 'Bill To'}
                            </h3>
                            {party ? (
                                <div className="text-sm">
                                    <p className="font-bold text-gray-900 text-base">{party.name}</p>
                                    <div className="text-gray-600 mt-1 space-y-0.5 text-xs">
                                        <p>{party.address}</p>
                                        <p>Phone: {party.phone}</p>
                                        {party.email && <p>Email: {party.email}</p>}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-400 italic text-sm">No party selected</p>
                            )}
                        </div>

                        {/* Right: Title & Invoice Details */}
                        <div className="flex-1 flex flex-col items-end">
                            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-widest mb-4">
                                {isQuotation
                                ? 'QUOTATION'
                                : isPurchase
                                ? 'PURCHASE INVOICE'
                                : isReturnOut
                                ? 'PURCHASE RETURN'
                                : isSale
                                ? 'SALES INVOICE'
                                : 'SALES RETURN'}
                            </h2>

                            {/* Invoice Data - Grid for alignment */}
                            <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
                                <span className="text-gray-500 font-medium text-left">Invoice No:</span>
                                <span className="font-bold text-gray-900 text-right">{data.invoice_no}</span>
                                
                                <span className="text-gray-500 font-medium text-left">Date:</span>
                                <span className="font-bold text-gray-900 text-right">{getFormattedDate(getDate())}</span>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>

            {/* Table Headers - Repeats on every page */}
            <tr className="border-b border-gray-800 bg-gray-50 print:bg-gray-50 text-[10px]">
                <th className="py-2 px-1 text-left font-bold uppercase border-r border-gray-300">Product</th>
                {printSettings.show_batch && (
                    <th className="py-2 px-1 text-center font-bold uppercase border-r border-gray-300 w-16">Batch</th>
                )}
                {printSettings.show_exp_date && (
                    <th className="py-2 px-1 text-center font-bold uppercase border-r border-gray-300 w-16">EXP</th>
                )}
                <th className="py-2 px-1 text-center font-bold uppercase border-r border-gray-300 w-10">Qty</th>
                {printSettings.show_bonus && (
                    <th className="py-2 px-1 text-center font-bold uppercase border-r border-gray-300 w-10">Bon</th>
                )}
                <th className="py-2 px-1 text-right font-bold uppercase border-r border-gray-300 w-16">Price</th>
                <th className="py-2 px-1 text-right font-bold uppercase border-r border-gray-300 w-16">Disc</th>
                <th className="py-2 px-1 text-right font-bold uppercase border-r border-gray-300 w-16">Tax</th>
                <th className="py-2 px-1 text-right font-bold uppercase border-r border-gray-300 w-16">Net Price</th>
                <th className="py-2 px-1 text-right font-bold uppercase w-20">Amount</th>
            </tr>
        </thead>

        <tbody className="text-[10px]">

            {/* Items */}
            {data.items.map((item, index) => {
                        const product = products.find(p => p.id === item.product_id);
                        
                        // Normalized fields
                        const batch = item.batch_no || '-';
                        const exp = 'exp_date' in item ? getFormattedDate(item.exp_date) : '-';
                        const bonus = 'bonus' in item ? item.bonus : '-';
                        
                        // Price logic
                        let price = 0;
                        if ('cost_price' in item || isPurchase || isReturnOut) price = (item as any).cost_price ?? (item as any).sale_price ?? 0;
                        else if ('sale_price' in item) price = item.sale_price;
                        
                        // Disc/Tax logic
                        const itemDisc = 'discount' in item ? item.discount : 0;
                        const itemTax = 'tax' in item ? item.tax : 0;
                        const computedAmount = (item.quantity * price) - itemDisc + itemTax;
                        const netUnitPrice = item.quantity > 0
                            ? price - (itemDisc / item.quantity)
                            : price;
                        const itemDiscPct = 'discount_percent' in item ? item.discount_percent : 0;
                        const itemTaxPct = 'tax_percent' in item ? item.tax_percent : 0;

                        return (
                            <tr key={index} className="break-inside-avoid border-b border-gray-200">
                                <td className="py-2 px-1 border-r border-gray-200">
                                    <div className="flex items-center gap-2">
                                        {printSettings.show_product_image && product?.photo && (
                                            <img src={product.photo} alt="" className="h-12 w-12 object-cover rounded border border-gray-100" />
                                        )}
                                        <div>
                                            <p className="font-bold text-gray-900 leading-tight">{product?.name || 'Unknown'}</p>
                                            <p className="text-[9px] text-gray-500">{product?.model_no}</p>
                                        </div>
                                    </div>
                                </td>
                                {printSettings.show_batch && (
                                    <td className="py-2 px-1 text-center border-r border-gray-200">{batch}</td>
                                )}
                                {printSettings.show_exp_date && (
                                    <td className="py-2 px-1 text-center border-r border-gray-200">{exp}</td>
                                )}
                                <td className="py-2 px-1 text-center font-medium border-r border-gray-200">{item.quantity}</td>
                                {printSettings.show_bonus && (
                                    <td className="py-2 px-1 text-center border-r border-gray-200">{bonus}</td>
                                )}
                                <td className="py-2 px-1 text-right border-r border-gray-200">{price.toFixed(2)}</td>
                                <td className="py-2 px-1 text-right border-r border-gray-200 text-red-600">
                                    {itemDiscPct && itemDiscPct > 0 ? `${itemDiscPct}%` : (itemDisc > 0 ? `-${itemDisc.toFixed(2)}` : '-')}
                                </td>
                                <td className="py-2 px-1 text-right border-r border-gray-200 text-blue-600">
                                    {itemTaxPct && itemTaxPct > 0 ? `${itemTaxPct}%` : (itemTax > 0 ? `+${itemTax.toFixed(2)}` : '-')}
                                </td>
                                <td className="py-2 px-1 text-right border-r border-gray-200">{netUnitPrice.toFixed(2)}</td>
                                <td className="py-2 px-1 text-right font-bold">{(item.amount ?? computedAmount).toFixed(2)}</td>
                            </tr>
                        );
                    })}
             
             {/* Totals Row */}
             <tr>
                 <td colSpan={12} className="pt-4">
                     {renderFooter()}
                 </td>
             </tr>

             {/* Signatures */}
             <tr>
                 <td colSpan={12} className="pt-8">
                    <div className="flex justify-between items-end pb-4 border-b border-gray-200">
                          <div className="text-left">
                              <div className="text-[10px] text-gray-500 italic space-y-1">
                                        <div>
                                            <span className="font-semibold text-gray-600">Created:</span>
                                            <span className="ml-1">{data.created_by || 'System'}</span>
                                            <span className="mx-1">•</span>
                                            <span>{getFormattedDateTime(data.created_at)}</span>
                                        </div>
                                        {data.updated_by && data.updated_at && (
                                            <div>
                                                <span className="font-semibold text-gray-600">Updated:</span>
                                                <span className="ml-1">{data.updated_by}</span>
                                                <span className="mx-1">•</span>
                                                <span>{getFormattedDateTime(data.updated_at)}</span>
                                            </div>
                                        )}
                                 </div>
                        </div>
            
                        {printSettings.show_footer_signature && (
                                <div className="text-center">
                                        <div className="border-t border-gray-400 w-40 mb-1"></div>
                                        <p className="text-xs font-bold uppercase text-gray-500">Authorized Signature</p>
                                </div>
                        )}
                    </div>
                 </td>
             </tr>

             {/* Footer Branding */}
             <tr>
                 <td colSpan={12} className="pt-2 text-center">
                     <div className="text-[8px] text-gray-400 italic">
                         <p>Powered by: Soft Care IT Solutions - Kabul Afghanistan. +93 789 68 10 10 | +93 70 102 1319 | +93 78 979 5964 | softcareitsolutions.com</p>
                     </div>
                 </td>
             </tr>
        </tbody>
      </table>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';
