'use client';

import React, { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Printer,
  Trash2,
  Eye,
  RefreshCw,
  TrendingUp,
  DollarSign,
  User,
  Plus,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { BillingSummary, createInvoiceAction, updateInvoiceStatusAction, deleteInvoiceAction, searchPatientsForBilling } from './actions';
import { InvoiceItem, InvoiceWithPatient, Patient, InvoiceItemCategory } from '@/types';
import { formatDate } from '@/lib/utils';

const COMMON_OPD_SERVICES: { description: string; category: InvoiceItemCategory; unitPrice: number }[] = [
  { description: 'OPD Consultation Fee', category: 'Consultation', unitPrice: 300 },
  { description: 'Follow-up Consultation', category: 'Consultation', unitPrice: 150 },
  { description: 'Emergency / Triage Consultation', category: 'Consultation', unitPrice: 500 },
  { description: 'ECG (12-Lead)', category: 'Procedure', unitPrice: 300 },
  { description: 'Blood Glucose Test (RBS/FBS)', category: 'Lab Test', unitPrice: 60 },
  { description: 'Nebulization Session', category: 'Procedure', unitPrice: 120 },
  { description: 'Wound Dressing / Minor Procedure', category: 'Procedure', unitPrice: 250 },
  { description: 'Suture Removal / Dressing', category: 'Procedure', unitPrice: 150 },
  { description: 'Prescription Dispensation', category: 'Medication', unitPrice: 200 },
];

interface BillingDashboardProps {
  summary: BillingSummary;
  userRole: string;
  initialPatientId?: number | null;
  initialPrescriptionId?: number | null;
  initialPatientData?: Patient | null;
}

export function BillingDashboard({
  summary,
  userRole,
  initialPatientId,
  initialPrescriptionId,
  initialPatientData,
}: BillingDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'REFUNDED'>('ALL');

  // New Invoice Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(initialPatientId));
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatientData || null);
  const [patientSearchTerm, setPatientSearchTerm] = useState(
    initialPatientData ? `${initialPatientData.name} (${initialPatientData.regNo || ''})` : ''
  );
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const [prescriptionId, setPrescriptionId] = useState<number | null>(initialPrescriptionId || null);
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description: 'OPD Consultation Fee',
      category: 'Consultation',
      quantity: 1,
      unitPrice: 300,
      total: 300,
    },
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Due'>('Cash');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [notes, setNotes] = useState('');

  // Patient search handler
  const handleSearchPatient = async (term: string) => {
    setPatientSearchTerm(term);
    if (term.trim().length >= 1) {
      setIsSearchingPatient(true);
      const res = await searchPatientsForBilling(term);
      setPatientSearchResults(res);
      setIsSearchingPatient(false);
    } else {
      setPatientSearchResults([]);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearchTerm(`${patient.name} (${patient.regNo || 'No Reg'})`);
    setPatientSearchResults([]);
  };

  // Line item manipulation
  const handleAddItem = (preset?: { description: string; category: InvoiceItemCategory; unitPrice: number }) => {
    const newItem: InvoiceItem = preset
      ? {
          id: Math.random().toString(36).substring(7),
          description: preset.description,
          category: preset.category,
          quantity: 1,
          unitPrice: preset.unitPrice,
          total: preset.unitPrice,
        }
      : {
          id: Math.random().toString(36).substring(7),
          description: '',
          category: 'Procedure',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = Number(field === 'quantity' ? value : updated.quantity) || 0;
          const rate = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.total = Math.max(0, qty * rate);
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  // Computations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  }, [items]);

  const netTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0) + (Number(tax) || 0));
  }, [subtotal, discount, tax]);

  // Invoice creation submission
  const handleCreateInvoice = () => {
    if (!selectedPatient) {
      toast.error('Validation Error', 'Please select a patient.');
      return;
    }

    if (items.some((it) => !it.description.trim())) {
      toast.error('Validation Error', 'All invoice items must have a description.');
      return;
    }

    startTransition(async () => {
      const res = await createInvoiceAction({
        patientId: selectedPatient.id,
        prescriptionId: prescriptionId || null,
        items,
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
        paymentMethod,
        paymentStatus,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.invoiceId) {
        toast.success('Invoice Generated', 'Invoice successfully created!');
        setIsCreateOpen(false);
        router.push(`/billing/${res.invoiceId}`);
      } else {
        toast.error('Error', res.error || 'Failed to generate invoice');
      }
    });
  };

  // Status update
  const handleUpdateStatus = (invoiceId: number, newStatus: 'PAID' | 'PENDING' | 'REFUNDED') => {
    startTransition(async () => {
      const res = await updateInvoiceStatusAction(invoiceId, newStatus);
      if (res.success) {
        toast.success('Status Updated', `Invoice marked as ${newStatus}`);
        router.refresh();
      } else {
        toast.error('Error', res.error || 'Failed to update status');
      }
    });
  };

  // Deletion
  const handleDelete = (invoiceId: number, invoiceNo: string) => {
    if (!confirm(`Are you sure you want to delete Invoice ${invoiceNo}? This action is irreversible.`)) return;
    startTransition(async () => {
      const res = await deleteInvoiceAction(invoiceId);
      if (res.success) {
        toast.success('Deleted', `Invoice ${invoiceNo} removed.`);
        router.refresh();
      } else {
        toast.error('Error', res.error || 'Failed to delete invoice');
      }
    });
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return summary.invoices.filter((inv) => {
      const matchesStatus = statusFilter === 'ALL' || inv.paymentStatus === statusFilter;
      const cleanQ = searchQuery.toLowerCase().trim();
      if (!cleanQ) return matchesStatus;

      const matchesQ =
        inv.invoiceNo.toLowerCase().includes(cleanQ) ||
        inv.patient.name.toLowerCase().includes(cleanQ) ||
        (inv.patient.phone && inv.patient.phone.includes(cleanQ)) ||
        (inv.patient.regNo && inv.patient.regNo.toLowerCase().includes(cleanQ));

      return matchesStatus && matchesQ;
    });
  }, [summary.invoices, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            OPD Billing & Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Clinical billing, cash receipts, procedure fees, and payment tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => {
              setSelectedPatient(null);
              setPatientSearchTerm('');
              setPrescriptionId(null);
              setIsCreateOpen(true);
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            New OPD Bill / Receipt
          </Button>
        </div>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Total Billed
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold text-slate-900">
              ₹{summary.totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary.totalInvoicesCount} total invoices recorded
            </p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50 border-emerald-200/60 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
              Total Collected
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold text-emerald-800">
              ₹{summary.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">Paid & settled revenue</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50/50 border-amber-200/60 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center justify-between">
              Pending Dues
              <Clock className="w-4 h-4 text-amber-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold text-amber-800">
              ₹{summary.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-amber-600 mt-1">Unsettled patient balances</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-200/60 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-blue-700 uppercase tracking-wider flex items-center justify-between">
              Today's OPD Revenue
              <DollarSign className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-extrabold text-blue-800">
              ₹{summary.todayBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-blue-600 mt-1">Generated during today's clinic hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bill #, Patient, Phone, Reg #..."
            className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['ALL', 'PAID', 'PENDING', 'REFUNDED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'ALL' ? 'All Invoices' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Invoices & Receipts List</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {filteredInvoices.length}
              </span>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Receipt className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No invoices found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No billing records match your filter criteria. Create your first OPD bill using the button above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/60 hover:bg-slate-50/60">
                    <TableHead className="text-xs font-bold text-slate-700">Invoice #</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Date</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Patient Details</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Services & Items</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Total (₹)</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Payment</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                    <TableHead className="text-xs font-bold text-slate-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    let parsedItems: InvoiceItem[] = [];
                    try {
                      parsedItems = JSON.parse(inv.items || '[]');
                    } catch {
                      parsedItems = [];
                    }

                    return (
                      <TableRow key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                          <Link
                            href={`/billing/${inv.id}`}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            {inv.invoiceNo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDate(inv.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-semibold text-slate-900">{inv.patient.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {inv.patient.regNo || `ID: ${inv.patient.id}`} • {inv.patient.age}y/{inv.patient.gender}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate text-slate-700">
                          {parsedItems.map((it) => it.description).join(', ') || 'Consultation'}
                          {parsedItems.length > 1 && (
                            <span className="text-[10px] ml-1 text-slate-400 font-medium">
                              ({parsedItems.length} items)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-900 whitespace-nowrap">
                          ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            {inv.paymentMethod}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              inv.paymentStatus === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inv.paymentStatus === 'PENDING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {inv.paymentStatus === 'PAID' && <CheckCircle2 className="w-3 h-3" />}
                            {inv.paymentStatus === 'PENDING' && <Clock className="w-3 h-3" />}
                            {inv.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/billing/${inv.id}`}>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-slate-700">
                                <Printer className="w-3.5 h-3.5" /> Print
                              </Button>
                            </Link>

                            {inv.paymentStatus === 'PENDING' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateStatus(inv.id, 'PAID')}
                                className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              >
                                Mark Paid
                              </Button>
                            )}

                            {userRole === 'doctor' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                                className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Invoice Modal Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Generate OPD Bill / Receipt</h2>
                  <p className="text-xs text-slate-400">Itemized billing for consultation, procedures, & medications</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Patient Selection Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Select Patient <span className="text-rose-500">*</span>
                </label>

                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-bold text-sm text-slate-900">{selectedPatient.name}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">
                        {selectedPatient.regNo || `ID #${selectedPatient.id}`} • {selectedPatient.age}y/{selectedPatient.gender}
                        {selectedPatient.phone ? ` • ${selectedPatient.phone}` : ''}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientSearchTerm('');
                      }}
                      className="h-7 text-xs text-slate-500 hover:text-rose-600"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      value={patientSearchTerm}
                      onChange={(e) => handleSearchPatient(e.target.value)}
                      placeholder="Type patient name, phone number, or Reg #..."
                      className="bg-white text-xs h-9"
                    />
                    {isSearchingPatient && (
                      <div className="absolute right-3 top-2.5 text-xs text-slate-400 animate-spin">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                    )}
                    {patientSearchResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patientSearchResults.map((pat) => (
                          <button
                            key={pat.id}
                            type="button"
                            onClick={() => handleSelectPatient(pat)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 flex items-center justify-between border-b last:border-b-0"
                          >
                            <span className="font-bold text-slate-800">{pat.name}</span>
                            <span className="text-slate-500 font-mono">
                              {pat.regNo || `ID #${pat.id}`} • {pat.phone || 'No phone'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Add Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Add Common OPD Services:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_OPD_SERVICES.map((srv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddItem(srv)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 transition-colors"
                    >
                      + {srv.description} (₹{srv.unitPrice})
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Billing Line Items</span>
                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="text-emerald-700 hover:text-emerald-800 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Custom Item
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  {items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Input
                          value={item.description}
                          onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                          placeholder="Service / Medication / Procedure..."
                          className="h-8 text-xs bg-white"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                          className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2"
                        >
                          <option value="Consultation">Consultation</option>
                          <option value="Procedure">Procedure</option>
                          <option value="Medication">Medication</option>
                          <option value="Lab Test">Lab Test</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="h-8 text-xs bg-white text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                          placeholder="Rate ₹"
                          className="h-8 text-xs bg-white text-right font-mono"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={items.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calculations Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Method</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['Cash', 'UPI', 'Card', 'Due'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method);
                            if (method === 'Due') setPaymentStatus('PENDING');
                            else setPaymentStatus('PAID');
                          }}
                          className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            paymentMethod === method
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Status</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('PAID')}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          paymentStatus === 'PAID'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ✓ PAID (Settled)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('PENDING')}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          paymentStatus === 'PENDING'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ⏳ PENDING (Due)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Notes / Remarks</label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Received via GPay, Follow-up in 5 days..."
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                {/* Subtotals & Grand Total */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Discount (₹):</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                        className="h-7 text-xs bg-white text-right font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tax / GST (₹):</span>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        value={tax}
                        onChange={(e) => setTax(Number(e.target.value) || 0)}
                        className="h-7 text-xs bg-white text-right font-mono"
                      />
                    </div>
                  </div>
                  <div className="border-t border-slate-300 pt-2 flex items-center justify-between font-bold text-sm text-slate-900">
                    <span>Total Payable:</span>
                    <span className="font-mono text-emerald-700 text-base">₹{netTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} disabled={isPending}>
                Cancel
              </Button>

              <Button
                onClick={handleCreateInvoice}
                disabled={isPending || !selectedPatient}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isPending ? 'Generating...' : 'Save & Print Invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
