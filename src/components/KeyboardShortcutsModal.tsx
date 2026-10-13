import React, { useEffect } from 'react';
import { X, Keyboard, Command, Download, History, Settings, Layers, Search, Sparkles, Send, CornerDownLeft } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  id: string;
  category: 'action' | 'navigation' | 'modes';
  keys: string[];
  title: string;
  bengaliTitle: string;
  description: string;
  icon: React.ReactNode;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘ Cmd' : 'Ctrl';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts: ShortcutItem[] = [
    {
      id: 'download',
      category: 'action',
      keys: [modKey, 'Enter ↵'],
      title: 'Start Download / Extract Media',
      bengaliTitle: 'ডাউনলোড শুরু বা প্রসেসিং ট্রিগার',
      description: 'Trigger download immediately for the current URL or start batch processing.',
      icon: <Download className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'focus-url',
      category: 'action',
      keys: [modKey, 'K'],
      title: 'Focus URL Input Box',
      bengaliTitle: 'লিংক ইনপুট বক্সে ফোকাস করুন',
      description: 'Quickly jump to and select the URL search box from anywhere on the page (or press /).',
      icon: <Search className="w-4 h-4 text-cyan-400" />,
    },
    {
      id: 'slash-focus',
      category: 'action',
      keys: ['/'],
      title: 'Quick Search / Jump to Input',
      bengaliTitle: 'ইনপুটে দ্রুত কার্সর রাখুন',
      description: 'When not typing in an input field, press / to focus the URL bar.',
      icon: <CornerDownLeft className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'history',
      category: 'navigation',
      keys: [modKey, 'H'],
      title: 'Toggle Download History',
      bengaliTitle: 'ডাউনলোড হিস্টোরি প্যানেল খুলুন',
      description: 'Open or close your download logs, saved files, and favorite media.',
      icon: <History className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'settings',
      category: 'navigation',
      keys: [modKey, 'S'],
      title: 'Open Settings & Preferences',
      bengaliTitle: 'সেটিংস ও কনফিগারেশন ওপেন করুন',
      description: 'Opens general preferences, cookies manager, smart retry, and Cloud SQL backup.',
      icon: <Settings className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'shortcuts',
      category: 'navigation',
      keys: ['?'],
      title: 'Open Shortcuts Cheat Sheet',
      bengaliTitle: 'কিবোর্ড শর্টকাট গাইড ওপেন করুন',
      description: 'Press ? (Shift + /) anywhere to view this shortcut cheat sheet (or Ctrl + /).',
      icon: <Keyboard className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'batch-mode',
      category: 'modes',
      keys: [modKey, 'B'],
      title: 'Toggle Multiple / Batch Mode',
      bengaliTitle: 'ব্যাচ ডাউনলোড মোড সুইচ করুন',
      description: 'Switch between single video mode and bulk multi-URL download mode.',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'social-mode',
      category: 'modes',
      keys: [modKey, 'M'],
      title: 'Toggle Social Reels Mode',
      bengaliTitle: 'সোশ্যাল রিলস মোডে যান',
      description: 'Quickly open dedicated Instagram, TikTok & YouTube Shorts fast downloader.',
      icon: <Sparkles className="w-4 h-4 text-pink-400" />,
    },
    {
      id: 'telegram',
      category: 'modes',
      keys: [modKey, 'Shift', 'T'],
      title: 'Telegram Bot Settings',
      bengaliTitle: 'টেলিগ্রাম বট ও চ্যানেল কনফিগার',
      description: 'Directly open Telegram auto-post and bot broadcast setup.',
      icon: <Send className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'escape',
      category: 'navigation',
      keys: ['Esc'],
      title: 'Close Modal / Cancel Operation',
      bengaliTitle: 'উইন্ডো বন্ধ করুন / ক্যানসেল',
      description: 'Closes any open modal popup, dialog, or drops focus.',
      icon: <X className="w-4 h-4 text-rose-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl text-cyan-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Keyboard Shortcuts</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30">
                  শর্টকাট
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Power user key bindings for ultra-fast media downloading & navigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Close shortcuts modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Quick Notice */}
          <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-950/40 border border-cyan-500/20 rounded-2xl text-xs text-cyan-200">
            <div className="flex items-center gap-2">
              <Command className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                পাওয়ার ইউজারদের জন্য কিবোর্ড শর্টকাট। যেকোনো সময় <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono font-bold text-cyan-300">?</kbd> বা <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono font-bold text-cyan-300">{modKey} + /</kbd> চাপলে এই উইন্ডোটি দেখতে পাবেন।
              </span>
            </div>
          </div>

          {/* Shortcuts Grid */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Actions & Fast Controls (ডাউনলোড ও নিয়ন্ত্রণ)
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {shortcuts.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 transition-all gap-2"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5 sm:mt-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">{item.title}</span>
                        <span className="text-xs text-slate-400 hidden sm:inline">• {item.bengaliTitle}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pl-10 sm:pl-0">
                    {item.keys.map((k, idx) => (
                      <React.Fragment key={idx}>
                        <kbd className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-mono font-bold text-cyan-300 shadow-inner flex items-center justify-center min-w-[28px]">
                          {k}
                        </kbd>
                        {idx < item.keys.length - 1 && (
                          <span className="text-slate-500 font-mono text-xs">+</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-300">
              Esc
            </kbd>
            <span>to close</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Got it (বুঝেছি)
          </button>
        </div>
      </div>
    </div>
  );
};
