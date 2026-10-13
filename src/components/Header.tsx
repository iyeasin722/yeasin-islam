import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Zap,
  Lock,
  Bug,
  LogIn,
  LogOut,
  History,
  User as UserIcon,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Download,
  Film,
  ListPlus,
  Sparkles,
  Send,
  Database,
  ChevronDown,
  MoreHorizontal,
  Cookie,
  ExternalLink,
  Keyboard,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppNavMode } from '../types';

interface HeaderProps {
  onOpenErrorTest?: () => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenHistory: () => void;
  onOpenSettings: (tab?: 'general' | 'cookies' | 'diagnostics' | 'telegram' | 'data') => void;
  onOpenStickerMaker?: () => void;
  onOpenShortcuts?: () => void;
  historyCount: number;
  currentMode?: AppNavMode;
  onModeChange?: (mode: AppNavMode) => void;
  batchCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenErrorTest,
  user,
  onLogin,
  onLogout,
  onOpenHistory,
  onOpenSettings,
  onOpenStickerMaker,
  onOpenShortcuts,
  historyCount,
  currentMode,
  onModeChange,
  batchCount = 0,
}) => {
  const [cookieStatus, setCookieStatus] = useState<{
    hasCookies: boolean;
    hasYouTubeSID?: boolean;
    hasYouTubeLoginInfo?: boolean;
  } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/cookies/status');
        if (res.ok) {
          const data = await res.json();
          setCookieStatus(data);
        }
      } catch {}
    };
    checkAuth();
    const interval = setInterval(checkAuth, 10000);
    return () => clearInterval(interval);
  }, []);

  const isYtConnected = Boolean(
    cookieStatus?.hasCookies && (cookieStatus.hasYouTubeLoginInfo || cookieStatus.hasYouTubeSID)
  );
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState<boolean>(false);

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone
      ) {
        setIsAppInstalled(true);
      }

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsAppInstalled(true);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  // "More" Dropdown Menu state & click outside listener
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    if (isMoreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowRestoredNotice(true);
        const timer = setTimeout(() => {
          setShowRestoredNotice(false);
          setWasOffline(false);
        }, 4000);
        return () => clearTimeout(timer);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowRestoredNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleManualCheck = () => {
    if (typeof navigator !== 'undefined') {
      const current = navigator.onLine;
      setIsOnline(current);
      if (current && wasOffline) {
        setShowRestoredNotice(true);
        setTimeout(() => {
          setShowRestoredNotice(false);
          setWasOffline(false);
        }, 4000);
      }
    }
  };

  return (
    <header className="w-full max-w-[100vw] overflow-x-hidden border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative group">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-500/50 shadow-lg shadow-orange-500/25 bg-black flex items-center justify-center p-0.5">
              <img
                src="/logo.jpg"
                alt="FluxLoad Logo"
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-300 pointer-events-none -z-10" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <span>FluxLoad</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 font-semibold border border-amber-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-amber-400 font-semibold tracking-wide flex items-center gap-1">
              <span>power by YEASIN</span>
            </p>
          </div>
        </div>

        {/* Navigation Mode Switcher */}
        {onModeChange && (
          <nav className="hidden md:flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 gap-1 shadow-inner">
            <button
              type="button"
              onClick={() => onModeChange('single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                currentMode === 'single'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Single URL</span>
            </button>
            <button
              type="button"
              onClick={() => onModeChange('batch')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer relative ${
                currentMode === 'batch'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Multiple Download</span>
              {batchCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-400 text-slate-950 font-bold">
                  {batchCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('social')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                currentMode === 'social'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                  : 'text-slate-400 hover:text-pink-300 hover:bg-slate-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Social Reels</span>
            </button>
          </nav>
        )}

        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Network Status Dot (ultra compact) */}
          <div
            id="network-status-indicator"
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium transition-all ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-md animate-pulse'
            }`}
            title={isOnline ? 'Network Online' : 'Network Offline'}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'}`} />
            <span className="hidden sm:inline text-[11px] font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Download History Button (Quick Access) */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="relative flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-xl text-xs font-medium transition-colors shadow-sm cursor-pointer"
            title="Download History (Shortcut: Ctrl + H / ⌘H)"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
            <kbd className="hidden lg:inline text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-700/80 px-1 py-0.2 rounded ml-0.5">
              Ctrl+H
            </kbd>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-slate-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-xs font-medium text-slate-200 hidden md:inline max-w-[85px] truncate">
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}

          {/* THE MORE (আরও) DROPDOWN BUTTON */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isMoreOpen
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                  : 'bg-slate-800/90 hover:bg-slate-750 hover:border-slate-600 text-slate-200 hover:text-white border-slate-700 shadow-sm'
              }`}
              title="More features, channels, cookies & tools (আরও অপশন)"
            >
              <MoreHorizontal className="w-4 h-4 text-cyan-400" />
              <span>More (আরও)</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMoreOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* DROPDOWN MENU POPOVER */}
            {isMoreOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 divide-y divide-slate-800 text-xs backdrop-blur-2xl">
                {/* Section 1: Telegram & Community */}
                <div className="pb-2 space-y-1">
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-2 pt-1 flex items-center justify-between">
                    <span>টেলিগ্রাম ও চ্যানেল</span>
                    <Send className="w-3 h-3 text-sky-400" />
                  </div>
                  <a
                    href="https://t.me/FluxLoad"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMoreOpen(false)}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-sky-500/15 text-slate-200 hover:text-sky-300 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-sky-400 -rotate-12" />
                      <div>
                        <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                          <span>Join @FluxLoad</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Official</span>
                        </div>
                        <div className="text-[10px] text-slate-400">অফিশিয়াল কমিউনিটি চ্যানেল</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings('telegram');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                        <Send className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-100">Telegram Bot & Channels</div>
                        <div className="text-[10px] text-slate-400">বট ও ৫টি চ্যানেলে অটো-পোস্ট পরিচালনা</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                      সক্রিয়
                    </span>
                  </button>

                  {onOpenStickerMaker && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenStickerMaker();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-slate-100">Logo & Sticker Maker</div>
                          <div className="text-[10px] text-slate-400">512x512 টেলিগ্রাম স্টিকার স্টুডিও</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">512px</span>
                    </button>
                  )}
                </div>

                {/* Section 2: Cookies & Authentication */}
                <div className="py-2 space-y-1">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider px-2 flex items-center justify-between">
                    <span>কুকিজ ও কানেকশন</span>
                    <Cookie className="w-3 h-3 text-cyan-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings('cookies');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                        <Cookie className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-100">YouTube Cookies</div>
                        <div className="text-[10px] text-slate-400">
                          {isYtConnected ? 'YouTube কানেক্টেড আছে' : 'ক্লাউড ডাউনলোডের জন্য কুকিজ দিন'}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      isYtConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {isYtConnected ? '✓ Connected' : 'Add Cookies'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings('cookies');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
                        <Cookie className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-100">Instagram Cookies</div>
                        <div className="text-[10px] text-slate-400">ইনস্টাগ্রাম রিলস ও পোস্ট সেশন</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Section 3: Devices, Backup & App */}
                <div className="py-2 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 flex items-center justify-between">
                    <span>ডিভাইস ও ব্যাকআপ</span>
                    <Database className="w-3 h-3 text-emerald-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings('data');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-100">সব ডাটা সেভ ও ব্যাকআপ</div>
                        <div className="text-[10px] text-slate-400">ডাটা এক্সপোর্ট, ইমপোর্ট ও ক্লাউড সেভ</div>
                      </div>
                    </div>
                  </button>

                  {!isAppInstalled && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        handleInstallApp();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-cyan-500/15 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <Download className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-slate-100">Install FluxLoad App</div>
                          <div className="text-[10px] text-slate-400">ফোন বা কম্পিউটারে অ্যাপ ইনস্টল করুন</div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                        PWA
                      </span>
                    </button>
                  )}
                </div>

                {/* Section 4: Settings & Diagnostics */}
                <div className="pt-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center justify-between">
                    <span>সিস্টেম সেটিংস</span>
                    <Settings className="w-3 h-3 text-slate-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreOpen(false);
                      onOpenSettings('general');
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                        <Settings className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-100">Settings</div>
                        <div className="text-[10px] text-slate-400">ডাউনলোড কনফিগারেশন ও থিম</div>
                      </div>
                    </div>
                    <kbd className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-700">
                      Ctrl+S
                    </kbd>
                  </button>

                  {onOpenShortcuts && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenShortcuts();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-cyan-500/10 text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                          <Keyboard className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-slate-100">Keyboard Shortcuts</div>
                          <div className="text-[10px] text-slate-400">কিবোর্ড শর্টকাট গাইড ও পাওয়ার কি</div>
                        </div>
                      </div>
                      <kbd className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                        ?
                      </kbd>
                    </button>
                  )}

                  {onOpenErrorTest && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        onOpenErrorTest();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-amber-500/15 text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                          <Bug className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-slate-100">Test Errors</div>
                          <div className="text-[10px] text-slate-400">এরর হ্যান্ডলিং ডায়াগনস্টিক টেস্ট</div>
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert when connection is lost */}
      {!isOnline && (
        <div
          id="offline-alert-banner"
          role="alert"
          className="w-full bg-rose-950/95 border-t border-b border-rose-500/40 px-4 py-2 text-xs text-rose-200 shadow-lg shadow-rose-950/50 transition-all"
        >
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5">
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
              <div>
                <span className="font-bold text-rose-100 mr-1.5">Connection Lost:</span>
                <span className="text-rose-200/90">
                  Your device is offline. Video analysis, media streaming, and downloads will resume automatically when reconnected.
                </span>
              </div>
            </div>
            <button
              onClick={handleManualCheck}
              className="flex items-center space-x-1.5 px-3 py-1 bg-rose-900/80 hover:bg-rose-800 border border-rose-500/50 rounded-lg text-[11px] font-semibold text-rose-100 transition-colors shrink-0 shadow-sm"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Notice when connection is restored */}
      {isOnline && showRestoredNotice && (
        <div
          id="online-restored-banner"
          role="status"
          className="w-full bg-emerald-950/90 border-t border-b border-emerald-500/30 px-4 py-1.5 text-xs text-emerald-200 shadow-sm transition-all"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-emerald-100">Connection Restored:</span>
            <span>You are back online. Ready to download and analyze media.</span>
          </div>
        </div>
      )}
    </header>
  );
};

