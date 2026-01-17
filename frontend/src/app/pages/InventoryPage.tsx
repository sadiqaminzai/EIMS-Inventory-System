import { useState } from 'react';
import { Package, Tag, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { ProductsPage } from './ProductsPage';
import { BrandsPage } from './BrandsPage';
import { CountriesPage } from './CountriesPage';
import { useStore } from '../../store';

export const InventoryPage = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'brands' | 'countries'>('products');
    const { hasPermission } = useStore();

    const tabs = [
        { id: 'products', label: 'Products', icon: Package, perm: 'product.view' },
        { id: 'brands', label: 'Brands', icon: Tag, perm: 'product.view' },
        { id: 'countries', label: 'Countries', icon: Globe, perm: 'product.view' },
    ];

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="bg-white border-b border-gray-200 px-6 pt-2 rounded-t-lg shadow-sm">
                 <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-gray-500" />
                    <h1 className="text-xl font-bold text-gray-900">Inventory Management</h1>
                 </div>
                 <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {tabs.map((tab) => {
                        if (tab.perm && !hasPermission(tab.perm as any)) return null;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
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
                        );
                    })}
                </nav>
            </div>

            <div className="flex-1 bg-white rounded-b-lg border border-gray-200 shadow-sm p-4 overflow-hidden">
                {activeTab === 'products' && <ProductsPage />}
                {activeTab === 'brands' && <BrandsPage />}
                {activeTab === 'countries' && <CountriesPage />}
            </div>
        </div>
    );
};
