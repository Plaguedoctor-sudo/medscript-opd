'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MaskedIdentifierProps {
  value: string | null | undefined;
  type: 'phone' | 'abha' | 'text';
  icon?: React.ReactNode;
}

export function MaskedIdentifier({ value, type, icon }: MaskedIdentifierProps) {
  const [revealed, setRevealed] = useState(false);

  if (!value) {
    return <span className="text-slate-400 text-xs">—</span>;
  }

  const maskValue = (raw: string, maskType: 'phone' | 'abha' | 'text'): string => {
    const clean = raw.trim();
    if (maskType === 'phone') {
      if (clean.length > 5) {
        return `${clean.slice(0, 5)} •••••`;
      }
      return '•••••';
    }
    if (maskType === 'abha') {
      if (clean.length > 4) {
        return `•••• •••• ${clean.slice(-4)}`;
      }
      return '•••• •••• ••••';
    }
    // generic
    if (clean.length > 4) {
      return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
    }
    return '••••';
  };

  const displayText = revealed ? value : maskValue(value, type);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed((prev) => !prev);
      }}
      title={revealed ? "Click to mask sensitive identifier" : "Click to reveal sensitive identifier"}
      className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer group select-none py-0.5"
    >
      {icon}
      <span className="font-mono">{displayText}</span>
      <span className="text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity">
        {revealed ? <EyeOff className="w-3 h-3 text-slate-500" /> : <Eye className="w-3 h-3 text-indigo-500" />}
      </span>
    </span>
  );
}
