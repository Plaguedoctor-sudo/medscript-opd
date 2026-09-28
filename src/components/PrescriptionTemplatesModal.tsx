'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Stethoscope,
  Pill,
  BookmarkCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { PrescriptionTemplate, Medication } from '@/types';
import {
  getPrescriptionTemplatesAction,
  createPrescriptionTemplateAction,
  deletePrescriptionTemplateAction,
} from '@/app/actions/template-actions';

interface PrescriptionTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMedications: Medication[];
  currentDiagnosis?: string;
  currentChiefComplaints?: string;
  currentAdvice?: string;
  currentLabTests?: string;
  onApplyTemplate: (template: PrescriptionTemplate) => void;
}

export function PrescriptionTemplatesModal({
  isOpen,
  onClose,
  currentMedications,
  currentDiagnosis = '',
  currentChiefComplaints = '',
  currentAdvice = '',
  currentLabTests = '',
  onApplyTemplate,
}: PrescriptionTemplatesModalProps) {
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'save'>('browse');

  // Save new template state
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newCategory, setNewCategory] = useState('General Medicine');
  const [newDescription, setNewDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const refreshTemplates = async () => {
    try {
      const data = await getPrescriptionTemplatesAction();
      setTemplates(data);
    } catch {
      toast.show({ title: 'Error', description: 'Failed to load templates.', type: 'error' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      let ignore = false;
      getPrescriptionTemplatesAction()
        .then((data) => {
          if (!ignore) {
            setTemplates(data);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (!ignore) {
            toast.show({ title: 'Error', description: 'Failed to load templates.', type: 'error' });
            setIsLoading(false);
          }
        });
      return () => {
        ignore = true;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) {
      toast.show({ title: 'Name Required', description: 'Please enter a name for this template.', type: 'error' });
      return;
    }

    if (currentMedications.length === 0) {
      toast.show({
        title: 'No Medications',
        description: 'Add at least one medication in the prescription desk before saving as a template.',
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await createPrescriptionTemplateAction({
        name: newTemplateName.trim(),
        category: newCategory,
        description: newDescription.trim() || undefined,
        chiefComplaints: currentChiefComplaints,
        diagnosis: currentDiagnosis,
        medications: currentMedications,
        advice: currentAdvice,
        labTests: currentLabTests,
      });

      if (res.success) {
        toast.show({
          title: 'Template Saved!',
          description: `"${newTemplateName}" is now available for 1-click prescribing.`,
          type: 'success',
        });
        setNewTemplateName('');
        setNewDescription('');
        setActiveTab('browse');
        void refreshTemplates();
      } else {
        toast.show({ title: 'Failed to Save', description: res.error, type: 'error' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      const res = await deletePrescriptionTemplateAction(id);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.show({ title: 'Template Deleted', description: name, type: 'info' });
      }
    } catch {
      toast.show({ title: 'Error', description: 'Could not delete template.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <BookmarkCheck className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Rx Sets & Clinical Protocols</h2>
              <p className="text-xs text-indigo-100">1-click prescription auto-population and saved clinical sets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b bg-slate-50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'browse'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Available Protocols ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'save'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" /> Save Current Rx as Protocol
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'browse' && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-slate-400 text-xs">Loading protocols...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No protocols created yet. Click &ldquo;Save Current Rx as Protocol&rdquo; to add your first preset!
                </div>
              ) : (
                templates.map((tmpl) => {
                  let medList: Medication[] = [];
                  try {
                    medList = JSON.parse(tmpl.medications || '[]');
                  } catch {
                    medList = [];
                  }

                  return (
                    <div
                      key={tmpl.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition-all bg-white space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{tmpl.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                              {tmpl.category}
                            </span>
                          </div>
                          {tmpl.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{tmpl.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => {
                              onApplyTemplate(tmpl);
                              toast.show({
                                title: 'Protocol Applied!',
                                description: `Loaded "${tmpl.name}" with ${medList.length} medications.`,
                                type: 'success',
                              });
                              onClose();
                            }}
                            className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Apply Protocol
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                            className="text-slate-400 hover:text-rose-600 h-8 w-8 p-0"
                            title="Delete template"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Meds Preview */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {medList.map((m, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                          >
                            <Pill className="w-3 h-3 text-blue-500" />
                            {m.prefix ? `${m.prefix} ` : ''}
                            {m.name} ({m.dosage})
                          </span>
                        ))}
                      </div>

                      {tmpl.advice && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 italic bg-slate-50 px-2 py-1 rounded">
                          💡 Advice: {tmpl.advice}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'save' && (
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                <Stethoscope className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  This will capture your current medications (<strong>{currentMedications.length} items</strong>
                  ), clinical diagnosis, patient advice, and lab test recommendations into a 1-click reusable
                  protocol.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">Protocol / Template Name *</Label>
                <Input
                  required
                  placeholder="e.g. Acute Bronchitis 5-Day Protocol"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800">Clinical Specialty / Category</Label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Endocrinology">Endocrinology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Gastroenterology">Gastroenterology</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Orthopedics">Orthopedics</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800">Brief Clinical Description</Label>
                  <Input
                    placeholder="e.g. For adults with non-productive cough"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Meds to be included */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800">
                  Included Medications ({currentMedications.length})
                </Label>
                {currentMedications.length === 0 ? (
                  <div className="p-3 text-center text-xs text-rose-600 bg-rose-50 rounded border border-rose-200">
                    No medications added in the prescription desk yet!
                  </div>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto border rounded-lg p-2 bg-slate-50">
                    {currentMedications.map((m, idx) => (
                      <div key={idx} className="text-xs text-slate-700 flex items-center justify-between">
                        <span>
                          <strong>{m.name}</strong> {m.strength ? `(${m.strength})` : ''} - {m.dosage} {m.timing}
                        </span>
                        <span className="text-slate-400 text-[11px]">{m.duration}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSaving || currentMedications.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5"
                >
                  {isSaving ? 'Saving Protocol...' : 'Save Reusable Protocol'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
