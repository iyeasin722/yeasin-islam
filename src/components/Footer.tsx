import React from 'react';
import { Shield, Lock, Activity } from 'lucide-react';

interface FooterProps {
  onOpenDiagnostics?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenDiagnostics }) => {
  return (
    <footer className="w-full max-w-[100vw] overflow-x-hidden border-t border-slate-800/80 bg-slate-950 py-8 px-4 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center space-x-2.5">
          <img
            src="/logo.jpg"
            alt="FluxLoad"
            className="w-6 h-6 rounded-lg object-cover border border-amber-500/40 shadow-sm shadow-orange-500/20"
          />
          <div className="flex items-center space-x-1.5 flex-wrap">
            <span className="font-bold text-slate-200">FluxLoad</span>
            <span className="text-[11px] text-amber-400 font-semibold">power by YEASIN</span>
            <span>•</span>
            <span>Supports 1000+ Websites</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 sm:space-x-6 flex-wrap">
          <a
            href="https://t.me/FluxLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors font-medium"
            title="Join Official FluxLoad Telegram Channel (https://t.me/FluxLoad)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            <span>Join @FluxLoad</span>
          </a>
          <span className="flex items-center gap-1.5 hover:text-slate-400 transition-colors">
            <Lock className="w-3.5 h-3.5 text-cyan-400" /> No Tracking
          </span>
          <span className="flex items-center gap-1.5 hover:text-slate-400 transition-colors">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> No Advertisements
          </span>
        </div>

        <div>
          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              className="hover:text-slate-400 transition-colors flex items-center space-x-1"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Status</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
