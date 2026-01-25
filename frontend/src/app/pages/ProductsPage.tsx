import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Product } from '../../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { X, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { format } from 'date-fns';

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

        <DenseSelect 
          label="Status" 
          options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          {...register('status')} 
        />
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
  const { products, brands, countries, addProduct, updateProduct, deleteProduct, hasPermission, currentUser } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

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

  const columns = [
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
        data={products} 
        columns={columns} 
        title="Product Inventory"
        onAdd={handleAdd}
        canAdd={hasPermission('product.create')}
        addLabel="Product"
          canSearch={hasPermission('product.search')}
          canExport={hasPermission('product.export')}
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
