import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search, FileSpreadsheet, FileText, ArrowUpDown, ArrowUp, ArrowDown, PlusCircle } from 'lucide-react';
import { clsx } from 'clsx';
// jspdf / jspdf-autotable / xlsx are heavy and only needed on export, so they
// are dynamically imported inside the handlers to keep table pages lightweight.

interface Column<T> {
  header: string | ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  width?: string;
  sortable?: boolean;
}

interface DenseTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  canAdd?: boolean;
  canSearch?: boolean;
  canExport?: boolean;
  canExportExcel?: boolean;
  canExportPdf?: boolean;
  defaultSort?: { key: keyof T; direction: 'asc' | 'desc' };
  headerAfterSearch?: React.ReactNode;
  tableContainerClassName?: string;
}

export const DenseTable = <T extends object>({
  data,
  columns,
  title,
  searchPlaceholder = "Search...",
  onAdd,
  addLabel = "Add New",
  canAdd = false,
  canSearch = true,
  canExport = true,
  canExportExcel,
  canExportPdf,
  defaultSort,
  headerAfterSearch,
  tableContainerClassName
}: DenseTableProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | null; direction: 'asc' | 'desc' }>({ 
    key: defaultSort?.key || null, 
    direction: defaultSort?.direction || 'asc' 
  });
  const itemsPerPage = 50;

  // Search Logic (Elastic Search across all string fields)
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) =>
        String(val).toLowerCase().includes(lowerTerm)
      )
    );
  }, [data, searchTerm]);

  // Sorting Logic
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key!] as any;
      const bVal = b[sortConfig.key!] as any;
      
      if (aVal === bVal) return 0;
      
      // Handle null/undefined values
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const allowExportExcel = canExportExcel ?? canExport;
  const allowExportPdf = canExportPdf ?? canExport;

  // Export to Excel
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(sortedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${title || 'Export'}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const tableColumn = columns.map(c => typeof c.header === 'string' ? c.header : '');
    const tableRows = sortedData.map(item => {
      return columns.map(col => {
        if (col.accessorKey) return item[col.accessorKey];
        return ""; // Cannot easily export custom render cells
      });
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows as any[][],
    });

    doc.save(`${title || 'Export'}.pdf`);
  };

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm w-full">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 gap-3 md:gap-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 w-full md:w-auto">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h2>
          {canSearch && (
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-2 top-1.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none w-full md:w-64 h-7"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
          {headerAfterSearch}
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          {allowExportExcel && (
            <button onClick={exportToExcel} className="p-1.5 text-green-700 hover:bg-green-50 rounded" title="Export Excel">
              <FileSpreadsheet className="h-4 w-4" />
            </button>
          )}
          {allowExportPdf && (
            <button onClick={exportToPDF} className="p-1.5 text-red-700 hover:bg-red-50 rounded" title="Export PDF">
              <FileText className="h-4 w-4" />
            </button>
          )}
          {canAdd && onAdd && (
            <button
              onClick={onAdd}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-full font-medium transition-colors shadow-sm"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className={clsx("overflow-x-auto overflow-y-visible", tableContainerClassName)}>
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10 text-xs font-semibold text-gray-600 uppercase">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={clsx(
                    "px-3 py-2 border-b border-gray-200 whitespace-nowrap",
                    col.sortable && "cursor-pointer hover:bg-gray-200 select-none",
                    col.width
                  )}
                  onClick={() => col.sortable && col.accessorKey && handleSort(col.accessorKey)}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col ml-1">
                         {sortConfig.key === col.accessorKey ? (
                           sortConfig.direction === 'asc' ? 
                             <ArrowUp className="h-3 w-3 text-blue-600" /> : 
                             <ArrowDown className="h-3 w-3 text-blue-600" />
                         ) : (
                           <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-50" />
                         )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-xs text-gray-700 divide-y divide-gray-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-blue-50 transition-colors h-8">
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-3 py-1 whitespace-nowrap truncate max-w-xs">
                      {col.cell ? col.cell(item) : (col.accessorKey ? String(item[col.accessorKey] ?? '') : '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400 italic">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — sticky to the bottom so record count + pagination stay visible
          even when the table is taller than the viewport on smaller screens. */}
      <div className="sticky bottom-0 z-10 rounded-b-lg bg-gray-50 border-t border-gray-200 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500">
        <div>
          Showing {sortedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{' '}
          {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>Page {currentPage} of {Math.max(1, totalPages)}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
