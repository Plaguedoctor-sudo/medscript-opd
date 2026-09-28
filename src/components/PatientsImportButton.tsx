'use client';

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BulkPatientImportModal } from './BulkPatientImportModal';
import { useRouter } from 'next/navigation';

export function PatientsImportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50 bg-white shadow-2xs"
      >
        <Upload className="w-3.5 h-3.5 text-blue-600" /> Bulk Import CSV
      </Button>

      <BulkPatientImportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onImportComplete={() => {
          router.refresh();
        }}
      />
    </>
  );
}
