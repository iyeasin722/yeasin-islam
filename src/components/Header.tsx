import React from 'react';
import { ShieldCheck, Zap, Lock, Bug } from 'lucide-react';

interface HeaderProps {
  onOpenErrorTest?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenErrorTest }) => {
  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              FluxLoad
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium border border-cyan-500/20">
                v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Free • Private • No Ads</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {onOpenErrorTest && (
            <button
              onClick={onOpenErrorTest}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors shadow-sm"
              title="Test all error handling scenarios"
            >
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Test Errors</span>
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-4 text-xs text-slate-400 font-medium">
            <div className="flex items-center space-x-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>No Ads</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Secure</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
