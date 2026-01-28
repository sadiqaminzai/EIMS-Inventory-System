import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Product } from '../../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { FileText, X, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateProductInventoryPDF } from '../utils/pdfGenerator';

const ProductForm = ({ initialData, onSave, onCancel }: { initialData?: Product, onSave: (data: any) => void, onCancel: () => void }) => {
  const { brands, countries } = useStore();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: initialData || { status: 'active' }
  });

  const photoUrl = watch('photo');
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(photoUrl);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
  };

  return (
    <form onSubmit={handleSubmit((data) => onSave({ ...data, photo_file: selectedFile }))} className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DenseInput label="Product Name" {...register('name', { required: 'Required' })} error={errors.name?.message as string} />
        <DenseInput label="Model No" {...register('model_no', { required: 'Required' })} error={errors.model_no?.message as string} />
        
        <DenseSelect 
          label="Brand" 
          options={brands.map(b => ({ value: b.id, label: b.name }))}
          {...register('brand_id', { required: 'Required' })} 
          error={errors.brand_id?.message as string}
        />
        <DenseSelect 
          label="Country" 
          options={countries.map(c => ({ value: c.id, label: c.name }))}
          {...register('country_id', { required: 'Required' })} 
          error={errors.country_id?.message as string}
        />

        <DenseInput type="number" label="Cost Price" {...register('cost_price', { required: 'Required', min: 0 })} error={errors.cost_price?.message as string} />
        <DenseInput type="number" label="Sale Price" {...register('sale_price', { required: 'Required', min: 0 })} error={errors.sale_price?.message as string} />
        <DenseInput label="Unit of Measure" {...register('unit_of_measure')} error={errors.unit_of_measure?.message as string} />
        <DenseSelect 
          label="Status" 
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          {...register('status')} 
        />
        
        <div className="col-span-1 md:col-span-2">
          <label className="text-[10px] font-semibold uppercase text-gray-500 block mb-1">Photo</label>
          <div className="flex items-start gap-4 p-3 border border-gray-200 rounded-md bg-gray-50/50">
            <div className="relative h-16 w-16 flex-shrink-0 bg-white border border-gray-200 rounded-md overflow-hidden flex items-center justify-center shadow-sm">
                {(previewUrl || photoUrl) ? (
                    <img src={previewUrl || photoUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                    <span className="text-[10px] text-gray-300">No img</span>
                )}
                {(previewUrl || photoUrl) && (
                     <button 
                       type="button" 
                       onClick={() => {
                          setPreviewUrl(undefined);
                          setSelectedFile(undefined);
                          setValue('photo', '');
                       }}
                       aria-label="Remove product photo"
                       title="Remove photo"
                       className="absolute top-0 right-0 bg-white/90 text-gray-500 p-0.5 hover:bg-red-500 hover:text-white transition-colors rounded-bl"
                     >
                       <X size={10} /> 
                     </button>
                )}
            </div>
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    aria-label="Upload product image"
                    title="Upload product image"
                    className="block w-full text-[10px] text-slate-500
                      file:mr-2 file:py-1 file:px-2.5
                      file:rounded-md file:border-0
                      file:text-[10px] file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 leading-tight">
                    Browse and upload product image.
                </p>
                <input type="hidden" {...register('photo')} />
            </div>
          </div>
        </div>
        
        <div className="col-span-1 md:col-span-2">
          <label className="text-[10px] font-semibold uppercase text-gray-500 block mb-1">Description</label>
          <textarea 
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none h-20"
            {...register('description')}
          />
        </div>

      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
        <Button type="button" variant="outline" onClick={onCancel} size="sm" className="gap-2">
            <X size={14} /> Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" size="sm">
            <Save size={14} /> Save
        </Button>
      </div>
    </form>
  );
};

