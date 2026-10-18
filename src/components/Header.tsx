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

        <div className="flex items-center space-x-2 sm:space-x-2.5">
          {/* Network Status - only displayed when offline */}
          {!isOnline && (
            <div
              id="network-status-indicator"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-md animate-pulse"
              title="Network Offline"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-[11px] font-semibold">Offline</span>
            </div>
          )}

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

