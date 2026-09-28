'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Image as ImageIcon,
  FileCheck,
  Trash2,
  Eye,
  Plus,
  X,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { PatientDocument, PatientDocumentType } from '@/types';
import {
  getPatientDocumentsAction,
  uploadPatientDocumentAction,
  deletePatientDocumentAction,
} from '@/app/actions/document-actions';

interface PatientDocumentsSectionProps {
  patientId: number;
  userRole?: string;
}

export function PatientDocumentsSection({ patientId, userRole = 'doctor' }: PatientDocumentsSectionProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);

  // Upload Form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<PatientDocumentType>('LAB_REPORT');
  const [notes, setNotes] = useState('');
  const [fileData, setFileData] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [mimeType, setMimeType] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const refreshDocuments = async () => {
    try {
      const docs = await getPatientDocumentsAction(patientId);
      setDocuments(docs);
    } catch {
      toast.show({ title: 'Error', description: 'Failed to load documents.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    getPatientDocumentsAction(patientId)
      .then((docs) => {
        if (!ignore) {
          setDocuments(docs);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          toast.show({ title: 'Error', description: 'Failed to load documents.', type: 'error' });
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [patientId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.show({
        title: 'File Too Large',
        description: 'Maximum file upload size is 10 MB.',
        type: 'error',
      });
      return;
    }

    setFileName(file.name);
    setFileSizeKb(Math.round(file.size / 1024));
    setMimeType(file.type);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileData) {
      toast.show({ title: 'Missing Info', description: 'Please provide a title and select a file.', type: 'error' });
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadPatientDocumentAction({
        patientId,
        title: title.trim(),
        documentType: docType,
        fileData,
        fileName,
        fileSizeKb,
        mimeType,
        notes,
      });

      if (res.success) {
        toast.show({
          title: 'Document Saved',
          description: `"${title}" successfully attached to patient record.`,
          type: 'success',
        });
        setTitle('');
        setFileData('');
        setFileName('');
        setNotes('');
        setIsUploadOpen(false);
        void refreshDocuments();
      } else {
        toast.show({ title: 'Upload Failed', description: res.error, type: 'error' });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: number, docTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${docTitle}"?`)) return;
    try {
      const res = await deletePatientDocumentAction(docId, patientId);
      if (res.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        toast.show({ title: 'Deleted', description: docTitle, type: 'info' });
      }
    } catch {
      toast.show({ title: 'Error', description: 'Could not delete document.', type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Clinical Documents & Scan Attachments</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
            {documents.length}
          </span>
        </div>
        <Button
          size="sm"
          type="button"
          onClick={() => setIsUploadOpen(true)}
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
        >
          <Upload className="w-3.5 h-3.5" /> Attach Document / Scan
        </Button>
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Loading attachments...</div>
      ) : documents.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-2">
          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-600">No clinical attachments yet</div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Attach patient X-rays, external lab PDF reports, 12-lead ECG strips, and dermatology / lesion photos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const isImage = doc.mimeType?.startsWith('image/') || doc.fileData.startsWith('data:image/');
            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                      {isImage ? (
                        <ImageIcon className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-indigo-700">{doc.documentType.replace('_', ' ')}</span>
                        {doc.fileSizeKb && <span>• {doc.fileSizeKb} KB</span>}
                      </div>
                      {doc.notes && <div className="text-[11px] text-slate-600 line-clamp-1 mt-1 italic">{doc.notes}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewDoc(doc)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-600"
                      title="View Document"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {isImage && (
                  <div
                    onClick={() => setPreviewDoc(doc)}
                    className="h-28 rounded-lg overflow-hidden bg-slate-100 cursor-pointer border border-slate-100 flex items-center justify-center relative group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.fileData} alt={doc.title} className="max-h-full max-w-full object-contain" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <Eye className="w-4 h-4" /> Click to enlarge
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-sm">Upload Clinical Attachment</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1 text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Document Title *</Label>
                <Input
                  required
                  placeholder="e.g. Chest X-Ray PA View"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Category</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as PatientDocumentType)}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-300 bg-white"
                >
                  <option value="LAB_REPORT">External Lab Report (PDF/Scan)</option>
                  <option value="IMAGING_XRAY">Radiology / X-Ray / CT / MRI</option>
                  <option value="ECG">12-Lead ECG Tracing</option>
                  <option value="CLINICAL_PHOTO">Clinical / Lesion / Wound Photo</option>
                  <option value="REFERRAL">Past Hospital Referral / Summary</option>
                  <option value="OTHER">Other Document</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Select File (Image / PDF up to 10MB) *</Label>
                <Input
                  required
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="bg-white file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
                />
                {fileName && (
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    {fileName} ({fileSizeKb} KB)
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Clinical Notes</Label>
                <Input
                  placeholder="e.g. Shows mild right lower lobe haziness"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-white"
                />
              </div>

              <Button
                type="submit"
                disabled={isUploading || !fileData}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 shadow-xs"
              >
                {isUploading ? 'Saving Document...' : 'Upload & Save Attachment'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{previewDoc.title}</h3>
                <p className="text-xs text-slate-400">
                  {previewDoc.documentType} • {previewDoc.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-100">
              {previewDoc.mimeType?.startsWith('image/') || previewDoc.fileData.startsWith('data:image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewDoc.fileData}
                  alt={previewDoc.title}
                  className="max-h-[70vh] max-w-full object-contain rounded shadow"
                />
              ) : (
                <iframe
                  src={previewDoc.fileData}
                  title={previewDoc.title}
                  className="w-full h-[70vh] rounded border border-slate-300"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
