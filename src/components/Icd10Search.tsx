'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Search, Stethoscope, Check, X, Tag } from 'lucide-react';
import { searchICD10, ICD10Diagnosis, formatICD10Diagnosis, ICD10_DATABASE } from '@/lib/icd10';

interface Icd10SearchProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
}

export function Icd10Search({
  value,
  onChange,
  id = 'diagnosis',
  name = 'diagnosis',
  placeholder = 'Search ICD-10 Code or Disease (e.g. I10, Diabetes, URTI, Fever)...',
}: Icd10SearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [results, setResults] = useState<ICD10Diagnosis[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal searchTerm if external value changes
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Update results based on search term & category filter
  useEffect(() => {
    let items = searchICD10(searchTerm, 30);
    if (selectedCategory !== 'All') {
      items = items.filter((d) => d.category === selectedCategory);
    }
    setResults(items);
  }, [searchTerm, selectedCategory]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (diag: ICD10Diagnosis) => {
    const formatted = formatICD10Diagnosis(diag);
    setSearchTerm(formatted);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onChange(val);
    if (!isOpen) setIsOpen(true);
  };

  const clearSelection = () => {
    setSearchTerm('');
    onChange('');
    setIsOpen(false);
  };

  const categories = ['All', 'Respiratory', 'Cardiovascular', 'Endocrine & Metabolic', 'Gastrointestinal', 'Infectious Disease', 'Musculoskeletal', 'Dermatology'];

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <div className="absolute left-2.5 text-blue-600 pointer-events-none">
          <Stethoscope className="w-4 h-4" />
        </div>
        <input
          id={id}
          name={name}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full h-10 pl-9 pr-9 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg bg-white shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
            title="Clear diagnosis"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="absolute right-2.5 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 max-h-[380px] flex flex-col">
          {/* Category Chips Bar */}
          <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <span className="text-slate-400 flex items-center gap-1 font-semibold px-1">
              <Tag className="w-3 h-3" /> Filter:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {results.length > 0 ? (
              results.map((diag) => {
                const isSelected = searchTerm.includes(`[${diag.code}]`);
                return (
                  <button
                    key={diag.code}
                    type="button"
                    onClick={() => handleSelect(diag)}
                    className={`w-full text-left p-2.5 hover:bg-blue-50/70 transition-colors flex items-start justify-between gap-3 group ${
                      isSelected ? 'bg-blue-50/90' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {diag.code}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {diag.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                          {diag.category}
                        </span>
                        {diag.synonyms && diag.synonyms.length > 0 && (
                          <span className="truncate text-slate-400">
                            • {diag.synonyms.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                <p>No exact ICD-10 code found for &quot;{searchTerm}&quot;.</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  You can still press Enter to use this custom diagnosis.
                </p>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>WHO ICD-10-CM Standardized Diagnostic Library</span>
            <span>{results.length} matches</span>
          </div>
        </div>
      )}
    </div>
  );
}
