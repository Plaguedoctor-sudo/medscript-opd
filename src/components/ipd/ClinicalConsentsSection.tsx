'use client';

import { useState, useTransition } from 'react';
import {
  FileCheck2,
  Plus,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClinicalConsent, ConsentType } from '@/types';
import { createClinicalConsentAction } from '@/app/ipd/actions';
import { DigitalSignaturePad } from '@/components/DigitalSignaturePad';
import { useRouter } from 'next/navigation';

interface ClinicalConsentsSectionProps {
  admissionId: number;
  patientId: number;
  patientName: string;
  initialConsents: ClinicalConsent[];
  userRole?: string;
}

const CONSENT_TEMPLATES: Record<ConsentType, { title: string; defaultContent: string }> = {
  GENERAL_ADMISSION: {
    title: 'General Inpatient Admission & Medical Treatment Consent',
    defaultContent:
      'I hereby give voluntary consent for inpatient admission to MedScript Hospital. I authorize the medical officers, attending physicians, and nursing staff to administer clinical examinations, diagnostic tests, routine intravenous therapy, nursing care, and medications as deemed necessary for my treatment. The potential benefits and general risks of hospitalization have been explained to me in a language I understand.',
  },
  HIGH_RISK: {
    title: 'High-Risk Medical & Critical Care Informed Consent',
    defaultContent:
      'I have been informed by the attending physician that my clinical condition carries elevated risk of acute decompensation, complications, or emergency intervention. I consent to intensive monitoring, urgent medications, supplemental oxygen, and resuscitation measures. I understand the inherent risks despite best clinical efforts.',
  },
  SURGICAL_PROCEDURE: {
    title: 'Surgical & Invasive Procedure Informed Consent',
    defaultContent:
      'I hereby authorize the surgical team to perform the recommended operative procedure. The indications, procedural steps, anticipated benefits, anesthesia risks, and post-operative course have been detailed to me. I also consent to any necessary intraoperative modifications in clinical interest.',
  },
  DISCHARGE_LAMA: {
    title: 'Discharge Against Medical Advice (LAMA) Refusal of Care',
    defaultContent:
      'I am demanding discharge against the explicit advice of the attending medical team. The life-threatening and health risks of premature discharge, including relapse, permanent impairment, or acute deterioration, have been clearly explained. I absolve the hospital and doctors of all legal and medical liability.',
  },
  DATA_SHARING_ABDM: {
    title: 'Ayushman Bharat Digital Mission (ABDM) Health Data Sharing Consent',
    defaultContent:
      'I consent to the creation and linkage of my Ayushman Bharat Health Account (ABHA). I authorize MedScript Hospital to securely upload my diagnostic reports, discharge summaries, and digital prescriptions to the ABDM unified health information exchange under the National Digital Health Blueprint.',
  },
};

