import React from 'react';
import { Shield, Lock, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-950 py-8 px-4 mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-300">FluxLoad</span>
          <span>•</span>
          <span>Supports 1000+ Websites (YouTube, TikTok, xHamster & more)</span>
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
          <p className="text-center md:text-right">
            Powered by <strong className="text-slate-400">yt-dlp</strong> & <strong className="text-slate-400">FFmpeg</strong>
          </p>
        </div>
      </div>
    </footer>
  );
};
