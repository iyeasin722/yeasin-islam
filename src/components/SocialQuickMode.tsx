import React, { useState, useEffect } from 'react';
import {
  Share2,
  Download,
  Music,
  Scissors,
  Clipboard,
  Sparkles,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Info
} from 'lucide-react';
import { VideoQuality, VideoFormatChoice, DownloadType } from '../types';

interface SocialQuickModeProps {
  onStartDownload: (url: string, options: { type: DownloadType; quality: VideoQuality; format: VideoFormatChoice }) => void;
  onOpenAudioCutter: (url?: string) => void;
  isDownloading?: boolean;
}

interface PlatformPreset {
  id: 'tiktok' | 'instagram' | 'shorts' | 'facebook' | 'twitter';
  name: string;
  badge: string;
  color: string;
  bgGlow: string;
  iconText: string;
  exampleUrl: string;
  guideTextBn: string;
}

const PLATFORMS: PlatformPreset[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    badge: 'No Watermark HD',
    color: 'from-pink-500 to-rose-600',
    bgGlow: 'shadow-pink-500/10 border-pink-500/40',
    iconText: '🎵 TikTok',
    exampleUrl: 'https://www.tiktok.com/@user/video/...',
    guideTextBn: 'টিকটক অ্যাপে গিয়ে শেয়ার (Share) বাটনে ক্লিক করে "Copy Link" কপি করুন। এখানে ওয়াটারমার্ক ছাড়া HD ভিডিও ডাউনলোড হবে।',
  },
  {
    id: 'instagram',
    name: 'Instagram Reels',
    badge: 'Reels & Stories 1080p',
    color: 'from-purple-500 to-pink-500',
    bgGlow: 'shadow-purple-500/10 border-purple-500/40',
    iconText: '📸 Instagram',
    exampleUrl: 'https://www.instagram.com/reel/...',
    guideTextBn: 'ইনস্টাগ্রাম রিলস বা পোস্টের শেয়ার অপশন থেকে লিঙ্ক কপি করে পেস্ট করুন। আসল রেজ্যুলেশনে ডাউনলোড হবে। লগইন প্রয়োজন হলে Settings → Site Cookies থেকে sessionid যোগ করুন।',
  },
  {
    id: 'shorts',
    name: 'YouTube Shorts',
    badge: 'High Bitrate 60FPS',
    color: 'from-red-500 to-rose-600',
    bgGlow: 'shadow-red-500/10 border-red-500/40',
    iconText: '▶️ Shorts',
    exampleUrl: 'https://youtube.com/shorts/...',
    guideTextBn: 'ইউটিউব শর্টসের শেয়ার বাটন থেকে লিঙ্ক কপি করুন। অডিও বা ভিডিও যেকোনো ফরম্যাটে এক ক্লিকে ডাউনলোড হবে।',
  },
  {
    id: 'facebook',
    name: 'Facebook Video',
    badge: 'Reels & Watch HD',
    color: 'from-blue-600 to-indigo-600',
    bgGlow: 'shadow-blue-500/10 border-blue-500/40',
    iconText: '👥 Facebook',
    exampleUrl: 'https://www.facebook.com/reel/...',
    guideTextBn: 'ফেসবুক রিলস বা ভিডিও পোস্টের ৩ ডট মেনু বা শেয়ার অপশন থেকে লিঙ্ক কপি করুন।',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    badge: 'Crisp MP4',
    color: 'from-slate-700 to-slate-900',
    bgGlow: 'shadow-slate-500/10 border-slate-600/40',
    iconText: '𝕏 Twitter',
    exampleUrl: 'https://x.com/user/status/...',
    guideTextBn: 'টুইট বা X পোস্টের শেয়ার আইকন থেকে "Copy link to post" কপি করে পেস্ট করুন।',
  },
];

