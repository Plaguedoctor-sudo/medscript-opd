'use client';

import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Patient, SafeClinicSettings, ClinicSettings } from '@/types';
import { MedicalCertificateModal } from './MedicalCertificateModal';

interface PatientCertificatesButtonProps {
  patient: Patient;
  settings?: SafeClinicSettings | ClinicSettings | null;
}

export function PatientCertificatesButton({ patient, settings }: PatientCertificatesButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
      >
        <Award className="w-3.5 h-3.5 text-amber-600" /> Medical Certificate
      </Button>

      <MedicalCertificateModal
        patient={patient}
        settings={settings}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
