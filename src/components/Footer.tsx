import React from 'react';
import { Shield, Lock, Activity, Smartphone } from 'lucide-react';

interface FooterProps {
  onOpenDiagnostics?: () => void;
  onOpenMobileGuide?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenDiagnostics, onOpenMobileGuide }) => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-8 px-4 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-300">FluxLoad</span>
          <span>•</span>
          <span>Supports 1000+ Websites</span>
          {onOpenMobileGuide && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={onOpenMobileGuide}
                className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium"
                title="স্মার্টফোনে ব্যবহারের সহায়িকা"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>মোবাইল গাইড / Phone Help</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-6">
          <span className="flex items-center gap-1.5 hover:text-slate-400 transition-colors">
            <Lock className="w-3.5 h-3.5 text-cyan-400" /> No Tracking
          </span>
          <span className="flex items-center gap-1.5 hover:text-slate-400 transition-colors">
            <Shield className="w-3.5 h-3.5 text-emerald-400" /> No Advertisements
          </span>
        </div>

        <div>
          {onOpenDiagnostics ? (
            <button
              type="button"
              onClick={onOpenDiagnostics}
              className="text-center md:text-right hover:text-cyan-400 transition-colors flex items-center gap-1.5 group"
              title="Open System Diagnostics to view yt-dlp and FFmpeg version status"
            >
              <Activity className="w-3.5 h-3.5 text-purple-400 group-hover:animate-pulse" />
              <span>
                Powered by <strong className="text-slate-400 group-hover:text-cyan-300">yt-dlp</strong> & <strong className="text-slate-400 group-hover:text-blue-300">FFmpeg</strong>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 group-hover:border-cyan-500/40 group-hover:text-cyan-300 font-mono">
                Diagnostics
              </span>
            </button>
          ) : (
            <p className="text-center md:text-right">
              Powered by <strong className="text-slate-400">yt-dlp</strong> & <strong className="text-slate-400">FFmpeg</strong>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
};
