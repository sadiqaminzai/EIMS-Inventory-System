import { useEffect } from 'react';
import { InvoiceTemplate } from './InvoiceTemplate';
import { Sale, Purchase, Return } from '../../../store';

interface PrintHandlerProps {
  data: Sale | Purchase | Return;
  type: 'sale' | 'purchase' | 'return' | 'return_in' | 'return_out';
  partyName?: string;
  onAfterPrint?: () => void;
}

export const PrintHandler = ({ data, type, partyName, onAfterPrint }: PrintHandlerProps) => {
  useEffect(() => {
    if (data) {
      // Set document title for PDF filename
      const originalTitle = document.title;
      const invoiceTypeLabel = type === 'sale' ? 'Sales Invoice' 
        : type === 'purchase' ? 'Purchase Invoice' 
        : type === 'return_in' ? 'Sales Return' 
        : type === 'return_out' ? 'Purchase Return' 
        : `${type} Invoice`;
      const partyPart = partyName ? ` - ${partyName}` : '';
      document.title = `${invoiceTypeLabel} ${data.invoice_no}${partyPart}`;

      // Handler for when the print dialog is closed (either printed or cancelled)
      const handleAfterPrint = () => {
         document.title = originalTitle;
         onAfterPrint();
      };

      // Add event listener for cleanup
      window.addEventListener('afterprint', handleAfterPrint);

      // Trigger print after a short delay to ensure the DOM is fully rendered and styles applied
      // 500ms provides a buffer for images and layout calculation
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      // Cleanup function
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
        document.title = originalTitle;
      };
    }
  }, [data, type, partyName, onAfterPrint]);

  if (!data) return null;

  return (
    // Use Tailwind to hide on screen but show on print
    // We apply fixed positioning at 0,0 to eliminate browser margins
    <div className="hidden print:block print:fixed print:top-0 print:left-0 print:m-0 print:p-0 print:w-[210mm] print:h-auto print:z-[9999]">
      {/* 
        We pass a specific ID for the print styles to target.
        The InvoiceTemplate's internal CSS ensures that during @media print,
        the body is hidden and ONLY this element (and its children) are visible.
      */}
      <InvoiceTemplate 
        data={data} 
        type={type} 
        id="native-print-invoice" 
      />
    </div>
  );
};
