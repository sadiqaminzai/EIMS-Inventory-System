import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStore, Customer } from '../../store';
import { Modal } from '../components/ui/Modal';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { Button } from '../components/ui/button';
import { Save, X } from 'lucide-react';
import { format } from 'date-fns';

const CustomerForm = ({ initialData, onSave, onCancel }: { initialData?: Customer, onSave: (data: any) => void, onCancel: () => void }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: initialData || { status: 'active' } });
  return (
    <form onSubmit={handleSubmit(onSave)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DenseInput label="Name" {...register('name', { required: 'Required' })} error={errors.name?.message as string} required />
      <DenseInput label="Phone" {...register('phone', { required: 'Required' })} error={errors.phone?.message as string} required />
      <DenseInput label="Email" type="email" {...register('email', { required: 'Required' })} error={errors.email?.message as string} required />
      <DenseSelect label="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} {...register('status')} />
      <div className="col-span-1 md:col-span-2">
        <DenseInput label="Address" {...register('address')} />
      </div>
      <div className="col-span-1 md:col-span-2 flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
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

export const CustomersPage = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer, hasPermission } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | undefined>();
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const handleSave = (data: any) => {
    if (editing) updateCustomer(editing.id, data); else addCustomer(data);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteCustomer(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const columns = [
    { header: 'Name', accessorKey: 'name' as keyof Customer, sortable: true },
    { header: 'Phone', accessorKey: 'phone' as keyof Customer, sortable: true },
    { header: 'Email', accessorKey: 'email' as keyof Customer, sortable: true },
    // Removed Address and Created By columns as requested
    { 
      header: 'Created At', 
      accessorKey: 'created_at' as keyof Customer, 
      sortable: true,
      cell: (i: Customer) => i.created_at ? format(new Date(i.created_at), 'yyyy-MM-dd HH:mm') : '-'
    },
    { 
      header: 'Status', 
      accessorKey: 'status' as keyof Customer, 
      sortable: true,
      cell: (i: Customer) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${i.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {i.status}
        </span>
      ) 
    },
    { 
      header: 'Actions', 
      cell: (i: Customer) => (
        <ActionButtons 
          onView={() => setViewCustomer(i)}
          onEdit={hasPermission('customer.edit') ? () => { setEditing(i); setIsOpen(true); } : undefined} 
          onDelete={hasPermission('customer.delete') ? () => setDeleteConfirmation(i.id) : undefined} 
        />
      ) 
    }
  ];

  if (!hasPermission('customer.view')) return <div>Access Denied</div>;

  return (
    <>
      <DenseTable 
        data={customers} 
        columns={columns} 
        title="Customers" 
        onAdd={() => { setEditing(undefined); setIsOpen(true); }} 
        canAdd={hasPermission('customer.create')} 
        defaultSort={{ key: 'created_at', direction: 'desc' }}
      />
      
      <Modal open={isOpen} onOpenChange={setIsOpen} title={editing ? "Edit Customer" : "Add Customer"}>
        <CustomerForm initialData={editing} onSave={handleSave} onCancel={() => setIsOpen(false)} />
      </Modal>

      <Modal open={!!viewCustomer} onOpenChange={(o) => !o && setViewCustomer(null)} title="Customer Details">
        {viewCustomer && (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">{viewCustomer.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${viewCustomer.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {viewCustomer.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</span>
                        <span className="font-medium text-gray-900">{viewCustomer.phone}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-100">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</span>
                        <span className="font-medium text-gray-900">{viewCustomer.email || '-'}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-100 col-span-1 md:col-span-2">
                        <span className="block text-xs font-semibold text-gray-500 uppercase mb-1">Address</span>
                        <span className="font-medium text-gray-900">{viewCustomer.address || '-'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2">
                    <div>
                        <span className="block font-semibold">Created By</span>
                        {viewCustomer.created_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Created At</span>
                         {viewCustomer.created_at ? format(new Date(viewCustomer.created_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                     <div>
                        <span className="block font-semibold">Updated By</span>
                        {viewCustomer.updated_by || '-'}
                    </div>
                    <div>
                         <span className="block font-semibold">Updated At</span>
                         {viewCustomer.updated_at ? format(new Date(viewCustomer.updated_at), 'yyyy-MM-dd HH:mm') : '-'}
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100 mt-4">
                    <Button 
                        variant="outline"
                        onClick={() => setViewCustomer(null)}
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
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  );
};
