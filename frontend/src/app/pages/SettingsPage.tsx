import { useForm } from 'react-hook-form';
import { useStore, Tenant, PrintSettings, User, Role, Permission, RoleItem } from '../../store';
import { roleApi } from '../../api/roles';
import { backupApi, BackupDto, BackupSettingsDto, BackupSettingsUpdateDto } from '../../api/backups';
import { DenseInput, DenseSelect } from '../components/ui/Form';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import { ImageUpload } from '../components/ui/ImageUpload';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/Modal';
import { DenseTable } from '../components/ui/DenseTable';
import { ActionButtons } from '../components/ui/ActionButtons';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Save, User as UserIcon, Shield, Lock, Settings as SettingsIcon, Building, Printer, Camera, X, Database, Download, Trash2, RefreshCw, Clock, Calendar, HardDrive, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { format, addYears, addMonths } from 'date-fns';
import { formatDateTime } from '../utils/dateTime';
import { toast } from 'sonner';

// --- Components for General Tab ---

const TenantForm = () => {
  const { tenant, updateTenant, hasPermission } = useStore();
  const { register, handleSubmit, setValue, watch } = useForm({ defaultValues: tenant });
    const [logoFile, setLogoFile] = useState<File | undefined>(undefined);
  
  const logo = watch('logo');

  if (!hasPermission('settings.edit')) return <div className="text-gray-500 italic">View Only Mode</div>;

    return (
        <form onSubmit={handleSubmit((data) => updateTenant({ ...data, logo_file: logoFile }))} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-900">Company Profile</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DenseInput label="Company Name" {...register('name')} />
        <DenseInput label="Phone" {...register('phone')} />
        <DenseInput label="Email" {...register('email')} />
        <DenseInput label="Website" {...register('website')} />
        <div className="col-span-1 md:col-span-2">
          <DenseInput label="Address" {...register('address')} />
        </div>
        <div className="col-span-1 md:col-span-2">
            <ImageUpload 
                label="Company Logo" 
                value={logo} 
                onChange={(val) => setValue('logo', val, { shouldDirty: true })} 
                onFileSelect={(file, preview) => {
                    setLogoFile(file);
                    setValue('logo', preview, { shouldDirty: true });
                }}
            />
        </div>
        <DenseInput label="License No" {...register('license_no')} readOnly className="bg-gray-100" />
        <DenseInput label="License Expiry" type="date" {...register('license_expiry')} readOnly className="bg-gray-100" />
      </div>
      <div className="pt-2">
        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="mr-2 h-4 w-4" />
            Save
        </Button>
      </div>
    </form>
  );
};

