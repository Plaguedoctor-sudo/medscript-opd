'use client';

import { useTransition } from 'react';
import { lockDeskAction } from '@/app/login/actions';
import { Lock } from 'lucide-react';

export function LockDeskButton() {
  const [isPending, startTransition] = useTransition();

  const handleLock = () => {
    startTransition(async () => {
      await lockDeskAction();
    });
  };

  return (
    <button
      type="button"
      onClick={handleLock}
      disabled={isPending}
      title="Lock Consultation Desk"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-red-700 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm disabled:opacity-50"
    >
      <Lock className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{isPending ? 'Locking...' : 'Lock Desk'}</span>
    </button>
  );
}
