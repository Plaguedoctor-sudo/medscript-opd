'use client';

import React, { useState, useTransition } from 'react';
import {
  Wrench,
  Package,
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  Truck,
  ShoppingCart,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  HospitalAssetItem,
  HospitalAssetCategory,
  AssetMaintenanceStatus,
  HospitalServiceLog,
  HospitalProcurementOrder,
  HospitalDepartmentDispatch,
  ProcurementOrderItem,
} from '@/types';
import {
  addOrUpdateHospitalAsset,
  logAssetServiceMaintenance,
  createProcurementOrder,
  receiveProcurementOrder,
  dispatchToDepartment,
  ManagerDashboardStats,
} from '@/app/manager/actions';

interface HospitalManagerPortalProps {
  initialAssets: HospitalAssetItem[];
  initialServiceLogs: HospitalServiceLog[];
  initialOrders: HospitalProcurementOrder[];
  initialDispatches: HospitalDepartmentDispatch[];
  stats: ManagerDashboardStats;
  currentUserRole: string;
  currentUserName?: string;
}

export function HospitalManagerPortal({
  initialAssets,
  initialServiceLogs,
  initialOrders,
  initialDispatches,
  stats: initialStats,
  currentUserRole,
  currentUserName,
}: HospitalManagerPortalProps) {
  const [activeTab, setActiveTab] = useState<'instruments' | 'consumables' | 'servicing' | 'procurement' | 'dispatch'>('instruments');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low_stock' | 'maintenance_due'>('all');

  // Asset creation / editing modal
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<HospitalAssetItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<HospitalAssetCategory>('SURGICAL_INSTRUMENT');
  const [formSpecification, setFormSpecification] = useState('');
  const [formQty, setFormQty] = useState(1);
  const [formUnit, setFormUnit] = useState('sets');
  const [formThreshold, setFormThreshold] = useState(2);
  const [formLocation, setFormLocation] = useState('');
  const [formCost, setFormCost] = useState(0);
  const [formSupplier, setFormSupplier] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formVendorPhone, setFormVendorPhone] = useState('');
  const [formMaintenanceStatus, setFormMaintenanceStatus] = useState<AssetMaintenanceStatus>('OPERATIONAL');
  const [formLastService, setFormLastService] = useState('');
  const [formNextDue, setFormNextDue] = useState('');

  // Service Maintenance modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedAssetForService, setSelectedAssetForService] = useState<HospitalAssetItem | null>(null);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<'PREVENTIVE' | 'BREAKDOWN' | 'CALIBRATION' | 'AMC_VISIT' | 'SHARPENING'>('PREVENTIVE');
  const [technicianName, setTechnicianName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [serviceCost, setServiceCost] = useState(0);
  const [workDescription, setWorkDescription] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');

  // Procurement order modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderVendor, setOrderVendor] = useState('');
  const [orderCategory, setOrderCategory] = useState<HospitalAssetCategory>('CLEANING_AGENT');
  const [orderExpectedDate, setOrderExpectedDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<ProcurementOrderItem[]>([
    { name: '', category: 'CLEANING_AGENT', quantity: 10, unit: 'units', unitPrice: 100, total: 1000 },
  ]);

  // Department dispatch modal
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedAssetForDispatch, setSelectedAssetForDispatch] = useState<HospitalAssetItem | null>(null);
  const [dispatchQty, setDispatchQty] = useState(1);
  const [dispatchDept, setDispatchDept] = useState('OPERATION_THEATRE');
  const [dispatchRecipient, setDispatchRecipient] = useState('');
  const [dispatchRemarks, setDispatchRemarks] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filtered assets
  const filteredAssets = initialAssets.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      a.name.toLowerCase().includes(q) ||
      (a.specification && a.specification.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (activeTab === 'instruments') {
      if (a.category !== 'SURGICAL_INSTRUMENT') return false;
    } else if (activeTab === 'consumables') {
      if (a.category === 'SURGICAL_INSTRUMENT') return false;
    }

    if (filterMode === 'low_stock') {
      return a.quantityInStock <= a.minThreshold;
    }
    if (filterMode === 'maintenance_due') {
      return a.maintenanceStatus === 'CALIBRATION_DUE' || a.maintenanceStatus === 'UNDER_MAINTENANCE';
    }

    return true;
  });

  const handleOpenAddAsset = (defaultCategory?: HospitalAssetCategory) => {
    setEditingAsset(null);
    setFormName('');
    setFormCategory(defaultCategory || (activeTab === 'instruments' ? 'SURGICAL_INSTRUMENT' : 'CLEANING_AGENT'));
    setFormSpecification('');
    setFormQty(10);
    setFormUnit(defaultCategory === 'SURGICAL_INSTRUMENT' ? 'sets' : 'units');
    setFormThreshold(defaultCategory === 'SURGICAL_INSTRUMENT' ? 2 : 5);
    setFormLocation('');
    setFormCost(0);
    setFormSupplier('');
    setFormVendor('');
    setFormVendorPhone('');
    setFormMaintenanceStatus(defaultCategory === 'SURGICAL_INSTRUMENT' ? 'OPERATIONAL' : 'NOT_APPLICABLE');
    setFormLastService('');
    setFormNextDue('');
    setIsAssetModalOpen(true);
  };

  const handleOpenEditAsset = (asset: HospitalAssetItem) => {
    setEditingAsset(asset);
    setFormName(asset.name);
    setFormCategory(asset.category);
    setFormSpecification(asset.specification || '');
    setFormQty(asset.quantityInStock);
    setFormUnit(asset.unit);
    setFormThreshold(asset.minThreshold);
    setFormLocation(asset.location || '');
    setFormCost(asset.purchaseCost);
    setFormSupplier(asset.supplierName || '');
    setFormVendor(asset.serviceVendor || '');
    setFormVendorPhone(asset.serviceVendorPhone || '');
    setFormMaintenanceStatus(asset.maintenanceStatus);
    setFormLastService(asset.lastServiceDate || '');
    setFormNextDue(asset.nextServiceDue || '');
    setIsAssetModalOpen(true);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFeedback({ type: 'error', message: 'Item name is required.' });
      return;
    }

    startTransition(async () => {
      const res = await addOrUpdateHospitalAsset({
        id: editingAsset?.id,
        name: formName,
        category: formCategory,
        specification: formSpecification,
        quantityInStock: formQty,
        unit: formUnit,
        minThreshold: formThreshold,
        location: formLocation,
        purchaseCost: formCost,
        supplierName: formSupplier,
        maintenanceStatus: formMaintenanceStatus,
        lastServiceDate: formLastService,
        nextServiceDue: formNextDue,
        serviceVendor: formVendor,
        serviceVendorPhone: formVendorPhone,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: editingAsset ? 'Asset updated successfully!' : 'New asset registered successfully!',
        });
        setIsAssetModalOpen(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save asset.' });
      }
    });
  };

  const handleOpenLogService = (asset: HospitalAssetItem) => {
    setSelectedAssetForService(asset);
    setVendorName(asset.serviceVendor || '');
    setWorkDescription('');
    setPartsReplaced('');
    setServiceCost(0);
    // Suggest next due date 90 days from now
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 90);
    setNextDueDate(nextDate.toISOString().split('T')[0]);
    setIsServiceModalOpen(true);
  };

  const handleSaveServiceLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForService) return;

    startTransition(async () => {
      const res = await logAssetServiceMaintenance({
        assetId: selectedAssetForService.id,
        serviceDate,
        serviceType,
        technicianName,
        vendorName,
        cost: serviceCost,
        workDescription,
        partsReplaced,
        nextDueDate,
        newAssetStatus: 'OPERATIONAL',
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Biomedical service log #${res.logId} recorded! Asset marked OPERATIONAL.`,
        });
        setIsServiceModalOpen(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to record service log.' });
      }
    });
  };

  const handleOpenDispatch = (asset: HospitalAssetItem) => {
    setSelectedAssetForDispatch(asset);
    setDispatchQty(1);
    setDispatchRecipient('');
    setDispatchRemarks('');
    setIsDispatchModalOpen(true);
  };

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForDispatch) return;

    startTransition(async () => {
      const res = await dispatchToDepartment({
        assetId: selectedAssetForDispatch.id,
        quantity: dispatchQty,
        targetDepartment: dispatchDept,
        recipientStaff: dispatchRecipient,
        remarks: dispatchRemarks,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Stock successfully dispatched to ${dispatchDept} (Receipt #${res.dispatchNo})`,
        });
        setIsDispatchModalOpen(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to dispatch stock.' });
      }
    });
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createProcurementOrder({
        vendorName: orderVendor,
        category: orderCategory,
        items: orderItems,
        expectedDeliveryDate: orderExpectedDate,
        notes: orderNotes,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Purchase Order ${res.orderNo} created successfully!`,
        });
        setIsOrderModalOpen(false);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to create purchase order.' });
      }
    });
  };

  const handleReceiveOrder = (orderId: number) => {
    startTransition(async () => {
      const res = await receiveProcurementOrder(orderId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Purchase order received and stock quantities auto-incremented into inventory!',
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to receive order.' });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Hospital Facility & Materials Management
              </span>
              <span className="text-xs text-slate-400">Offline Sovereign Store</span>
              {currentUserName && (
                <span className="text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  User: {currentUserName} ({currentUserRole})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2.5">
              <Wrench className="w-6 h-6 text-blue-400" />
              Hospital Materials, Assets & Operations Portal
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Maintain surgical instrument sets, daily cleaning agents, toiletries, bedsheets, biomedical equipment servicing schedules, purchase orders, and internal department stock dispatches.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              size="sm"
              onClick={() => handleOpenAddAsset()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add New Asset / Item
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOrderModalOpen(true)}
              className="gap-1.5 bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-blue-400" /> Create Purchase Order
            </Button>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Items</div>
            <div className="text-xl font-mono font-black text-white mt-0.5">{initialStats.totalAssets}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Surgical Sets</div>
            <div className="text-xl font-mono font-black text-cyan-400 mt-0.5">{initialStats.surgicalInstrumentsCount}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Cleaning Stock</div>
            <div className="text-xl font-mono font-black text-emerald-400 mt-0.5">{initialStats.cleaningAgentsCount}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Linen & Bedsheets</div>
            <div className="text-xl font-mono font-black text-purple-400 mt-0.5">{initialStats.linenBedsheetsCount}</div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Low Stock Alert</div>
            <div className={`text-xl font-mono font-black mt-0.5 ${initialStats.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {initialStats.lowStockCount}
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
            <div className="text-[10px] font-bold uppercase text-slate-400">Service Due</div>
            <div className={`text-xl font-mono font-black mt-0.5 ${initialStats.maintenanceAlertsCount > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {initialStats.maintenanceAlertsCount}
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('instruments')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'instruments'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" /> Surgical & Medical Instruments
          </button>

          <button
            onClick={() => setActiveTab('consumables')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'consumables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Cleaning, Toiletries & Linen
          </button>

          <button
            onClick={() => setActiveTab('servicing')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'servicing'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" /> Maintenance & Servicing
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
              {initialServiceLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'procurement'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Purchase Orders
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 font-mono">
              {initialOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'dispatch'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Truck className="w-3.5 h-3.5" /> Department Dispatches
          </button>
        </div>

        {(activeTab === 'instruments' || activeTab === 'consumables') && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items, location..."
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-700 font-semibold"
            >
              <option value="all">All Items</option>
              <option value="low_stock">Low Stock Only</option>
              <option value="maintenance_due">Service Due</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1 & 2: Assets & Consumables Grid */}
      {(activeTab === 'instruments' || activeTab === 'consumables') && (
        <div className="space-y-4">
          {filteredAssets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Items Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No items match your filter criteria. Use &ldquo;Add New Asset&rdquo; above to register stock.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isLow = asset.quantityInStock <= asset.minThreshold;
                const isServiceDue =
                  asset.maintenanceStatus === 'CALIBRATION_DUE' ||
                  asset.maintenanceStatus === 'UNDER_MAINTENANCE';

                return (
                  <Card
                    key={asset.id}
                    className={`border shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between ${
                      isServiceDue
                        ? 'border-red-300 bg-red-50/20'
                        : isLow
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200'
                    }`}
                  >
                    <CardHeader className="p-4 pb-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                              {asset.category.replace(/_/g, ' ')}
                            </span>
                            {asset.category === 'SURGICAL_INSTRUMENT' && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  asset.maintenanceStatus === 'OPERATIONAL'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                                }`}
                              >
                                {asset.maintenanceStatus}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">{asset.name}</h3>
                          {asset.specification && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{asset.specification}</p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xl font-mono font-black text-slate-900">
                            {asset.quantityInStock}{' '}
                            <span className="text-xs font-normal text-slate-500">{asset.unit}</span>
                          </div>
                          {isLow && (
                            <span className="text-[10px] font-bold text-amber-600 flex items-center justify-end gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs space-y-1">
                        {asset.location && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400">Location:</span>
                            <span className="font-semibold text-slate-700">{asset.location}</span>
                          </div>
                        )}
                        {asset.purchaseCost > 0 && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400">Unit Cost:</span>
                            <span className="font-mono font-semibold text-slate-800">₹{asset.purchaseCost}</span>
                          </div>
                        )}
                        {asset.category === 'SURGICAL_INSTRUMENT' && asset.nextServiceDue && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400">Next Service:</span>
                            <span className="font-mono font-semibold text-indigo-700">{asset.nextServiceDue}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDispatch(asset)}
                          className="flex-1 h-7 text-xs text-purple-700 border-purple-200 hover:bg-purple-50 gap-1"
                        >
                          <Truck className="w-3 h-3" /> Dispatch
                        </Button>

                        {asset.category === 'SURGICAL_INSTRUMENT' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLogService(asset)}
                            className="flex-1 h-7 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 gap-1"
                          >
                            <Wrench className="w-3 h-3" /> Service Log
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEditAsset(asset)}
                          className="h-7 text-xs text-slate-600"
                        >
                          Edit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Instrument Servicing & Maintenance Logs */}
      {activeTab === 'servicing' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" /> Biomedical & Surgical Instrument Service Logs
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Track calibration records, sharpening, preventive maintenance, and AMC technician visits.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {initialServiceLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No service maintenance logs recorded yet.</div>
              ) : (
                initialServiceLogs.map((log) => (
                  <div key={log.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.assetName || `Asset #${log.assetId}`}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {log.serviceType}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Date: {log.serviceDate}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-1 font-medium">{log.workDescription}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {log.vendorName && `Vendor: ${log.vendorName}`}
                        {log.technicianName && ` • Eng: ${log.technicianName}`}
                        {log.partsReplaced && ` • Parts: ${log.partsReplaced}`}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {log.cost > 0 && <div className="text-xs font-mono font-bold text-slate-900">₹{log.cost}</div>}
                      {log.nextDueDate && (
                        <div className="text-[10px] text-indigo-600 font-medium mt-0.5">
                          Next Due: {log.nextDueDate}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">Logged by {log.loggedBy}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Procurement & Purchase Orders */}
      {activeTab === 'procurement' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" /> Hospital Procurement & Purchase Orders
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Create purchase requisitions. Marking an order RECEIVED automatically increments inventory stock.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsOrderModalOpen(true)}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
            >
              <PlusCircle className="w-3.5 h-3.5" /> New Purchase Order
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {initialOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No purchase orders created yet.</div>
              ) : (
                initialOrders.map((order) => {
                  const isReceived = order.status === 'RECEIVED';
                  return (
                    <div key={order.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {order.orderNo}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isReceived
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-slate-500 text-xs font-bold">Vendor: {order.vendorName}</span>
                        </div>

                        <div className="text-slate-700 mt-1">
                          Items: <span className="font-semibold">{order.items.map((it) => `${it.name} (${it.quantity} ${it.unit})`).join(', ')}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Order Date: {order.orderDate} • Total Amount: <span className="font-bold text-slate-800">₹{order.totalAmount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isReceived ? (
                          <Button
                            size="sm"
                            onClick={() => handleReceiveOrder(order.id)}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Received (Inward Stock)
                          </Button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Inwarded to Stock
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: Department Dispatches */}
      {activeTab === 'dispatch' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-purple-600" /> Department Stock Dispatch History
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Audit trail of cleaning agents, toiletries, bedsheets, and surgical sets handed over to hospital wards.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 text-xs">
              {initialDispatches.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No department dispatches recorded yet.</div>
              ) : (
                initialDispatches.map((disp) => (
                  <div key={disp.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {disp.dispatchNo}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          To: {disp.targetDepartment.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-400 text-[10px]">Date: {disp.dispatchDate}</span>
                      </div>
                      <div className="text-slate-900 font-bold text-sm mt-1">
                        {disp.quantity} {disp.unit} of {disp.assetName}
                      </div>
                      {disp.remarks && <div className="text-[11px] text-slate-500 italic mt-0.5">Remarks: {disp.remarks}</div>}
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-800">Received By: {disp.recipientStaff}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Dispatched by: {disp.dispatchedBy}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: Add / Edit Hospital Asset */}
      <Dialog open={isAssetModalOpen} onOpenChange={setIsAssetModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveAsset}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                {editingAsset ? 'Edit Hospital Asset / Stock' : 'Register New Hospital Asset'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Register surgical instruments, cleaning supplies, toiletries, or hospital linen.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Item / Instrument Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Major Laparotomy Instrument Set, Sodium Hypochlorite 5%"
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Category *</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="SURGICAL_INSTRUMENT">Surgical / Medical Instrument</option>
                    <option value="CLEANING_AGENT">Cleaning Agent / Disinfectant</option>
                    <option value="TOILETRIES">Toiletries / Soap / Sanitizer</option>
                    <option value="LINEN_BEDSHEET">Linen & Hospital Bedsheet</option>
                    <option value="GENERAL_CONSUMABLE">General Consumable</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Unit of Measure *</Label>
                  <Input
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="sets, pieces, bottles, liters"
                    required
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Specification / Details</Label>
                <Input
                  value={formSpecification}
                  onChange={(e) => setFormSpecification(e.target.value)}
                  placeholder="e.g. Grade 316 Stainless Steel 28pcs; White cotton 60x90; 5L Jar"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Stock Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formQty}
                    onChange={(e) => setFormQty(parseInt(e.target.value, 10) || 0)}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Min Threshold</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(parseInt(e.target.value, 10) || 2)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Unit Cost (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formCost}
                    onChange={(e) => setFormCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Storage Location</Label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. OT Sterile Room, Central Store"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Supplier / Vendor</Label>
                  <Input
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="e.g. Apollo Surgico, CleanSafe Ltd"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {formCategory === 'SURGICAL_INSTRUMENT' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-blue-600" /> Biomedical Maintenance & Servicing
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Maintenance Status</Label>
                      <select
                        value={formMaintenanceStatus}
                        onChange={(e) => setFormMaintenanceStatus(e.target.value as any)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                      >
                        <option value="OPERATIONAL">Operational</option>
                        <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                        <option value="CALIBRATION_DUE">Calibration Due</option>
                        <option value="OUT_OF_SERVICE">Out of Service</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Next Service Due</Label>
                      <Input
                        type="date"
                        value={formNextDue}
                        onChange={(e) => setFormNextDue(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">AMC Service Vendor</Label>
                      <Input
                        value={formVendor}
                        onChange={(e) => setFormVendor(e.target.value)}
                        placeholder="e.g. Apex Biomedical Services"
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Vendor Contact Phone</Label>
                      <Input
                        value={formVendorPhone}
                        onChange={(e) => setFormVendorPhone(e.target.value)}
                        placeholder="+91 98220 11223"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAssetModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {isPending ? 'Saving...' : 'Save Asset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Log Instrument Maintenance */}
      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveServiceLog}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" /> Log Maintenance / Calibration Service
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Recording servicing updates the instrument&apos;s calibration history and resets maintenance alerts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-bold text-amber-900">
                Instrument: {selectedAssetForService?.name}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Service Date *</Label>
                  <Input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Service Type *</Label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="PREVENTIVE">Preventive Maintenance</option>
                    <option value="CALIBRATION">Calibration</option>
                    <option value="AMC_VISIT">AMC Scheduled Visit</option>
                    <option value="SHARPENING">Surgical Sharpening</option>
                    <option value="BREAKDOWN">Breakdown Repair</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Work Carried Out *</Label>
                <Input
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  placeholder="e.g. Steam chamber descaling, pressure gasket replaced, safety valve test"
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Technician Name</Label>
                  <Input
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    placeholder="e.g. Er. Sunil Joshi"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Service Cost (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={serviceCost}
                    onChange={(e) => setServiceCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vendor / Service Centre</Label>
                  <Input
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Apex Biomedical Services"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Next Service Due Date</Label>
                  <Input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsServiceModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                {isPending ? 'Logging...' : 'Record Service'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Department Stock Dispatch */}
      <Dialog open={isDispatchModalOpen} onOpenChange={setIsDispatchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleConfirmDispatch}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-600" /> Dispatch Supplies to Department
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dispatches inventory stock and logs recipient staff sign-off.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                <div className="font-bold text-purple-900">{selectedAssetForDispatch?.name}</div>
                <div className="text-[11px] text-purple-700">
                  Available in Store: {selectedAssetForDispatch?.quantityInStock} {selectedAssetForDispatch?.unit}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Target Department *</Label>
                  <select
                    value={dispatchDept}
                    onChange={(e) => setDispatchDept(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="OPERATION_THEATRE">Operation Theatre (OT)</option>
                    <option value="ICU">Intensive Care Unit (ICU)</option>
                    <option value="IPD_WARD">Inpatient Wards (IPD)</option>
                    <option value="OPD">Outpatient Clinic (OPD)</option>
                    <option value="EMERGENCY">Casualty / Emergency</option>
                    <option value="LAB">Pathology Lab</option>
                    <option value="DIALYSIS">Dialysis Unit</option>
                    <option value="GENERAL">General Hospital</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Quantity to Dispatch *</Label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedAssetForDispatch?.quantityInStock || 100}
                    value={dispatchQty}
                    onChange={(e) => setDispatchQty(parseInt(e.target.value, 10) || 1)}
                    required
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Recipient Staff Name (Sign-off) *</Label>
                <Input
                  value={dispatchRecipient}
                  onChange={(e) => setDispatchRecipient(e.target.value)}
                  placeholder="e.g. Sister Kavita (OT In-charge), Rajesh (Ward A)"
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Remarks (Optional)</Label>
                <Input
                  value={dispatchRemarks}
                  onChange={(e) => setDispatchRemarks(e.target.value)}
                  placeholder="e.g. For Morning OT schedule / Weekly linen change"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsDispatchModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isPending} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                {isPending ? 'Dispatching...' : 'Confirm Dispatch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Create Purchase Order */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveOrder}>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" /> Create Hospital Purchase Requisition
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Log procurement of hospital needed things (cleaning supplies, toiletries, linen, surgical instruments).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Vendor / Supplier *</Label>
                  <Input
                    value={orderVendor}
                    onChange={(e) => setOrderVendor(e.target.value)}
                    placeholder="e.g. CleanSafe Chemicals Ltd"
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Requisition Category *</Label>
                  <select
                    value={orderCategory}
                    onChange={(e) => setOrderCategory(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="CLEANING_AGENT">Cleaning Agent / Disinfectants</option>
                    <option value="TOILETRIES">Toiletries & Sanitation</option>
                    <option value="LINEN_BEDSHEET">Hospital Linen & Bedsheets</option>
                    <option value="SURGICAL_INSTRUMENT">Surgical & Medical Instruments</option>
                    <option value="GENERAL_CONSUMABLE">General Consumables</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Order Items:</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setOrderItems([
                        ...orderItems,
                        { name: '', category: orderCategory, quantity: 10, unit: 'units', unitPrice: 100, total: 1000 },
                      ])
                    }
                    className="h-6 text-[11px] text-blue-600"
                  >
                    + Add Item
                  </Button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 grid grid-cols-12 gap-2 items-center bg-slate-50/50">
                      <div className="col-span-5">
                        <Input
                          value={item.name}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].name = e.target.value;
                            setOrderItems(updated);
                          }}
                          placeholder="Item name"
                          required
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].quantity = parseInt(e.target.value, 10) || 1;
                            updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
                            setOrderItems(updated);
                          }}
                          placeholder="Qty"
                          className="h-7 text-xs font-mono font-bold bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].unit = e.target.value;
                            setOrderItems(updated);
                          }}
                          placeholder="Unit"
                          className="h-7 text-xs bg-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => {
                            const updated = [...orderItems];
                            updated[idx].unitPrice = parseFloat(e.target.value) || 0;
                            updated[idx].total = updated[idx].quantity * updated[idx].unitPrice;
                            setOrderItems(updated);
                          }}
                          placeholder="Price"
                          className="h-7 text-xs font-mono bg-white"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Expected Delivery Date</Label>
                  <Input
                    type="date"
                    value={orderExpectedDate}
                    onChange={(e) => setOrderExpectedDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Notes / Payment Terms</Label>
                  <Input
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="e.g. 30 days credit / Immediate delivery"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsOrderModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {isPending ? 'Creating...' : 'Submit Purchase Order'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
