'use client';

import React, { useState } from 'react';
import { Smartphone, Tablet, Monitor, ChevronRight, X } from 'lucide-react';
import { useViewport } from '@/hooks/useViewport';

export default function ViewportIndicator() {
  const { width, height, isMobile, isTablet, isDesktop, isMounted } = useViewport();
  const [minimized, setMinimized] = useState(false);

  if (!isMounted) return null;

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 left-4 z-50 bg-[#00053d] text-white p-2.5 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center justify-center border border-white/20"
        title="Show Viewport Detection Details"
      >
        {isMobile && <Smartphone className="w-4 h-4 text-blue-400" />}
        {isTablet && <Tablet className="w-4 h-4 text-amber-400" />}
        {isDesktop && <Monitor className="w-4 h-4 text-emerald-400" />}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-[#00053d]/95 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-2xl shadow-xl border border-white/15 flex items-center gap-3 transition-all animate-in fade-in duration-300">
      <div className="flex items-center gap-1.5 font-medium">
        {isMobile && (
          <>
            <Smartphone className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-blue-300 font-bold">Mobile Viewport</span>
          </>
        )}
        {isTablet && (
          <>
            <Tablet className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-amber-300 font-bold">Tablet Viewport</span>
          </>
        )}
        {isDesktop && (
          <>
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 font-bold">Desktop Viewport</span>
          </>
        )}
      </div>

      <span className="text-slate-400">|</span>

      <span className="font-mono text-slate-300">
        {width} × {height} px
      </span>

      <button
        onClick={() => setMinimized(true)}
        className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
        title="Minimize"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
