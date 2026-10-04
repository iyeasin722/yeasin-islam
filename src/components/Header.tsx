import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { User } from 'firebase/auth';
import { AppNavMode } from '../types';

interface HeaderProps {
  onOpenErrorTest?: () => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenHistory: () => void;
  onOpenSettings: (tab?: 'general' | 'cookies' | 'diagnostics') => void;
  onOpenMobileGuide?: () => void;
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
  onOpenMobileGuide,
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
    } else if (onOpenMobileGuide) {
      onOpenMobileGuide();
    }
  };

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
                v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Free • Private • No Ads</p>
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

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Network Status Indicator (checks navigator.onLine) */}
          <div
            id="network-status-indicator"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-md shadow-rose-950 animate-pulse'
            }`}
            title={
              isOnline
                ? 'Network Connected (navigator.onLine: true)'
                : 'Connection Lost (navigator.onLine: false) - Video downloads and link analysis are paused'
            }
          >
            <span className="relative flex h-2 w-2">
              {isOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </>
              )}
            </span>
            {isOnline ? (
              <span className="hidden sm:inline text-[11px] font-semibold text-emerald-400">Online</span>
            ) : (
              <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span>Offline</span>
              </span>
            )}
          </div>

          {/* YouTube Authentication Status */}
          <button
            onClick={() => onOpenSettings('cookies')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shadow-sm group border ${
              isYtConnected
                ? 'bg-red-950/40 hover:bg-red-900/40 border-red-500/30 text-red-300'
                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-700/60 text-slate-400'
            }`}
            title={
              isYtConnected
                ? 'YouTube Authentication: Connected (Click to manage Cookies)'
                : 'YouTube: Cookie authentication recommended for cloud downloads (Click to add cookies)'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isYtConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            ></span>
            <span className={`font-semibold ${isYtConnected ? 'text-red-200' : 'text-slate-300'}`}>
              YouTube
            </span>
            <span
              className={`text-[10px] font-mono hidden md:inline flex items-center gap-0.5 ${
                isYtConnected ? 'text-emerald-300' : 'text-amber-400/90'
              }`}
            >
              {isYtConnected ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" /> Connected
                </>
              ) : (
                'Add Cookies'
              )}
            </span>
          </button>

          {/* PWA App Install Button */}
          {!isAppInstalled && (
            <button
              onClick={handleInstallApp}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
              title="Install FluxLoad App on Phone or PC (অ্যাপ ইনস্টল করুন)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
              <span className="sm:hidden text-[10px]">ইনস্টল</span>
            </button>
          )}

          {/* Phone Guide / Mobile Troubleshooting */}
          {onOpenMobileGuide && (
            <button
              onClick={onOpenMobileGuide}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title="Mobile Troubleshooting & Download Guide (ফোনে ডাউনলোডের নির্দেশিকা)"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Phone Guide</span>
              <span className="sm:hidden text-[10px]">ফোন</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
            title="FluxLoad System Settings"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Download History Button (Always Available) */}
          <button
            onClick={onOpenHistory}
            className="relative flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors shadow-sm"
            title="View Download History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-slate-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

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

          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-200 hidden md:inline max-w-[100px] truncate">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-cyan-600/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in</span>
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-400 font-medium">
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

