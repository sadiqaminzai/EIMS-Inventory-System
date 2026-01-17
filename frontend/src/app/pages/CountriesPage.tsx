import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Country } from '../../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Button } from '../components/ui/button';
import { Save, X } from 'lucide-react';
import { format } from 'date-fns';

const CountryForm = ({ initialData, onSave, onCancel }: { initialData?: Country, onSave: (data: any) => void, onCancel: () => void }) => {
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

export const CountriesPage = () => {
  const { countries, products, addCountry, updateCountry, deleteCountry, hasPermission } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Country | undefined>();
  const [viewCountry, setViewCountry] = useState<Country | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const handleSave = (data: any) => {
    if (editing) updateCountry(editing.id, data); else addCountry(data);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteCountry(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const getProductCount = (countryId: string) => {
    return products.filter(p => p.country_id === countryId).length;
  };

  const columns = [
    { header: 'Name', accessorKey: 'name' as keyof Country, sortable: true },
    { header: 'Details', accessorKey: 'details' as keyof Country, sortable: true },
    { 
      header: 'Products', 
      cell: (i: Country) => (
        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
          {getProductCount(i.id)} items
        </span>
      )
    },
    { 
      header: 'Created By', 
      accessorKey: 'created_by' as keyof Country, 
      sortable: true,
      cell: (i: Country) => i.created_by || '-'
    },
    { 
      header: 'Created At', 
      accessorKey: 'created_at' as keyof Country, 
      sortable: true,
      cell: (i: Country) => i.created_at ? format(new Date(i.created_at), 'yyyy-MM-dd HH:mm') : '-'
    },
    { 
      header: 'Status', 
      accessorKey: 'status' as keyof Country, 
      sortable: true,
      cell: (i: Country) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${i.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {i.status}
        </span>
      ) 
    },
    { 
      header: 'Actions', 
      cell: (i: Country) => (
        <ActionButtons 
          onView={() => setViewCountry(i)}
          onEdit={hasPermission('product.edit') ? () => { setEditing(i); setIsOpen(true); } : undefined} 
          onDelete={hasPermission('product.delete') ? () => setDeleteConfirmation(i.id) : undefined} 
        />
      ) 
    }
  ];

  if (!hasPermission('product.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable 
        data={countries} 
        columns={columns} 
        title="Countries" 
        onAdd={() => { setEditing(undefined); setIsOpen(true); }} 
        canAdd={hasPermission('product.create')} 
        defaultSort={{ key: 'created_at', direction: 'desc' }}
      />
      
      <Modal open={isOpen} onOpenChange={setIsOpen} title={editing ? "Edit Country" : "Add Country"} size="sm">
        <CountryForm initialData={editing} onSave={handleSave} onCancel={() => setIsOpen(false)} />
      </Modal>

      <Modal open={!!viewCountry} onOpenChange={(o) => !o && setViewCountry(null)} title="Country Details" size="sm">
        {viewCountry && (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{viewCountry.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${viewCountry.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {viewCountry.status}
                        </span>
                    </div>
                    <div className="text-center bg-blue-50 p-2 rounded-lg border border-blue-100">
                        <span className="block text-2xl font-bold text-blue-700">{getProductCount(viewCountry.id)}</span>
                        <span className="text-[10px] uppercase text-blue-600 font-semibold">Products</span>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <span className="block text-xs font-semibold text-gray-500 uppercase mb-2">Description / Details</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {viewCountry.details || "No details available."}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 pt-2">
                    <div>
                        <span className="block font-semibold">Created By</span>
                        {viewCountry.created_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Created At</span>
                         {viewCountry.created_at ? format(new Date(viewCountry.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                     <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewCountry.updated_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Updated At</span>
                         {viewCountry.updated_at ? format(new Date(viewCountry.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100 mt-4">
                    <Button 
                        variant="outline"
                        onClick={() => setViewCountry(null)}
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
        title="Delete Country"
        description="Are you sure you want to delete this country? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  );
};
