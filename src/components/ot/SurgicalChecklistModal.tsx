'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, CheckCircle2, AlertTriangle, Activity, Scissors } from 'lucide-react';
import { WhoSurgicalChecklist } from '@/types';
import { saveWhoSurgicalChecklistAction } from '@/app/actions/ot-actions';

interface SurgicalChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  admissionId: number;
  patientId: number;
  patientName: string;
  surgeonName: string;
  initialChecklist?: WhoSurgicalChecklist;
}

export function SurgicalChecklistModal({
  isOpen,
  onClose,
  admissionId,
  patientId,
  patientName,
  surgeonName,
  initialChecklist,
}: SurgicalChecklistModalProps) {
  const [phase, setPhase] = useState<'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT'>('SIGN_IN');
  const [isPending, startTransition] = useTransition();

  // Basic Info
  const [surgeryName, setSurgeryName] = useState(initialChecklist?.surgeryName || 'Emergency Exploratory Laparotomy');
  const [otNumber, setOtNumber] = useState(initialChecklist?.otNumber || 'OT-1');
  const [anesthesiologist, setAnesthesiologist] = useState(initialChecklist?.anesthesiologist || 'Dr. Anesthesia Consultant');
  const [scrubNurse, setScrubNurse] = useState(initialChecklist?.scrubNurse || 'Sister Priya Nair');

  // Phase 1: Sign In
  const [signInPatientConfirmed, setSignInPatientConfirmed] = useState(initialChecklist?.signInPatientConfirmed ?? true);
  const [signInSiteMarked, setSignInSiteMarked] = useState(initialChecklist?.signInSiteMarked ?? true);
  const [signInAnesthesiaSafetyCheck, setSignInAnesthesiaSafetyCheck] = useState(initialChecklist?.signInAnesthesiaSafetyCheck ?? true);
  const [signInPulseOximeterActive, setSignInPulseOximeterActive] = useState(initialChecklist?.signInPulseOximeterActive ?? true);
  const [signInAllergyConfirmed, setSignInAllergyConfirmed] = useState(initialChecklist?.signInAllergyConfirmed ?? true);
  const [signInDifficultAirwayRisk, setSignInDifficultAirwayRisk] = useState(initialChecklist?.signInDifficultAirwayRisk ?? false);
  const [signInAspirationRisk, setSignInAspirationRisk] = useState(initialChecklist?.signInAspirationRisk ?? false);
  const [bloodLossMl, setBloodLossMl] = useState(initialChecklist?.signInBloodLossRiskEstimatedMl ?? 200);

  // Phase 2: Time Out
  const [timeOutTeamIntroduced, setTimeOutTeamIntroduced] = useState(initialChecklist?.timeOutTeamIntroduced ?? true);
  const [timeOutPatientIdentified, setTimeOutPatientIdentified] = useState(initialChecklist?.timeOutPatientIdentified ?? true);
  const [timeOutProcedureConfirmed, setTimeOutProcedureConfirmed] = useState(initialChecklist?.timeOutProcedureConfirmed ?? true);
  const [timeOutIncisionSiteConfirmed, setTimeOutIncisionSiteConfirmed] = useState(initialChecklist?.timeOutIncisionSiteConfirmed ?? true);
  const [timeOutAntibioticGiven, setTimeOutAntibioticGiven] = useState(initialChecklist?.timeOutAntibioticProphylaxisGiven ?? true);
  const [timeOutAntibioticName, setTimeOutAntibioticName] = useState(initialChecklist?.timeOutAntibioticName || 'Inj Cefuroxime 1.5g IV');
  const [timeOutSterilityConfirmed, setTimeOutSterilityConfirmed] = useState(initialChecklist?.timeOutSterilityConfirmed ?? true);
  const [timeOutImagingDisplayed, setTimeOutImagingDisplayed] = useState(initialChecklist?.timeOutImagingDisplayed ?? true);

  // Phase 3: Sign Out
  const [signOutNurseConfirmed, setSignOutNurseConfirmed] = useState(initialChecklist?.signOutNurseVerballyConfirmed ?? true);
  const [signOutInstrumentCount, setSignOutInstrumentCount] = useState(initialChecklist?.signOutInstrumentCountCorrect ?? true);
  const [signOutSpongeCount, setSignOutSpongeCount] = useState(initialChecklist?.signOutSpongeNeedleCountCorrect ?? true);
  const [signOutSpecimenLabeled, setSignOutSpecimenLabeled] = useState(initialChecklist?.signOutSpecimenLabeledAccurately ?? true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = () => {
    startTransition(async () => {
      const now = new Date();
      const res = await saveWhoSurgicalChecklistAction({
        admissionId,
        patientId,
        surgeryName,
        otNumber,
        operatingSurgeon: surgeonName,
        anesthesiologist,
        scrubNurse,
        signInPatientConfirmed,
        signInSiteMarked,
        signInAnesthesiaSafetyCheck,
        signInPulseOximeterActive,
        signInAllergyConfirmed,
        signInDifficultAirwayRisk,
        signInAspirationRisk,
        signInBloodLossRiskEstimatedMl: Number(bloodLossMl),
        signInCompletedAt: now,
        signInSignedBy: anesthesiologist,
        timeOutTeamIntroduced,
        timeOutPatientIdentified,
        timeOutProcedureConfirmed,
        timeOutIncisionSiteConfirmed,
        timeOutAntibioticProphylaxisGiven: timeOutAntibioticGiven,
        timeOutAntibioticName,
        timeOutSterilityConfirmed,
        timeOutImagingDisplayed,
        timeOutCompletedAt: now,
        timeOutSignedBy: surgeonName,
        signOutNurseVerballyConfirmed: signOutNurseConfirmed,
        signOutInstrumentCountCorrect: signOutInstrumentCount,
        signOutSpongeNeedleCountCorrect: signOutSpongeCount,
        signOutSpecimenLabeledAccurately: signOutSpecimenLabeled,
        signOutCompletedAt: now,
        signOutSignedBy: scrubNurse,
        createdAt: now,
      });

      if (res.success) {
        setFeedback('WHO Surgical Safety Checklist verified & logged.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setFeedback(`Error: ${res.error}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Scissors className="w-5 h-5 text-indigo-400" />
            WHO Surgical Safety Checklist — {patientName}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Global standard 3-phase surgical safety verification mandated for all operative procedures
          </DialogDescription>
        </DialogHeader>

        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Phase Selectors */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-3 mt-2">
          <Button
            type="button"
            variant={phase === 'SIGN_IN' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPhase('SIGN_IN')}
            className={`text-xs ${phase === 'SIGN_IN' ? 'bg-indigo-600 text-white' : 'border-slate-800 text-slate-300'}`}
          >
            1. Sign In (Pre-Induction)
          </Button>
          <Button
            type="button"
            variant={phase === 'TIME_OUT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPhase('TIME_OUT')}
            className={`text-xs ${phase === 'TIME_OUT' ? 'bg-indigo-600 text-white' : 'border-slate-800 text-slate-300'}`}
          >
            2. Time Out (Pre-Incision)
          </Button>
          <Button
            type="button"
            variant={phase === 'SIGN_OUT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPhase('SIGN_OUT')}
            className={`text-xs ${phase === 'SIGN_OUT' ? 'bg-indigo-600 text-white' : 'border-slate-800 text-slate-300'}`}
          >
            3. Sign Out (Post-Op)
          </Button>
        </div>

        {/* Phase 1: Sign In */}
        {phase === 'SIGN_IN' && (
          <div className="space-y-3 py-2 text-xs">
            <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Before Induction of Anesthesia (With Anesthesiologist & Nurse)
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInPatientConfirmed}
                  onChange={(e) => setSignInPatientConfirmed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Patient confirmed identity, site, and consent</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInSiteMarked}
                  onChange={(e) => setSignInSiteMarked(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Surgical site marked / Not applicable</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInAnesthesiaSafetyCheck}
                  onChange={(e) => setSignInAnesthesiaSafetyCheck(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Anesthesia machine & medication check complete</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInPulseOximeterActive}
                  onChange={(e) => setSignInPulseOximeterActive(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Pulse oximeter on patient & functioning</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInAllergyConfirmed}
                  onChange={(e) => setSignInAllergyConfirmed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Known allergy confirmed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signInDifficultAirwayRisk}
                  onChange={(e) => setSignInDifficultAirwayRisk(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Difficult airway / aspiration risk present</span>
              </label>
            </div>
          </div>
        )}

        {/* Phase 2: Time Out */}
        {phase === 'TIME_OUT' && (
          <div className="space-y-3 py-2 text-xs">
            <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Before Skin Incision (Entire Team Out Loud)
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeOutTeamIntroduced}
                  onChange={(e) => setTimeOutTeamIntroduced(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Team members introduced name & role</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeOutPatientIdentified}
                  onChange={(e) => setTimeOutPatientIdentified(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Patient name, procedure, & site verbalized</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeOutAntibioticGiven}
                  onChange={(e) => setTimeOutAntibioticGiven(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Antibiotic prophylaxis given within past 60 min</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeOutSterilityConfirmed}
                  onChange={(e) => setTimeOutSterilityConfirmed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Sterility indicators verified by scrub nurse</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeOutImagingDisplayed}
                  onChange={(e) => setTimeOutImagingDisplayed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Essential diagnostic imaging displayed</span>
              </label>
            </div>
          </div>
        )}

        {/* Phase 3: Sign Out */}
        {phase === 'SIGN_OUT' && (
          <div className="space-y-3 py-2 text-xs">
            <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              Before Patient Leaves Operating Room
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signOutNurseConfirmed}
                  onChange={(e) => setSignOutNurseConfirmed(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Name of procedure recorded accurately</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signOutInstrumentCount}
                  onChange={(e) => setSignOutInstrumentCount(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Instrument counts correct</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signOutSpongeCount}
                  onChange={(e) => setSignOutSpongeCount(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Sponge & needle counts correct</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signOutSpecimenLabeled}
                  onChange={(e) => setSignOutSpecimenLabeled(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600"
                />
                <span>Specimen labeled (including patient name)</span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-800 text-slate-300 text-xs"
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
          >
            Sign & Save WHO Checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
