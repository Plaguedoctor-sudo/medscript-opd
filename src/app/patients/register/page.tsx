'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, UserPlus, Phone, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { registerPatientAction } from './actions';

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function RegisterPatientPage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredPatient, setRegisteredPatient] = useState<{
    id: number;
    name: string;
    regNo: string | null;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.show({ title: 'Name Required', description: 'Please enter the patient full name.', type: 'error' });
      return;
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      toast.show({ title: 'Invalid Age', description: 'Please enter a valid age (0–120).', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerPatientAction({
        name: name.trim(),
        age: ageNum,
        gender,
        phone: phone.trim() || null,
        bloodGroup: bloodGroup || null,
        allergies: allergies.trim() || null,
        abhaId: abhaId.trim() || null,
      });

      if (result.success && result.patient) {
        setRegisteredPatient(result.patient);
        toast.show({
          title: 'Patient Registered',
          description: `${result.patient.name} — Reg: ${result.patient.regNo || `#${result.patient.id}`}`,
          type: 'success',
        });
      } else {
        toast.show({ title: 'Registration Failed', description: result.error || 'Unknown error', type: 'error' });
      }
    } catch (err: unknown) {
      toast.show({ title: 'Error', description: err instanceof Error ? err.message : 'Server error', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setRegisteredPatient(null);
    setName('');
    setAge('');
    setGender('Male');
    setPhone('');
    setBloodGroup('');
    setAllergies('');
    setAbhaId('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/patients">
              <Button variant="ghost" size="icon" title="Back to Patients">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
                <UserPlus className="text-white w-4 h-4" />
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 tracking-tight block leading-tight">
                  Register New Patient
                </span>
                <span className="text-[11px] text-slate-500 font-medium block leading-none">
                  Demographic intake — Reception / Nursing
                </span>
              </div>
            </div>
          </div>
          <Link href="/patients">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Users className="w-4 h-4" /> All Patients
            </Button>
          </Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {registeredPatient ? (
          /* SUCCESS STATE */
          <Card className="border-emerald-200 bg-emerald-50 text-center shadow-md">
            <CardContent className="py-12 space-y-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-emerald-900">Patient Registered Successfully</h2>
                <p className="text-emerald-700 font-semibold text-lg">{registeredPatient.name}</p>
                <p className="text-sm text-emerald-600 font-mono">
                  Registration No: <strong>{registeredPatient.regNo || `#${registeredPatient.id}`}</strong>
                </p>
              </div>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                The patient chart has been created. A doctor can now start a consultation, or you can register another patient.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href={`/patient/${registeredPatient.id}`}>
                  <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white w-full sm:w-auto">
                    View Patient Chart
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleRegisterAnother}
                  className="gap-2 border-emerald-400 text-emerald-800 hover:bg-emerald-100 w-full sm:w-auto"
                >
                  <UserPlus className="w-4 h-4" /> Register Another Patient
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* REGISTRATION FORM */
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-600" />
                New Patient Demographics
              </CardTitle>
              <p className="text-sm text-slate-500">
                Fill in the patient's basic information. Fields marked with * are required.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">
                    Full Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar Patel"
                    className="h-11"
                    autoFocus
                    required
                  />
                </div>

                {/* Age + Gender */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="age" className="text-sm font-semibold">
                      Age (Years) <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      min="0"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 45"
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">
                      Gender <span className="text-rose-500">*</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-1.5 h-11">
                      {(['Male', 'Female', 'Other'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`rounded-lg text-xs font-bold border transition-all ${
                            gender === g
                              ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-semibold">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      maxLength={10}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile number"
                      className="h-11 pl-10 font-mono"
                    />
                  </div>
                </div>

                {/* Blood Group + Allergies */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bloodGroup" className="text-sm font-semibold text-slate-600">
                      Blood Group
                    </Label>
                    <select
                      id="bloodGroup"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm"
                    >
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg || 'Unknown / Not tested'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allergies" className="text-sm font-semibold text-rose-700">
                      Drug Allergies
                    </Label>
                    <Input
                      id="allergies"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="e.g. Penicillin, Aspirin"
                      className="h-11 border-rose-200 focus:border-rose-400"
                    />
                  </div>
                </div>

                {/* ABHA ID */}
                <div className="space-y-2">
                  <Label htmlFor="abhaId" className="text-sm font-semibold text-slate-600">
                    ABHA ID (Optional)
                  </Label>
                  <Input
                    id="abhaId"
                    value={abhaId}
                    onChange={(e) => setAbhaId(e.target.value)}
                    placeholder="e.g. 12-3456-7890-1234"
                    className="h-11 font-mono text-sm"
                  />
                  <p className="text-[11px] text-slate-400">Ayushman Bharat Health Account — 14-digit ID</p>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full h-12 font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                >
                  {isSubmitting ? (
                    'Registering Patient...'
                  ) : (
                    <>
                      <Save className="w-5 h-5" /> Register Patient
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
