'use client';

import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { importPatientsFromCsvAction, ImportResult } from '@/app/patients/actions';

interface BulkPatientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const SAMPLE_CSV = `Name,Age,Gender,Phone,Allergies,BloodGroup,ABHA
Ramesh Kumar,45,Male,9876543210,Penicillin,B+,14-1234-5678-9012
Sunita Sharma,38,Female,9823456789,None,O+,sunita@abdm
Amitabh Verma,62,Male,9811223344,Sulfa drugs,A+,14-9988-7766-5544
Priya Patel,29,Female,9899001122,NSAIDs,AB+,priya@abdm`;

export function BulkPatientImportModal({ isOpen, onClose, onImportComplete }: BulkPatientImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText((event.target?.result as string) || '');
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medscript_patient_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast.show({ title: 'No CSV Content', description: 'Please select a file or paste CSV text.', type: 'error' });
      return;
    }

    setIsImporting(true);
    try {
      const res = await importPatientsFromCsvAction(csvText);
      setResult(res);
      if (res.success && res.importedCount > 0) {
        toast.show({
          title: 'Import Successful',
          description: `Imported ${res.importedCount} patients (${res.skippedCount} skipped).`,
          type: 'success',
        });
        if (onImportComplete) onImportComplete();
      } else {
        toast.show({
          title: 'Import Finished with Warnings',
          description: `Imported ${res.importedCount}, skipped ${res.skippedCount}.`,
          type: 'warning',
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Bulk Import Patient Records</h2>
              <p className="text-xs text-blue-100">Import existing patient demographic registers from CSV or Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {result ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-sm text-slate-900">Import Processing Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="text-2xl font-black text-emerald-700">{result.importedCount}</div>
                    <div className="text-xs font-semibold text-emerald-800">Patients Added</div>
                  </div>
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
                    <div className="text-2xl font-black text-slate-700">{result.skippedCount}</div>
                    <div className="text-xs font-semibold text-slate-600">Skipped / Invalid</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-rose-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Issues Encountered:
                    </div>
                    <div className="max-h-32 overflow-y-auto text-xs bg-rose-50 border border-rose-200 rounded p-2 text-rose-800 space-y-1">
                      {result.errors.map((err, idx) => (
                        <div key={idx}>{err}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Done & View Patients
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div>
                  <div className="text-xs font-bold text-blue-900">Need the correct column format?</div>
                  <div className="text-[11px] text-blue-700">Columns: Name, Age, Gender, Phone, Allergies, BloodGroup, ABHA</div>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleDownloadSample}
                  className="gap-1.5 text-xs border-blue-300 text-blue-800 hover:bg-blue-100 bg-white"
                >
                  <Download className="w-3.5 h-3.5" /> Sample CSV
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
                />
                {fileName && <div className="text-[11px] text-slate-500 font-mono">Selected: {fileName}</div>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Or Paste Raw CSV Data</label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`Name,Age,Gender,Phone\nJohn Doe,42,Male,9876543210`}
                  className="w-full text-xs font-mono p-3 border border-slate-300 rounded-lg bg-white focus:outline-blue-500"
                />
              </div>

              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !csvText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 shadow-xs"
              >
                {isImporting ? 'Importing Patients...' : 'Start Bulk Import'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