export const ProductsPage = () => {
  const { products, brands, categories, countries, tenant, addProduct, updateProduct, deleteProduct, hasPermission, currentUser } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    setEditingProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSave = (data: any) => {
    if (editingProduct) {
      updateProduct(editingProduct.id, data);
    } else {
      addProduct(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteProduct(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((p) => (
        p.name?.toLowerCase().includes(term) ||
        p.model_no?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      ));
    }

    if (brandFilter !== 'all') {
      result = result.filter((p) => String(p.brand_id) === brandFilter);
    }
    if (countryFilter !== 'all') {
      result = result.filter((p) => String(p.country_id) === countryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    return result;
  }, [products, searchTerm, brandFilter, countryFilter, statusFilter]);

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach((p) => next.delete(p.id));
      } else {
        filteredProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleExportPdf = async () => {
    const exportItems = exportScope === 'selected'
      ? filteredProducts.filter((p) => selectedIds.has(p.id))
      : filteredProducts;

    if (!exportItems.length) {
      toast.info(exportScope === 'selected' ? 'Select at least one product to export.' : 'No products to export.');
      return;
    }

    await generateProductInventoryPDF({
      title: 'Inventory Report',
      products: exportItems,
      tenant,
      brands,
      categories,
      countries
    });
  };

  const columns = [
    {
      header: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleSelectAllFiltered}
          aria-label="Select all filtered products"
        />
      ),
      width: '40px',
      cell: (item: Product) => (
        <input
          type="checkbox"
          checked={selectedIds.has(item.id)}
          onChange={() => toggleSelect(item.id)}
          aria-label={`Select ${item.name}`}
        />
      )
    },
    { 
      header: 'Info', 
      accessorKey: 'name' as keyof Product,
      sortable: true,
      cell: (item: Product) => (
        <div className="flex items-center gap-2">
          {item.photo && <ImageWithFallback src={item.photo} alt={item.name} className="h-8 w-8 rounded object-cover border border-gray-200" />}
          <div>
            <div className="font-medium text-gray-900">{item.name}</div>
            <div className="text-[10px] text-gray-500">{item.model_no}</div>
          </div>
        </div>
      )
    },
    // Removed Brand and Country columns as requested
    { 
      header: 'Stock', 
      accessorKey: 'stock_qty' as keyof Product,
      sortable: true,
      cell: (item: Product) => (
        <span className={item.stock_qty < 10 ? "text-red-600 font-bold" : "text-gray-700"}>
          {item.stock_qty}
        </span>
      )
    },
    // Removed Created By column as requested
    { 
      header: 'Created At', 
      accessorKey: 'created_at' as keyof Product, 
      sortable: true,
      cell: (i: Product) => i.created_at ? format(new Date(i.created_at), 'yyyy-MM-dd HH:mm') : '-'
    },
    // Removed Cost Price column as requested
    { 
      header: 'Sale', 
      accessorKey: 'sale_price' as keyof Product,
      sortable: true,
      cell: (item: Product) => `$${item.sale_price}`
    },
    { 
      header: 'Status', 
      accessorKey: 'status' as keyof Product,
      sortable: true,
      cell: (item: Product) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {item.status}
        </span>
      )
    },
    {
      header: 'Actions',
      width: '120px',
        cell: (item: Product) => (
          <ActionButtons 
            onView={hasPermission('product.view') ? () => setViewProduct(item) : undefined}
            onEdit={hasPermission('product.edit') ? () => handleEdit(item) : undefined}
            onDelete={hasPermission('product.delete') ? () => setDeleteConfirmation(item.id) : undefined}
          />
        )
    }
  ];

  return (
    <>
      <DenseTable 
        data={filteredProducts} 
        columns={columns} 
        title="Inventory"
        onAdd={handleAdd}
        canAdd={hasPermission('product.create')}
        addLabel="Product"
        canSearch={false}
        canExport={false}
        canExportExcel={hasPermission('product.export')}
        canExportPdf={false}
        headerAfterSearch={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search products..."
              aria-label="Search products"
              className="pl-3 pr-3 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none w-full md:w-48 h-7"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="text-xs border border-gray-300 rounded h-7 px-2"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              aria-label="Filter by brand"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              className="text-xs border border-gray-300 rounded h-7 px-2"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="Filter by country"
            >
              <option value="all">All Countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className="text-xs border border-gray-300 rounded h-7 px-2"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                />
                All Filtered
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'selected'}
                  onChange={() => setExportScope('selected')}
                />
                Selected Only
              </label>
            </div>
            {hasPermission('product.export') && (
              <button
                onClick={handleExportPdf}
                className="flex items-center gap-1.5 text-xs text-red-700 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
                title="Export PDF"
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </button>
            )}
          </div>
        }
        defaultSort={{ key: 'created_at', direction: 'desc' }}
      />
      
      <Modal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        title={editingProduct ? "Edit Product" : "Add New Product"}
      >
        <ProductForm 
          initialData={editingProduct} 
          onSave={handleSave} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>

      <Modal
         open={!!viewProduct}
         onOpenChange={(open) => !open && setViewProduct(null)}
         title="Product Details"
       >
         {viewProduct && (
            <div className="space-y-6">
                {/* Header with Image and Basic Info */}
                <div className="flex gap-4">
                    <div className="h-24 w-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {viewProduct.photo ? (
                            <ImageWithFallback src={viewProduct.photo} alt={viewProduct.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{viewProduct.name}</h3>
                        <p className="text-sm text-gray-500 mb-2">{viewProduct.model_no}</p>
                        <div className="flex gap-2">
                             <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${viewProduct.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {viewProduct.status}
                             </span>
                        </div>
                    </div>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Brand</span>
                        <span className="font-medium text-gray-900">{brands.find(b => b.id === viewProduct.brand_id)?.name || '-'}</span>
                    </div>
                     <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Country</span>
                        <span className="font-medium text-gray-900">{countries.find(c => c.id === viewProduct.country_id)?.name || '-'}</span>
                    </div>
                     {currentUser.role !== 'accountant' && (
                       <div className="bg-gray-50 p-3 rounded border border-gray-100">
                          <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Cost Price</span>
                          <span className="font-medium text-gray-900">${viewProduct.cost_price}</span>
                       </div>
                     )}
                     <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sale Price</span>
                        <span className="font-medium text-green-700 font-bold">${viewProduct.sale_price}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-100 col-span-1 md:col-span-2">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Stock Level</span>
                         <span className={`font-bold text-lg ${viewProduct.stock_qty < 10 ? "text-red-600" : "text-gray-900"}`}>
                            {viewProduct.stock_qty} <span className="text-xs font-normal text-gray-500">units</span>
                        </span>
                    </div>
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2">
                    <div>
                        <span className="block font-semibold">Created By</span>
                        {viewProduct.created_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Created At</span>
                         {viewProduct.created_at ? format(new Date(viewProduct.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                     <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewProduct.updated_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Updated At</span>
                         {viewProduct.updated_at ? format(new Date(viewProduct.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                </div>

                {/* Description */}
                {viewProduct.description && (
                    <div className="pt-2">
                         <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
                         <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">
                            {viewProduct.description}
                         </p>
                    </div>
                )}
                
                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <Button 
                        variant="outline"
                        onClick={() => setViewProduct(null)}
                        size="sm"
                    >
                        Close
                    </Button>
                </div>
            </div>
         )}
       </Modal>
       
       <ConfirmationDialog
        open={!!deleteConfirmation}
        onOpenChange={(open) => !open && setDeleteConfirmation(null)}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  );
};
