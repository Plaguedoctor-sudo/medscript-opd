'use client';

import { useState, useTransition } from 'react';
import {
  Pill,
  Search,
  Plus,
  AlertTriangle,
  Clock,
  History,
  TrendingDown,
  Layers,
  MapPin,
  CheckCircle2,
  X,
  MinusCircle,
  PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PharmacyInventoryItem, PharmacyTransaction, UserRole } from '@/types';
import {
  addPharmacyItem,
  dispenseOrAdjustStock,
  getPharmacyTransactions,
  InventoryStats,
} from './actions';
import { useRouter } from 'next/navigation';

interface InventoryDashboardProps {
  initialItems: PharmacyInventoryItem[];
  stats: InventoryStats;
  userRole: UserRole;
}

export function InventoryDashboard({ initialItems, stats, userRole }: InventoryDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<PharmacyInventoryItem[]>(initialItems);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock' | 'expiring_soon'>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PharmacyInventoryItem | null>(null);
  const [transactions, setTransactions] = useState<
    (PharmacyTransaction & { medicineName: string; patientName?: string | null })[]
  >([]);

  // Add Item Form State
  const [newItem, setNewItem] = useState({
    medicineName: '',
    brandName: '',
    category: 'Tablet',
    batchNo: '',
    expiryDate: '',
    quantityInStock: 50,
    minThreshold: 20,
    purchaseCost: 0,
    mrp: 0,
    sellingPrice: 0,
    rackLocation: '',
    supplierName: '',
  });

  // Dispense Form State
  const [dispenseData, setDispenseData] = useState<{
    quantity: number;
    type: 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED' | 'INWARD';
    remarks: string;
  }>({
    quantity: 1,
    type: 'DISPENSED',
    remarks: '',
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filter items locally based on search, category, and tab
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const [ninetyDaysFromNow] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split('T')[0];
  });

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      search === '' ||
      item.medicineName.toLowerCase().includes(search.toLowerCase()) ||
      (item.brandName && item.brandName.toLowerCase().includes(search.toLowerCase())) ||
      item.batchNo.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    let matchesTab = true;
    if (activeTab === 'low_stock') {
      matchesTab = item.quantityInStock <= item.minThreshold;
    } else if (activeTab === 'expiring_soon') {
      matchesTab = item.expiryDate <= ninetyDaysFromNow;
    }

    return matchesSearch && matchesCategory && matchesTab;
  });

  const handleOpenDispense = (item: PharmacyInventoryItem, defaultType: 'DISPENSED' | 'INWARD' = 'DISPENSED') => {
    setSelectedItem(item);
    setDispenseData({
      quantity: 1,
      type: defaultType,
      remarks: '',
    });
    setActionError(null);
    setActionSuccess(null);
    setShowDispenseModal(true);
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setActionError(null);
    setActionSuccess(null);

    const res = await dispenseOrAdjustStock({
      inventoryId: selectedItem.id,
      type: dispenseData.type,
      quantity: Number(dispenseData.quantity),
      remarks: dispenseData.remarks,
    });

    if (res.success && res.newStock !== undefined) {
      setItems((prev) =>
        prev.map((i) => (i.id === selectedItem.id ? { ...i, quantityInStock: res.newStock! } : i))
      );
      setActionSuccess(`Stock updated! New balance: ${res.newStock} units.`);
      setTimeout(() => {
        setShowDispenseModal(false);
        setActionSuccess(null);
        startTransition(() => router.refresh());
      }, 900);
    } else {
      setActionError(res.error || 'Failed to update stock.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    if (!newItem.medicineName || !newItem.batchNo || !newItem.expiryDate) {
      setActionError('Medicine name, batch number, and expiry date are required.');
      return;
    }

    const res = await addPharmacyItem({
      medicineName: newItem.medicineName,
      brandName: newItem.brandName || undefined,
      category: newItem.category,
      batchNo: newItem.batchNo,
      expiryDate: newItem.expiryDate,
      quantityInStock: Number(newItem.quantityInStock),
      minThreshold: Number(newItem.minThreshold),
      purchaseCost: Number(newItem.purchaseCost),
      mrp: Number(newItem.mrp),
      sellingPrice: Number(newItem.sellingPrice),
      rackLocation: newItem.rackLocation || undefined,
      supplierName: newItem.supplierName || undefined,
    });

    if (res.success) {
      setActionSuccess('Medicine stock added to formulary successfully!');
      setTimeout(() => {
        setShowAddModal(false);
        setActionSuccess(null);
        startTransition(() => router.refresh());
      }, 900);
    } else {
      setActionError(res.error || 'Failed to add item.');
    }
  };

  const handleViewHistory = async () => {
    setShowHistoryModal(true);
    const data = await getPharmacyTransactions(50);
    setTransactions(data);
  };

  const categories = [
    'All',
    'Tablet',
    'Capsule',
    'Syrup',
    'Injection',
    'IV Fluid',
    'Inhaler',
    'Surgical Consumable',
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Formulary Items</span>
            <Layers className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.totalItems}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{stats.totalQuantity} total units in stock</div>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Stock Valuation</span>
            <span className="text-sm font-bold text-emerald-600">₹</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.totalValuation.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">At purchase cost ledger</div>
        </div>

        <div
          onClick={() => setActiveTab('low_stock')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'low_stock' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400' : 'bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-2">{stats.lowStockCount}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Below reorder threshold</div>
        </div>

        <div
          onClick={() => setActiveTab('expiring_soon')}
          className={`p-4 rounded-xl border shadow-xs cursor-pointer transition-all ${
            activeTab === 'expiring_soon' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400' : 'bg-white hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-semibold uppercase tracking-wider">Expiring &lt;90d</span>
            <Clock className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900 mt-2">{stats.expiringSoonCount}</div>
          <div className="text-[11px] text-rose-700/80 mt-0.5">Requires priority rotation</div>
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-xs flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Actions</div>
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setShowAddModal(true);
              }}
              className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Inward Stock
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleViewHistory}
              title="Transaction History"
              className="text-xs text-slate-700"
            >
              <History className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search medicine name, brand, or batch number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'all' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              onClick={() => setActiveTab('low_stock')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'low_stock'
                  ? 'bg-amber-100 text-amber-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Low Stock ({stats.lowStockCount})
            </button>
            <button
              onClick={() => setActiveTab('expiring_soon')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTab === 'expiring_soon'
                  ? 'bg-rose-100 text-rose-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expiring Soon ({stats.expiringSoonCount})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Items Table */}
      <div className="bg-white rounded-xl border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Medicine & Brand</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Batch & Expiry</th>
                <th className="px-3 py-3 text-right">In Stock</th>
                <th className="px-3 py-3 text-right">Selling Price</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Pill className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No medicine stock records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.quantityInStock <= item.minThreshold;
                  const isExpiring = item.expiryDate <= ninetyDaysFromNow;
                  const isExpired = item.expiryDate < todayStr;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.medicineName}</div>
                        {item.brandName && (
                          <div className="text-[11px] text-slate-500 font-medium">({item.brandName})</div>
                        )}
                        {item.supplierName && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{item.supplierName}</div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-mono text-[11px] text-slate-700 font-semibold">{item.batchNo}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`text-[10px] font-medium ${
                              isExpired
                                ? 'text-rose-700 font-bold'
                                : isExpiring
                                ? 'text-amber-700 font-semibold'
                                : 'text-slate-500'
                            }`}
                          >
                            Exp: {item.expiryDate}
                          </span>
                          {isExpired && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                              EXPIRED
                            </span>
                          )}
                          {!isExpired && isExpiring && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                              EXPIRING SOON
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <div
                          className={`text-sm font-black ${
                            item.quantityInStock === 0
                              ? 'text-rose-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {item.quantityInStock}
                        </div>
                        <div className="text-[10px] text-slate-400">Min: {item.minThreshold}</div>
                      </td>

                      <td className="px-3 py-3 text-right">
                        <div className="font-bold text-slate-900">₹{item.sellingPrice.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">Cost: ₹{item.purchaseCost.toFixed(2)}</div>
                      </td>

                      <td className="px-3 py-3">
                        {item.rackLocation ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {item.rackLocation}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDispense(item, 'DISPENSED')}
                            disabled={item.quantityInStock <= 0}
                            title="Dispense Medicine"
                            className="h-7 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 gap-1 px-2"
                          >
                            <MinusCircle className="w-3.5 h-3.5" /> Dispense
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDispense(item, 'INWARD')}
                            title="Add Inward Stock"
                            className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 gap-1 px-2"
                          >
                            <PlusCircle className="w-3.5 h-3.5" /> Inward
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" /> Inward New Medicine Stock
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {actionSuccess}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Medicine Name / Composition *</Label>
                  <Input
                    required
                    placeholder="e.g. Paracetamol 650mg, Amoxicillin-Clav 625mg"
                    value={newItem.medicineName}
                    onChange={(e) => setNewItem({ ...newItem, medicineName: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Brand / Trade Name</Label>
                  <Input
                    placeholder="e.g. Dolo 650, Augmentin"
                    value={newItem.brandName}
                    onChange={(e) => setNewItem({ ...newItem, brandName: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Category</Label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {categories
                      .filter((c) => c !== 'All')
                      .map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Batch Number *</Label>
                  <Input
                    required
                    placeholder="e.g. B-2026-09"
                    value={newItem.batchNo}
                    onChange={(e) => setNewItem({ ...newItem, batchNo: e.target.value })}
                    className="mt-1 text-xs font-mono uppercase"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Expiry Date (YYYY-MM-DD) *</Label>
                  <Input
                    required
                    type="date"
                    value={newItem.expiryDate}
                    onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Inward Quantity *</Label>
                  <Input
                    required
                    type="number"
                    min="1"
                    value={newItem.quantityInStock}
                    onChange={(e) => setNewItem({ ...newItem, quantityInStock: parseInt(e.target.value) || 0 })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Low Stock Threshold</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newItem.minThreshold}
                    onChange={(e) => setNewItem({ ...newItem, minThreshold: parseInt(e.target.value) || 20 })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Purchase Cost (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.purchaseCost}
                    onChange={(e) => setNewItem({ ...newItem, purchaseCost: parseFloat(e.target.value) || 0 })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Selling Price (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.sellingPrice}
                    onChange={(e) => setNewItem({ ...newItem, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Rack / Shelf Location</Label>
                  <Input
                    placeholder="e.g. Rack A-1, Cold Chain"
                    value={newItem.rackLocation}
                    onChange={(e) => setNewItem({ ...newItem, rackLocation: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Distributor / Supplier</Label>
                  <Input
                    placeholder="e.g. Apex Pharma"
                    value={newItem.supplierName}
                    onChange={(e) => setNewItem({ ...newItem, supplierName: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Confirm Inward Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense / Adjust Stock Modal */}
      {showDispenseModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {dispenseData.type === 'INWARD' ? 'Inward Stock' : 'Dispense / Adjust Stock'}
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {selectedItem.medicineName} ({selectedItem.batchNo})
                </p>
              </div>
              <button
                onClick={() => setShowDispenseModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between text-xs">
              <span className="text-slate-500">Current Available Stock:</span>
              <span className="text-sm font-black text-slate-900">{selectedItem.quantityInStock} units</span>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {actionSuccess}
              </div>
            )}

            <form onSubmit={handleDispenseSubmit} className="space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold">Transaction Type</Label>
                <select
                  value={dispenseData.type}
                  onChange={(e) =>
                    setDispenseData({
                      ...dispenseData,
                      type: e.target.value as 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED' | 'INWARD',
                    })
                  }
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="DISPENSED">Dispense to Patient / OPD Prescription</option>
                  <option value="INWARD">Additional Inward Stock (Restock)</option>
                  <option value="ADJUSTMENT">Inventory Audit Adjustment</option>
                  <option value="EXPIRED">Write-off Expired / Damaged Stock</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Quantity to Process</Label>
                <Input
                  required
                  type="number"
                  min="1"
                  max={dispenseData.type !== 'INWARD' ? selectedItem.quantityInStock : undefined}
                  value={dispenseData.quantity}
                  onChange={(e) =>
                    setDispenseData({ ...dispenseData, quantity: parseInt(e.target.value) || 1 })
                  }
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Clinical / Dispensing Remarks</Label>
                <Input
                  placeholder="e.g. Dispensed to OPD patient, or ward floor stock replenishment"
                  value={dispenseData.remarks}
                  onChange={(e) => setDispenseData({ ...dispenseData, remarks: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDispenseModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className={
                    dispenseData.type === 'INWARD'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }
                >
                  Confirm {dispenseData.type}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" /> Pharmacy Stock Ledger &amp; Audit Trail
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-slate-400">Loading audit transactions...</div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{tx.medicineName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tx.remarks || 'Standard transaction'}
                        {tx.patientName && ` • Patient: ${tx.patientName}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-IN') : ''}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'INWARD'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.type === 'DISPENSED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.type} {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