export function SocialQuickMode({
  onStartDownload,
  onOpenAudioCutter,
  isDownloading = false,
}: SocialQuickModeProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformPreset['id']>('tiktok');
  const [inputUrl, setInputUrl] = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Auto-detect platform from URL input
  useEffect(() => {
    const lower = inputUrl.toLowerCase();
    if (lower.includes('tiktok.com')) setSelectedPlatform('tiktok');
    else if (lower.includes('instagram.com')) setSelectedPlatform('instagram');
    else if (lower.includes('youtube.com/shorts') || lower.includes('youtu.be')) setSelectedPlatform('shorts');
    else if (lower.includes('facebook.com') || lower.includes('fb.watch')) setSelectedPlatform('facebook');
    else if (lower.includes('twitter.com') || lower.includes('x.com')) setSelectedPlatform('twitter');
  }, [inputUrl]);

  const currentPlatform = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0];

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text.trim());
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleDownloadVideo = () => {
    if (!inputUrl.trim()) return;
    onStartDownload(inputUrl.trim(), {
      type: 'video',
      quality: 'best',
      format: 'mp4',
    });
  };

  const handleDownloadAudio = () => {
    if (!inputUrl.trim()) return;
    onStartDownload(inputUrl.trim(), {
      type: 'audio',
      quality: 'best',
      format: 'mp3',
    });
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Platform Selector Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PLATFORMS.map((p) => {
          const isSelected = selectedPlatform === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer border ${
                isSelected
                  ? `bg-slate-900 border-cyan-500 text-white shadow-lg ${p.bgGlow}`
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span>{p.iconText}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-500'
              }`}>
                {p.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Social Input Box */}
      <div className="bg-slate-900/90 border border-slate-800/90 hover:border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Decorative corner glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Header info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {currentPlatform.name} স্পেশাল ডাউনলোডার
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-semibold">
                  {currentPlatform.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {currentPlatform.guideTextBn}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <ShieldCheck className="w-4 h-4" />
              <span>১০০% আসল কোয়ালিটি</span>
            </div>
          </div>

          {/* URL Input Bar */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder={`Paste ${currentPlatform.name} link here (e.g. ${currentPlatform.exampleUrl})`}
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 rounded-2xl py-4 pl-4 pr-32 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all"
              />

              <div className="absolute right-2 flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
                  title="Paste from clipboard"
                >
                  {pasteSuccess ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Pasted!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>পেস্ট করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Instant Action Presets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* 1. Video HD No Watermark */}
            <button
              type="button"
              onClick={handleDownloadVideo}
              disabled={!inputUrl.trim() || isDownloading}
              className="p-4 bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-2 group transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:cursor-not-allowed border border-cyan-400/30"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold">🎬 HD Video (No Watermark)</div>
                <div className="text-[11px] text-cyan-100 opacity-90">ওয়াটারমার্ক ছাড়া সেরা রেজ্যুলেশন</div>
              </div>
            </button>

            {/* 2. MP3 Audio Extract */}
            <button
              type="button"
              onClick={handleDownloadAudio}
              disabled={!inputUrl.trim() || isDownloading}
              className="p-4 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/50 disabled:opacity-50 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-2 group transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Music className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">🎵 অডিও গান (MP3 320k)</div>
                <div className="text-[11px] text-slate-400">শুধু ব্যাকগ্রাউন্ড মিউজিক বা সাউন্ড</div>
              </div>
            </button>

            {/* 3. Send to Ringtone Cutter */}
            <button
              type="button"
              onClick={() => onOpenAudioCutter(inputUrl.trim())}
              className="p-4 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-2 group transition-all shadow-sm cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scissors className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100">✂️ রিংটোন কাটার (Trim)</div>
                <div className="text-[11px] text-slate-400">নির্দিষ্ট অংশ কেটে রিংটোন বানান</div>
              </div>
            </button>
          </div>

          {/* Quick tips footer */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 flex items-start space-x-2 text-[11px] text-slate-400">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-300">টিপস: </strong>
              ভিডিওর লিঙ্ক পেস্ট করলেই সিস্টেম নিজে থেকেই টিকটক, ইনস্টাগ্রাম বা ইউটিউব চিনে নেবে। সরাসরি ডাউনলোড বাটন চাপলেই ব্রাউজার বা ফোনে সেভ শুরু হয়ে যাবে।
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
