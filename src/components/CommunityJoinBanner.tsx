import React, { useState, useEffect } from 'react';
import { Send, Sparkles, ExternalLink, X, ShieldCheck, Zap } from 'lucide-react';

interface CommunityJoinBannerProps {
  onOpenStickerMaker?: () => void;
  onOpenTelegramSettings?: () => void;
}

export const CommunityJoinBanner: React.FC<CommunityJoinBannerProps> = ({
  onOpenStickerMaker,
  onOpenTelegramSettings,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fluxload_banner_dismissed_v2') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('fluxload_banner_dismissed_v2', 'true');
    } catch {}
  };

  const handleJoin = () => {
    window.open('https://t.me/FluxLoad', '_blank', 'noopener,noreferrer');
  };

  if (isDismissed) {
    return (
      <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 pt-2 pb-1 flex justify-end overflow-hidden">
        <button
          onClick={() => {
            setIsDismissed(false);
            try {
              localStorage.removeItem('fluxload_banner_dismissed_v2');
            } catch {}
          }}
          className="text-[11px] text-sky-400/80 hover:text-sky-300 flex items-center gap-1.5 transition-colors cursor-pointer bg-sky-950/30 px-2.5 py-1 rounded-lg border border-sky-800/40"
          title="Show FluxLoad Telegram Community announcement"
        >
          <Send className="w-3 h-3 text-sky-400" />
          <span>Join @FluxLoad Channel</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 pt-3 pb-1 overflow-hidden">
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-r from-slate-900/90 via-sky-950/40 to-slate-900/90 shadow-xl shadow-sky-950/40 backdrop-blur-md p-3.5 sm:p-4">
        {/* Ambient glow decoration */}
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          {/* Left info */}
          <div className="flex items-start sm:items-center space-x-3">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
                <Send className="w-5 h-5 sm:w-6 sm:h-6 -rotate-12 translate-x-0.5" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 border-2 border-slate-900"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-sky-400" />
                  Official Community
                </span>
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>https://t.me/FluxLoad</span>
                </span>
                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Join now everybody!
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                স্বাগতম! দ্রুত ক্লাউড ভিডিও ডাউনলোড, ১০ জিবি স্ট্রিমিং ও এক্সক্লুসিভ স্টিকারের জন্য আমাদের অফিশিয়াল চ্যানেলে যোগ দিন।
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap sm:flex-nowrap justify-end w-full md:w-auto">
            {onOpenStickerMaker && (
              <button
                type="button"
                onClick={onOpenStickerMaker}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Create Telegram Logo & 512x512 Stickers with Size Optimizer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Logo & Sticker Maker</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleJoin}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-500/25 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              title="Join @FluxLoad Telegram Channel (t.me/FluxLoad)"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Join Channel Now</span>
              <ExternalLink className="w-3 h-3 text-sky-200" />
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
              title="Hide announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
