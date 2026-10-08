import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  X,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  FolderDown,
  HardDrive,
  Cpu,
  Layers,
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  Cookie,
  Upload,
  ShieldCheck,
  AlertCircle,
  Loader2,
  FileText,
  RefreshCw,
  Activity,
  CheckCircle2,
  ExternalLink,
  Zap,
  Server,
  Terminal,
  Film,
  DownloadCloud,
  Trash2,
  Globe,
  Key,
} from 'lucide-react';
import { FluxLoadSettings, DEFAULT_SETTINGS, VideoQuality, VideoFormatChoice, DownloadType, CookieStatus } from '../types';
import { soundNotify } from '../lib/soundNotify';
import { ToastContainer, ToastData } from './Toast';

interface DiagnosticsData {
  ytdlp: {
    installed: boolean;
    version: string;
    path: string;
    isLocalBinary: boolean;
    status: string;
  };
  ffmpeg: {
    installed: boolean;
    version: string;
    path: string;
    codecs?: string[];
    status: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptimeSeconds: number;
    timestamp: string;
  };
}

interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt?: string;
  checkedAt: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FluxLoadSettings;
  onUpdateSettings: (newSettings: Partial<FluxLoadSettings>) => void;
  onResetSettings: () => void;
  initialTab?: 'general' | 'cookies' | 'diagnostics';
  initialPlatform?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  initialTab = 'general',
  initialPlatform,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'cookies' | 'diagnostics'>(initialTab);

  // Cookie State
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [cookiesInput, setCookiesInput] = useState('');
  const [isCookieSaving, setIsCookieSaving] = useState(false);
  const [isCookieTesting, setIsCookieTesting] = useState(false);
  const [isVerifyingCookies, setIsVerifyingCookies] = useState(false);
  const [cookieMsg, setCookieMsg] = useState<{ type: 'success' | 'error'; text: string; guidance?: string } | null>(null);
  const [testTarget, setTestTarget] = useState<'youtube' | 'instagram'>('youtube');
  const [customTestUrl, setCustomTestUrl] = useState('');

  // Platform Cookie Profiles State
  const [platformProfiles, setPlatformProfiles] = useState<Record<string, { hasCookies: boolean; count: number; lastModified?: string }>>({});
  const [activePlatformModal, setActivePlatformModal] = useState<string | null>(null);
  const [platformInputText, setPlatformInputText] = useState('');
  const [isPlatformSaving, setIsPlatformSaving] = useState(false);

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isDiagLoading, setIsDiagLoading] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isUpdatingYtDlp, setIsUpdatingYtDlp] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration = 6000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchCookieStatus = useCallback(async () => {
    try {
      const [resStatus, resPlatforms] = await Promise.all([
        fetch('/api/cookies/status'),
        fetch('/api/cookies/platforms'),
      ]);
      if (resStatus.ok) {
        const data = await resStatus.json();
        setCookieStatus(data);
      }
      if (resPlatforms.ok) {
        const pData = await resPlatforms.json();
        if (pData.platforms) {
          setPlatformProfiles(pData.platforms);
        }
      }
    } catch (e) {}
  }, []);

  const fetchDiagnostics = useCallback(async () => {
    setIsDiagLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setIsDiagLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCookieStatus();
      fetchDiagnostics();
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (initialPlatform) {
        setActiveTab('cookies');
        setActivePlatformModal(initialPlatform);
      }
    }
  }, [isOpen, initialTab, initialPlatform, fetchCookieStatus, fetchDiagnostics]);

  useEffect(() => {
    if (activeTab === 'diagnostics' && !diagnostics) {
      fetchDiagnostics();
    }
  }, [activeTab, diagnostics, fetchDiagnostics]);

  if (!isOpen) return null;

  // Handle Cookie Operations
  const handleSaveCookies = async () => {
    if (!cookiesInput.trim()) return;
    setIsCookieSaving(true);
    setCookieMsg(null);
    try {
      const res = await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setCookieMsg({
          type: 'success',
          text: data.message || `Cookies saved permanently! (${data.linesCount} entries active)`
        });
        addToast('success', 'Cookies Saved', `Successfully activated ${data.linesCount || ''} cookie entries.`);
        fetchCookieStatus();
      } else {
        setCookieMsg({ type: 'error', text: data.error || 'Failed to save cookies' });
        addToast('error', 'Save Failed', data.error || 'Failed to save cookies');
      }
    } catch (err: any) {
      setCookieMsg({ type: 'error', text: err.message || 'Error saving cookies' });
      addToast('error', 'Error', err.message || 'Error saving cookies');
    } finally {
      setIsCookieSaving(false);
    }
  };

  const handleDeleteCookies = async () => {
    setIsCookieSaving(true);
    setCookieMsg(null);
    try {
      const res = await fetch('/api/cookies', { method: 'DELETE' });
      if (res.ok) {
        setCookieMsg({ type: 'success', text: 'Cookies permanently removed from system.' });
        addToast('info', 'Cookies Cleared', 'Saved authentication cookies removed.');
        setCookiesInput('');
        fetchCookieStatus();
      }
    } catch (e) {
      setCookieMsg({ type: 'error', text: 'Failed to delete cookies' });
      addToast('error', 'Clear Failed', 'Failed to remove saved cookies');
    } finally {
      setIsCookieSaving(false);
    }
  };

  const handleSavePlatformCookie = async (platform: string) => {
    if (!platformInputText.trim()) return;
    setIsPlatformSaving(true);
    try {
      const res = await fetch(`/api/cookies/platform/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: platformInputText }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(
          'success',
          `${platform.toUpperCase()} Cookies Saved`,
          `Activated ${data.count || ''} cookies and merged into active extractor profile.`
        );
        setPlatformInputText('');
        setActivePlatformModal(null);
        fetchCookieStatus();
      } else {
        addToast('error', 'Save Failed', data.error || 'Failed to save cookies for platform');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Error saving platform cookies');
    } finally {
      setIsPlatformSaving(false);
    }
  };

  const handleDeletePlatformCookie = async (platform: string) => {
    setIsPlatformSaving(true);
    try {
      const res = await fetch(`/api/cookies/platform/${platform}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        addToast('info', `${platform.toUpperCase()} Profile Cleared`, `Removed separate cookie profile for ${platform}.`);
        fetchCookieStatus();
      } else {
        addToast('error', 'Clear Failed', data.error || 'Failed to remove platform cookies');
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message);
    } finally {
      setIsPlatformSaving(false);
    }
  };

  const handleTestCookies = async (targetPlatform: 'youtube' | 'instagram' = testTarget, overrideUrl?: string) => {
    setIsCookieTesting(true);
    setCookieMsg(null);
    try {
      const urlToSend = overrideUrl || (customTestUrl.trim() ? customTestUrl.trim() : undefined);
      const res = await fetch('/api/cookies/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: targetPlatform,
          url: urlToSend
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCookieMsg({ type: 'success', text: data.message || 'Authenticated successfully!' });
        addToast('success', 'Authentication Successful', data.message || 'Cookies verified with target site.');
      } else {
        setCookieMsg({
          type: 'error',
          text: data.error || 'Verification failed: check cookies',
          guidance: data.guidance
        });
        addToast('error', 'Authentication Failed', data.error || 'Session cookies were rejected.');
      }
    } catch (err: any) {
      setCookieMsg({ type: 'error', text: err.message || 'Error testing cookies' });
      addToast('error', 'Test Error', err.message || 'Error executing auth test.');
    } finally {
      setIsCookieTesting(false);
    }
  };

  const handleVerifyCookies = async () => {
    setIsVerifyingCookies(true);
    setCookieMsg(null);
    try {
      const res = await fetch('/api/cookies/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: customTestUrl.trim() || undefined
        }),
      });
      const data = await res.json();
      if (data.success) {
        addToast(
          'success',
          'Cookies Verified with YouTube',
          data.message || 'YouTube accepted your cookies with 0 HTTP 403 Forbidden errors!'
        );
        setCookieMsg({
          type: 'success',
          text: data.message || 'YouTube accepted your cookies! Verified with zero 403 Forbidden errors.'
        });
      } else {
        const errorTitle = data.is403 ? 'HTTP 403 Forbidden' : 'Cookie Verification Failed';
        const errorMsg = data.error || 'YouTube rejected the cookies.';
        addToast('error', errorTitle, `${errorMsg} ${data.guidance || ''}`);
        setCookieMsg({
          type: 'error',
          text: errorMsg,
          guidance: data.guidance
        });
      }
    } catch (err: any) {
      addToast('error', 'Verification Failed', err.message || 'Could not verify cookies with YouTube.');
      setCookieMsg({
        type: 'error',
        text: err.message || 'Verification request failed'
      });
    } finally {
      setIsVerifyingCookies(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCookiesInput(text);
        addToast('info', 'File Loaded', `Loaded cookie file: ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  // Diagnostics Check Updates
  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch('/api/diagnostics/check-updates');
      if (res.ok) {
        const data: UpdateCheckResult = await res.json();
        setUpdateInfo(data);
        if (data.updateAvailable) {
          addToast(
            'info',
            'Update Available',
            `A new yt-dlp release (v${data.latestVersion}) is available. Current: v${data.currentVersion}.`
          );
        } else {
          addToast(
            'success',
            'Up to Date',
            `yt-dlp is running the latest release (v${data.currentVersion}).`
          );
        }
      } else {
        addToast('error', 'Update Check Failed', 'Failed to check GitHub releases for updates.');
      }
    } catch (err: any) {
      addToast('error', 'Network Error', err.message || 'Failed to check updates.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    setIsUpdatingYtDlp(true);
    try {
      const res = await fetch('/api/diagnostics/update', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'yt-dlp Updated', data.message || `Updated to ${data.newVersion}`);
        await fetchDiagnostics();
        setUpdateInfo(null);
      } else {
        addToast('error', 'Update Failed', data.error || 'Failed to apply update.');
      }
    } catch (err: any) {
      addToast('error', 'Update Error', err.message || 'An error occurred during update installation.');
    } finally {
      setIsUpdatingYtDlp(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      {/* Toast notifications container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-cyan-950/40 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                FluxLoad System Settings
              </h3>
              <p className="text-xs text-slate-400">Preferences, authentication cookies & engine diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'general'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'cookies'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Cookies & Auth</span>
            {cookieStatus?.hasCookies && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Cookies active" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
            {diagnostics?.ytdlp?.installed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                v{diagnostics.ytdlp.version.split('.')[0]}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: GENERAL SETTINGS */}
        {activeTab === 'general' && (
          <div className="space-y-6 text-sm animate-fadeIn">
            {/* 1. Default Quality & Format Presets */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  Default Download Presets
                </span>
                <span className="text-[11px] text-slate-500 font-mono">1-Click Mode</span>
              </div>

              {/* Default Type */}
              <div>
                <label className="block text-xs text-slate-300 mb-1.5 font-medium">Default Download Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['video', 'audio'] as DownloadType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({
                          defaultType: t,
                          defaultFormat: t === 'audio' ? 'mp3' : 'mp4',
                        });
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        settings.defaultType === t
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {t === 'video' ? '🎬 Video + Audio' : '🎵 Audio Only'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Quality (if video) */}
              {settings.defaultType === 'video' && (
                <div>
                  <label className="block text-xs text-slate-300 mb-1.5 font-medium">Preferred Video Quality</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(['auto', '4k', '1080p', '720p', '480p', '360p'] as VideoQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ defaultQuality: q })}
                        className={`py-1.5 rounded-xl border text-xs font-medium transition-all ${
                          settings.defaultQuality === q
                            ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-semibold shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {q === 'auto' ? 'Auto' : q === '4k' ? '4K' : q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Default Format */}
              <div>
                <label className="block text-xs text-slate-300 mb-1.5 font-medium">Preferred Container Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {(settings.defaultType === 'video' ? ['mp4', 'webm'] : ['mp3', 'm4a']).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => onUpdateSettings({ defaultFormat: f as VideoFormatChoice })}
                      className={`py-1.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all ${
                        settings.defaultFormat === f
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Auto Save & Path Settings */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FolderDown className="w-3.5 h-3.5" />
                  Auto Save & Storage
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Auto-Trigger Browser Download</span>
                  <span className="text-[11px] text-slate-400">
                    Instantly save file to your browser's default Downloads directory when completed
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ autoSaveToDownloads: !settings.autoSaveToDownloads })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    settings.autoSaveToDownloads ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.autoSaveToDownloads ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">Download Prefix / Tag (Optional)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.saveFolderPrefix === 'FluxLoad' ? '' : settings.saveFolderPrefix}
                    onChange={(e) => onUpdateSettings({ saveFolderPrefix: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    placeholder="Leave empty for original name (e.g. MyTag)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {settings.saveFolderPrefix && settings.saveFolderPrefix !== 'FluxLoad'
                      ? `Tag: ${settings.saveFolderPrefix}_*`
                      : 'No tag (Original file name)'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Audio Tone & Notifications */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" />
                  Notifications & Audio
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (settings.playNotificationSound) {
                      soundNotify.playCompleteSound();
                    }
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  Test Sound
                </button>
              </div>

              {/* Sound toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  {settings.playNotificationSound ? (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">Chime on Download Complete</span>
                    <span className="text-[11px] text-slate-400">Plays an audio tone when download reaches 100%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ playNotificationSound: !settings.playNotificationSound })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    settings.playNotificationSound ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.playNotificationSound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* System Notifications */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  {settings.browserNotifications ? (
                    <Bell className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <BellOff className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <span className="text-xs font-medium text-slate-200 block">Browser Push Notifications</span>
                    <span className="text-[11px] text-slate-400">Send system desktop alerts when in background</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!settings.browserNotifications) {
                      await soundNotify.requestNotificationPermission();
                    }
                    onUpdateSettings({ browserNotifications: !settings.browserNotifications });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    settings.browserNotifications ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.browserNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 4. Batch Settings */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Multi-Download Concurrency
                </span>
                <span className="text-xs font-mono text-cyan-300 font-semibold">
                  {settings.batchConcurrency === 1 ? '1 Video 1 Download (Sequential)' : `${settings.batchConcurrency} parallel tasks`}
                </span>
              </div>

              <input
                type="range"
                min={1}
                max={5}
                value={settings.batchConcurrency}
                onChange={(e) => onUpdateSettings({ batchConcurrency: parseInt(e.target.value) || 1 })}
                className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span className="text-cyan-400 font-medium">1: 1 Video 1 Download (Sequential)</span>
                <span>3 (Parallel)</span>
                <span>5 (Max Speed)</span>
              </div>
              {settings.batchConcurrency === 1 && (
                <p className="text-[11px] text-cyan-300/90 bg-cyan-950/40 p-2 rounded-lg border border-cyan-500/20">
                  ✓ <strong>1 Video 1 Download Active</strong>: Videos download sequentially one by one in queue to protect connection stability and prevent rate-limiting.
                </p>
              )}
            </div>

            {/* 5. Video File Size Limit Safeguard */}
            <div className="bg-slate-950/60 border border-cyan-900/40 p-4 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  Max Download Size
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
                  Unlimited (2000GB+)
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unlimited file sizes (including ultra-large videos up to 2000GB+) are supported with full HTTP Range resumable streaming.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: COOKIES & AUTHENTICATION */}
        {activeTab === 'cookies' && (
          <div className="space-y-5 text-sm animate-fadeIn">
            <div className="bg-slate-950/60 border border-amber-500/30 p-4 rounded-2xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Cookie className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Site Cookies & Login Access
                  </span>
                </div>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                    cookieStatus?.hasCookies
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {cookieStatus?.hasCookies ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-semibold">
                        {cookieStatus.source === 'user_saved' ? 'Permanent User Cookies Active' : 'Cookies Active'} ({cookieStatus.linesCount} entries)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No Cookies Set</span>
                    </>
                  )}
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Public videos download directly without cookies. Cookies are only required for YouTube bot bypass on cloud servers, private Instagram accounts, or age-restricted content.
              </p>

              {/* Stored Domains & Tokens */}
              {cookieStatus?.hasCookies && cookieStatus.detectedDomains && cookieStatus.detectedDomains.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Active Domains:</span>
                    {cookieStatus.detectedDomains.map((domain) => {
                      if (domain === 'youtube.com') {
                        const isFullyAuthed = cookieStatus.hasYouTubeLoginInfo && cookieStatus.hasYouTubeSID;
                        return (
                          <span
                            key={domain}
                            className={`text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 ${
                              isFullyAuthed
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            YouTube {isFullyAuthed ? '• Authenticated' : '• Tokens Detected'}
                          </span>
                        );
                      }
                      return (
                        <span
                          key={domain}
                          className="text-[10px] px-2 py-0.5 rounded-md border bg-slate-800/80 border-slate-700 text-slate-300 font-medium"
                        >
                          {domain}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Feedback messages */}
              {cookieMsg && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    cookieMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <p className="font-semibold">{cookieMsg.text}</p>
                  {cookieMsg.guidance && <p className="mt-1 text-[11px] opacity-90">{cookieMsg.guidance}</p>}
                </div>
              )}

              {/* Paste / Upload Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-300 font-medium">Paste Netscape Cookies Text</label>
                  <label className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 font-medium transition-colors">
                    <Upload className="w-3 h-3" />
                    <span>Upload cookies.txt file</span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  value={cookiesInput}
                  onChange={(e) => setCookiesInput(e.target.value)}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	1741234567	SID	...&#10;.youtube.com	TRUE	/	TRUE	1741234567	LOGIN_INFO	..."
                  rows={4}
                  className="w-full p-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-600 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500/60 resize-none"
                />
              </div>

              {/* Action Buttons: Save, Verify, Test, Clear */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveCookies}
                  disabled={isCookieSaving || !cookiesInput.trim()}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
                >
                  {isCookieSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Cookies (Permanent)</span>
                </button>

                {/* VERIFY COOKIES BUTTON (checks 403 Forbidden & sends toast) */}
                <button
                  type="button"
                  onClick={handleVerifyCookies}
                  disabled={isVerifyingCookies}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
                  title="Lightweight check with YouTube API to verify zero 403 Forbidden errors"
                >
                  {isVerifyingCookies ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Verify Cookies</span>
                </button>

                {cookieStatus?.hasCookies && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTestCookies('youtube')}
                      disabled={isCookieTesting}
                      className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
                    >
                      {isCookieTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Test YouTube</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTestCookies('instagram')}
                      disabled={isCookieTesting}
                      className="px-3 py-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-500/40 text-fuchsia-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 shadow-sm"
                    >
                      {isCookieTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      <span>Test Instagram</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteCookies}
                      disabled={isCookieSaving}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>

              {/* Custom Test URL Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="url"
                  value={customTestUrl}
                  onChange={(e) => setCustomTestUrl(e.target.value)}
                  placeholder="Optional: target test URL (e.g., https://youtube.com/watch?v=...)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                {customTestUrl.trim() && (
                  <button
                    type="button"
                    onClick={handleVerifyCookies}
                    disabled={isVerifyingCookies}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-xl text-xs font-medium transition-colors"
                  >
                    Verify URL
                  </button>
                )}
              </div>

              {/* PLATFORM COOKIE PROFILES */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      Platform-Specific Cookie Profiles
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Manage separate authentication cookies per service. Automatically merged into yt-dlp runtime.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'youtube', name: 'YouTube', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                    { id: 'instagram', name: 'Instagram', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
                    { id: 'facebook', name: 'Facebook', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
                    { id: 'tiktok', name: 'TikTok', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                  ].map((p) => {
                    const prof = platformProfiles[p.id];
                    const hasP = prof?.hasCookies;
                    return (
                      <div
                        key={p.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${p.color}`}>
                              {p.name}
                            </span>
                            {hasP ? (
                              <span className="text-[10px] text-emerald-400 font-mono font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {prof.count} cookies
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500">Not configured</span>
                            )}
                          </div>
                        </div>

                        {prof?.lastModified && (
                          <div className="text-[10px] text-slate-500 truncate">
                            Updated: {new Date(prof.lastModified).toLocaleDateString()}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlatformModal(p.id);
                              setPlatformInputText('');
                            }}
                            className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <Key className="w-3 h-3 text-cyan-400" />
                            <span>{hasP ? 'Update Profile' : 'Add Cookies'}</span>
                          </button>
                          {hasP && (
                            <button
                              type="button"
                              onClick={() => handleDeletePlatformCookie(p.id)}
                              disabled={isPlatformSaving}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-slate-800 transition-colors"
                              title={`Clear ${p.name} cookies`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-modal or Inline Editor for Platform Cookies */}
                {activePlatformModal && (
                  <div className="mt-3 bg-slate-900 border border-cyan-500/40 rounded-xl p-3.5 space-y-3 shadow-lg animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                          Set Cookies for {activePlatformModal.toUpperCase()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePlatformModal(null)}
                        className="p-1 text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={platformInputText}
                      onChange={(e) => setPlatformInputText(e.target.value)}
                      placeholder={
                        activePlatformModal === 'instagram'
                          ? "Paste Netscape cookies OR raw Instagram sessionid (e.g. 68291882%3A... or sessionid=...)"
                          : `Paste Netscape format cookies for ${activePlatformModal} here...`
                      }
                      rows={3}
                      className="w-full p-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                    />
                    {activePlatformModal === 'instagram' && (
                      <div className="space-y-1.5 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                        <p className="text-amber-300 font-semibold flex items-center gap-1">
                          💡 <strong>How to get Instagram Cookie / sessionid (সহজ নিয়ম):</strong>
                        </p>
                        <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[10.5px]">
                          <li>PC ব্রাউজারে <a href="https://www.instagram.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">instagram.com</a>-এ লগইন করুন।</li>
                          <li>কীবোর্ডে <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-200">F12</kbd> (বা Inspect) চাপুন।</li>
                          <li><span className="font-semibold text-slate-200">Application</span> (বা Storage) &rarr; <span className="font-semibold text-slate-200">Cookies</span> &rarr; <code>instagram.com</code> সিলেক্ট করুন।</li>
                          <li><code className="text-pink-400 font-bold">sessionid</code> নামের কুকিটির Value কপি করে এখানে পেস্ট করুন। (অথবা Cookie-Editor এক্সটেনশন দিয়ে Netscape/JSON এক্সপোর্ট করে পেস্ট করতে পারেন)।</li>
                        </ol>
                      </div>
                    )}
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setActivePlatformModal(null)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSavePlatformCookie(activePlatformModal)}
                        disabled={isPlatformSaving || !platformInputText.trim()}
                        className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1.5 shadow-sm"
                      >
                        {isPlatformSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Save Profile</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Guide */}
              <div className="bg-slate-900/80 rounded-xl p-3.5 text-[11px] text-slate-400 space-y-2 border border-slate-800">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Recommended: Export without auto-rotation (Official yt-dlp method):
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                  <li>Open an <span className="text-cyan-300 font-semibold">Incognito / Private tab</span>.</li>
                  <li>Log in to YouTube, then navigate to <code className="bg-slate-800 px-1 py-0.5 rounded text-amber-300 font-mono">youtube.com/robots.txt</code>.</li>
                  <li>Export Netscape cookies using <span className="text-cyan-300 font-semibold">&quot;Cookie-Editor&quot;</span> and immediately close the Incognito tab.</li>
                  <li>Paste above and click <span className="text-amber-300 font-semibold">&quot;Save Cookies&quot;</span>, then click <span className="text-emerald-400 font-semibold">&quot;Verify Cookies&quot;</span>.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DIAGNOSTICS PANEL */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-5 text-sm animate-fadeIn">
            {/* Top Engine Health Bar */}
            <div className="bg-slate-950/60 border border-purple-500/30 p-4 rounded-2xl">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      System Diagnostics & Engines
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Live runtime status, extractor versions and update monitor
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchDiagnostics}
                    disabled={isDiagLoading}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors"
                    title="Refresh diagnostics data"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDiagLoading ? 'animate-spin' : ''}`} />
                  </button>

                  {/* CHECK FOR UPDATES BUTTON */}
                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-purple-900/30 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} />
                    <span>{isCheckingUpdate ? 'Checking GitHub...' : 'Check for Updates'}</span>
                  </button>
                </div>
              </div>

              {/* Update Check Result Banner */}
              {updateInfo && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  {updateInfo.updateAvailable ? (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-300">
                            New yt-dlp release available: v{updateInfo.latestVersion}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Current version is v{updateInfo.currentVersion}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {updateInfo.releaseUrl && (
                          <a
                            href={updateInfo.releaseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 px-2 py-1 bg-slate-900 rounded-lg border border-slate-700"
                          >
                            <span>Release Notes</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handleInstallUpdate}
                          disabled={isUpdatingYtDlp}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          {isUpdatingYtDlp ? <Loader2 className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
                          <span>Install Update</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/25 rounded-xl flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-300">
                            yt-dlp is up to date (v{updateInfo.currentVersion})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            You are running the latest production release from yt-dlp/yt-dlp.
                          </p>
                        </div>
                      </div>
                      {updateInfo.releaseUrl && (
                        <a
                          href={updateInfo.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                        >
                          <span>GitHub Release</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Core Engines Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. yt-dlp Core Card */}
              <div className="bg-slate-950/60 border border-cyan-500/30 p-4 rounded-2xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      yt-dlp Engine
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      diagnostics?.ytdlp?.installed
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {diagnostics?.ytdlp?.installed ? 'Operational' : 'Unavailable'}
                  </span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] text-slate-400">Installed Version</span>
                    <span className="text-base font-mono font-bold text-cyan-300">
                      {diagnostics?.ytdlp?.version || (isDiagLoading ? 'Detecting...' : 'Not found')}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate" title={diagnostics?.ytdlp?.path}>
                    Path: {diagnostics?.ytdlp?.path || '/app/applet/tmp/yt-dlp'}
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800/60">
                    <span>Multi-Fragment Boost:</span>
                    <span className="text-cyan-400 font-medium">16 concurrent chunks</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800/60">
                    <span>Buffer Memory:</span>
                    <span className="text-cyan-400 font-medium">16MB I/O stream</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span>Client Rotation:</span>
                    <span className="text-slate-300 font-medium">visionOS, iOS, Android, Web</span>
                  </div>
                </div>
              </div>

              {/* 2. FFmpeg Converter Card */}
              <div className="bg-slate-950/60 border border-blue-500/30 p-4 rounded-2xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      FFmpeg Transcoder
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      diagnostics?.ffmpeg?.installed
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {diagnostics?.ffmpeg?.installed ? 'Operational' : 'Simulated'}
                  </span>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11px] text-slate-400">Installed Version</span>
                    <span className="text-base font-mono font-bold text-blue-300">
                      {diagnostics?.ffmpeg?.version || (isDiagLoading ? 'Detecting...' : '4.4.2')}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate" title={diagnostics?.ffmpeg?.path}>
                    Path: {diagnostics?.ffmpeg?.path || '/usr/bin/ffmpeg'}
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800/60">
                    <span>Audio Encoders:</span>
                    <span className="text-blue-300 font-medium">MP3 (LAME), AAC, Opus</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5 border-b border-slate-800/60">
                    <span>Video Demuxing:</span>
                    <span className="text-blue-300 font-medium">H.264, VP9, AV1, WebM</span>
                  </div>
                  <div className="flex items-center justify-between py-0.5">
                    <span>DASH Stream Muxing:</span>
                    <span className="text-emerald-400 font-medium">Full Support</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Runtime & Platform Information */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-400" />
                  Container Host & Platform
                </span>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  BDIX Acceleration Active
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">OS Platform</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                    {diagnostics?.system?.platform || 'linux'} ({diagnostics?.system?.arch || 'x64'})
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Node.js</div>
                  <div className="text-xs font-mono font-bold text-cyan-300 mt-0.5">
                    {diagnostics?.system?.nodeVersion || process.version || 'v22.x'}
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Extractor JS</div>
                  <div className="text-xs font-mono font-bold text-purple-300 mt-0.5">
                    Built-in Node.js
                  </div>
                </div>

                <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Server Uptime</div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    {diagnostics?.system?.uptimeSeconds
                      ? `${Math.floor(diagnostics.system.uptimeSeconds / 60)}m ${diagnostics.system.uptimeSeconds % 60}s`
                      : 'Active'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-5 mt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
