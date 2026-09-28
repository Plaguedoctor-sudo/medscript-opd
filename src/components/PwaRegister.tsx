'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check for worker updates
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New MedScript PWA version available.');
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('PWA service worker registration failed:', err);
        });
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('online', handleOnline);

      return () => {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      };
    }
  }, []);

  if (isOffline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs border border-amber-400 print:hidden animate-in slide-in-from-bottom-2">
        <WifiOff className="w-3.5 h-3.5 animate-pulse" />
        <span>Offline Mode (Local Storage Active)</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-4 z-50 bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs border border-emerald-500 print:hidden animate-in slide-in-from-bottom-2">
        <Wifi className="w-3.5 h-3.5" />
        <span>Connected to Clinic Network</span>
      </div>
    );
  }

  return null;
}
