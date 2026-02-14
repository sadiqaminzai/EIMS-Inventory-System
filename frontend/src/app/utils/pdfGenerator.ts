import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatDateTimeLong } from './dateTime';
import { Tenant, Purchase, Sale, Return, Product, Customer, Supplier, Brand, Country, Category } from '../../store';

// Helper types
type TransactionType = 'Purchase' | 'Sale' | 'Return' | 'ReturnIn' | 'ReturnOut' | 'Quotation';

const toDataUrl = async (url: string): Promise<string | undefined> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

export const generateProductInventoryPDF = async (params: {
  title: string;
  products: Product[];
  tenant: Tenant;
  brands: Brand[];
  categories: Category[];
  countries: Country[];
}) => {
  const { title, products, tenant, brands, categories, countries } = params;
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const brandMap = new Map(brands.map((b) => [String(b.id), b.name]));
  const categoryMap = new Map(categories.map((c) => [String(c.id), c.name]));
  const countryMap = new Map(countries.map((c) => [String(c.id), c.name]));

  const logoData = tenant.logo
    ? (tenant.logo.startsWith('data:image/') ? tenant.logo : await toDataUrl(tenant.logo))
    : undefined;

  const reportTitle = title || 'Inventory Report';

  const drawHeader = () => {
    // Logo
    if (logoData) {
      try {
        const format = logoData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logoData, format, 14, 10, 20, 20);
      } catch {
        // ignore logo failures
      }
    }

    // Company Info
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(tenant.name ?? '', 40, 18);

    doc.setFontSize(10);
    doc.setTextColor(100);
    if (tenant.address) {
      doc.text(String(tenant.address), 40, 24);
    }
    if (tenant.email || tenant.phone) {
      doc.text(`${tenant.email ?? ''}${tenant.email && tenant.phone ? ' | ' : ''}${tenant.phone ?? ''}`, 40, 29);
    }
    if (tenant.license_no) {
      doc.text(`License: ${tenant.license_no}`, 40, 34);
    }

    // Right Side Title + Date
    doc.setFontSize(18);
    doc.setTextColor(0, 102, 204);
    doc.text(reportTitle.toUpperCase(), pageWidth - 14, 18, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Date: ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth - 14, 24, { align: 'right' });

    // Divider
    doc.setDrawColor(200);
    doc.line(14, 40, pageWidth - 14, 40);
  };

  const drawFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text(`Generated on ${formatDateTimeLong(new Date())}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  const columns = [
    'Photo',
    'Product',
    'Model No',
    'Brand',
    'Sale Price',
    'Country',
    'Unit',
    'Description'
  ];

  const photoByRow: Record<number, string | undefined> = {};
  const rows = await Promise.all(products.map(async (p, index) => {
    if (p.photo) {
      const photoData = p.photo.startsWith('data:image/') ? p.photo : await toDataUrl(p.photo);
      photoByRow[index] = photoData;
    }

    return [
      '',
      p.name ?? '',
      p.model_no ?? '',
      brandMap.get(String(p.brand_id)) ?? '',
      Number(p.sale_price ?? 0).toFixed(2),
      countryMap.get(String(p.country_id)) ?? '',
      p.unit_of_measure ?? '',
      p.description ?? ''
    ];
  }));

  autoTable(doc, {
    head: [columns],
    body: rows as any[][],
    startY: 46,
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 14 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 25 },
      6: { cellWidth: 18 },
      7: { cellWidth: 75 }
    },
    didDrawPage: () => {
      drawHeader();
      drawFooter();
    },
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.cell.section === 'body') {
        const photo = photoByRow[data.row.index];
        if (photo) {
          try {
            const format = photo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(photo, format, data.cell.x + 1, data.cell.y + 1, 12, 12);
          } catch {
            // ignore image failures
          }
        }
      }
    }
  });

  const safeName = reportTitle.replace(/[^a-z0-9\s-]/gi, '').trim() || 'Inventory Report';
  doc.save(`${safeName}.pdf`);
};

export const generateInvoicePDF = async (
  type: TransactionType,
  data: Purchase | Sale | Return,
  tenant: Tenant,
  products: Product[],
  party: Customer | Supplier | undefined,
  settings?: any
) => {
  const safeText = (value?: string | null) => (value ? String(value) : '');
  const formatExpiry = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'MMM yy');
  };
  const formatInvoiceDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return format(parsed, 'MMM dd, yyyy');
  };
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // --- Header ---
  // Logo
  if (tenant.logo) {
    const logoData = tenant.logo.startsWith('data:image/')
      ? tenant.logo
      : await toDataUrl(tenant.logo);
    if (logoData) {
      try {
        const format = logoData.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logoData, format, 14, 10, 20, 20);
      } catch (e) {
        console.warn('Could not add logo to PDF', e);
      }
    }
  }

  // Company Info (Left side)
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(safeText(tenant.name), 40, 18);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (tenant.address) {
    doc.text(safeText(tenant.address), 40, 24);
  }
  if (tenant.email || tenant.phone) {
    doc.text(`${safeText(tenant.email)}${tenant.email && tenant.phone ? ' | ' : ''}${safeText(tenant.phone)}`, 40, 29);
  }
  if (tenant.license_no) {
    doc.text(`License: ${safeText(tenant.license_no)}`, 40, 34);
  }

  // Divider Line
  doc.setDrawColor(200);
  doc.line(14, 45, pageWidth - 14, 45);

  // --- Bill To / From (Left Side) ---
  const contentStartY = 55;
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(type === 'Purchase' || type === 'ReturnOut' ? 'Vendor:' : 'Bill To:', 14, contentStartY);
  
  if (party) {
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(party.name, 14, contentStartY + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    let partyY = contentStartY + 12;
    if (party.address) {
      doc.text(party.address, 14, partyY);
      partyY += 5;
    }
    if (party.phone) {
      doc.text(party.phone, 14, partyY);
      partyY += 5;
    }
    if (party.email) {
      doc.text(party.email, 14, partyY);
    }
  } else {
    doc.setTextColor(0);
    doc.text('Walk-in / Unknown', 14, contentStartY + 7);
  }

  // --- Invoice Details (Right Side) ---
  doc.setFontSize(20);
  doc.setTextColor(0, 102, 204); // Blue
  const title = type === 'Purchase'
    ? 'PURCHASE INVOICE'
    : type === 'ReturnOut'
      ? 'PURCHASE RETURN'
      : type === 'Sale'
        ? 'SALES INVOICE'
        : type === 'Quotation'
          ? 'QUOTATION'
          : 'SALES RETURN';
  doc.text(title, pageWidth - 14, contentStartY + 2, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(0);
  
  let detailsY = contentStartY + 10;
  
  doc.text(`Invoice #: ${data.invoice_no}`, pageWidth - 14, detailsY, { align: 'right' });
  
  const dateStr = 'purchase_date' in data ? data.purchase_date : 
                  'sale_date' in data ? data.sale_date : 
                  data.return_date;
                  
  doc.text(`Date: ${formatInvoiceDate(dateStr)}`, pageWidth - 14, detailsY + 5, { align: 'right' });
  // Removed Status line

  // --- Table ---
  const hasPhotos = data.items.some((item) => {
    const product = products.find(p => p.id === item.product_id);
    return Boolean(product?.photo);
  });
  const tableColumn = hasPhotos
    ? ["Item", "Photo", "Batch", "Exp", "Qty", "Price", "Disc", "Tax", "Net Price", "Amount"]
    : ["Item", "Batch", "Exp", "Qty", "Price", "Disc", "Tax", "Net Price", "Amount"];
  const tableRows: any[] = [];
  const photoByRow: Record<number, string | undefined> = {};

  for (const [index, item] of data.items.entries()) {
    const product = products.find(p => p.id === item.product_id);
    const productName = product ? product.name : 'Unknown Product';
    const modelNo = product?.model_no ? String(product.model_no) : '';
    const itemLabel = modelNo ? `${productName}\n${modelNo}` : productName;
    
    let price = 0;
    let batch = '';
    let exp = '-';
    let qty = item.quantity;
    
     if ('cost_price' in item || type === 'Purchase' || type === 'ReturnOut') { // Purchase/Return Out
       price = (item as any).cost_price ?? (item as any).sale_price ?? 0;
       batch = (item as any).batch_no || '';
       exp = formatExpiry((item as any).exp_date);
     } else if ('sale_price' in item) { // Sale/Return In
       price = item.sale_price;
       batch = item.batch_no;
       exp = formatExpiry((item as any).exp_date);
     } else { // Fallback
       price = (item as any).sale_price || 0;
       batch = (item as any).batch_no || '';
       exp = formatExpiry((item as any).exp_date);
     }

    const itemDisc = Number((item as any).discount ?? 0);
    const itemTax = Number((item as any).tax ?? 0);
    const itemDiscPct = Number((item as any).discount_percent ?? 0);
    const itemTaxPct = Number((item as any).tax_percent ?? 0);
    const total = Number(item.amount ?? ((qty * price) - itemDisc + itemTax));
    const netUnitPrice = qty > 0 ? (price - (itemDisc / qty)) : price;
    const discDisplay = itemDiscPct > 0 ? `${itemDiscPct}%` : (itemDisc > 0 ? `-${itemDisc.toFixed(2)}` : '-');
    const taxDisplay = itemTaxPct > 0 ? `${itemTaxPct}%` : (itemTax > 0 ? `+${itemTax.toFixed(2)}` : '-');

    if (hasPhotos) {
      if (product?.photo) {
        const photoData = product.photo.startsWith('data:image/')
          ? product.photo
          : await toDataUrl(product.photo);
        photoByRow[index] = photoData;
      }
      tableRows.push([
        itemLabel,
        '',
        batch,
        exp,
        qty,
        price.toFixed(2),
        discDisplay,
        taxDisplay,
        netUnitPrice.toFixed(2),
        total.toFixed(2)
      ]);
    } else {
      tableRows.push([
        itemLabel,
        batch,
        exp,
        qty,
        price.toFixed(2),
        discDisplay,
        taxDisplay,
        netUnitPrice.toFixed(2),
        total.toFixed(2)
      ]);
    }
  }

  // Calculate totals
  let subTotal = 0;
  let tax = 0;
  let discount = 0;
  let grandTotal = 0;
  let paidAmount = 0;

  // Items and Quantity counts
  const itemsCount = data.items.length;
  const totalQty = data.items.reduce((acc, item) => acc + item.quantity + (item.bonus || 0), 0);

  if ('grand_total' in data) { // Purchase
      subTotal = data.sub_total;
      tax = data.total_tax;
      discount = data.total_discount;
      grandTotal = data.grand_total;
      paidAmount = data.paid_amount || 0;
  } else if ('net_payable' in data) { // Sale
      subTotal = data.sub_total;
      tax = data.total_tax;
      discount = data.total_discount;
      grandTotal = data.net_payable;
      paidAmount = data.paid_amount || 0;
  } else { // Return
      const r = data as Return;
      subTotal = r.sub_total || r.total_amount;
      tax = r.total_tax || 0;
      discount = r.total_discount || 0;
      grandTotal = r.net_amount ?? r.total_amount;
      paidAmount = r.paid_amount ?? 0; 
  }

  const balance = grandTotal - paidAmount;

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 95,
    theme: 'grid',
    headStyles: { fillColor: [66, 66, 66] },
    styles: { fontSize: 9, minCellHeight: hasPhotos ? 14 : undefined },
    columnStyles: hasPhotos ? { 1: { cellWidth: 16 } } : undefined,
    didDrawCell: (cellData) => {
      if (!hasPhotos) return;
      if (cellData.section !== 'body') return;
      if (cellData.column.index !== 1) return;
      const img = photoByRow[cellData.row.index];
      if (!img) return;
      const padding = 2;
      const size = Math.min(cellData.cell.height - padding * 2, cellData.cell.width - padding * 2);
      const x = cellData.cell.x + padding;
      const y = cellData.cell.y + padding;
      const format = img.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      try {
        doc.addImage(img, format, x, y, size, size);
      } catch {
        // ignore image draw errors
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // --- Totals Block (Replicating View Modal) ---
  // Background for footer
  doc.setFillColor(249, 250, 251); // bg-gray-50
  doc.rect(14, finalY + 2, pageWidth - 28, 35, 'F');
  
  doc.setDrawColor(229, 231, 235); // border-gray-200
  doc.line(14, finalY + 2, pageWidth - 14, finalY + 2); // Top border
  doc.line(14, finalY + 37, pageWidth - 14, finalY + 37); // Bottom border

  const footerY = finalY + 12;

  // Left Side: Items, Quantity, Discount, Tax
  // ITEMS
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // text-gray-500
  doc.text("ITEMS", 30, footerY, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39); // text-gray-900
  doc.setFont('helvetica', 'bold');
  doc.text(itemsCount.toString(), 30, footerY + 6, { align: 'center' });

  // QUANTITY
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.text("QUANTITY", 60, footerY, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.text(totalQty.toString(), 60, footerY + 6, { align: 'center' });

  // DISCOUNT
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.text("DISCOUNT", 90, footerY, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38); // text-red-600
  doc.setFont('helvetica', 'bold');
  doc.text(`-${discount.toFixed(2)}`, 90, footerY + 6, { align: 'center' });

  // TAX
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.text("TAX", 120, footerY, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235); // text-blue-600
  doc.setFont('helvetica', 'bold');
  doc.text(`+${tax.toFixed(2)}`, 120, footerY + 6, { align: 'center' });

  // Right Side: Total, Paid, Balance
  const rightX = pageWidth - 14;
  
  // TOTAL
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99); // text-gray-600
  doc.setFont('helvetica', 'bold');
  doc.text("TOTAL:", rightX - 40, footerY);
  
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39); // text-gray-900
  doc.text(grandTotal.toFixed(2), rightX, footerY, { align: 'right' });

  // PAID
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text("PAID:", rightX - 40, footerY + 6);
  
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61); // text-green-700
  doc.text(paidAmount.toFixed(2), rightX, footerY + 6, { align: 'right' });

  // Line separator
  doc.setDrawColor(229, 231, 235);
  doc.line(rightX - 60, footerY + 10, rightX, footerY + 10);

  // BALANCE
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text("BALANCE:", rightX - 40, footerY + 16);
  
  doc.setFontSize(12);
  doc.setTextColor(194, 65, 12); // text-orange-700
  doc.text(balance.toFixed(2), rightX, footerY + 16, { align: 'right' });


  // --- Footer ---
  const pageHeight = doc.internal.pageSize.height;
  
  // Signature Lines - Removed as per request for PDF downloads
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 15, { align: 'center' });
  doc.text(`Generated on ${formatDateTimeLong(new Date())}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Save with descriptive filename: "Sales Invoice 3 - Customer Name.pdf"
  const invoiceTypeLabel = type === 'sale' ? 'Sales Invoice' 
    : type === 'purchase' ? 'Purchase Invoice' 
    : type === 'return_in' ? 'Sales Return' 
    : type === 'return_out' ? 'Purchase Return' 
    : `${type} Invoice`;
  const partyName = party?.name ? ` - ${party.name.replace(/[<>:"/\\|?*]/g, '')}` : '';
  const fileName = `${invoiceTypeLabel} ${data.invoice_no}${partyName}.pdf`;
  doc.save(fileName);
};
