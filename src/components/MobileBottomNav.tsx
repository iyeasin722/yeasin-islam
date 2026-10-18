import React from 'react';
import { Film, ListPlus, Sparkles, History, Settings } from 'lucide-react';
import { AppNavMode } from '../types';

interface MobileBottomNavProps {
  currentMode: AppNavMode;
  onModeChange: (mode: AppNavMode) => void;
  onOpenHistory: () => void;
  historyCount: number;
  batchCount: number;
  onOpenSettings: (tab?: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentMode,
  onModeChange,
  onOpenHistory,
  historyCount,
  batchCount,
  onOpenSettings,
}) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-1.5 py-1.5 shadow-2xl flex items-center justify-between w-full max-w-[100vw] overflow-x-hidden safe-area-pb"
    >
      {/* 1. URL Downloader */}
      <button
        type="button"
        onClick={() => onModeChange('single')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
          currentMode === 'single'
            ? 'text-cyan-400 font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div
          className={`p-1 rounded-lg transition-all ${
            currentMode === 'single' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : ''
          }`}
        >
          <Film className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">ডাউনলোড</span>
      </button>

      {/* 2. Social Reels */}
      <button
        type="button"
        onClick={() => onModeChange('social')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
          currentMode === 'social'
            ? 'text-pink-400 font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div
          className={`p-1 rounded-lg transition-all ${
            currentMode === 'social' ? 'bg-pink-500/20 text-pink-400 shadow-sm' : ''
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">রিলস</span>
      </button>

      {/* 3. Multiple/Batch */}
      <button
        type="button"
        onClick={() => onModeChange('batch')}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative ${
          currentMode === 'batch'
            ? 'text-cyan-400 font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div
          className={`p-1 rounded-lg transition-all relative ${
            currentMode === 'batch' ? 'bg-cyan-500/20 text-cyan-400 shadow-sm' : ''
          }`}
        >
          <ListPlus className="w-4 h-4" />
          {batchCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-cyan-400 text-slate-950 text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {batchCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">মাল্টিপল</span>
      </button>

      {/* 4. History */}
      <button
        type="button"
        onClick={onOpenHistory}
        className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-cyan-300 transition-all relative"
      >
        <div className="p-1 rounded-lg relative">
          <History className="w-4 h-4 text-cyan-400" />
          {historyCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-slate-950 text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
              {historyCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">হিস্টোরি</span>
      </button>

      {/* 5. Settings */}
      <button
        type="button"
        onClick={() => onOpenSettings()}
        className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slate-400 hover:text-slate-200 transition-all relative"
      >
        <div className="p-1 rounded-lg">
          <Settings className="w-4 h-4 text-slate-400" />
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight truncate">সেটিংস</span>
      </button>
    </nav>
  );
};
