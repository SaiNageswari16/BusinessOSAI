import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { api } from '@/services/api';
import { apiClient } from '@/services/apiClient';
import type { Product } from '@/types';
import { cn } from '@/utils/cn';

interface InventoryItem {
  id: string;
  name: string;
  subText: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  stock: number;
  stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock';
  status: 'Active' | 'Inactive';
  mrp: number;
  purchasePrice?: number;
  reorderLevel?: number;
  imageUrl: string;
}

const inventorySubTabs = ['Products', 'Stock In', 'Stock Out', 'Adjustments', 'Transfer', 'Suppliers', 'Reports'];
const categoryBadges: Record<string, string> = {
  Supplements: 'bg-purple-50 text-purple-600 border-purple-200',
  Accessories: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  Nutrition: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState('Products');
  const [inventoryType, setInventoryType] = useState<'My Inventory' | 'Master Catalog'>('My Inventory');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [unitFilter, setUnitFilter] = useState('All Units');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<InventoryItem[]>('/inventory')
      .then((res) => {
        if (!isMounted) return;
        setItems(Array.isArray(res) ? res : []);
      })
      .catch(() => {
        if (isMounted) setItems([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add/Edit Product Panel Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'Add New' | 'Add from Master Catalog'>('Add New');

  // Form State
  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category: 'Supplements',
    brand: 'Optimum Nutrition',
    unit: 'Pcs',
    purchasePrice: '',
    mrp: '',
    initialStock: '',
    reorderLevel: '',
  });

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search);
    const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
    const matchesBrand = brandFilter === 'All Brands' || item.brand === brandFilter;
    const matchesUnit = unitFilter === 'All Units' || item.unit === unitFilter;
    return matchesSearch && matchesCategory && matchesBrand && matchesUnit;
  });

  // Calculate Pagination Slices
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredItems.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleOpenCreate = () => {
    setEditingItemId(null);
    setForm({
      name: '',
      sku: '',
      barcode: '',
      category: 'Supplements',
      brand: 'Optimum Nutrition',
      unit: 'Pcs',
      purchasePrice: '',
      mrp: '',
      initialStock: '',
      reorderLevel: '',
    });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      category: item.category,
      brand: item.brand,
      unit: item.unit,
      purchasePrice: String(item.purchasePrice || ''),
      mrp: String(item.mrp || ''),
      initialStock: String(item.stock || ''),
      reorderLevel: String(item.reorderLevel || ''),
    });
    setDrawerOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory product?')) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => prev.filter((iId) => iId !== id));
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected products?`)) return;
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    setSelectedIds([]);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.mrp) return;

    const stockNum = Number(form.initialStock) || 0;
    let stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
    if (stockNum === 0) stockStatus = 'Out of Stock';
    else if (stockNum <= 10) stockStatus = 'Low Stock';

    if (editingItemId) {
      // Update existing item
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                name: form.name,
                sku: form.sku || item.sku,
                barcode: form.barcode || item.barcode,
                category: form.category,
                brand: form.brand,
                unit: form.unit,
                stock: stockNum,
                stockStatus,
                mrp: Number(form.mrp) || item.mrp,
                purchasePrice: Number(form.purchasePrice) || item.purchasePrice,
                reorderLevel: Number(form.reorderLevel) || item.reorderLevel,
              }
            : item
        )
      );
    } else {
      // Create new item
      const newItem: InventoryItem = {
        id: `inv_${Date.now()}`,
        name: form.name,
        subText: form.unit,
        sku: form.sku || `SKU-${form.name.slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        barcode: form.barcode || `${Math.floor(8900000000000 + Math.random() * 9999999999)}`,
        category: form.category,
        brand: form.brand,
        unit: form.unit,
        stock: stockNum,
        stockStatus,
        status: 'Active',
        mrp: Number(form.mrp) || 0,
        purchasePrice: Number(form.purchasePrice) || 0,
        reorderLevel: Number(form.reorderLevel) || 10,
        imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=300&auto=format&fit=crop&q=80',
      };
      setItems((prev) => [newItem, ...prev]);
    }

    setDrawerOpen(false);
  };

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Top Header & Page Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-100 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-navy-900">Inventory</h1>
          <p className="text-xs text-navy-500 font-medium mt-0.5">
            Manage your inventory products, stock and operations
          </p>
        </div>

        {/* Top Header Controls */}
        <div className="flex items-center gap-3">
          <div className="relative hidden xl:block w-72">
            <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              placeholder="Search products, SKU, barcode..."
              className="input-field text-xs pl-8 pr-10 py-1.5 rounded-xl bg-navy-50/60"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-navy-400 border border-navy-200 px-1.5 py-0.5 rounded bg-white">
              ⌘ K
            </span>
          </div>

          <div className="flex items-center gap-2 bg-navy-50 px-3 py-1.5 rounded-xl border border-navy-100 text-xs font-semibold text-navy-700">
            <Icon name="map-pin" size={14} className="text-brand-600" />
            <span>Fit Club Elite - Indiranagar</span>
            <Icon name="chevron-down" size={14} className="text-navy-400" />
          </div>

          <button className="relative w-8 h-8 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-600 hover:bg-navy-100">
            <Icon name="bell" size={16} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-navy-300 text-white text-[9px] font-bold flex items-center justify-center">
              0
            </span>
          </button>

          <button className="w-8 h-8 rounded-xl bg-navy-50 border border-navy-100 flex items-center justify-center text-navy-600 hover:bg-navy-100">
            <Icon name="printer" size={16} />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-navy-100">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold flex items-center justify-center">
              Y
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-navy-900 leading-none">Yashwanth</div>
              <div className="text-[10px] text-navy-400">Owner</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex border-b border-navy-100 gap-6 text-sm font-semibold text-navy-500">
        {inventorySubTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'pb-3 transition-all relative',
              activeTab === tab ? 'text-brand-600 font-bold' : 'hover:text-navy-800'
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Metrics Cards Row (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card p-4 border border-navy-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Icon name="package" size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-navy-400">Total Products</div>
            <div className="text-xl font-extrabold text-navy-900 leading-tight">248</div>
            <div className="text-[10px] font-semibold text-success-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 12.4%</span>
              <span className="text-navy-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="card p-4 border border-navy-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Icon name="dollar-sign" size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-navy-400">Total Stock Value</div>
            <div className="text-xl font-extrabold text-navy-900 leading-tight">₹2,48,750</div>
            <div className="text-[10px] font-semibold text-success-600 flex items-center gap-0.5 mt-0.5">
              <span>↑ 8.3%</span>
              <span className="text-navy-400 font-normal">vs last month</span>
            </div>
          </div>
        </div>

        <div className="card p-4 border border-navy-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Icon name="alert-triangle" size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-navy-400">Low Stock Items</div>
            <div className="text-xl font-extrabold text-navy-900 leading-tight">18</div>
            <div className="text-[10px] font-semibold text-danger-600 flex items-center gap-0.5 mt-0.5">
              <span>↓ 2</span>
              <span className="text-navy-400 font-normal">vs yesterday</span>
            </div>
          </div>
        </div>

        <div className="card p-4 border border-navy-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Icon name="slash" size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-navy-400">Out of Stock</div>
            <div className="text-xl font-extrabold text-navy-900 leading-tight">3</div>
            <div className="text-[10px] font-semibold text-danger-600 flex items-center gap-0.5 mt-0.5">
              <span>↓ 1</span>
              <span className="text-navy-400 font-normal">vs yesterday</span>
            </div>
          </div>
        </div>

        <div className="card p-4 border border-navy-100 bg-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <Icon name="clock" size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-navy-400">Stock Expiring Soon</div>
            <div className="text-xl font-extrabold text-navy-900 leading-tight">12</div>
            <div className="text-[10px] font-medium text-navy-400 mt-0.5">Within 30 days</div>
          </div>
        </div>
      </div>

      {/* Action Bar & Catalog Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInventoryType('My Inventory')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all',
              inventoryType === 'My Inventory'
                ? 'bg-brand-50 border border-brand-200 text-brand-700 shadow-sm'
                : 'bg-navy-50/70 text-navy-600 hover:bg-navy-100'
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon name="box" size={14} /> My Inventory
            </span>
          </button>

          <button
            onClick={() => setInventoryType('Master Catalog')}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-bold transition-all',
              inventoryType === 'Master Catalog'
                ? 'bg-brand-50 border border-brand-200 text-brand-700 shadow-sm'
                : 'bg-navy-50/70 text-navy-600 hover:bg-navy-100'
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon name="grid" size={14} /> Master Catalog
            </span>
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Delete Button when items are checked */}
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="btn-secondary py-2 px-3 rounded-xl text-xs font-bold text-danger-600 border-danger-200 bg-danger-50 hover:bg-danger-100 flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Icon name="trash" size={14} />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="btn-primary py-2 px-4 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5 shadow-glow"
          >
            <Icon name="plus" size={14} /> Add Product
          </button>

          <button className="btn-secondary text-xs py-2 px-3 rounded-xl flex items-center gap-1.5">
            <Icon name="download" size={14} /> Import Products
          </button>

          <button className="btn-secondary text-xs py-2 px-3 rounded-xl flex items-center gap-1.5">
            <Icon name="upload" size={14} /> Export
          </button>

          <button className="btn-secondary text-xs py-2 px-3 rounded-xl flex items-center gap-1.5">
            <Icon name="barcode" size={14} /> Print Barcodes
          </button>

          <button className="btn-secondary text-xs py-2 px-3 rounded-xl flex items-center gap-1">
            <span>More</span>
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-3 border border-navy-100 bg-white">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
            <input
              type="text"
              placeholder="Search by product name, SKU or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field text-xs pl-9 py-2 bg-navy-50/50 border-navy-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field text-xs py-1.5 w-auto bg-white border-navy-200"
            >
              <option>All Categories</option>
              <option>Supplements</option>
              <option>Accessories</option>
              <option>Nutrition</option>
            </select>

            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="input-field text-xs py-1.5 w-auto bg-white border-navy-200"
            >
              <option>All Brands</option>
              <option>Optimum Nutrition</option>
              <option>MuscleBlaze</option>
              <option>MuscleTech</option>
              <option>Fit Club</option>
              <option>Fast&Up</option>
            </select>

            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="input-field text-xs py-1.5 w-auto bg-white border-navy-200"
            >
              <option>All Units</option>
              <option>Kg</option>
              <option>Pcs</option>
              <option>Pair</option>
            </select>

            <button className="btn-secondary py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5">
              <Icon name="filter" size={14} /> Filters
            </button>

            <button className="btn-secondary py-1.5 px-3 rounded-xl text-xs flex items-center gap-1.5">
              <Icon name="columns" size={14} /> Columns
            </button>
          </div>
        </div>
      </div>

      {/* Main Inventory Products Table */}
      <div className="card p-4 border border-navy-100 bg-white">
        {loading ? (
          <SkeletonTable rows={8} cols={10} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[950px]">
              <thead>
                <tr className="border-b border-navy-100 text-navy-400 font-semibold uppercase tracking-wider">
                  <th className="pb-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </th>
                  <th className="pb-3 px-3">PRODUCT</th>
                  <th className="pb-3 px-3">SKU / BARCODE</th>
                  <th className="pb-3 px-3">CATEGORY</th>
                  <th className="pb-3 px-3">BRAND</th>
                  <th className="pb-3 px-3">UNIT</th>
                  <th className="pb-3 px-3">STOCK</th>
                  <th className="pb-3 px-3">STATUS</th>
                  <th className="pb-3 px-3">MRP</th>
                  <th className="pb-3 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {pagedItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const badgeStyle = categoryBadges[item.category] || 'bg-navy-50 text-navy-600 border-navy-200';

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        'hover:bg-navy-50/60 transition-colors cursor-pointer',
                        isSelected && 'bg-brand-50/40'
                      )}
                    >
                      <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(item.id, e)}
                          className="w-4 h-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-navy-100 overflow-hidden border border-navy-200 shrink-0">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-bold text-navy-900 text-sm">{item.name}</div>
                            <div className="text-[10px] text-navy-400">{item.subText}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-navy-800 text-xs">{item.sku}</div>
                        <div className="font-mono text-[10px] text-navy-400">{item.barcode}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={cn('px-2.5 py-1 rounded-lg text-[11px] font-semibold border', badgeStyle)}>
                          {item.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-navy-700 font-semibold">{item.brand}</td>

                      <td className="py-3 px-3 text-navy-600">{item.unit}</td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'font-bold text-sm',
                              item.stockStatus === 'In Stock' && 'text-success-600',
                              item.stockStatus === 'Low Stock' && 'text-amber-600',
                              item.stockStatus === 'Out of Stock' && 'text-danger-600'
                            )}
                          >
                            {item.stock}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold',
                              item.stockStatus === 'In Stock' && 'text-success-600',
                              item.stockStatus === 'Low Stock' && 'text-amber-600',
                              item.stockStatus === 'Out of Stock' && 'text-danger-600'
                            )}
                          >
                            {item.stockStatus}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-bold text-navy-900 text-sm">
                        ₹{item.mrp.toLocaleString()}
                      </td>

                      {/* Working Action Column: Edit & Delete */}
                      <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Edit Product"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 rounded-lg text-danger-600 hover:bg-danger-50 transition-colors"
                            title="Delete Product"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Dynamic Table Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-navy-100 text-xs text-navy-500">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredItems.length)} of {filteredItems.length} products
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg hover:bg-navy-50 text-navy-400 disabled:opacity-30"
            >
              <Icon name="chevron-left" size={14} />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition-all',
                    currentPage === pageNum
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'hover:bg-navy-50 text-navy-700'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg hover:bg-navy-50 text-navy-400 disabled:opacity-30"
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="input-field text-xs py-1 px-2 w-auto bg-white border-navy-200"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Slide-over Right Drawer Panel: Add or Edit Product */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col justify-between animate-slide-left border-l border-navy-100">
            {/* Drawer Header */}
            <div>
              <div className="p-6 border-b border-navy-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-navy-900">
                    {editingItemId ? 'Edit Inventory Product' : 'Add Product to Inventory'}
                  </h2>
                  <p className="text-xs text-navy-400">Enter product details and stock pricing below</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="text-navy-400 hover:text-navy-700 p-1">
                  <Icon name="x" size={20} />
                </button>
              </div>

              {/* Sub-tabs inside drawer */}
              <div className="flex border-b border-navy-100 px-6 gap-3 pt-3 bg-navy-50/50">
                <button
                  onClick={() => setDrawerTab('Add New')}
                  className={cn(
                    'px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2',
                    drawerTab === 'Add New'
                      ? 'border-brand-600 text-brand-600 bg-white'
                      : 'border-transparent text-navy-500 hover:text-navy-800'
                  )}
                >
                  {editingItemId ? 'Edit Product' : 'Add New'}
                </button>

                {!editingItemId && (
                  <button
                    onClick={() => setDrawerTab('Add from Master Catalog')}
                    className={cn(
                      'px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2',
                      drawerTab === 'Add from Master Catalog'
                        ? 'border-brand-600 text-brand-600 bg-white'
                        : 'border-transparent text-navy-500 hover:text-navy-800'
                    )}
                  >
                    Add from Master Catalog
                  </button>
                )}
              </div>

              {/* Form Content */}
              <form id="add-product-form" onSubmit={handleSaveProduct} className="p-6 space-y-5">
                {/* Section 1: Product Information */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider text-brand-600">
                    Product Information
                  </h3>

                  <div>
                    <label className="text-xs font-semibold text-navy-700 block mb-1">
                      Product Name <span className="text-danger-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter product name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input-field text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-navy-700 block mb-1">
                      SKU <span className="text-danger-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter SKU (e.g. SKU-PRO-001)"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="input-field text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-navy-700 block mb-1">Barcode</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter barcode"
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                        className="input-field text-xs flex-1"
                      />
                      <button
                        type="button"
                        className="btn-secondary text-xs px-3 rounded-xl flex items-center gap-1 whitespace-nowrap text-brand-600 border-brand-200 bg-brand-50"
                      >
                        <Icon name="barcode" size={14} /> Scan Barcode
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">
                        Category <span className="text-danger-500">*</span>
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="input-field text-xs"
                      >
                        <option>Supplements</option>
                        <option>Accessories</option>
                        <option>Nutrition</option>
                        <option>Apparel</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">Brand</label>
                      <select
                        value={form.brand}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })}
                        className="input-field text-xs"
                      >
                        <option>Optimum Nutrition</option>
                        <option>MuscleBlaze</option>
                        <option>MuscleTech</option>
                        <option>Fit Club</option>
                        <option>Fast&Up</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-navy-700 block mb-1">
                      Unit of Measure <span className="text-danger-500">*</span>
                    </label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="input-field text-xs"
                    >
                      <option>Pcs</option>
                      <option>Kg</option>
                      <option>Pair</option>
                      <option>Box</option>
                    </select>
                  </div>
                </div>

                {/* Section 2: Pricing & Stock */}
                <div className="space-y-3 pt-3 border-t border-navy-100">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider text-brand-600">
                    Pricing & Stock
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">
                        Purchase Price (₹) <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Enter purchase price"
                        value={form.purchasePrice}
                        onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">
                        MRP (₹) <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="Enter MRP"
                        value={form.mrp}
                        onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">
                        Initial Stock <span className="text-danger-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="Enter stock quantity"
                        value={form.initialStock}
                        onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-navy-700 block mb-1">Reorder Level</label>
                      <input
                        type="number"
                        placeholder="Enter reorder level"
                        value={form.reorderLevel}
                        onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Product Image Upload */}
                <div className="space-y-2 pt-3 border-t border-navy-100">
                  <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider text-brand-600">
                    Product Image
                  </h3>

                  <div className="border-2 border-dashed border-navy-200 rounded-2xl p-6 text-center hover:border-brand-500 hover:bg-brand-50/20 transition-all cursor-pointer">
                    <Icon name="upload" size={24} className="mx-auto text-brand-600 mb-2" />
                    <div className="text-xs font-bold text-navy-900">Upload product image</div>
                    <div className="text-[10px] text-navy-400 mt-0.5">JPG, PNG or WEBP (Max 2MB)</div>
                  </div>
                </div>
              </form>
            </div>

            {/* Drawer Footer Buttons */}
            <div className="p-4 border-t border-navy-100 bg-white flex gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="btn-secondary flex-1 py-2.5 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-product-form"
                className="btn-primary flex-1 py-2.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-glow"
              >
                {editingItemId ? 'Update Product' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
