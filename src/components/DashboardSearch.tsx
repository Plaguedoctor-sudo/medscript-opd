'use client'

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function DashboardSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleSearch(term: string) {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    
    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  }

  return (
    <div className="relative w-72">
      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isPending ? 'text-blue-500 animate-pulse' : 'text-slate-400'}`} />
      <Input 
        className="pl-9" 
        placeholder="Search patients or diagnosis..." 
        defaultValue={searchParams.get('q') || ''}
        onChange={(e) => handleSearch(e.target.value)}
      />
    </div>
  );
}
