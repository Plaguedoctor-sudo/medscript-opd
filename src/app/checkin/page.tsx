'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Building,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Printer,
  Sparkles,
  Users,
  Search,
  ArrowRight,
  RotateCcw,
  Volume2,
  Calendar,
  Shield,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import {
  lookupReturningPatientAction,
  selfCheckinAction,
  getKioskClinicInfoAction,
  SelfCheckinResult,
} from './actions';
import { formatDate } from '@/lib/utils';

const COMMON_SYMPTOMS = [
  'Fever & Chills',
  'Cough & Cold',
  'Sore Throat',
  'Severe Headache',
  'Stomach / Abdominal Pain',
  'Vomiting / Nausea',
  'Loose Motions (Diarrhea)',
  'Body Ache & Fatigue',
  'Blood Pressure (BP) Check',
  'Diabetes / Blood Sugar Review',
  'Skin Rash / Itching',
  'Routine Follow-Up',
];

export default function WaitingRoomCheckinPage() {
  const [clinicInfo, setClinicInfo] = useState<{
    clinicName: string;
    doctorName: string;
    qualifications: string;
    address: string;
    logoUrl?: string | null;
    currentCallingToken?: number | null;
    totalWaiting: number;
  }>({
    clinicName: 'MedScript Clinic OPD',
    doctorName: 'Dr. Nitin Hiralal Sonare',
    qualifications: 'MBBS',
    address: 'Consulting Suite',
    currentCallingToken: null,
    totalWaiting: 0,
  });

  const [mode, setMode] = useState<'RETURNING' | 'NEW'>('RETURNING');

  // Returning state
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [matchedPatient, setMatchedPatient] = useState<{
    id: number;
    name: string;
    age: number;
    gender: string;
    phone: string | null;
    regNo: string | null;
    allergies: string | null;
    bloodGroup: string | null;
  } | null>(null);

  // New patient state
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newBloodGroup, setNewBloodGroup] = useState('');
  const [newAllergies, setNewAllergies] = useState('');

  // Selected symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customComplaint, setCustomComplaint] = useState('');

  // Submission state & Token Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedToken, setIssuedToken] = useState<SelfCheckinResult | null>(null);

  // Load clinic info and poll queue stats
  useEffect(() => {
    getKioskClinicInfoAction().then(setClinicInfo);
    const interval = setInterval(() => {
      getKioskClinicInfoAction().then(setClinicInfo);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePhoneSearch = async (phoneToSearch: string) => {
    const clean = phoneToSearch.replace(/\D/g, '');
    setSearchPhone(clean);

    if (clean.length === 10) {
      setIsSearching(true);
      const res = await lookupReturningPatientAction(clean);
      setIsSearching(false);
      if (res.found && res.patient) {
        setMatchedPatient(res.patient);
        toast.show({
          title: `Welcome back, ${res.patient.name}!`,
          description: 'Select your symptoms below to get your token.',
          type: 'success',
        });
      } else {
        setMatchedPatient(null);
      }
    } else {
      setMatchedPatient(null);
    }
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const getCombinedComplaint = () => {
    const parts = [...selectedSymptoms];
    if (customComplaint.trim()) parts.push(customComplaint.trim());
    return parts.join(', ');
  };

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const complaint = getCombinedComplaint();

      let result: SelfCheckinResult;

      if (mode === 'RETURNING') {
        if (!matchedPatient) {
          toast.show({
            title: 'Patient Not Found',
            description: 'No record found with this phone number. Please switch to New Patient tab.',
            type: 'error',
          });
          setIsSubmitting(false);
          return;
        }

        result = await selfCheckinAction({
          patientId: matchedPatient.id,
          phone: matchedPatient.phone || searchPhone,
          chiefComplaint: complaint || 'Follow-up Consultation',
        });
      } else {
        if (!newName.trim()) {
          toast.show({ title: 'Name Required', description: 'Please enter patient full name.', type: 'error' });
          setIsSubmitting(false);
          return;
        }
        if (!newPhone.trim() || newPhone.replace(/\D/g, '').length < 10) {
          toast.show({ title: 'Valid Phone Required', description: 'Please enter a 10-digit mobile number.', type: 'error' });
          setIsSubmitting(false);
          return;
        }

        result = await selfCheckinAction({
          name: newName.trim(),
          age: Number(newAge) || 30,
          gender: newGender,
          phone: newPhone.trim(),
          bloodGroup: newBloodGroup || undefined,
          allergies: newAllergies || undefined,
          chiefComplaint: complaint || 'General OPD Consultation',
        });
      }

      if (result.success && result.tokenNo) {
        setIssuedToken(result);

        // Voice announcement
        try {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(
              `Token number ${result.tokenNo} issued for ${result.patientName}. Please take a seat in the waiting hall.`
            );
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
          }
        } catch {}

        toast.show({
          title: `Token #${result.tokenNo} Generated!`,
          description: `You are in line. ${result.waitingAhead ?? 0} patients ahead.`,
          type: 'success',
        });
      } else {
        toast.show({
          title: 'Check-in Error',
          description: result.error || 'Failed to generate token. Please visit reception desk.',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      toast.show({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Checkin failed',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIssuedToken(null);
    setMatchedPatient(null);
    setSearchPhone('');
    setNewName('');
    setNewAge('');
    setNewPhone('');
    setSelectedSymptoms([]);
    setCustomComplaint('');
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-8">
      {/* Kiosk Header */}
      <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-700/80 print:hidden">
        <div className="flex items-center gap-3.5">
          {clinicInfo.logoUrl ? (
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={clinicInfo.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30">
              <Stethoscope className="w-7 h-7" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              {clinicInfo.clinicName}
            </h1>
            <p className="text-xs sm:text-sm text-blue-300 font-medium">
              {clinicInfo.doctorName} • {clinicInfo.qualifications}
            </p>
            <p className="text-xs text-slate-400">{clinicInfo.address}</p>
          </div>
        </div>

        {/* Live Queue Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl text-center shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Now Calling</span>
            <span className="text-xl font-black font-mono text-emerald-400">
              {clinicInfo.currentCallingToken ? `#${clinicInfo.currentCallingToken}` : 'Ready'}
            </span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl text-center shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">In Waiting</span>
            <span className="text-xl font-black font-mono text-amber-400">
              {clinicInfo.totalWaiting} Patients
            </span>
          </div>
        </div>
      </header>

      {/* Main Kiosk Area */}
      <main className="max-w-2xl mx-auto w-full my-6 flex-1 flex flex-col justify-center">
        {issuedToken ? (
          /* ISSUED TOKEN SLIP SCREEN */
          <div className="space-y-6 animate-in zoom-in-95 duration-200">
            {/* Printable Slip Container */}
            <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-center space-y-6 print:border-none print:shadow-none print:p-4">
              <div className="space-y-1">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
                  Check-in Confirmed
                </span>
                <h2 className="text-xl font-bold text-slate-900">{clinicInfo.clinicName}</h2>
                <p className="text-xs text-slate-500">{formatDate(new Date())} • OPD Token Slip</p>
              </div>

              {/* Massive Token Number */}
              <div className="py-6 px-4 bg-linear-to-b from-blue-50 to-indigo-50/50 rounded-2xl border-2 border-dashed border-blue-200">
                <span className="text-xs font-bold uppercase text-slate-500 block mb-1">Your Token Number</span>
                <div className="text-6xl sm:text-7xl font-black font-mono text-blue-700 tracking-tight">
                  #{issuedToken.tokenNo}
                </div>
                <div className="text-sm font-bold text-slate-800 mt-2">{issuedToken.patientName}</div>
                {issuedToken.regNo && (
                  <div className="text-xs font-mono text-slate-500">Reg: {issuedToken.regNo}</div>
                )}
              </div>

              {/* Waiting Stats */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Patients Ahead</span>
                  <span className="text-lg font-bold text-slate-900">
                    {issuedToken.waitingAhead ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Estimated Wait</span>
                  <span className="text-lg font-bold text-slate-900">
                    ~{Math.max(5, (issuedToken.waitingAhead ?? 0) * 10)} mins
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1 border-t border-slate-200 pt-4">
                <p className="font-semibold text-slate-700">Please take a seat in the waiting room.</p>
                <p>Watch the digital display screen. Your token will be announced when it is your turn.</p>
              </div>

              {/* Action Buttons (Hidden when printing) */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3 print:hidden">
                <Button
                  type="button"
                  onClick={handlePrintSlip}
                  size="lg"
                  className="flex-1 gap-2 bg-slate-900 hover:bg-black text-white font-bold"
                >
                  <Printer className="w-5 h-5" /> Print Token Slip
                </Button>
                <Button
                  type="button"
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                  className="flex-1 gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 font-bold"
                >
                  <RotateCcw className="w-5 h-5" /> Next Patient Check-in
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* SELF CHECK-IN FORM */
          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-md">
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setMode('RETURNING');
                  setMatchedPatient(null);
                }}
                className={`py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  mode === 'RETURNING'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Returning Patient
              </button>
              <button
                type="button"
                onClick={() => setMode('NEW')}
                className={`py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  mode === 'NEW'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                New Patient
              </button>
            </div>

            <form onSubmit={handleCheckinSubmit} className="space-y-6">
              {mode === 'RETURNING' ? (
                /* RETURNING PATIENT LOOKUP */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-200 flex items-center justify-between">
                      <span>Enter Registered 10-Digit Mobile Number</span>
                      {isSearching && <span className="text-blue-400 text-xs animate-pulse">Searching records...</span>}
                    </Label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
                      <Input
                        type="tel"
                        maxLength={10}
                        value={searchPhone}
                        onChange={(e) => handlePhoneSearch(e.target.value)}
                        placeholder="e.g. 9810123456"
                        className="h-12 pl-11 text-base sm:text-lg font-mono bg-slate-900 border-slate-700 text-white focus:ring-2 focus:ring-blue-500 rounded-xl"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Type your 10-digit mobile number to automatically find your patient chart.
                    </p>
                  </div>

                  {matchedPatient ? (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Patient Found</span>
                        <div className="text-base font-bold text-white">{matchedPatient.name}</div>
                        <div className="text-xs text-slate-300">
                          {matchedPatient.age} Yrs • {matchedPatient.gender} {matchedPatient.bloodGroup ? `• Blood: ${matchedPatient.bloodGroup}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-700">
                          {matchedPatient.regNo || `ID #${matchedPatient.id}`}
                        </span>
                      </div>
                    </div>
                  ) : searchPhone.length === 10 && !isSearching ? (
                    <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-amber-300">No chart found for +91 {searchPhone}</div>
                        <p className="text-[11px] text-slate-400">First time visiting our clinic? Click New Patient above.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setNewPhone(searchPhone);
                          setMode('NEW');
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0"
                      >
                        Register as New
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                /* NEW PATIENT REGISTRATION FORM */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-200">Patient Full Name *</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar Patel"
                      className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-200">Age (Years) *</Label>
                      <Input
                        type="number"
                        min="0"
                        max="120"
                        value={newAge}
                        onChange={(e) => setNewAge(e.target.value)}
                        placeholder="e.g. 35"
                        className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-200">Gender *</Label>
                      <div className="grid grid-cols-3 gap-1 h-11">
                        {['Male', 'Female', 'Other'].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setNewGender(g)}
                            className={`rounded-xl text-xs font-bold border transition-all ${
                              newGender === g
                                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-200">Mobile Phone Number *</Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <Input
                        type="tel"
                        maxLength={10}
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="10-digit mobile number"
                        className="h-11 pl-10 bg-slate-900 border-slate-700 text-white rounded-xl font-mono text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-300">Blood Group (Optional)</Label>
                      <select
                        value={newBloodGroup}
                        onChange={(e) => setNewBloodGroup(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      >
                        <option value="">Select (Optional)</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-300">Drug Allergies (Optional)</Label>
                      <Input
                        value={newAllergies}
                        onChange={(e) => setNewAllergies(e.target.value)}
                        placeholder="e.g. Penicillin, Sulfa"
                        className="h-11 bg-slate-900 border-slate-700 text-white rounded-xl text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Symptoms / Chief Complaints Selector */}
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <Label className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400" /> Select What You Are Experiencing Today
                </Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SYMPTOMS.map((sym) => {
                    const active = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white shadow-md font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>

                <Input
                  value={customComplaint}
                  onChange={(e) => setCustomComplaint(e.target.value)}
                  placeholder="Other symptoms or complaints (Optional)..."
                  className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl text-xs"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || (mode === 'RETURNING' && !matchedPatient)}
                size="lg"
                className="w-full h-14 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl shadow-blue-600/30 gap-2"
              >
                {isSubmitting ? (
                  'Allocating Token...'
                ) : (
                  <>
                    Confirm Check-in & Get Token <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </main>

      {/* Kiosk Footer */}
      <footer className="max-w-4xl mx-auto w-full pt-4 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 print:hidden">
        <div>
          <span>MedScript EMR Kiosk • Self-Service Patient Registration</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/appointments/queue" className="hover:text-blue-400 text-slate-400">
            Open Full Queue Display
          </Link>
          <span>•</span>
          <Link href="/" className="hover:text-blue-400 text-slate-400">
            Staff Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
