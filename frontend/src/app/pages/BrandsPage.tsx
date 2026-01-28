import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Brand } from '../../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Button } from '../components/ui/button';
import { Save, X } from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';

const BrandForm = ({ initialData, onSave, onCancel }: { initialData?: Brand, onSave: (data: any) => void, onCancel: () => void }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: initialData || { status: 'active' } });
  return (
    <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
      <DenseInput label="Name" {...register('name', { required: 'Required' })} error={errors.name?.message as string} />
      <DenseInput label="Details" {...register('details')} />
      <DenseSelect label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} {...register('status')} />
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
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

export const BrandsPage = () => {
  const { brands, products, addBrand, updateBrand, deleteBrand, hasPermission } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | undefined>();
  const [viewBrand, setViewBrand] = useState<Brand | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const handleSave = (data: any) => {
    if (editing) updateBrand(editing.id, data); else addBrand(data);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteBrand(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const getProductCount = (brandId: string) => {
    return products.filter(p => p.brand_id === brandId).length;
  };

  const columns = [
    { header: 'Name', accessorKey: 'name' as keyof Brand, sortable: true },
    { header: 'Details', accessorKey: 'details' as keyof Brand, sortable: true },
    { 
      header: 'Products', 
      cell: (i: Brand) => (
        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
          {getProductCount(i.id)} items
        </span>
      )
    },
    { 
      header: 'Created By', 
      accessorKey: 'created_by' as keyof Brand, 
      sortable: true,
      cell: (i: Brand) => i.created_by || '-'
    },
    { 
      header: 'Created At', 
      accessorKey: 'created_at' as keyof Brand, 
      sortable: true,
      cell: (i: Brand) => formatDateTime(i.created_at)
    },
    { 
      header: 'Status', 
      accessorKey: 'status' as keyof Brand, 
      sortable: true,
      cell: (i: Brand) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${i.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {i.status}
        </span>
      ) 
    },
    { 
      header: 'Actions', 
      cell: (i: Brand) => (
        <ActionButtons 
          onView={hasPermission('brand.view') ? () => setViewBrand(i) : undefined}
          onEdit={hasPermission('brand.edit') ? () => { setEditing(i); setIsOpen(true); } : undefined} 
          onDelete={hasPermission('brand.delete') ? () => setDeleteConfirmation(i.id) : undefined} 
        />
      ) 
    }
  ];

  if (!hasPermission('brand.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable 
        data={brands} 
        columns={columns} 
        title="Brands" 
        onAdd={() => { setEditing(undefined); setIsOpen(true); }} 
        canAdd={hasPermission('brand.create')}
        canSearch={hasPermission('brand.search')}
        canExport={hasPermission('brand.export')}
        defaultSort={{ key: 'created_at', direction: 'desc' }} 
      />
      
      <Modal open={isOpen} onOpenChange={setIsOpen} title={editing ? "Edit Brand" : "Add Brand"} size="sm">
        <BrandForm initialData={editing} onSave={handleSave} onCancel={() => setIsOpen(false)} />
      </Modal>

      <Modal open={!!viewBrand} onOpenChange={(o) => !o && setViewBrand(null)} title="Brand Details" size="sm">
        {viewBrand && (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{viewBrand.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${viewBrand.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {viewBrand.status}
                        </span>
                    </div>
                    <div className="text-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="block text-2xl font-bold text-blue-700">{getProductCount(viewBrand.id)}</span>
                        <span className="text-[10px] uppercase text-blue-600 font-semibold">Products</span>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <span className="block text-xs font-semibold text-gray-500 uppercase mb-2">Description / Details</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {viewBrand.details || "No details available."}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 pt-2">
                    <div>
                        <span className="block font-semibold">Created By</span>
                        {viewBrand.created_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Created At</span>
                         {formatDateTime(viewBrand.created_at)}
                    </div>
                     <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewBrand.updated_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Updated At</span>
                         {formatDateTime(viewBrand.updated_at)}
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100 mt-4">
                    <Button 
                        variant="outline"
                        onClick={() => setViewBrand(null)}
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
        title="Delete Brand"
        description="Are you sure you want to delete this brand? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  );
};
