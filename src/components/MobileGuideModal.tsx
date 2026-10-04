import React, { useState } from 'react';
import {
  Smartphone,
  X,
  ShieldAlert,
  Download,
  Apple,
  Globe,
  HelpCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Share2,
} from 'lucide-react';

interface MobileGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileGuideModal: React.FC<MobileGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicShareUrl = currentOrigin.includes('ais-dev-')
    ? currentOrigin.replace('ais-dev-', 'ais-pre-')
    : currentOrigin || 'https://ais-pre-iadmvxsjcvmxle664s7hd4-634228146758.asia-southeast1.run.app';

  const handleCopyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-xl max-h-[90vh] rounded-3xl p-5 sm:p-6 shadow-2xl shadow-cyan-950/60 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'bn' ? 'ফোনে ব্যবহারের সমাধান ও গাইড' : 'Mobile Troubleshooting Guide'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'bn' ? 'স্মার্টফোনে ভিডিও ডাউনলোড ও প্রিভিউ সংক্রান্ত সহায়িকা' : 'How to download & stream videos smoothly on mobile phones'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`px-2 py-1 rounded-md font-semibold transition-all ${
                  lang === 'bn' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md font-semibold transition-all ${
                  lang === 'en' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto pr-1 py-4 space-y-4 text-xs sm:text-sm text-slate-300">
          {/* Issue 1: "Action required" Google Security Cookie */}
          <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? '১. ফোনে "Action required: Grant permission" বা কুকি সমস্যা'
                  : '1. "Action required: Grant permission" Security Cookie Prompt'}
              </span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              {lang === 'bn'
                ? 'গুগল এআই স্টুডিও ক্লাউড রান সিকিউরিটি পলিসির কারণে ফোন বা ক্যামেরা স্ক্যানারে প্রথমবার ওপেন করলে "Action required: Grant permission for the required security cookie" দেখা দেয়।'
                : 'Google AI Studio Cloud Run enforces identity and cookie verification. When scanning with a phone camera or in-app browser, Google displays an "Action required" prompt.'}
            </p>
            <div className="bg-slate-950/70 rounded-xl p-3 border border-amber-500/20 space-y-2 text-xs">
              <p className="font-semibold text-amber-300">
                {lang === 'bn' ? 'কীভাবে সমাধান করবেন:' : 'How to fix in 10 seconds:'}
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                <li>
                  {lang === 'bn'
                    ? 'ক্যামেরার ভেতরের ব্রাউজার এড়িয়ে সরাসরি Chrome বা Safari ব্রাউজার ওপেন করুন।'
                    : 'Avoid in-app QR viewers. Open the link directly in Chrome or Safari.'}
                </li>
                <li>
                  {lang === 'bn'
                    ? 'স্ক্রিনে "Grant permission" বা "Continue" বাটনে ট্যাপ করুন এবং গুগল অ্যাকাউন্টে সাইন ইন করুন।'
                    : 'Tap "Grant permission" on the Google prompt to allow the required session cookie.'}
                </li>
                <li>
                  {lang === 'bn'
                    ? 'অথবা পাবলিক শেয়ার্ড লিংক ব্যবহার করুন যা সরাসরি যে কারো ফোনে চলে।'
                    : 'Or use the Public Share URL which opens without developer session restrictions.'}
                </li>
              </ul>
            </div>
          </div>

          {/* Public Share Link Card */}
          <div className="bg-slate-950/60 border border-cyan-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5 text-xs">
                <Globe className="w-4 h-4" />
                {lang === 'bn' ? 'ফোনে ব্যবহারের জন্য পাবলিক লিংক' : 'Public App Link for Mobile'}
              </span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                Public Shareable
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl p-2 font-mono text-xs text-slate-300">
              <input
                type="text"
                readOnly
                value={publicShareUrl}
                className="bg-transparent flex-1 outline-none text-slate-300 truncate"
              />
              <button
                type="button"
                onClick={handleCopyPublicUrl}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-sans font-semibold text-xs transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedLink ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Issue 2: iPhone / iOS Safari Download Guide */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
              <Apple className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? '২. আইফোন (iPhone / iOS Safari) এ ভিডিও সেভ করার নিয়ম'
                  : '2. Saving Videos on iPhone (iOS Safari)'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p>
                {lang === 'bn'
                  ? '১. ভিডিও ডাউনলোড শেষ হলে "ফোনে ডাউনলোড করুন" বাটনে ক্লিক করুন।'
                  : '1. Once downloaded on the server, tap "Download to Phone".'}
              </p>
              <p>
                {lang === 'bn'
                  ? '২. সাফারিতে "Do you want to download...?" পপ-আপ আসলে "Download" এ ট্যাপ করুন।'
                  : '2. When Safari asks "Do you want to download...?", tap "Download".'}
              </p>
              <p>
                {lang === 'bn'
                  ? '৩. ভিডিওটি আইফোনের Files অ্যাপে সেভ হবে। ফটোস (Photos) অ্যাপে নিতে Files এ গিয়ে ভিডিওর Share আইকন চেপে "Save Video" চাপুন।'
                  : '3. Video is stored in your iOS Files app > Downloads. To move it to Camera Roll / Photos, open it in Files, tap Share icon, and select "Save Video".'}
              </p>
              <p>
                {lang === 'bn'
                  ? '৪. বিকল্প: "Open in Browser" এ চাপলে ভিডিওটি সরাসরি ব্রাউজারে চলবে।'
                  : '4. Alternative: Tap "Open in Browser" to play full-screen instantly.'}
              </p>
            </div>
          </div>

          {/* Issue 3: Android Chrome Guide */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? '৩. অ্যান্ড্রয়েড (Android Chrome) এ সরাসরি ডাউনলোড'
                  : '3. Android (Google Chrome) Downloads'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p>
                {lang === 'bn'
                  ? '১. ডাউনলোড শেষ হলে "ফোনে ডাউনলোড করুন" বাটনে ট্যাপ করলেই ক্রোম সরাসরি নোটিফিকেশন বারে ডাউনলোড শুরু করে।'
                  : '1. Tap "Download to Phone", Chrome immediately starts downloading to your notification bar and Downloads folder.'}
              </p>
              <p>
                {lang === 'bn'
                  ? '২. যদি কোনো কারণে অটো-ডাউনলোড না হয়, "Open in New Tab" এ গিয়ে ভিডিওর ওপর ২ সেকেন্ড চেপে ধরুন (Long Press), তারপর "Download video" চাপুন।'
                  : '2. If download fails, tap "Open in New Tab", long-press the playing video and tap "Download video".'}
              </p>
            </div>
          </div>

          {/* Issue 4: Mobile Clipboard Paste */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'bn'
                  ? '৪. ফোনে লিংক পেস্ট (Paste) করার সহজ উপায়'
                  : '4. Pasting URLs on Mobile Phones'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {lang === 'bn'
                ? 'ফোনে অনেক সময় ব্রাউজারের সিকিউরিটি পারমিশনের কারণে "Paste from Clipboard" বাটন সরাসরি কাজ না করলে ইনপুট বক্সে আঙুল দিয়ে চেপে ধরে (Long Press) রাখুন, তারপর ভেসে ওঠা "Paste" অপশনে ক্লিক করুন।'
                : 'If the browser blocks clipboard access, simply long-press inside the URL input box on your phone and tap "Paste".'}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <a
            href={publicShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
          >
            <span>{lang === 'bn' ? 'পাবলিক শেয়ার লিংকে যান' : 'Open Public Share Link'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-colors"
          >
            {lang === 'bn' ? 'বুঝেছি / ঠিক আছে' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