export function ClinicalConsentsSection({
  admissionId,
  patientId,
  patientName,
  initialConsents,
  userRole,
}: ClinicalConsentsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [consents, setConsents] = useState<ClinicalConsent[]>(initialConsents);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [consentType, setConsentType] = useState<ConsentType>('GENERAL_ADMISSION');
  const [title, setTitle] = useState(CONSENT_TEMPLATES.GENERAL_ADMISSION.title);
  const [content, setContent] = useState(CONSENT_TEMPLATES.GENERAL_ADMISSION.defaultContent);
  const [signedByName, setSignedByName] = useState(patientName);
  const [relationship, setRelationship] = useState('Self');
  const [witnessName, setWitnessName] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (type: ConsentType) => {
    setConsentType(type);
    setTitle(CONSENT_TEMPLATES[type].title);
    setContent(CONSENT_TEMPLATES[type].defaultContent);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureDataUrl) {
      setErrorMsg('Please capture patient / guardian signature before submitting.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const res = await createClinicalConsentAction({
      patientId,
      admissionId,
      consentType,
      title,
      content,
      patientSignature: signatureDataUrl,
      signedByName,
      relationship,
      witnessName,
    });

    if (res.success) {
      setShowAddModal(false);
      setSignatureDataUrl(null);
      startTransition(() => router.refresh());
    } else {
      setErrorMsg(res.error || 'Failed to record consent.');
    }
    setSaving(false);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between border-b-2 border-indigo-200 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center">
            <FileCheck2 className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
            Clinical Consent Forms &amp; Digital Signatures ({consents.length})
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200">
            NABH &amp; IT Act 2000
          </span>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setErrorMsg(null);
            setSignedByName(patientName);
            setShowAddModal(true);
          }}
          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-7 px-2.5 print:hidden"
        >
          <Plus className="w-3.5 h-3.5" /> Sign Consent Form
        </Button>
      </div>

      {consents.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
          No signed clinical consent forms recorded for this admission. Click &quot;Sign Consent Form&quot; to execute admission or procedural consent.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consents.map((consent) => (
            <div
              key={consent.id}
              className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-xs text-slate-900 leading-snug">{consent.title}</div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    <ShieldCheck className="w-3 h-3" /> Signed &amp; Sealed
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 mt-2 line-clamp-3 leading-relaxed italic bg-slate-50 p-2 rounded border border-slate-100">
                  &quot;{consent.content}&quot;
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-end justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-slate-900">
                    Signed by: {consent.signedByName} ({consent.relationship})
                  </div>
                  {consent.witnessName && (
                    <div className="text-[10px] text-slate-500">Witness: {consent.witnessName}</div>
                  )}
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {consent.signedAt ? new Date(consent.signedAt).toLocaleString('en-IN') : ''}
                  </div>
                </div>

                {consent.patientSignature && (
                  <div className="border border-slate-200 rounded p-1 bg-white shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={consent.patientSignature}
                      alt="Signature"
                      className="h-9 max-w-[100px] object-contain"
                    />
                  </div>
                )}
              </div>

              {consent.doctorSignature && (
                <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-1 font-mono text-[9px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded truncate max-w-[70%]">
                    <Lock className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {consent.doctorSignature.includes('SEAL-v1:')
                        ? `SEAL: ${consent.doctorSignature.split('::')[1]?.replace('SEAL-v1:', '').slice(0, 16)}...`
                        : consent.doctorSignature}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Verified Seal
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Execute Consent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" /> Execute Clinical Consent Form
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <Label className="text-xs font-semibold">Consent Type / Template</Label>
                <select
                  value={consentType}
                  onChange={(e) => handleTypeChange(e.target.value as ConsentType)}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                >
                  <option value="GENERAL_ADMISSION">General Inpatient Admission &amp; Medical Treatment</option>
                  <option value="HIGH_RISK">High-Risk Medical &amp; Critical Care Consent</option>
                  <option value="SURGICAL_PROCEDURE">Surgical &amp; Invasive Procedure Informed Consent</option>
                  <option value="DISCHARGE_LAMA">Discharge Against Medical Advice (LAMA) Refusal</option>
                  <option value="DATA_SHARING_ABDM">Ayushman Bharat (ABDM) Health Record Sharing</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Document Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Legal &amp; Clinical Terms</Label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-slate-50 p-2.5 text-xs font-medium leading-relaxed shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Signatory Full Name *</Label>
                  <Input
                    required
                    value={signedByName}
                    onChange={(e) => setSignedByName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Relationship to Patient</Label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs"
                  >
                    <option value="Self">Self (Patient)</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent / Mother / Father</option>
                    <option value="Child">Son / Daughter</option>
                    <option value="Guardian">Legal Guardian</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Attending Staff / Witness Name</Label>
                <Input
                  placeholder="e.g. Sister Priya Nair (Staff Nurse)"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              {/* Digital Touch Signature Pad */}
              <div>
                <Label className="text-xs font-semibold mb-1 block">
                  Patient / Guardian Signature (Sign with finger or stylus) *
                </Label>
                <DigitalSignaturePad
                  onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                  onClear={() => setSignatureDataUrl(null)}
                  width={520}
                  height={140}
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !signatureDataUrl}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving ? 'Executing...' : 'Sign & Legally Seal Consent'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