const PrintSettingsForm = () => {
  const { printSettings, updatePrintSettings, hasPermission } = useStore();
  const { register, handleSubmit } = useForm({ defaultValues: printSettings });

  if (!hasPermission('settings.edit')) return null;

  return (
    <form onSubmit={handleSubmit(updatePrintSettings)} className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Printer className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-medium text-gray-900">Print Settings</h3>
      </div>
      <div className="flex flex-col gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register('show_product_image')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Show Product Image on Invoice
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register('show_header_logo')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Show Header Logo
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" {...register('show_footer_signature')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Show Footer Signature
        </label>
        
        <div className="border-t border-gray-200 my-2 pt-2">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Column Visibility</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
            <input type="checkbox" {...register('show_batch')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Show Batch Column
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
            <input type="checkbox" {...register('show_exp_date')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Show EXP Date Column
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" {...register('show_bonus')} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Show Bonus Column
            </label>
        </div>
      </div>
      <div className="pt-2">
        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            <Save className="mr-2 h-4 w-4" />
            Save
        </Button>
      </div>
    </form>
  );
};

const GeneralTab = () => {
    return (
        <div className="max-w-3xl">
            <TenantForm />
        </div>
    );
};

const PrintTab = () => {
    return (
        <div className="max-w-3xl">
            <PrintSettingsForm />
        </div>
    );
};

// --- Components for Clients Tab ---

const ClientForm = ({ initialData, onSave, onCancel }: { initialData?: Tenant, onSave: (data: any) => void, onCancel: () => void }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Tenant>({
    defaultValues: initialData || {
      license_status: 'Active',
      license_type: 'Trial',
      license_key: `LIC-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
      license_issue: format(new Date(), 'yyyy-MM-dd'),
      license_expiry: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      max_users: 5
    }
  });
    const [logoFile, setLogoFile] = useState<File | undefined>(undefined);

  const logoUrl = watch('logo');
  const licenseType = watch('license_type');
  const licenseIssue = watch('license_issue');

  // Auto-calculate expiry based on type if issue date changes or type changes
  useEffect(() => {
    if (!initialData && licenseIssue) { // Only auto-calc for new or if explicit
        const start = new Date(licenseIssue);
        let end = new Date(start);
        
        switch (licenseType) {
            case 'Trial':
                end = addMonths(start, 1);
                break;
            case 'Monthly':
                end = addMonths(start, 1);
                break;
            case 'Yearly':
                end = addYears(start, 1);
                break;
            case 'Lifetime':
                end = addYears(start, 99);
                break;
        }
        setValue('license_expiry', format(end, 'yyyy-MM-dd'));
    }
  }, [licenseType, licenseIssue, setValue, initialData]);

    return (
        <form onSubmit={handleSubmit((data) => onSave({ ...data, logo_file: logoFile }))} className="flex flex-col">
      <Tabs defaultValue="basic" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none px-4 h-10 bg-transparent">
          <TabsTrigger value="basic" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none text-blue-600">Basic Info</TabsTrigger>
          <TabsTrigger value="license" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none rounded-none text-gray-500">License Info</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 p-1">
            <TabsContent value="basic" className="space-y-4 p-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                        <ImageUpload 
                            label="COMPANY LOGO" 
                            value={logoUrl} 
                            onChange={(val) => setValue('logo', val)} 
                            onFileSelect={(file, preview) => {
                                setLogoFile(file);
                                setValue('logo', preview);
                            }}
                        />
                    </div>
                    
                    <DenseInput label="COMPANY NAME" {...register('name', { required: 'Required' })} error={errors.name?.message} />
                    <DenseInput label="EMAIL" type="email" {...register('email', { required: 'Required' })} error={errors.email?.message} />
                    <DenseInput label="PHONE" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
                    <DenseInput label="WHATSAPP" {...register('whatsapp')} />
                    <div className="col-span-1 md:col-span-2">
                         <DenseInput label="ADDRESS" {...register('address', { required: 'Required' })} error={errors.address?.message} />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <DenseInput label="WEBSITE" {...register('website')} />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="license" className="space-y-4 p-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                         <DenseInput label="LICENSE KEY" {...register('license_key')} readOnly className="bg-gray-100 text-gray-500 font-mono" />
                    </div>

                    <DenseSelect 
                        label="LICENSE TYPE" 
                        options={[
                            { value: 'Trial', label: 'Trial' },
                            { value: 'Monthly', label: 'Monthly' },
                            { value: 'Yearly', label: 'Yearly' },
                            { value: 'Lifetime', label: 'Lifetime' }
                        ]}
                        {...register('license_type')} 
                    />
                    
                    <DenseInput type="number" label="MAX USERS" {...register('max_users', { required: 'Required', min: 1 })} error={errors.max_users?.message} />
                    
                    <DenseInput type="date" label="START DATE" {...register('license_issue', { required: 'Required' })} error={errors.license_issue?.message} />
                    <DenseInput type="date" label="EXPIRY DATE" {...register('license_expiry', { required: 'Required' })} error={errors.license_expiry?.message} />
                    
                    <DenseSelect 
                        label="STATUS" 
                        options={[
                            { value: 'Active', label: 'Active' },
                            { value: 'Expired', label: 'Expired' },
                            { value: 'Suspended', label: 'Suspended' }
                        ]}
                        {...register('license_status')} 
                    />
                </div>
            </TabsContent>
        </div>
      </Tabs>

      <div className="flex justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50 mt-auto">
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

const ClientsTab = () => {
  const { clients, addClient, updateClient, deleteClient, hasPermission } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Tenant | undefined>(undefined);
  const [viewClient, setViewClient] = useState<Tenant | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingClient(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (client: Tenant) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleSave = (data: any) => {
    if (editingClient) {
      updateClient(editingClient.id, data);
    } else {
      addClient({ ...data, id: nanoid() });
    }
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (deleteConfirmation) {
      deleteClient(deleteConfirmation);
      setDeleteConfirmation(null);
    }
  };

  const columns = [
    { 
      header: 'Company', 
      accessorKey: 'name' as keyof Tenant,
      sortable: true,
      cell: (item: Tenant) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
             {item.logo ? <img src={item.logo} alt="Logo" className="h-full w-full object-cover" /> : item.name.charAt(0)}
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm">{item.name}</div>
            <div className="text-[10px] text-gray-500">{item.address}</div>
          </div>
        </div>
      )
    },
    { 
      header: 'Contact', 
      accessorKey: 'email' as keyof Tenant,
      cell: (item: Tenant) => (
        <div className="flex flex-col">
            <span className="text-xs text-gray-700">{item.email}</span>
            <span className="text-[10px] text-gray-500">{item.phone}</span>
        </div>
      )
    },
    { 
      header: 'License', 
      accessorKey: 'license_type' as keyof Tenant,
      sortable: true,
      cell: (item: Tenant) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-900">{item.license_type}</span>
            <span className="text-[10px] text-gray-500 font-mono">{item.max_users} Users</span>
        </div>
      )
    },
    { 
      header: 'Expiry', 
      accessorKey: 'license_expiry' as keyof Tenant,
      sortable: true,
      cell: (item: Tenant) => {
        if (!item.license_expiry) {
            return <span className="text-xs text-gray-400">-</span>;
        }

        const expiry = new Date(item.license_expiry);
        if (Number.isNaN(expiry.getTime())) {
            return <span className="text-xs text-gray-400">-</span>;
        }

        const daysLeft = Math.ceil((expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const isNearExpiry = daysLeft < 30 && daysLeft > 0;
        const isExpired = daysLeft <= 0;

        return (
            <div className="flex flex-col">
                <span className={`text-xs ${isExpired ? 'text-red-600 font-bold' : isNearExpiry ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>
                    {format(expiry, 'MMM dd, yyyy')}
                </span>
                {isNearExpiry && <span className="text-[9px] text-orange-600">Expiring soon ({daysLeft} days)</span>}
                {isExpired && <span className="text-[9px] text-red-600">Expired</span>}
            </div>
        );
      }
    },
    { 
      header: 'Status', 
      accessorKey: 'license_status' as keyof Tenant,
      sortable: true,
      cell: (item: Tenant) => {
          const colors = {
              'Active': 'bg-green-100 text-green-700',
              'Expired': 'bg-red-100 text-red-700',
              'Suspended': 'bg-yellow-100 text-yellow-700'
          };
          return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${colors[item.license_status] || 'bg-gray-100'}`}>
            {item.license_status}
            </span>
        );
      }
    },
    {
      header: 'Actions',
      width: '120px',
      cell: (item: Tenant) => (
        <ActionButtons 
                    onView={hasPermission('client.view') ? () => setViewClient(item) : undefined}
          onEdit={hasPermission('client.edit') ? () => handleEdit(item) : undefined}
          onDelete={hasPermission('client.delete') ? () => setDeleteConfirmation(item.id) : undefined}
        />
      )
    }
  ];

  if (!hasPermission('client.view')) {
      return <div className="p-8 text-center text-gray-500">You do not have permission to view clients.</div>;
  }

  return (
    <>
      <DenseTable 
        data={clients} 
        columns={columns} 
        title="Client Registration"
        onAdd={handleAdd}
        canAdd={hasPermission('client.create')}
        addLabel="Client"
                canSearch={hasPermission('client.search')}
                canExport={hasPermission('client.export')}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />
      
      <Modal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        title={editingClient ? "Edit Client" : "REGISTER NEW CLIENT"}
        className="max-w-2xl"
      >
        <ClientForm 
          initialData={editingClient} 
          onSave={handleSave} 
          onCancel={() => setIsModalOpen(false)} 
        />
      </Modal>

      <Modal
        open={!!viewClient}
        onOpenChange={(open) => !open && setViewClient(null)}
        title="Client Details"
        className="max-w-lg"
      >
        {viewClient && (
             <div className="space-y-6">
                 {/* Header with Image and Basic Info */}
                 <div className="flex gap-4 items-center pb-4 border-b border-gray-100">
                     <div className="h-16 w-16 flex-shrink-0 bg-blue-600 rounded-lg overflow-hidden flex items-center justify-center text-white font-bold text-xl shadow-sm">
                         {viewClient.logo ? (
                             <ImageWithFallback src={viewClient.logo} alt={viewClient.name} className="h-full w-full object-cover" />
                         ) : (
                             viewClient.name.charAt(0)
                         )}
                     </div>
                     <div>
                         <h3 className="text-xl font-bold text-gray-900 leading-none mb-1">{viewClient.name}</h3>
                         <div className="flex items-center gap-2 mb-1">
                             <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${viewClient.license_status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                 {viewClient.license_status}
                             </span>
                             <span className="text-xs text-gray-400">|</span>
                             <span className="text-xs text-gray-500">{viewClient.email}</span>
                         </div>
                     </div>
                 </div>
 
                 {/* Details Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {/* Contact Info */}
                     <div className="col-span-1 md:col-span-1 space-y-3">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact Info</h4>
                         
                         <div className="space-y-1">
                             <div className="text-[10px] text-gray-500 uppercase">Phone</div>
                             <div className="text-sm font-medium text-gray-800">{viewClient.phone}</div>
                         </div>
                         {viewClient.whatsapp && (
                            <div className="space-y-1">
                                <div className="text-[10px] text-gray-500 uppercase">WhatsApp</div>
                                <div className="text-sm font-medium text-gray-800">{viewClient.whatsapp}</div>
                            </div>
                         )}
                         <div className="space-y-1">
                             <div className="text-[10px] text-gray-500 uppercase">Address</div>
                             <div className="text-sm font-medium text-gray-800 leading-snug">{viewClient.address}</div>
                         </div>
                         {viewClient.website && (
                             <div className="space-y-1">
                                 <div className="text-[10px] text-gray-500 uppercase">Website</div>
                                 <a href={viewClient.website.startsWith('http') ? viewClient.website : `https://${viewClient.website}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate block">
                                     {viewClient.website}
                                 </a>
                             </div>
                         )}
                     </div>
 
                     {/* License Info */}
                     <div className="col-span-1 md:col-span-1 space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                         <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">License Details</h4>
                         
                         <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                             <div className="text-xs text-gray-500">Plan Type</div>
                             <div className="text-sm font-bold text-blue-700">{viewClient.license_type}</div>
                         </div>
                         
                         <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                             <div className="text-xs text-gray-500">Max Users</div>
                             <div className="text-sm font-bold text-gray-900">{viewClient.max_users}</div>
                         </div>
 
                         <div className="space-y-1 mb-2">
                             <div className="text-[10px] text-gray-500 uppercase">Valid From</div>
                             <div className="text-xs font-mono text-gray-700">{viewClient.license_issue}</div>
                         </div>
 
                         <div className="space-y-1">
                             <div className="text-[10px] text-gray-500 uppercase">Expires On</div>
                             <div className="text-xs font-mono text-gray-700">{viewClient.license_expiry}</div>
                         </div>
                         
                         <div className="mt-3 pt-2 border-t border-gray-200">
                             <div className="text-[10px] text-gray-400 uppercase mb-1">License Key</div>
                             <div className="text-[10px] font-mono bg-white border border-gray-200 p-1.5 rounded text-gray-600 break-all">
                                 {viewClient.license_key}
                             </div>
                         </div>
                     </div>
                 </div>
                 
                 <div className="flex justify-end pt-2 border-t border-gray-100">
                     <Button 
                         variant="outline"
                         onClick={() => setViewClient(null)}
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
        title="Delete Client"
        description="Are you sure you want to delete this client? This will remove all their data access."
        onConfirm={handleDelete}
        confirmLabel="Delete"
      />
    </>
  );
};

// --- Components for Users Tab ---

const UserForm = ({ initialData, onSave, onCancel }: { initialData?: User, onSave: (data: any) => void, onCancel: () => void }) => {
    const { currentUser, roles, clients, tenant } = useStore();
    const DEFAULT_PASSWORD = 'password';
    const defaultRole = initialData?.role ?? roles[0]?.name ?? '';
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<User & { avatar_file?: File; tenant_id?: string; password?: string }>({
        defaultValues: initialData || {
            status: 'active',
            role: defaultRole,
            tenant_id: tenant.id
        }
    });
    
    const avatar = watch('avatar');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setValue('avatar', reader.result as string, { shouldDirty: true });
                setValue('avatar_file', file, { shouldDirty: true });
            };
            reader.readAsDataURL(file);
        }
    };

    const formatRoleLabel = (name?: string) =>
        (name ?? '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const selectedRole = watch('role');
    const selectedTenantId = watch('tenant_id');
    const isSuperAdmin = currentUser.role === 'superadmin';
    const requiresTenant = isSuperAdmin && selectedRole !== 'superadmin';
    const [tenantRoles, setTenantRoles] = useState<RoleItem[] | null>(null);

    useEffect(() => {
        let active = true;
        if (!isSuperAdmin || !selectedTenantId) {
            setTenantRoles(null);
            return;
        }
        roleApi.list({ tenant_id: selectedTenantId })
            .then((list) => {
                if (!active) return;
                const mapped: RoleItem[] = (list ?? []).map((r) => ({
                    id: Number(r.id),
                    name: r.name,
                    tenant_id: r.tenant_id !== undefined && r.tenant_id !== null ? String(r.tenant_id) : undefined,
                    description: r.description ?? null,
                    permissions: r.permissions ?? null,
                }));
                setTenantRoles(mapped);
            })
            .catch(() => {
                if (active) setTenantRoles([]);
            });
        return () => {
            active = false;
        };
    }, [isSuperAdmin, selectedTenantId]);

    const roleOptions = useMemo(() => (
        (tenantRoles ?? roles)
            .filter((role) => currentUser.role === 'superadmin' || role.name !== 'superadmin')
            .filter((role) => !requiresTenant || !selectedTenantId || !role.tenant_id || String(role.tenant_id) === String(selectedTenantId))
            .map((role) => ({ value: String(role.id ?? role.name), label: formatRoleLabel(role.name) }))
    ), [tenantRoles, roles, currentUser.role, requiresTenant, selectedTenantId]);

    const tenantOptions = useMemo(
        () => (clients ?? []).map((t) => ({ value: t.id, label: t.name })),
        [clients]
    );

    useEffect(() => {
        if (!isSuperAdmin) {
            if (String(selectedTenantId ?? '') !== String(tenant.id)) {
                setValue('tenant_id', tenant.id, { shouldDirty: true });
            }
            return;
        }
        if (!selectedTenantId) {
            const fallback = String(tenant.id ?? tenantOptions[0]?.value ?? '');
            if (fallback && String(selectedTenantId ?? '') !== fallback) {
                setValue('tenant_id', fallback, { shouldDirty: true });
            }
        }
    }, [isSuperAdmin, selectedRole, selectedTenantId, tenant.id, tenantOptions, setValue]);

    useEffect(() => {
        if (!isSuperAdmin) return;
        if (!tenantOptions.length) return;
        const currentTenant = String(selectedTenantId ?? '');
        const tenantValues = new Set(tenantOptions.map((opt) => String(opt.value)));
        if (!currentTenant || !tenantValues.has(currentTenant)) {
            const fallback = String(tenantOptions[0].value ?? '');
            if (fallback && currentTenant !== fallback) {
                setValue('tenant_id', fallback, { shouldDirty: true });
            }
        }
    }, [isSuperAdmin, tenantOptions, selectedTenantId, setValue]);

    useEffect(() => {
        if (!roleOptions.length) return;
        const currentRole = String(selectedRole ?? '');
        const roleValues = new Set(roleOptions.map((opt) => String(opt.value)));
        const nextRole = String(roleOptions[0].value ?? '');
        if (!roleValues.has(currentRole) && nextRole && currentRole !== nextRole) {
            setValue('role', roleOptions[0].value, { shouldDirty: true });
        }
    }, [roleOptions, selectedRole, setValue]);

    return (
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="flex flex-col items-center gap-2 mb-6">
                 <div className="relative group cursor-pointer">
                    <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center border-2 border-white shadow-md relative ring-2 ring-gray-100">
                        {avatar ? (
                            <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                            <UserIcon className="h-10 w-10 text-gray-300" />
                        )}
                        
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm transition-opacity font-medium">
                                Change
                            </div>
                        </div>
                    </div>

                    {/* Camera Icon Button */}
                    <div className="absolute bottom-0 right-1 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 text-gray-500 group-hover:text-blue-600 transition-colors z-20">
                        <Camera className="w-3.5 h-3.5" />
                    </div>

                    <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileChange}
                        title="Upload avatar"
                    />
                 </div>
                 <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Profile Photo</span>
            </div>

            <DenseInput label="Full Name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
            <DenseInput label="Email" type="email" {...register('email', { required: 'Required' })} error={errors.email?.message} />
            {!initialData && (
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                    Default password is <span className="font-mono font-semibold">{DEFAULT_PASSWORD}</span>. The user can change it after first login.
                </div>
            )}
            {!initialData && (
                <DenseInput
                    label="Password (optional)"
                    type="password"
                    placeholder={`Leave blank to use ${DEFAULT_PASSWORD}`}
                    {...register('password')}
                />
            )}
            {isSuperAdmin && (
                <DenseSelect
                    label="Tenant"
                    options={tenantOptions}
                    {...register('tenant_id', requiresTenant ? { required: 'Required' } : undefined)}
                    error={errors.tenant_id?.message as string}
                />
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DenseSelect 
                    label="Role" 
                    options={roleOptions}
                    {...register('role')} 
                />
                <DenseSelect 
                    label="Status" 
                    options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' }
                    ]}
                    {...register('status')} 
                />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
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

const UsersTab = () => {
    const { users, addUser, updateUser, deleteUser, hasPermission, currentUser } = useStore();
    const formatRoleLabel = (name?: string) =>
        (name ?? '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [viewUser, setViewUser] = useState<User | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    const formatDateTime = (value?: string) => {
        if (!value) return '-';
        try {
            return format(new Date(value), 'dd/MM/yyyy h:mm a');
        } catch {
            return value;
        }
    };

    const handleSave = (data: any) => {
        const normalized = currentUser?.role === 'superadmin'
            ? data
            : { ...data, tenant_id: currentUser?.tenant_id };
        if (editingUser) {
            updateUser(editingUser.id, normalized);
        } else {
            addUser({ ...normalized, id: nanoid() });
        }
        setIsModalOpen(false);
    };

    const columns = [
        { 
            header: 'User', 
            accessorKey: 'name' as keyof User,
            cell: (item: User) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                         {item.avatar ? <img src={item.avatar} alt="" className="h-full w-full object-cover" /> : <UserIcon className="h-4 w-4 text-gray-500" />}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.email}</div>
                    </div>
                </div>
            )
        },
        { 
            header: 'Role', 
            accessorKey: 'role' as keyof User,
            cell: (item: User) => (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {formatRoleLabel(item.role)}
                </span>
            )
        },
        {
            header: 'Tenant',
            cell: (item: User) => (
                <span className="text-xs text-gray-600">{item.tenant_name || '-'}</span>
            )
        },
        { 
            header: 'Status', 
            accessorKey: 'status' as keyof User,
            cell: (item: User) => (
                <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium capitalize", 
                    item.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                    {item.status}
                </span>
            )
        },
        {
            header: 'Actions',
            width: '100px',
            cell: (item: User) => (
                <ActionButtons 
                    onView={hasPermission('user.view') ? () => setViewUser(item) : undefined}
                    onEdit={hasPermission('user.edit') ? () => { setEditingUser(item); setIsModalOpen(true); } : undefined}
                    onDelete={hasPermission('user.delete') ? () => setDeleteId(item.id) : undefined}
                />
            )
        }
    ];

    if (!hasPermission('settings.view')) return <div>Access Denied</div>;

    return (
        <>
            <DenseTable 
                data={users} 
                columns={columns} 
                title="User Management"
                onAdd={() => { setEditingUser(undefined); setIsModalOpen(true); }}
                addLabel="User"
                canAdd={hasPermission('user.create')}
                canSearch={hasPermission('user.search')}
                canExport={hasPermission('user.export')}
            />
            
            <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title={editingUser ? "Edit User" : "Add User"} className="max-w-md">
                <UserForm initialData={editingUser} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>

            <Modal
                open={!!viewUser}
                onOpenChange={(open) => !open && setViewUser(null)}
                title="User Details"
                className="max-w-md"
            >
                {viewUser && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                {viewUser.avatar ? (
                                    <img src={viewUser.avatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5 text-gray-500" />
                                )}
                            </div>
                            <div>
                                <div className="text-base font-semibold text-gray-900">{viewUser.name}</div>
                                <div className="text-sm text-gray-500">{viewUser.email}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Role</div>
                                <div className="text-sm font-semibold text-gray-900 mt-1">{formatRoleLabel(viewUser.role)}</div>
                            </div>
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Status</div>
                                <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">{viewUser.status}</div>
                            </div>
                        </div>

                        <div className="rounded-md border border-gray-100 bg-white p-3">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Audit</div>
                            <div className="text-[11px] text-gray-600 italic space-y-1">
                                <div>
                                    <span className="font-semibold text-gray-700">Created:</span>
                                    <span className="ml-1">{viewUser.created_by || 'System'}</span>
                                    <span className="mx-1">•</span>
                                    <span>{formatDateTime(viewUser.created_at)}</span>
                                </div>
                                {viewUser.updated_by && (
                                    <div>
                                        <span className="font-semibold text-gray-700">Updated:</span>
                                        <span className="ml-1">{viewUser.updated_by}</span>
                                        <span className="mx-1">•</span>
                                        <span>{formatDateTime(viewUser.updated_at)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmationDialog 
                open={!!deleteId} 
                onOpenChange={(open) => !open && setDeleteId(null)} 
                title="Delete User" 
                description="Are you sure? This user will lose access immediately." 
                onConfirm={() => { if(deleteId) deleteUser(deleteId); setDeleteId(null); }}
                confirmLabel="Delete"
            />
        </>
    );
};

// --- Components for Roles Tab ---

const RoleForm = ({ initialData, initialPermissions, onSave, onCancel }: { initialData?: RoleItem, initialPermissions: Permission[], onSave: (data: { name: string; description?: string | null; permissions: Permission[]; tenant_id?: string }) => void, onCancel: () => void }) => {
    const { permissionsCatalog, currentUser, clients, tenant } = useStore();
    const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; description?: string | null }>({
        defaultValues: {
            name: initialData?.name ?? '',
            description: initialData?.description ?? ''
        }
    });
    const [selectedPerms, setSelectedPerms] = useState<Permission[]>(initialPermissions);

    useEffect(() => {
        reset({
            name: initialData?.name ?? '',
            description: initialData?.description ?? ''
        });
        setSelectedPerms(initialPermissions);
        setSelectedTenant(initialData?.tenant_id ?? tenant.id ?? '');
    }, [initialData, initialPermissions, reset, tenant.id]);

    const isSuperAdmin = currentUser.role === 'superadmin';
    const tenantOptions = (clients ?? []).map((t) => ({ value: t.id, label: t.name }));
    const [selectedTenant, setSelectedTenant] = useState<string>(
        initialData?.tenant_id ?? tenant.id ?? ''
    );

    const togglePerm = (perm: Permission) => {
        if (selectedPerms.includes(perm)) {
            setSelectedPerms(selectedPerms.filter(p => p !== perm));
        } else {
            setSelectedPerms([...selectedPerms, perm]);
        }
    };

    const formatGroupLabel = (name: string) =>
        name
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const groupLabelMap: Record<string, string> = {
        inventory: 'Inventory',
        partners: 'Partners',
        invoices: 'Invoices',
        product: 'Products',
        brand: 'Brands',
        country: 'Countries',
        supplier: 'Suppliers',
        customer: 'Customers',
        purchase: 'Purchases',
        sales: 'Sales',
        return_in: 'Sales Return',
        return_out: 'Purchase Return',
        return: 'Sales Return',
        quotation: 'Quotation',
        account: 'Accounts',
        account_transactions: 'Transactions',
        account_accounts: 'Accounts',
        account_transaction: 'Transaction Types',
        settings: 'Settings',
        user: 'Users',
        role: 'Roles',
        permission: 'Permissions',
        client: 'Clients',
    };

    const actionLabelMap: Record<string, string> = {
        view: 'View',
        create: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        search: 'Search',
        export: 'Export',
        print: 'Print',
        payment: 'Payment',
        income: 'Income',
        expense: 'Expense',
        transfer: 'Transfer',
        save: 'Save',
        cancel: 'Cancel',
    };

    const groupOrder = [
        'inventory', 'partners', 'invoices',
        'product', 'brand', 'country',
        'supplier', 'customer',
        'purchase', 'sales', 'return_in', 'return_out',
        'account', 'account_transactions', 'account_accounts', 'account_transaction',
        'settings', 'user', 'role', 'permission', 'client',
    ];

    const actionOrder = ['view', 'create', 'edit', 'delete', 'search', 'export', 'print', 'payment', 'income', 'expense', 'transfer', 'save', 'cancel'];

    const groups = permissionsCatalog.reduce<Record<string, Permission[]>>((acc, perm) => {
        let group = 'Other';
        if (perm.startsWith('manage_')) {
            group = perm.replace('manage_', '');
        } else if (perm.startsWith('partners.')) {
            group = 'partners';
        } else if (perm.startsWith('invoices.')) {
            group = 'invoices';
        } else if (perm.startsWith('account.transactions.')) {
            group = 'account_transactions';
        } else if (perm.startsWith('account.accounts.')) {
            group = 'account_accounts';
        } else if (perm.startsWith('account.transaction.')) {
            group = 'account_transaction';
        } else if (perm.includes('.')) {
            group = perm.split('.')[0];
        }
        acc[group] = acc[group] || [];
        acc[group].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const sortPerms = (perms: Permission[]) =>
        [...perms].sort((p1, p2) => {
            const aParts = p1.split('.');
            const bParts = p2.split('.');
            const aKey = aParts[aParts.length - 1] || p1;
            const bKey = bParts[bParts.length - 1] || p2;
            const aIdx = actionOrder.indexOf(aKey);
            const bIdx = actionOrder.indexOf(bKey);
            if (aIdx === -1 && bIdx === -1) return p1.localeCompare(p2);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });

    const orderedGroups = Object.entries(groups)
        .sort(([a], [b]) => {
            const aIdx = groupOrder.indexOf(a);
            const bIdx = groupOrder.indexOf(b);
            if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        })
        .map(([groupKey, perms]) => [groupKey, sortPerms(perms)] as const);

    const permissionsByGroup = Object.fromEntries(orderedGroups) as Record<string, Permission[]>;

    const mainPanels = [
        {
            key: 'inventory',
            label: 'Inventory',
            groups: [
                { key: 'inventory', label: 'Main' },
                { key: 'product', label: 'Products' },
                { key: 'brand', label: 'Brands' },
                { key: 'country', label: 'Countries' },
            ],
        },
        {
            key: 'partners',
            label: 'Partners',
            groups: [
                { key: 'partners', label: 'Main' },
                { key: 'customer', label: 'Customers' },
                { key: 'supplier', label: 'Suppliers' },
            ],
        },
        {
            key: 'invoices',
            label: 'Invoices',
            groups: [
                { key: 'invoices', label: 'Main' },
                { key: 'sales', label: 'Sales' },
                { key: 'purchase', label: 'Purchases' },
                { key: 'return_in', label: 'Sales Return' },
                { key: 'return_out', label: 'Purchase Return' },
                { key: 'quotation', label: 'Quotation' },
            ],
        },
        {
            key: 'accounts',
            label: 'Accounts',
            groups: [
                { key: 'account', label: 'Main' },
                { key: 'account_accounts', label: 'Accounts' },
                { key: 'account_transactions', label: 'Transactions' },
                { key: 'account_transaction', label: 'Transaction Types' },
            ],
        },
        {
            key: 'settings',
            label: 'Settings',
            groups: [
                { key: 'settings', label: 'Main' },
                { key: 'general', label: 'General' },
                { key: 'profile', label: 'Profile' },
                { key: 'user', label: 'Users' },
                { key: 'role', label: 'Roles' },
                { key: 'permission', label: 'Permissions' },
                { key: 'client', label: 'Clients' },
            ],
        },
    ];

    const resolveGroupLabel = (groupKey: string) => groupLabelMap[groupKey] || formatGroupLabel(groupKey);
    const resolveActionLabel = (perm: string) => {
        const parts = perm.split('.');
        const action = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        return actionLabelMap[action] || formatGroupLabel(action);
    };

    const usedGroupKeys = new Set(mainPanels.flatMap((panel) => panel.groups.map((g) => g.key)));
    const otherGroups = orderedGroups
        .filter(([groupKey]) => !usedGroupKeys.has(groupKey))
        .map(([groupKey, perms]) => ({ key: groupKey, label: resolveGroupLabel(groupKey), perms }));

    return (
        <form onSubmit={handleSubmit((data) => onSave({ ...data, permissions: selectedPerms, tenant_id: isSuperAdmin ? selectedTenant : undefined }))} className="flex flex-col h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <DenseInput label="Role Name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
                <DenseInput label="Description" {...register('description')} />
                {isSuperAdmin && (
                    <DenseSelect
                        label="Tenant"
                        options={tenantOptions}
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value)}
                    />
                )}
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                {mainPanels.map((panel) => {
                    const hasAny = panel.groups.some((g) => (permissionsByGroup[g.key]?.length ?? 0) > 0);
                    if (!hasAny) return null;
                    return (
                        <div key={panel.key} className="mb-6 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                                <h4 className="text-sm font-bold text-gray-900">{panel.label}</h4>
                            </div>
                            <div className="space-y-3">
                                {panel.groups.map((group) => {
                                    const perms = permissionsByGroup[group.key] ?? [];
                                    if (perms.length === 0) return null;
                                    return (
                                        <div key={group.key} className="flex flex-col gap-2">
                                            <div className="text-[11px] font-semibold uppercase text-gray-500">{group.label}</div>
                                            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                                                {perms.map((perm) => (
                                                    <label key={perm} className="flex items-center gap-2 text-xs text-gray-700 px-2 py-1 rounded-full bg-gray-50 hover:bg-gray-100 cursor-pointer whitespace-nowrap border border-gray-200 flex-shrink-0">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedPerms.includes(perm as Permission)} 
                                                            onChange={() => togglePerm(perm as Permission)}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        {resolveActionLabel(perm)}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
                {otherGroups.length > 0 && (
                    <div className="mb-6 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                            <h4 className="text-sm font-bold text-gray-900">Other</h4>
                        </div>
                        <div className="space-y-3">
                            {otherGroups.map((group) => (
                                <div key={group.key} className="flex flex-col gap-2">
                                    <div className="text-[11px] font-semibold uppercase text-gray-500">{group.label}</div>
                                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                                        {group.perms.map((perm) => (
                                            <label key={perm} className="flex items-center gap-2 text-xs text-gray-700 px-2 py-1 rounded-full bg-gray-50 hover:bg-gray-100 cursor-pointer whitespace-nowrap border border-gray-200 flex-shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedPerms.includes(perm as Permission)} 
                                                    onChange={() => togglePerm(perm as Permission)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                {resolveActionLabel(perm)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="border-t pt-4 mt-2 flex justify-end gap-2 bg-white">
                <Button type="button" variant="outline" onClick={onCancel} className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50">
                    <X size={14} /> Cancel
                </Button>
                <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Save size={14} /> Save
                </Button>
            </div>
        </form>
    );
};

const RolesTab = () => {
    const { roles, rolePermissions, addRole, updateRole, deleteRole, hasPermission } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleItem | undefined>(undefined);
    const [viewRole, setViewRole] = useState<RoleItem | null>(null);
    const [deleteRoleId, setDeleteRoleId] = useState<number | null>(null);

    const formatRoleLabel = (name?: string) =>
        (name ?? '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const columns = [
        {
            header: 'Role',
            accessorKey: 'name' as keyof RoleItem,
            sortable: true,
            cell: (item: RoleItem) => (
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-900">{formatRoleLabel(item.name)}</span>
                </div>
            )
        },
        {
            header: 'Tenant',
            accessorKey: 'tenant_name' as keyof RoleItem,
            cell: (item: RoleItem) => (
                <span className="text-xs text-gray-600">{item.tenant_name || '-'}</span>
            )
        },
        {
            header: 'Description',
            accessorKey: 'description' as keyof RoleItem,
            cell: (item: RoleItem) => (
                <span className="text-xs text-gray-600">{item.description || '-'}</span>
            )
        },
        {
            header: 'Permissions',
            cell: (item: RoleItem) => (
                <span className="text-xs text-gray-600">
                    {rolePermissions[item.name]?.length || 0} assigned
                </span>
            )
        },
        {
            header: 'Actions',
            width: '120px',
            cell: (item: RoleItem) => (
                <ActionButtons
                    onView={hasPermission('role.view') ? () => setViewRole(item) : undefined}
                    onEdit={hasPermission('role.edit') ? () => { setEditingRole(item); setIsModalOpen(true); } : undefined}
                    onDelete={hasPermission('role.delete') ? () => setDeleteRoleId(item.id) : undefined}
                />
            )
        }
    ];

    const handleSave = (data: { name: string; description?: string | null; permissions: Permission[] }) => {
        if (editingRole) {
            updateRole(String(editingRole.id), data);
        } else {
            addRole(data);
        }
        setIsModalOpen(false);
    };

    if (!hasPermission('settings.view')) return <div>Access Denied</div>;

    return (
        <div className="space-y-4">
            <DenseTable
                data={roles}
                columns={columns}
                title="Roles"
                onAdd={() => { setEditingRole(undefined); setIsModalOpen(true); }}
                addLabel="Role"
                canAdd={hasPermission('role.create')}
                canSearch={hasPermission('role.search')}
                canExport={hasPermission('role.export')}
                defaultSort={{ key: 'name', direction: 'asc' }}
            />

            <Modal
                open={isModalOpen}
                onOpenChange={(open) => {
                    setIsModalOpen(open);
                    if (!open) setEditingRole(undefined);
                }}
                title={editingRole ? `Edit Role: ${formatRoleLabel(editingRole.name)}` : 'Add Role'}
                className="max-w-7xl w-[92vw]"
            >
                <RoleForm
                    initialData={editingRole}
                    initialPermissions={editingRole ? (rolePermissions[editingRole.name] ?? []) : []}
                    onSave={handleSave}
                    onCancel={() => { setIsModalOpen(false); setEditingRole(undefined); }}
                />
            </Modal>

            <Modal
                open={!!viewRole}
                onOpenChange={(open) => !open && setViewRole(null)}
                title={`Role Details: ${formatRoleLabel(viewRole?.name ?? '')}`}
                className="max-w-3xl"
            >
                {viewRole && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Role Name</div>
                                <div className="text-sm font-semibold text-gray-900 mt-1">{formatRoleLabel(viewRole.name)}</div>
                            </div>
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Description</div>
                                <div className="text-sm font-semibold text-gray-900 mt-1">{viewRole.description || '-'}</div>
                            </div>
                        </div>
                        <div className="rounded-md border border-gray-100 bg-white p-3">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Permissions</div>
                            <div className="flex flex-wrap gap-2">
                                {(rolePermissions[viewRole.name] ?? []).length > 0 ? (
                                    (rolePermissions[viewRole.name] ?? []).map((perm) => (
                                        <span key={perm} className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700">
                                            {perm}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-400">No permissions assigned</span>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <Button variant="outline" size="sm" onClick={() => setViewRole(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmationDialog
                open={deleteRoleId !== null}
                onOpenChange={(open) => !open && setDeleteRoleId(null)}
                title="Delete Role"
                description="Are you sure you want to delete this role? This action cannot be undone."
                onConfirm={() => { if (deleteRoleId !== null) deleteRole(String(deleteRoleId)); setDeleteRoleId(null); }}
                confirmLabel="Delete"
            />
        </div>
    );
};

// --- Components for Permissions Tab (Reference) ---

const PermissionsTab = () => {
    const { permissions, permissionsCatalog, addPermission, updatePermission, deletePermission, hasPermission } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPermission, setEditingPermission] = useState<{ id: number; name: string } | null>(null);
    const [viewPermission, setViewPermission] = useState<{ id: number; name: string } | null>(null);
    const [deletePermissionId, setDeletePermissionId] = useState<number | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string }>({
        defaultValues: { name: '' }
    });

    useEffect(() => {
        reset({ name: editingPermission?.name ?? '' });
    }, [editingPermission, reset]);

    const handleSave = (data: { name: string }) => {
        if (editingPermission) {
            updatePermission(String(editingPermission.id), data);
        } else {
            addPermission(data);
        }
        setIsModalOpen(false);
        setEditingPermission(null);
    };

    const columns = [
        { header: 'Permission Key', accessorKey: 'name' as keyof { name: string }, sortable: true },
        {
            header: 'Description',
            cell: (item: { name: string }) => (
                <span className="text-xs text-gray-600">Allows the user to access {item.name}</span>
            )
        },
        {
            header: 'Actions',
            width: '120px',
            cell: (item: { id: number; name: string }) => (
                <ActionButtons
                    onView={hasPermission('permission.view') ? () => setViewPermission({ id: item.id, name: item.name }) : undefined}
                    onEdit={hasPermission('permission.edit') ? () => { setEditingPermission({ id: item.id, name: item.name }); setIsModalOpen(true); } : undefined}
                    onDelete={hasPermission('permission.edit') ? () => setDeletePermissionId(item.id) : undefined}
                />
            )
        }
    ];

    if (!hasPermission('permission.view')) return <div>Access Denied</div>;

    const permissionMap = new Map<string, { id: number; name: string }>();
    permissionsCatalog.forEach((name, idx) => {
        if (!permissionMap.has(name)) {
            permissionMap.set(name, { id: idx + 1, name });
        }
    });
    permissions.forEach((perm) => {
        if (!permissionMap.has(perm.name)) {
            permissionMap.set(perm.name, { id: perm.id, name: perm.name });
        } else {
            const existing = permissionMap.get(perm.name)!;
            if (!existing.id && perm.id) permissionMap.set(perm.name, { id: perm.id, name: perm.name });
        }
    });
    const permissionsTableData = Array.from(permissionMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="space-y-4">
            <DenseTable
                data={permissionsTableData}
                columns={columns as any}
                title="System Permissions"
                onAdd={() => { setEditingPermission(null); setIsModalOpen(true); }}
                addLabel="Permission"
                canAdd={hasPermission('permission.edit')}
                canSearch={hasPermission('permission.search')}
                canExport={hasPermission('permission.export')}
                defaultSort={{ key: 'name', direction: 'asc' }}
            />

            <Modal
                open={isModalOpen}
                onOpenChange={(open) => {
                    setIsModalOpen(open);
                    if (!open) setEditingPermission(null);
                }}
                title={editingPermission ? 'Edit Permission' : 'Add Permission'}
                className="max-w-lg"
            >
                <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                    <DenseInput label="Permission Key" {...register('name', { required: 'Required' })} error={errors.name?.message} />
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50">
                            <X size={14} /> Cancel
                        </Button>
                        <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Save size={14} /> Save
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={!!viewPermission}
                onOpenChange={(open) => !open && setViewPermission(null)}
                title="Permission Details"
                className="max-w-lg"
            >
                {viewPermission && (
                    <div className="space-y-4">
                        <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Permission Key</div>
                            <div className="text-sm font-semibold text-gray-900 mt-1 font-mono">{viewPermission.name}</div>
                        </div>
                        <div className="rounded-md border border-gray-100 bg-white p-3">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500">Description</div>
                            <div className="text-sm text-gray-600 mt-1">Allows the user to access {viewPermission.name}</div>
                        </div>
                        <div className="flex justify-end pt-2 border-t border-gray-100">
                            <Button variant="outline" size="sm" onClick={() => setViewPermission(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmationDialog
                open={deletePermissionId !== null}
                onOpenChange={(open) => !open && setDeletePermissionId(null)}
                title="Delete Permission"
                description="Are you sure you want to delete this permission? Roles using it will lose access."
                onConfirm={() => { if (deletePermissionId !== null) deletePermission(String(deletePermissionId)); setDeletePermissionId(null); }}
                confirmLabel="Delete"
            />
        </div>
    );
};

const BackupsTab = () => {
    const { hasPermission } = useStore();
    const [backups, setBackups] = useState<BackupDto[]>([]);
    const [settings, setSettings] = useState<BackupSettingsDto | null>(null);
    const [loading, setLoading] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [restoreConfirm, setRestoreConfirm] = useState<BackupDto | null>(null);
    const [creatingBackup, setCreatingBackup] = useState(false);
    const { register, handleSubmit, reset, formState: { errors } } = useForm<BackupSettingsUpdateDto>({
        defaultValues: {}
    });

    const loadBackups = useCallback(async () => {
        setLoading(true);
        try {
            const data = await backupApi.getBackups();
            setBackups(data.data);
        } catch (error) {
            toast.error('Failed to load backups');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const data = await backupApi.getSettings();
            setSettings(data);
            reset({
                auto_backup_enabled: data.auto_backup_enabled,
                frequency: data.frequency,
                backup_time: data.backup_time,
                retention_days: data.retention_days,
                max_backups: data.max_backups,
            });
        } catch (error) {
            toast.error('Failed to load backup settings');
        }
    }, [reset]);

    useEffect(() => {
        if (hasPermission('settings.backup')) {
            loadBackups();
            loadSettings();
        }
    }, [hasPermission, loadBackups, loadSettings]);

    const handleCreateBackup = async () => {
        setCreatingBackup(true);
        try {
            await backupApi.createBackup();
            toast.success('Backup created successfully');
            loadBackups();
        } catch (error) {
            toast.error('Failed to create backup');
        } finally {
            setCreatingBackup(false);
        }
    };

    const handleDeleteBackup = async (backupId: number) => {
        try {
            await backupApi.deleteBackup(backupId);
            toast.success('Backup deleted successfully');
            loadBackups();
        } catch (error) {
            toast.error('Failed to delete backup');
        }
    };

    const handleRestoreBackup = async (backup: BackupDto) => {
        try {
            await backupApi.restoreBackup(backup.id);
            toast.success('Backup restored successfully');
            setRestoreConfirm(null);
        } catch (error) {
            toast.error('Failed to restore backup');
        }
    };

    const handleDownloadBackup = async (backup: BackupDto) => {
        try {
            const blob = await backupApi.downloadBackup(backup.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = backup.filename;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Failed to download backup');
        }
    };

    const handleUpdateSettings = (data: BackupSettingsUpdateDto) => {
        backupApi.updateSettings(data).then(() => {
            toast.success('Backup settings updated');
            loadSettings();
            setSettingsModalOpen(false);
        }).catch(() => {
            toast.error('Failed to update backup settings');
        });
    };

    const backupColumns = [
        { header: 'Filename', accessorKey: 'filename', sortable: true },
        { header: 'Type', accessorKey: 'type', sortable: true, cell: (item: BackupDto) => <span className="capitalize text-xs">{item.type}</span> },
        { header: 'Size', accessorKey: 'formatted_size', cell: (item: BackupDto) => item.formatted_size || 'N/A' },
        { header: 'Status', accessorKey: 'status', sortable: true, cell: (item: BackupDto) => (
            <span className={clsx('capitalize text-xs px-2 py-1 rounded-full', {
                'bg-yellow-100 text-yellow-800': item.status === 'pending',
                'bg-blue-100 text-blue-800': item.status === 'in_progress',
                'bg-green-100 text-green-800': item.status === 'completed',
                'bg-red-100 text-red-800': item.status === 'failed',
            })}>
                {item.status}
            </span>
        )},
        { header: 'Created', accessorKey: 'created_at', cell: (item: BackupDto) => formatDateTime(item.created_at, 'MMM dd, yyyy h:mm a') },
        {
            header: 'Actions',
            width: '160px',
            cell: (item: BackupDto) => (
                <ActionButtons
                    onView={hasPermission('backup.download') ? () => handleDownloadBackup(item) : undefined}
                    onEdit={hasPermission('backup.restore') ? () => setRestoreConfirm(item) : undefined}
                    onDelete={hasPermission('backup.delete') ? () => handleDeleteBackup(item.id) : undefined}
                />
            )
        }
    ];

    if (!hasPermission('settings.backup')) return <div>Access Denied</div>;

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <Database size={20} /> Database Backups
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Create and manage database backups</p>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            onClick={() => setSettingsModalOpen(true)}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <SettingsIcon size={14} /> Settings
                        </Button>
                        <Button 
                            onClick={handleCreateBackup}
                            disabled={creatingBackup}
                            size="sm"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <HardDrive size={14} /> Create Backup
                        </Button>
                    </div>
                </div>

                <DenseTable
                    data={backups}
                    columns={backupColumns as any}
                    title="Backups"
                    isLoading={loading}
                    canSearch={false}
                    defaultSort={{ key: 'created_at', direction: 'desc' }}
                />
            </div>

            <Modal
                open={settingsModalOpen}
                onOpenChange={(open) => {
                    setSettingsModalOpen(open);
                    if (!open) loadSettings();
                }}
                title="Backup Settings"
                className="max-w-lg"
            >
                {settings && (
                    <form onSubmit={handleSubmit(handleUpdateSettings)} className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                {...register('auto_backup_enabled')} 
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                id="auto_backup"
                            />
                            <label htmlFor="auto_backup" className="text-sm font-medium text-gray-700">Enable Automatic Backups</label>
                        </div>

                        <DenseSelect
                            label="Frequency"
                            options={[
                                { value: 'daily', label: 'Daily' },
                                { value: 'weekly', label: 'Weekly' },
                                { value: 'monthly', label: 'Monthly' },
                            ]}
                            {...register('frequency')}
                        />

                        <DenseInput
                            label="Backup Time"
                            type="time"
                            {...register('backup_time')}
                        />

                        <DenseInput
                            label="Retention Days"
                            type="number"
                            {...register('retention_days', { required: 'Required' })}
                            error={errors.retention_days?.message}
                        />

                        <DenseInput
                            label="Max Backups to Keep"
                            type="number"
                            {...register('max_backups', { required: 'Required' })}
                            error={errors.max_backups?.message}
                        />

                        {settings.last_backup_at && (
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Last Backup</div>
                                <div className="text-sm font-medium text-gray-900 mt-1">{formatDateTime(settings.last_backup_at, 'MMM dd, yyyy h:mm a')}</div>
                            </div>
                        )}

                        {settings.next_backup_at && (
                            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                                <div className="text-[11px] uppercase tracking-wide text-gray-500">Next Backup</div>
                                <div className="text-sm font-medium text-gray-900 mt-1">{formatDateTime(settings.next_backup_at, 'MMM dd, yyyy h:mm a')}</div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                            <Button type="button" variant="outline" onClick={() => setSettingsModalOpen(false)} className="gap-2 text-gray-700 border-gray-300 hover:bg-gray-50">
                                <X size={14} /> Cancel
                            </Button>
                            <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Save size={14} /> Save
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            <ConfirmationDialog
                open={restoreConfirm !== null}
                onOpenChange={(open) => !open && setRestoreConfirm(null)}
                title="Restore Backup"
                description={`Are you sure you want to restore from ${restoreConfirm?.filename}? This will overwrite the current database.`}
                onConfirm={() => { if (restoreConfirm) handleRestoreBackup(restoreConfirm); }}
                confirmLabel="Restore"
            />
        </div>
    );
};

// --- Components for Profile Tab ---

const ProfileTab = () => {
    const { currentUser, updateCurrentUser } = useStore();
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({ defaultValues: currentUser });
    const formatRoleLabel = (name?: string) =>
        (name ?? '')
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

    const avatar = watch('avatar');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setValue('avatar', reader.result as string, { shouldDirty: true });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
             <form onSubmit={handleSubmit((data) => updateCurrentUser(data))} className="space-y-6 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex flex-col items-center gap-2 mb-6">
                    <div className="relative group cursor-pointer">
                        <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center border-2 border-white shadow-md relative ring-2 ring-gray-100">
                            {avatar ? (
                                <img src={avatar} alt={currentUser.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                                    {currentUser.name.charAt(0)}
                                </div>
                            )}
                            
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm transition-opacity font-medium">
                                    Change
                                </div>
                            </div>
                        </div>

                        {/* Camera Icon Button */}
                        <div className="absolute bottom-0 right-1 bg-white rounded-full p-1.5 shadow-sm border border-gray-200 text-gray-500 group-hover:text-blue-600 transition-colors z-20">
                            <Camera className="w-3.5 h-3.5" />
                        </div>

                        <input 
                            type="file" 
                            accept="image/*" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleFileChange}
                            title="Upload avatar"
                        />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-gray-900">{currentUser.name}</h3>
                        <p className="text-sm text-gray-500">{currentUser.email}</p>
                        <span className="inline-block mt-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                            {formatRoleLabel(currentUser.role)}
                        </span>
                    </div>
                </div>

                <div className="grid gap-4 border-t border-gray-100 pt-6">
                    <DenseInput label="Full Name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
                    <DenseInput label="Email Address" type="email" {...register('email', { required: 'Required' })} error={errors.email?.message} readOnly className="bg-gray-50" />
                    <div className="pt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Change Password</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DenseInput label="New Password" type="password" placeholder="Leave blank to keep current" />
                            <DenseInput label="Confirm Password" type="password" placeholder="Confirm new password" />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end border-t border-gray-100">
                    <Button type="submit" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Save size={14} /> Save
                    </Button>
                </div>
            </form>
        </div>
    );
};

export const SettingsPage = () => {
  const { hasPermission, currentUser } = useStore();
  
  const allTabs = [
      { id: 'general', label: 'General', icon: SettingsIcon, perm: 'settings.general' },
      { id: 'print', label: 'Print', icon: Printer, perm: 'settings.print' },
      { id: 'clients', label: 'Clients', icon: Building, perm: 'settings.clients' },
      { id: 'users', label: 'Users', icon: UserIcon, perm: 'settings.users' },
      { id: 'roles', label: 'Roles', icon: Shield, perm: 'settings.roles' },
      { id: 'permissions', label: 'Permissions', icon: Lock, perm: 'settings.permissions' },
      { id: 'backup', label: 'Backup', icon: Database, perm: 'settings.backup' },
      { id: 'profile', label: 'Profile', icon: UserIcon, perm: 'settings.profile' },
  ];

  const tabs = allTabs.filter(tab => hasPermission(tab.perm as Permission));
  
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'profile');

  // Update active tab if current selection becomes invalid
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
        setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Allow access if user has any settings permission
  const hasAnySettingsPermission = hasPermission('settings.view') || 
    hasPermission('settings.general') || 
    hasPermission('settings.print') || 
    hasPermission('settings.profile') ||
    hasPermission('settings.users') ||
    hasPermission('settings.roles') ||
    hasPermission('settings.permissions') ||
    hasPermission('settings.clients') ||
    hasPermission('settings.backup');

  if (!hasAnySettingsPermission) return <div>Access Denied</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm min-h-full flex flex-col">
      <div className="border-b border-gray-200 px-6">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                        "group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap",
                        activeTab === tab.id 
                            ? "border-blue-500 text-blue-600" 
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                >
                    <tab.icon className={clsx("mr-2 h-4 w-4", activeTab === tab.id ? "text-blue-500" : "text-gray-400 group-hover:text-gray-500")} />
                    {tab.label}
                </button>
            ))}
        </nav>
      </div>
      <div className="p-6 flex-1 bg-gray-50/50">
        {activeTab === 'general' && hasPermission('settings.general') && <GeneralTab />}
        {activeTab === 'print' && hasPermission('settings.print') && <PrintTab />}
        {activeTab === 'clients' && hasPermission('settings.clients') && <ClientsTab />}
        {activeTab === 'users' && hasPermission('settings.users') && <UsersTab />}
        {activeTab === 'roles' && hasPermission('settings.roles') && <RolesTab />}
        {activeTab === 'permissions' && hasPermission('settings.permissions') && <PermissionsTab />}
        {activeTab === 'backup' && hasPermission('settings.backup') && <BackupsTab />}
        {activeTab === 'profile' && hasPermission('settings.profile') && <ProfileTab />}
      </div>
    </div>
  );
};
