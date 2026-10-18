import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { UrlInputCard, DownloadPhase } from './components/UrlInputCard';
import { VideoInfoCard } from './components/VideoInfoCard';
import { DownloadProgressCard } from './components/DownloadProgressCard';
import { BatchDownloadManager } from './components/BatchDownloadManager';
import { YtDlpAlertBanner } from './components/YtDlpAlertBanner';
import { Footer } from './components/Footer';
import { ErrorTestModal } from './components/ErrorTestModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { LocalMediaConverter } from './components/LocalMediaConverter';
import { SocialQuickMode } from './components/SocialQuickMode';
import { AudioCutterModal } from './components/AudioCutterModal';
import { MediaPlayerModal } from './components/MediaPlayerModal';
import { DomainWatcherManager } from './components/DomainWatcherManager';
import { TelegramExportModal } from './components/TelegramExportModal';
import { ToastContainer, ToastData } from './components/Toast';
import { CommunityJoinBanner } from './components/CommunityJoinBanner';
import { LogoStickerMakerModal } from './components/LogoStickerMakerModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  VideoInfo,
  DownloadType,
  VideoQuality,
  VideoFormatChoice,
  TaskStatus,
  BatchItem,
  FluxLoadSettings,
  DEFAULT_SETTINGS,
  SingleDownloadConfig,
  AppNavMode,
} from './types';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, doc, query, orderBy, onSnapshot, deleteDoc, setDoc } from 'firebase/firestore';
import { soundNotify } from './lib/soundNotify';
import { downloadFileWithBlob } from './lib/downloadHelper';
import {
  exportAllDataAsJson,
  parseAndValidateBackup,
  syncAllDataToCloud,
  saveAllDataLocally,
} from './lib/dataBackup';

// Helper to check if an error is network-related for Smart Retry
const isNetworkError = (errMsg?: string): boolean => {
  if (!errMsg) return false;
  const msg = errMsg.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('socket') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('disconnected') ||
    msg.includes('fragment') ||
    msg.includes('temporary') ||
    msg.includes('offline') ||
    msg.includes('dns') ||
    msg.includes('interrupted') ||
    msg.includes('unreachable') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('ssl') ||
    msg.includes('handshake')
  );
};

export default function App() {
  // App navigation state
  const [appMode, setAppMode] = useState<AppNavMode>('single');
  const [singleStep, setSingleStep] = useState<'url' | 'info' | 'downloading'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio Cutter state
  const [isAudioCutterOpen, setIsAudioCutterOpen] = useState(false);
  const [audioCutterParams, setAudioCutterParams] = useState<{
    taskId?: string;
    mediaUrl?: string;
    title?: string;
  }>({});

  // Media Player state
  const [isMediaPlayerOpen, setIsMediaPlayerOpen] = useState(false);
  const [mediaPlayerParams, setMediaPlayerParams] = useState<{
    mediaUrl: string;
    title?: string;
    type?: 'video' | 'audio';
    taskId?: string;
  }>({ mediaUrl: '' });

  const handleOpenAudioCutter = (taskId?: string, mediaUrl?: string, title?: string) => {
    setAudioCutterParams({ taskId, mediaUrl, title });
    setIsAudioCutterOpen(true);
  };

  const handleOpenMediaPlayer = (mediaUrl: string, title?: string, type?: 'video' | 'audio', taskId?: string) => {
    setMediaPlayerParams({ mediaUrl, title, type, taskId });
    setIsMediaPlayerOpen(true);
  };

  // Settings State with LocalStorage Persistence
  const [settings, setSettings] = useState<FluxLoadSettings>(() => {
    try {
      const saved = localStorage.getItem('fluxload_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.saveFolderPrefix === 'FluxLoad') {
          parsed.saveFolderPrefix = '';
          try {
            localStorage.setItem('fluxload_settings', JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }));
          } catch {}
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'cookies' | 'diagnostics' | 'telegram' | 'data'>('general');
  const [settingsPlatform, setSettingsPlatform] = useState<string | undefined>(undefined);

  const handleOpenSettings = (
    tab: 'general' | 'cookies' | 'diagnostics' | 'telegram' | 'data' = 'general',
    platform?: string
  ) => {
    setSettingsTab(tab);
    setSettingsPlatform(platform);
    setIsSettingsOpen(true);
  };

  // Telegram Export state
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramExportParams, setTelegramExportParams] = useState<{
    taskId?: string;
    downloadUrl?: string;
    title?: string;
    thumbnail?: string;
    fileSize?: string;
    format?: string;
    isAudio?: boolean;
  }>({});

  const handleOpenTelegramExport = (params: {
    taskId?: string;
    downloadUrl?: string;
    title?: string;
    thumbnail?: string;
    fileSize?: string;
    format?: string;
    isAudio?: boolean;
  }) => {
    setTelegramExportParams(params);
    setIsTelegramModalOpen(true);
  };

  // Telegram Integration State & Global Notification Toasts
  const [telegramConfig, setTelegramConfig] = useState<{
    configured: boolean;
    botTokenMasked?: string;
    chatId?: string;
    channelTitle?: string;
    botUsername?: string;
    channels?: Array<{
      chatId: string;
      channelTitle?: string;
      enabled?: boolean;
      botToken?: string;
      botUsername?: string;
      customCaption?: string;
    }>;
    autoSend?: boolean;
    removeSizeLimit?: boolean;
    maxUploadGb?: number;
    uploadDeliveryMode?: string;
  } | null>(null);

  // Logo & Telegram Sticker Maker Studio state
  const [isStickerMakerOpen, setIsStickerMakerOpen] = useState(false);

  const [globalToasts, setGlobalToasts] = useState<ToastData[]>([]);

  const addGlobalToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, duration = 6000) => {
      const newToast: ToastData = {
        id: 'toast-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type,
        title,
        message,
        duration,
      };
      setGlobalToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const dismissGlobalToast = useCallback((id: string) => {
    setGlobalToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchTelegramConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setTelegramConfig(data);
        if (data && (data.botToken || data.chatId)) {
          try {
            localStorage.setItem('fluxload_telegram_config', JSON.stringify(data));
          } catch {}
        }
        if (data?.channels && Array.isArray(data.channels) && data.channels.length > 0) {
          try {
            localStorage.setItem('fluxload_saved_channels', JSON.stringify(data.channels));
          } catch {}
        }
        // If server only returned default @FluxLoad channel, check if we have more saved channels in browser
        if (!data?.channels || data.channels.length <= 1) {
          try {
            const savedChannels = localStorage.getItem('fluxload_saved_channels');
            if (savedChannels) {
              const parsed = JSON.parse(savedChannels);
              if (Array.isArray(parsed) && parsed.length > 1) {
                const restoreRes = await fetch('/api/telegram/channels/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ channels: parsed }),
                });
                if (restoreRes.ok) {
                  const restoredData = await restoreRes.json();
                  if (restoredData.channels) {
                    setTelegramConfig((prev) => prev ? { ...prev, channels: restoredData.channels } : prev);
                  }
                }
              }
            }
          } catch {}
        }
      } else {
        // Auto-recovery: If server lost config, restore from permanent browser storage
        try {
          const cached = localStorage.getItem('fluxload_telegram_config');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.botToken || parsed.chatId)) {
              await fetch('/api/telegram/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: parsed }),
              });
              setTelegramConfig(parsed);
            }
          }
        } catch {}
      }
    } catch (err) {
      console.error('Failed to query telegram config:', err);
    }
  }, []);

  useEffect(() => {
    fetchTelegramConfig();
  }, [fetchTelegramConfig]);

  const handleToggleTelegramAutoSend = async (desired?: boolean) => {
    try {
      const nextVal = desired !== undefined ? desired : !telegramConfig?.autoSend;
      const res = await fetch('/api/telegram/toggle-auto-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSend: nextVal }),
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramConfig((prev) => (prev ? { ...prev, autoSend: data.autoSend } : null));
        if (data.autoSend) {
          addGlobalToast(
            'success',
            'টেলিগ্রাম অটো-পোস্ট চালু (Active) 🚀',
            `ভিডিও ডাউনলোড শেষ হলেই স্বয়ংক্রিয়ভাবে "${telegramConfig?.channelTitle || telegramConfig?.chatId || 'চ্যানেলে'}" পোস্ট হবে!`
          );
        } else {
          addGlobalToast(
            'info',
            'অটো-পোস্ট বন্ধ (Off)',
            'টেলিগ্রামে স্বয়ংক্রিয় পোস্ট নিষ্ক্রিয় করা হয়েছে।'
          );
        }
      }
    } catch (e: any) {
      addGlobalToast('error', 'Error', 'Failed to toggle auto-post: ' + e.message);
    }
  };

  const handleUpdateSettings = (updates: Partial<FluxLoadSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('fluxload_settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem('fluxload_settings', JSON.stringify(DEFAULT_SETTINGS));
    } catch {}
  };

  // Single download state
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [activeDownloadUrl, setActiveDownloadUrl] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [lastSingleConfig, setLastSingleConfig] = useState<SingleDownloadConfig | null>(null);
  const [smartRetryAttempts, setSmartRetryAttempts] = useState<number>(0);
  const smartRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    id: '',
    status: 'queued',
    progress: 0,
    speed: '0 KB/s',
    downloadedSize: '0 MB',
    totalSize: 'Unknown',
    eta: 'Calculating...',
  });

  // Multiple / Batch download state
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);

  // Modals and system info
  const [isErrorTestModalOpen, setIsErrorTestModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Global Keyboard Shortcuts (Power User Accessibility)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isMod = isMac ? e.metaKey : e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // Escape: Close any open modal
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (isHistoryOpen) {
          setIsHistoryOpen(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (isTelegramModalOpen) {
          setIsTelegramModalOpen(false);
          return;
        }
        if (isAudioCutterOpen) {
          setIsAudioCutterOpen(false);
          return;
        }
        if (isMediaPlayerOpen) {
          setIsMediaPlayerOpen(false);
          return;
        }
        if (isStickerMakerOpen) {
          setIsStickerMakerOpen(false);
          return;
        }
        if (isErrorTestModalOpen) {
          setIsErrorTestModalOpen(false);
          return;
        }
      }

      // Mod + S: Toggle Settings (Prevent default browser save webpage)
      if (isMod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // Mod + H: Toggle History (Prevent default browser history window)
      if (isMod && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setIsHistoryOpen((prev) => !prev);
        return;
      }

      // Mod + B: Toggle Batch Mode
      if (isMod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setAppMode((prev) => (prev === 'batch' ? 'single' : 'batch'));
        return;
      }

      // Mod + M: Toggle Social Reels Mode
      if (isMod && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setAppMode((prev) => (prev === 'social' ? 'single' : 'social'));
        return;
      }

      // Mod + Shift + T: Open Telegram Settings
      if (isMod && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleOpenSettings('telegram');
        return;
      }

      // Mod + K or '/' (when not typing in an input): Focus URL Input
      if ((isMod && (e.key === 'k' || e.key === 'K')) || (!isMod && e.key === '/' && !isInput)) {
        e.preventDefault();
        const inputEl = document.getElementById('fluxload-main-url-input') as HTMLInputElement | null;
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }
        return;
      }

      // '?' (Shift + /) or Mod + /: Toggle Keyboard Shortcuts Modal (when not in input)
      if ((e.key === '?' && !isInput) || (isMod && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Mod + Enter: Trigger Download
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        const submitBtn = document.querySelector('form button[type="submit"]') as HTMLButtonElement | null;
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
        } else {
          const primaryBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null;
          if (primaryBtn && !primaryBtn.disabled) {
            primaryBtn.click();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isShortcutsModalOpen,
    isHistoryOpen,
    isSettingsOpen,
    isTelegramModalOpen,
    isAudioCutterOpen,
    isMediaPlayerOpen,
    isStickerMakerOpen,
    isErrorTestModalOpen,
    appMode,
  ]);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch download history from Firestore when logged in, or load from localStorage
  useEffect(() => {
    if (!user) {
      try {
        const local = localStorage.getItem('fluxload_download_history');
        if (local) {
          setHistory(JSON.parse(local));
          return;
        }
      } catch {}
      setHistory([]);
      return;
    }

    const colRef = collection(db, 'users', user.uid, 'downloads');
    const q = query(colRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setHistory(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/downloads`);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle Google Login
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout failed:', err);
    }
  };

  // Data Backup, Cloud Sync & All Data Save Handlers
  const handleExportAllData = async () => {
    let tgConfig: any = null;
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) tgConfig = await res.json();
    } catch {}
    exportAllDataAsJson(settings, history, tgConfig);
  };

  const handleImportAllData = async (jsonStr: string) => {
    const res = parseAndValidateBackup(jsonStr);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to parse backup' };
    }
    if (res.settings) {
      handleUpdateSettings(res.settings);
    }
    if (res.history && res.history.length > 0) {
      setHistory(res.history);
      try {
        localStorage.setItem('fluxload_download_history', JSON.stringify(res.history));
      } catch {}
      if (user) {
        for (const item of res.history) {
          try {
            const colRef = collection(db, 'users', user.uid, 'downloads');
            await addDoc(colRef, {
              ...item,
              userId: user.uid,
              createdAt: item.createdAt || new Date().toISOString(),
            });
          } catch {}
        }
      }
    }
    if (res.telegramConfig?.chatId) {
      try {
        localStorage.setItem('fluxload_telegram_config', JSON.stringify(res.telegramConfig));
      } catch {}
    }
    return { success: true };
  };

  const handleSyncAllData = async () => {
    if (!user) {
      return { success: false, syncedItemsCount: 0, error: 'User is not signed in' };
    }
    let tgConfig: any = null;
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) tgConfig = await res.json();
    } catch {}
    return await syncAllDataToCloud(user.uid, settings, history, tgConfig);
  };

  // Check system status on mount
  useEffect(() => {
    fetch('/api/system-status')
      .then(async (res) => {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await res.json();
          setSystemStatus(data);
        }
      })
      .catch(() => {
        // Silent fallback to default status if server is initializing
      });
  }, []);

  // Helper to parse JSON safely
  const parseJsonOrThrow = async (response: Response, defaultMessage: string) => {
    const ct = response.headers.get('content-type');
    if (!ct || !ct.includes('application/json')) {
      const text = await response.text();
      throw new Error(
        response.ok ? defaultMessage : `Server Error (${response.status}): ${text.slice(0, 120)}`
      );
    }
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || defaultMessage);
    }
    return data;
  };

  const autoDownloadedSingleJobIdsRef = useRef<Set<string>>(new Set());
  const telegramNotifiedTasksRef = useRef<Set<string>>(new Set());
  const [autoSaveStatus, setAutoSaveStatus] = useState<{
    isSaving: boolean;
    success: boolean;
    loadedFormatted: string;
    totalFormatted: string;
    percent: number;
    error: string | null;
  }>({
    isSaving: false,
    success: false,
    loadedFormatted: '',
    totalFormatted: '',
    percent: 0,
    error: null,
  });

  const handleStartSingleDownload = async (
    url: string,
    config: SingleDownloadConfig,
    isRetryAttempt = false
  ) => {
    if (smartRetryTimerRef.current) {
      clearTimeout(smartRetryTimerRef.current);
      smartRetryTimerRef.current = null;
    }
    if (!isRetryAttempt) {
      setSmartRetryAttempts(0);
    }
    setIsLoading(true);
    setError(null);
    setActiveDownloadUrl(url);
    setLastSingleConfig(config);
    setAutoSaveStatus({
      isSaving: false,
      success: false,
      loadedFormatted: '',
      totalFormatted: '',
      percent: 0,
      error: null,
    });

    try {
      // 1. Immediately start download on backend
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...config,
        }),
      });

      const data = await parseJsonOrThrow(response, 'Failed to start download process');
      const newId = data.id || data.jobId;
      setTaskId(newId);
      setTaskStatus({
        id: newId,
        status: 'downloading',
        progress: 0,
        speed: '0 KB/s',
        downloadedSize: '0 MB',
        totalSize: 'Detecting media...',
        eta: isRetryAttempt ? `Reconnecting (${smartRetryAttempts + 1}/${settings.smartRetryMaxAttempts ?? 3})...` : 'Starting...',
      });

      // 2. Fetch metadata asynchronously in background for title & preview
      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((meta) => {
          if (meta) setVideoInfo(meta);
        })
        .catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to start download. Please check the URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseSingle = async () => {
    if (!taskId) return;
    try {
      await fetch(`/api/jobs/${taskId}/pause`, { method: 'POST' });
      setTaskStatus((prev) => ({ ...prev, status: 'paused' }));
    } catch (e) {
      console.error('Failed to pause:', e);
    }
  };

  const handleResumeSingle = async () => {
    if (!taskId) return;
    try {
      await fetch(`/api/jobs/${taskId}/resume`, { method: 'POST' });
      setTaskStatus((prev) => ({ ...prev, status: 'downloading' }));
    } catch (e) {
      console.error('Failed to resume:', e);
    }
  };

  const handleCancelSingle = async () => {
    if (smartRetryTimerRef.current) {
      clearTimeout(smartRetryTimerRef.current);
      smartRetryTimerRef.current = null;
    }
    setSmartRetryAttempts(0);
    if (!taskId) return;
    if (taskId.startsWith('test-err-')) {
      setTaskStatus((prev) => ({ ...prev, status: 'cancelled' }));
      return;
    }
    try {
      await fetch(`/api/cancel/${taskId}`, { method: 'POST' });
      setTaskStatus((prev) => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const handleRetrySingle = () => {
    if (smartRetryTimerRef.current) {
      clearTimeout(smartRetryTimerRef.current);
      smartRetryTimerRef.current = null;
    }
    setSmartRetryAttempts(0);
    if (activeDownloadUrl && lastSingleConfig) {
      handleStartSingleDownload(activeDownloadUrl, lastSingleConfig);
    } else if (activeDownloadUrl) {
      handleStartSingleDownload(activeDownloadUrl, {
        type: settings.defaultType || 'video',
        quality: settings.defaultQuality || '720p',
        format: settings.defaultFormat || 'mp4',
      });
    }
  };

  const handleResetSingle = () => {
    if (smartRetryTimerRef.current) {
      clearTimeout(smartRetryTimerRef.current);
      smartRetryTimerRef.current = null;
    }
    setSmartRetryAttempts(0);
    setActiveDownloadUrl('');
    setVideoInfo(null);
    setTaskId(null);
    setError(null);
    setTaskStatus({
      id: '',
      status: 'queued',
      progress: 0,
      speed: '0 KB/s',
      downloadedSize: '0 MB',
      totalSize: 'Unknown',
      eta: 'Calculating...',
    });
    setAutoSaveStatus({
      isSaving: false,
      success: false,
      loadedFormatted: '',
      totalFormatted: '',
      percent: 0,
      error: null,
    });
  };

  // Poll Single Download Status
  useEffect(() => {
    if (!taskId || taskId.startsWith('test-err-')) return;

    let isSubscribed = true;
    const abortController = new AbortController();
    let pollTimeout: NodeJS.Timeout | null = null;
    let consecutiveNetworkErrors = 0;
    let notFoundCount = 0;

    const pollStatus = async () => {
      if (!isSubscribed || abortController.signal.aborted) return;

      try {
        const res = await fetch(`/api/status/${taskId}`, {
          signal: abortController.signal,
          headers: { Accept: 'application/json' },
        });

        if (!isSubscribed) return;

        if (res.ok) {
          consecutiveNetworkErrors = 0;
          notFoundCount = 0;
          const ct = res.headers.get('content-type');
          if (ct && ct.includes('application/json')) {
            const statusData: TaskStatus = await res.json();
            if (!isSubscribed) return;
            setTaskStatus(statusData);

            if (statusData.status === 'completed' || statusData.status === 'done') {
              setSmartRetryAttempts(0);
              // If Telegram upload is active or queued, keep polling so user sees live upload speed & progress!
              if (
                statusData.telegramUploading ||
                statusData.telegramStatus === 'uploading' ||
                statusData.telegramStatus === 'queued'
              ) {
                pollTimeout = setTimeout(pollStatus, 800);
                return;
              }

              // If Telegram upload just completed, show toast once
              if (
                statusData.telegramStatus === 'completed' &&
                statusData.id &&
                !telegramNotifiedTasksRef.current.has(statusData.id)
              ) {
                telegramNotifiedTasksRef.current.add(statusData.id);
                addGlobalToast(
                  'success',
                  '✅ Auto-Posted to Telegram! 🎬',
                  `ভিডিওটি সকল টেলিগ্রাম চ্যানেলে সফলভাবে আপলোড সম্পন্ন হয়েছে!`,
                  8000
                );
              }
              return;
            }

            if (statusData.status === 'error') {
              const isNetworkFail = isNetworkError(statusData.error);
              const maxAttempts = settings.smartRetryMaxAttempts ?? 3;
              const isSmartRetryEnabled = settings.smartRetryEnabled !== false;

              if (isSmartRetryEnabled && isNetworkFail && smartRetryAttempts < maxAttempts && activeDownloadUrl) {
                const nextAttempt = smartRetryAttempts + 1;
                addGlobalToast(
                  'info',
                  `Smart Retry Active (${nextAttempt}/${maxAttempts})`,
                  `Network issue detected: "${statusData.error || 'Connection dropped'}". Auto-retrying download in 2.5 seconds...`,
                  5000
                );
                setTaskStatus((prev) => ({
                  ...prev,
                  status: 'downloading',
                  speed: 'Reconnecting...',
                  eta: `Auto-retrying (${nextAttempt}/${maxAttempts})...`,
                }));

                if (smartRetryTimerRef.current) clearTimeout(smartRetryTimerRef.current);
                smartRetryTimerRef.current = setTimeout(() => {
                  handleStartSingleDownload(
                    activeDownloadUrl,
                    lastSingleConfig || {
                      type: settings.defaultType || 'video',
                      quality: settings.defaultQuality || '720p',
                      format: settings.defaultFormat || 'mp4',
                    },
                    true
                  );
                }, 2500);
                return;
              } else if (isSmartRetryEnabled && isNetworkFail && smartRetryAttempts >= maxAttempts) {
                addGlobalToast(
                  'warning',
                  'Smart Retry Limit Reached',
                  `Automatic retries reached maximum limit (${maxAttempts}/${maxAttempts}). Please verify your network and retry manually.`,
                  7000
                );
              }
              return;
            }

            if (statusData.status === 'cancelled') {
              return;
            }
          }
          pollTimeout = setTimeout(pollStatus, 1000);
          return;
        }

        if (res.status === 404) {
          notFoundCount++;
          if (notFoundCount >= 3) {
            if (isSubscribed) {
              setTaskStatus((prev) => {
                if (prev.status === 'completed' || prev.status === 'done' || prev.status === 'cancelled') {
                  return prev;
                }
                return {
                  ...prev,
                  status: 'error',
                  error: 'Download task not found or expired. Please restart the download.',
                };
              });
            }
            return;
          }
          pollTimeout = setTimeout(pollStatus, 1500);
          return;
        }

        // Non-ok response (e.g. 500 or 503)
        consecutiveNetworkErrors++;
        const nextDelay = Math.min(1000 * Math.pow(1.5, consecutiveNetworkErrors), 5000);
        pollTimeout = setTimeout(pollStatus, nextDelay);
      } catch (err: any) {
        if (!isSubscribed || err?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }

        consecutiveNetworkErrors++;
        // If server is temporarily rebooting or network blipped, retry gracefully without throwing or spamming console
        if (consecutiveNetworkErrors >= 6) {
          if (isSubscribed) {
            const maxAttempts = settings.smartRetryMaxAttempts ?? 3;
            const isSmartRetryEnabled = settings.smartRetryEnabled !== false;

            if (isSmartRetryEnabled && smartRetryAttempts < maxAttempts && activeDownloadUrl) {
              const nextAttempt = smartRetryAttempts + 1;
              addGlobalToast(
                'info',
                `Smart Retry (${nextAttempt}/${maxAttempts})`,
                `Connection interrupted. Auto-retrying download in 3 seconds...`,
                5000
              );
              setTaskStatus((prev) => ({
                ...prev,
                status: 'downloading',
                speed: 'Reconnecting...',
                eta: `Auto-retrying (${nextAttempt}/${maxAttempts})...`,
              }));

              if (smartRetryTimerRef.current) clearTimeout(smartRetryTimerRef.current);
              smartRetryTimerRef.current = setTimeout(() => {
                handleStartSingleDownload(
                  activeDownloadUrl,
                  lastSingleConfig || {
                    type: settings.defaultType || 'video',
                    quality: settings.defaultQuality || '720p',
                    format: settings.defaultFormat || 'mp4',
                  },
                  true
                );
              }, 3000);
              return;
            }

            setTaskStatus((prev) => {
              if (prev.status === 'completed' || prev.status === 'done' || prev.status === 'cancelled') {
                return prev;
              }
              return {
                ...prev,
                status: 'error',
                error: 'Connection to download server interrupted. Please check your network and retry.',
              };
            });
          }
          return;
        }

        const nextDelay = Math.min(1000 * Math.pow(1.5, consecutiveNetworkErrors), 4000);
        pollTimeout = setTimeout(pollStatus, nextDelay);
      }
    };

    pollStatus();

    return () => {
      isSubscribed = false;
      abortController.abort();
      if (pollTimeout) clearTimeout(pollTimeout);
      if (smartRetryTimerRef.current) clearTimeout(smartRetryTimerRef.current);
    };
  }, [taskId, smartRetryAttempts, settings.smartRetryEnabled, settings.smartRetryMaxAttempts, activeDownloadUrl, lastSingleConfig, addGlobalToast]);

  // Automatic browser download trigger & notification on completion (NO Save Page, NO 2nd Save button)
  useEffect(() => {
    const isCompleted = taskStatus.status === 'completed' || taskStatus.status === 'done';
    if (isCompleted && taskId && !autoDownloadedSingleJobIdsRef.current.has(taskId)) {
      autoDownloadedSingleJobIdsRef.current.add(taskId);

      const recordTitle = videoInfo?.title || taskStatus.filename || 'Downloaded Media';
      const recordUrl = videoInfo?.webpage_url || activeDownloadUrl;
      const recordType = lastSingleConfig?.type || settings.defaultType || 'video';
      const recordQuality = lastSingleConfig?.quality || settings.defaultQuality || '720p';
      const recordFormat = (taskStatus.filename?.split('.').pop() || lastSingleConfig?.format || 'mp4').toLowerCase();
      const recordCreatedAt = new Date().toISOString();

      // Clean filename and guarantee NO duplicate extensions (e.g. .mp4.mp4)
      const rawBase = recordTitle.trim();
      const baseWithoutExt = rawBase.replace(/\.(mp4|webm|mkv|mp3|m4a|wav|opus|ogg|flv|avi|mov)$/i, '');
      const cleanTitle = baseWithoutExt
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/["'`;]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\.{2,}/g, '.')
        .replace(/^[\s_.-]+|[\s_.-]+$/g, '')
        .trim()
        .slice(0, 100);
      const finalFilename = `${cleanTitle || 'video'}.${recordFormat}`;

      // Automatically send the final file to the browser via authenticated blob stream
      if (settings?.autoSaveToDownloads !== false) {
        setAutoSaveStatus({
          isSaving: true,
          success: false,
          loadedFormatted: '0 MB',
          totalFormatted: taskStatus.totalSize || '...',
          percent: 0,
          error: null,
        });

        try {
          const downloadEndpoint =
            taskStatus.downloadUrl ||
            `/api/jobs/${taskId}/file?filename=${encodeURIComponent(finalFilename)}`;

          downloadFileWithBlob(downloadEndpoint, finalFilename, (progress) => {
            setAutoSaveStatus({
              isSaving: true,
              success: false,
              loadedFormatted: progress.loadedFormatted,
              totalFormatted: progress.totalFormatted,
              percent: progress.percent,
              error: null,
            });
          })
            .then(() => {
              setAutoSaveStatus({
                isSaving: false,
                success: true,
                loadedFormatted: '',
                totalFormatted: '',
                percent: 100,
                error: null,
              });
            })
            .catch((err) => {
              console.warn('Auto blob download failed:', err);
              setAutoSaveStatus({
                isSaving: false,
                success: false,
                loadedFormatted: '',
                totalFormatted: '',
                percent: 0,
                error: err?.message || 'Automatic browser download was blocked or interrupted.',
              });
            });
        } catch (e: any) {
          console.warn('Auto browser download trigger failed:', e);
          setAutoSaveStatus({
            isSaving: false,
            success: false,
            loadedFormatted: '',
            totalFormatted: '',
            percent: 0,
            error: e?.message || 'Auto-save initialization failed.',
          });
        }
      }

      // Audio notification chime
      if (settings?.playNotificationSound !== false) {
        soundNotify.playCompleteSound();
      }

      // Native browser notification
      if (settings?.browserNotifications) {
        soundNotify.showNotification('FluxLoad: Download Complete! 🎉', {
          body: `Saved: ${finalFilename}`,
        });
      }

      // 1. Update local storage history
      const localItem = {
        id: 'local-' + Date.now(),
        userId: user?.uid || 'guest',
        title: recordTitle,
        url: recordUrl,
        type: recordType,
        quality: recordQuality,
        format: recordFormat,
        createdAt: recordCreatedAt,
      };

      try {
        const current = JSON.parse(localStorage.getItem('fluxload_download_history') || '[]');
        const updated = [localItem, ...current.filter((x: any) => x.url !== recordUrl)].slice(0, 50);
        localStorage.setItem('fluxload_download_history', JSON.stringify(updated));
        if (!user) {
          setHistory(updated);
        }
      } catch {}

      // 2. Persist to Firestore if user logged in
      if (user) {
        const saveFirestore = async () => {
          try {
            const colRef = collection(db, 'users', user.uid, 'downloads');
            const docRef = doc(colRef);
            const firestoreRecord = {
              id: docRef.id,
              userId: user.uid,
              title: recordTitle,
              url: recordUrl,
              type: recordType,
              quality: recordQuality,
              format: recordFormat,
              createdAt: recordCreatedAt,
            };
            await setDoc(docRef, firestoreRecord);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/downloads`);
          }
        };
        saveFirestore();
      }

      // 3. AUTOMATIC POST TO TELEGRAM CHANNEL (Auto upload to @FluxLoad & all configured channels simultaneously)
      (async () => {
        try {
          const activeChannels = telegramConfig?.channels?.filter(c => c.enabled !== false) || [];
          const activeTargets = activeChannels.map(c => c.chatId);
          if (!activeTargets.includes('@FluxLoad')) {
            activeTargets.unshift('@FluxLoad');
          }
          const channelNames = activeChannels.length > 0
            ? activeChannels.map(c => c.channelTitle || c.chatId).join(', ')
            : '@FluxLoad';

          setTaskStatus((prev) => ({
            ...prev,
            telegramStatus: 'uploading',
          }));

          addGlobalToast(
            'info',
            '🚀 Telegram Auto-Post',
            `"${recordTitle}" ভিডিওটি একই সাথে সকল Telegram চ্যানেল (${channelNames})-এ আপলোড হচ্ছে...`,
            4000
          );

          const postRes = await fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              downloadUrl: taskStatus.downloadUrl,
              caption: recordTitle,
              targetChats: activeTargets,
            }),
          });

          let postData: any = null;
          try {
            const ct = postRes.headers.get('content-type');
            if (ct && ct.includes('application/json')) {
              postData = await postRes.json();
            }
          } catch {}

          if (postRes.ok && postData?.started) {
            setTaskStatus((prev) => ({
              ...prev,
              telegramUploading: true,
              telegramStatus: 'uploading',
            }));
            // Polling loop in pollStatus continuously tracks upload speed, progress & completion
          } else if (postRes.ok && postData?.success) {
            setTaskStatus((prev) => ({
              ...prev,
              telegramUploading: false,
              telegramStatus: 'completed',
              telegramPostUrl: postData.channelPostUrl,
              telegramPostUrls: postData.channelPostUrls,
              telegramChannels: postData.results,
              telegramSuccessCount: postData.successCount,
              telegramTotalTargets: postData.totalTargets,
              telegramMessage: postData.message,
            }));

            if (taskId && !telegramNotifiedTasksRef.current.has(taskId)) {
              telegramNotifiedTasksRef.current.add(taskId);
              const countMsg = postData.totalTargets && postData.totalTargets > 1
                ? `${postData.successCount}/${postData.totalTargets}টি চ্যানেলে (${channelNames})`
                : '@FluxLoad চ্যানেলে';
              addGlobalToast(
                'success',
                '✅ Auto-Posted to Telegram! 🎬',
                `ভিডিওটি ${countMsg} সফলভাবে আপলোড হয়েছে (${postData.formattedSize || ''})!`,
                8000
              );
            }
          } else if (postData?.botNeedsAdmin) {
            setTaskStatus((prev) => ({
              ...prev,
              telegramUploading: false,
              telegramStatus: 'forbidden_admin_needed',
              telegramChannels: postData.results,
              telegramError: postData.error || postData.message,
            }));
            addGlobalToast(
              'warning',
              '⚠️ Telegram Bot Admin Needed',
              `বট @${telegramConfig?.botUsername || 'black_world722_bot'} টেলিগ্রাম চ্যানেলে Administrator হিসেবে নেই। চ্যানেলে বটকে Administrator করুন (Post Messages পারমিশন দিয়ে)।`,
              10000
            );
          } else if (postData) {
            setTaskStatus((prev) => ({
              ...prev,
              telegramUploading: false,
              telegramStatus: 'error',
              telegramChannels: postData.results,
              telegramError: postData.error || postData.message,
            }));
            console.warn('Telegram Auto-Post notice:', postData.error);
          }
        } catch (err: any) {
          console.warn('Auto Telegram send notice:', err?.message || err);
        }
      })();
    } else if (taskStatus.status === 'error') {
      if (settings?.playNotificationSound !== false) {
        soundNotify.playErrorSound();
      }
    }
  }, [taskStatus.status, taskId, videoInfo, user, activeDownloadUrl, settings, lastSingleConfig, taskStatus.filename, taskStatus.downloadUrl, telegramConfig, addGlobalToast]);

  // ==========================================
  // MULTIPLE / BATCH DOWNLOAD HANDLERS
  // ==========================================
  const handleAnalyzeBatch = async (rawUrls: string[]) => {
    const urls = rawUrls.filter(
      (u) =>
        u &&
        !u.startsWith('#') &&
        !u.toLowerCase().includes('curl.se') &&
        !u.toLowerCase().includes('cookie_spec') &&
        !u.includes('\tTRUE\t') &&
        !u.includes('\tFALSE\t')
    );
    if (urls.length === 0) return;
    setIsLoading(true);
    setError(null);

    const newItems: BatchItem[] = urls.map((u, idx) => ({
      id: 'batch-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substring(2, 6),
      url: u,
      status: 'analyzing',
      selected: true,
      type: settings.defaultType,
      quality: settings.defaultQuality,
      format: settings.defaultFormat,
      progress: 0,
      speed: '0 KB/s',
      downloadedSize: '0 MB',
      totalSize: 'Unknown',
      eta: '--:--',
    }));

    setBatchItems((prev) => [...prev, ...newItems]);
    setAppMode('batch');
    setIsLoading(false);

    // Call batch analyze endpoint
    try {
      const response = await fetch('/api/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];

        setBatchItems((prev) =>
          prev.map((item) => {
            const found = results.find((r: any) => r.url === item.url);
            if (found) {
              if (found.success && found.data) {
                let chosenQuality = item.quality;
                if (found.data.availableQualities && found.data.availableQualities.length > 0) {
                  if (!found.data.availableQualities.includes(chosenQuality)) {
                    chosenQuality = found.data.availableQualities.includes('auto')
                      ? 'auto'
                      : found.data.availableQualities[found.data.availableQualities.length - 1];
                  }
                }
                return {
                  ...item,
                  status: 'ready',
                  info: found.data,
                  quality: chosenQuality,
                };
              } else {
                return {
                  ...item,
                  status: 'error',
                  error: found.error || 'Failed to extract video information',
                };
              }
            }
            return item;
          })
        );
      }
    } catch (err: any) {
      console.error('Batch analyze error:', err);
    }
  };

  const handleUpdateBatchItem = (id: string, updates: Partial<BatchItem>) => {
    setBatchItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllBatch = () => {
    setBatchItems([]);
  };

  const handleAddBatchUrls = (newUrls: string[]) => {
    handleAnalyzeBatch(newUrls);
  };

  // Start Batch Download execution
  const handleStartBatchDownload = async (itemIds: string[]) => {
    const itemsToStart = batchItems.filter((i) => itemIds.includes(i.id));

    setBatchItems((prev) =>
      prev.map((i) => (itemIds.includes(i.id) ? { ...i, status: 'queued', progress: 0 } : i))
    );

    const payload = itemsToStart.map((i) => ({
      id: i.id,
      url: i.url,
      title: i.info?.title || i.title,
      type: i.type,
      quality: i.quality,
      format: i.format,
    }));

    try {
      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: payload,
          concurrency: settings.batchConcurrency || 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const queuedTasks = data.tasks || [];

        setBatchItems((prev) =>
          prev.map((item) => {
            const task = queuedTasks.find((t: any) => t.id === item.id);
            if (task) {
              return {
                ...item,
                taskId: task.taskId,
                status: (task.status as any) || 'queued',
              };
            }
            return item;
          })
        );
      }
    } catch (err) {
      console.error('Failed to start batch download:', err);
    }
  };

  const handleCancelBatchItem = async (id: string) => {
    const item = batchItems.find((i) => i.id === id);
    if (!item || !item.taskId) return;

    try {
      await fetch(`/api/cancel/${item.taskId}`, { method: 'POST' });
      setBatchItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'cancelled' } : i))
      );
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const handleCancelAllBatch = async () => {
    fetch('/api/batch-cancel-all', { method: 'POST' }).catch(() => {});
    const active = batchItems.filter((i) => i.taskId && (i.status === 'downloading' || i.status === 'queued'));
    for (const item of active) {
      if (item.taskId) {
        fetch(`/api/cancel/${item.taskId}`, { method: 'POST' }).catch(() => {});
      }
    }
    setBatchItems((prev) =>
      prev.map((i) => (i.status === 'downloading' || i.status === 'queued' ? { ...i, status: 'cancelled' } : i))
    );
  };

  const handleRetryBatchItem = (id: string) => {
    handleStartBatchDownload([id]);
  };

  // Poll Batch download status
  const activeBatchTaskIdsKey = useMemo(() => {
    if (appMode !== 'batch') return '';
    return batchItems
      .filter((i) => i.taskId && (i.status === 'downloading' || i.status === 'queued' || i.status === 'processing'))
      .map((i) => i.taskId!)
      .sort()
      .join(',');
  }, [batchItems, appMode]);

  useEffect(() => {
    if (appMode !== 'batch' || !activeBatchTaskIdsKey) return;

    let isSubscribed = true;
    const abortController = new AbortController();
    let pollTimeout: NodeJS.Timeout | null = null;
    let consecutiveErrors = 0;

    const pollBatch = async () => {
      if (!isSubscribed || abortController.signal.aborted) return;
      const currentActive = batchItems
        .filter((i) => i.taskId && (i.status === 'downloading' || i.status === 'queued' || i.status === 'processing'))
        .map((i) => i.taskId!);

      if (currentActive.length === 0) return;

      try {
        const response = await fetch('/api/batch-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: currentActive }),
          signal: abortController.signal,
        });

        if (!isSubscribed) return;

        if (response.ok) {
          consecutiveErrors = 0;
          const data = await response.json();
          if (data && data.tasks && isSubscribed) {
            setBatchItems((prev) =>
              prev.map((item) => {
                if (item.taskId && data.tasks[item.taskId]) {
                  const statusInfo = data.tasks[item.taskId];

                  if (statusInfo.status === 'completed' && item.status !== 'completed') {
                    if (settings.playNotificationSound) soundNotify.playCompleteSound();

                    const batchTitle = item.info?.title || item.url;
                    const batchCreatedAt = new Date().toISOString();

                    const localBatchItem = {
                      id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                      userId: user?.uid || 'guest',
                      title: batchTitle,
                      url: item.url,
                      type: item.type,
                      quality: item.quality,
                      format: item.format,
                      createdAt: batchCreatedAt,
                    };
                    try {
                      const cur = JSON.parse(localStorage.getItem('fluxload_download_history') || '[]');
                      const upd = [localBatchItem, ...cur.filter((x: any) => x.url !== item.url)].slice(0, 50);
                      localStorage.setItem('fluxload_download_history', JSON.stringify(upd));
                      if (!user) setHistory(upd);
                    } catch {}

                    if (user) {
                      const saveRecord = async () => {
                        try {
                          const colRef = collection(db, 'users', user.uid, 'downloads');
                          const docRef = doc(colRef);
                          await setDoc(docRef, {
                            id: docRef.id,
                            userId: user.uid,
                            title: batchTitle,
                            url: item.url,
                            type: item.type,
                            quality: item.quality,
                            format: item.format,
                            createdAt: batchCreatedAt,
                          });
                        } catch (e) {
                          // Silent history logging error
                        }
                      };
                      saveRecord();
                    }
                  }

                  return {
                    ...item,
                    status: statusInfo.status,
                    progress: statusInfo.progress,
                    speed: statusInfo.speed || item.speed,
                    downloadedSize: statusInfo.downloadedSize || item.downloadedSize,
                    totalSize: statusInfo.totalSize || item.totalSize,
                    eta: statusInfo.eta || item.eta,
                    filename: statusInfo.filename || item.filename,
                    downloadUrl: statusInfo.downloadUrl || item.downloadUrl,
                    error: statusInfo.error || item.error,
                  };
                }
                return item;
              })
            );
          }
          pollTimeout = setTimeout(pollBatch, 1000);
          return;
        }

        consecutiveErrors++;
        const nextDelay = Math.min(1000 * Math.pow(1.5, consecutiveErrors), 5000);
        pollTimeout = setTimeout(pollBatch, nextDelay);
      } catch (err: any) {
        if (!isSubscribed || err?.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        consecutiveErrors++;
        const nextDelay = Math.min(1000 * Math.pow(1.5, consecutiveErrors), 4000);
        pollTimeout = setTimeout(pollBatch, nextDelay);
      }
    };

    pollBatch();

    return () => {
      isSubscribed = false;
      abortController.abort();
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [activeBatchTaskIdsKey, appMode, user, settings]);

  const isDownloadingAnyBatch = batchItems.some(
    (i) => i.status === 'downloading' || i.status === 'processing' || i.status === 'queued'
  );

  // ==========================================
  // DIAGNOSTICS & HISTORY
  // ==========================================
  const handleTriggerErrorTest = (errorType: string, errorMsg: string) => {
    setAppMode('single');
    if (['invalid_url', 'video_unavailable', 'network_timeout'].includes(errorType)) {
      setSingleStep('url');
      setVideoInfo(null);
      setError(`[Diagnostics Test] ${errorMsg}`);
    } else {
      setSingleStep('downloading');
      setTaskId('test-err-' + Date.now());
      setTaskStatus({
        id: 'test-err-' + Date.now(),
        status: 'error',
        progress: 40,
        speed: '0 KB/s',
        downloadedSize: '14.2 MB',
        totalSize: '65.0 MB',
        eta: 'Failed',
        error: `[Diagnostics Test] ${errorMsg}`,
      });
    }
  };

  const handleDeleteHistory = async (id: string) => {
    // 1. Remove from localStorage
    try {
      const cur = JSON.parse(localStorage.getItem('fluxload_download_history') || '[]');
      const upd = cur.filter((x: any) => x.id !== id);
      localStorage.setItem('fluxload_download_history', JSON.stringify(upd));
      if (!user) setHistory(upd);
    } catch {}

    // 2. If logged in and not purely a local temporary ID, delete from Firestore
    if (user && !id.startsWith('local-')) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'downloads', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/downloads/${id}`);
      }
    }
  };

  const handleToggleFavorite = async (id: string) => {
    let nextFavorite = false;
    setHistory((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          nextFavorite = !item.isFavorite;
          return { ...item, isFavorite: nextFavorite };
        }
        return item;
      });
      try {
        localStorage.setItem('fluxload_download_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    if (user && !id.startsWith('local-')) {
      try {
        await setDoc(
          doc(db, 'users', user.uid, 'downloads', id),
          { isFavorite: nextFavorite },
          { merge: true }
        );
      } catch (err) {
        console.warn('Failed to sync favorite state to Firestore:', err);
      }
    }
  };

  let singlePhase: DownloadPhase = 'idle';
  if (isLoading) {
    singlePhase = 'preparing';
  } else if (taskId) {
    if (taskStatus.status === 'downloading') {
      if (taskStatus.progress >= 99) {
        singlePhase = 'processing';
      } else {
        singlePhase = 'downloading';
      }
    } else if (taskStatus.status === 'processing') {
      singlePhase = 'processing';
    } else if (taskStatus.status === 'completed' || taskStatus.status === 'done') {
      singlePhase = 'completed';
    } else if (taskStatus.status === 'paused') {
      singlePhase = 'paused';
    } else if (taskStatus.status === 'error') {
      singlePhase = 'error';
    } else if (taskStatus.status === 'cancelled') {
      singlePhase = 'cancelled';
    } else {
      singlePhase = 'preparing';
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white w-full max-w-[100vw] overflow-x-hidden relative">
      <Header
        onOpenErrorTest={() => setIsErrorTestModalOpen(true)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={handleOpenSettings}
        onOpenStickerMaker={() => setIsStickerMakerOpen(true)}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        historyCount={history.length}
        currentMode={appMode}
        onModeChange={(m) => setAppMode(m)}
        batchCount={batchItems.length}
      />

      {/* Official FluxLoad Telegram Channel Community Banner (t.me/FluxLoad) */}
      <CommunityJoinBanner
        onOpenStickerMaker={() => setIsStickerMakerOpen(true)}
        onOpenTelegramSettings={() => handleOpenSettings('telegram')}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 md:p-8 pb-24 md:pb-8 relative w-full max-w-[100vw] overflow-x-hidden">
        {/* Ambient background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] max-w-full h-[700px] bg-cyan-500/5 rounded-full blur-[140px]" />
        </div>

        <div className="w-full max-w-4xl z-10">
          {systemStatus && !systemStatus.installed && (
            <YtDlpAlertBanner status={systemStatus} />
          )}

          {/* SINGLE DOWNLOAD MODE - Fully Automatic (No Save Page, No 2nd Save Button) */}
          {appMode === 'single' && (
            <UrlInputCard
              onStartSingleDownload={handleStartSingleDownload}
              onAnalyzeBatch={(urls) => {
                setAppMode('batch');
                handleAnalyzeBatch(urls);
              }}
              onPreviewFetched={(info) => setVideoInfo(info)}
              taskStatus={taskId ? taskStatus : null}
              videoInfo={videoInfo}
              taskId={taskId}
              phase={singlePhase}
              error={error}
              mode="single"
              onModeChange={(m) => setAppMode(m)}
              settings={settings}
              onOpenSettings={(platform) => handleOpenSettings('cookies', platform)}
              onOpenTelegramExport={handleOpenTelegramExport}
              onOpenTelegramSettings={() => handleOpenSettings('telegram')}
              onOpenAudioCutter={handleOpenAudioCutter}
              onOpenMediaPlayer={handleOpenMediaPlayer}
              onPauseSingle={handlePauseSingle}
              onResumeSingle={handleResumeSingle}
              onCancelSingle={handleCancelSingle}
              onRetrySingle={handleRetrySingle}
              onResetSingle={handleResetSingle}
              autoSaveStatus={autoSaveStatus}
              telegramConfig={telegramConfig}
              onToggleTelegramAutoSend={handleToggleTelegramAutoSend}
              onOpenStickerMaker={() => setIsStickerMakerOpen(true)}
              onOpenHistory={() => setIsHistoryOpen(true)}
            />
          )}

          {/* SOCIAL MEDIA QUICK MODE (TikTok, Instagram Reels, YouTube Shorts) */}
          {appMode === 'social' && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setAppMode('single')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
                >
                  <span>← Back to URL Download</span>
                </button>
              </div>
              <SocialQuickMode
                onStartDownload={(url, opts) => {
                  setAppMode('single');
                  handleStartSingleDownload(url, opts);
                }}
                onOpenAudioCutter={(url) => handleOpenAudioCutter(undefined, url)}
                isDownloading={isLoading}
              />
            </div>
          )}

          {/* MULTIPLE / BATCH DOWNLOAD MODE */}
          {appMode === 'batch' && (
            <BatchDownloadManager
              items={batchItems}
              onUpdateItem={handleUpdateBatchItem}
              onRemoveItem={handleRemoveBatchItem}
              onClearAll={handleClearAllBatch}
              onAddUrls={handleAddBatchUrls}
              onStartBatchDownload={handleStartBatchDownload}
              onCancelItem={handleCancelBatchItem}
              onCancelAll={handleCancelAllBatch}
              onRetryItem={handleRetryBatchItem}
              onResetToInput={() => {
                setAppMode('single');
                handleResetSingle();
              }}
              onOpenSettings={() => setIsSettingsOpen(true)}
              isDownloadingAny={isDownloadingAnyBatch}
              batchSettings={{
                concurrency: settings.batchConcurrency,
                autoTriggerBrowserDownload: settings.autoSaveToDownloads,
              }}
              onUpdateBatchSettings={(updates) => {
                if (updates.concurrency !== undefined) {
                  handleUpdateSettings({ batchConcurrency: updates.concurrency });
                }
                if (updates.autoTriggerBrowserDownload !== undefined) {
                  handleUpdateSettings({ autoSaveToDownloads: updates.autoTriggerBrowserDownload });
                }
              }}
            />
          )}

          {/* AUDIO CUTTER & RINGTONE MODE */}
          {appMode === 'cutter' && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setAppMode('single')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
                >
                  <span>← Back to URL Downloader</span>
                </button>
              </div>
              <AudioCutterModal
                isOpen={true}
                onClose={() => setAppMode('single')}
                playNotificationSound={settings.playNotificationSound}
              />
            </div>
          )}

          {/* LOCAL MEDIA TRANSCODER MODE */}
          {appMode === 'converter' && (
            <div className="space-y-4">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => setAppMode('single')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
                >
                  <span>← Back to URL Downloader</span>
                </button>
              </div>
              <LocalMediaConverter
                onBackToDownloads={() => setAppMode('single')}
                playNotificationSound={settings.playNotificationSound}
              />
            </div>
          )}

          {/* AUTONOMOUS DOMAIN VIDEO CRAWLER & AUTO-POSTER MODE */}
          {appMode === 'crawler' && (
            <DomainWatcherManager
              onBackToDownloads={() => setAppMode('single')}
              telegramConfig={telegramConfig}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </div>
      </main>

      <Footer
        onOpenDiagnostics={() => handleOpenSettings('diagnostics')}
      />

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false);
            setSettingsPlatform(undefined);
          }}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetSettings={handleResetSettings}
          initialTab={settingsTab}
          initialPlatform={settingsPlatform}
          user={user}
          history={history}
          onExportAllData={handleExportAllData}
          onImportAllData={handleImportAllData}
          onSyncAllData={handleSyncAllData}
        />
      )}

      {isErrorTestModalOpen && (
        <ErrorTestModal
          isOpen={isErrorTestModalOpen}
          onClose={() => setIsErrorTestModalOpen(false)}
          onTriggerErrorTest={handleTriggerErrorTest}
        />
      )}

      {isHistoryOpen && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          onDelete={handleDeleteHistory}
          onToggleFavorite={handleToggleFavorite}
          onPlayMedia={handleOpenMediaPlayer}
          onTrimMedia={(taskId, url, title) => handleOpenAudioCutter(taskId, url, title)}
          onSendToTelegram={(item) =>
            handleOpenTelegramExport({
              taskId: item.taskId,
              downloadUrl: item.downloadUrl,
              title: item.title,
              format: item.format,
              isAudio: item.type === 'audio',
            })
          }
          onSelectUrl={(url) => {
            setAppMode('single');
            handleStartSingleDownload(url, {
              type: settings.defaultType || 'video',
              quality: settings.defaultQuality || '720p',
              format: settings.defaultFormat || 'mp4',
            });
          }}
          onExportAllData={handleExportAllData}
          onSyncAllData={handleSyncAllData}
          isSignedIn={!!user}
          onSignIn={handleLogin}
        />
      )}

      {/* Telegram Channel Export Modal */}
      {isTelegramModalOpen && (
        <TelegramExportModal
          isOpen={isTelegramModalOpen}
          onClose={() => setIsTelegramModalOpen(false)}
          taskId={telegramExportParams.taskId}
          downloadUrl={telegramExportParams.downloadUrl}
          title={telegramExportParams.title}
          thumbnail={telegramExportParams.thumbnail}
          fileSize={telegramExportParams.fileSize}
          format={telegramExportParams.format}
          isAudio={telegramExportParams.isAudio}
        />
      )}

      {/* Audio Cutter & Ringtone Modal */}
      {isAudioCutterOpen && (
        <AudioCutterModal
          isOpen={isAudioCutterOpen}
          onClose={() => setIsAudioCutterOpen(false)}
          initialTaskId={audioCutterParams.taskId}
          initialMediaUrl={audioCutterParams.mediaUrl}
          initialTitle={audioCutterParams.title}
          playNotificationSound={settings.playNotificationSound}
        />
      )}

      {/* Media Player Modal with Speed & Loop */}
      {isMediaPlayerOpen && (
        <MediaPlayerModal
          isOpen={isMediaPlayerOpen}
          onClose={() => setIsMediaPlayerOpen(false)}
          mediaUrl={mediaPlayerParams.mediaUrl}
          title={mediaPlayerParams.title}
          type={mediaPlayerParams.type}
          taskId={mediaPlayerParams.taskId}
          onOpenAudioCutter={handleOpenAudioCutter}
        />
      )}

      {/* FluxLoad Logo & Telegram 512x512 Sticker Maker Studio (.size remove) */}
      <LogoStickerMakerModal
        isOpen={isStickerMakerOpen}
        onClose={() => setIsStickerMakerOpen(false)}
        telegramConfig={telegramConfig}
        onShowToast={(msg, type) =>
          addGlobalToast(
            type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success',
            'Logo & Sticker Studio',
            msg
          )
        }
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentMode={appMode}
        onModeChange={(m) => setAppMode(m)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
        batchCount={batchItems.length}
        onOpenSettings={(tab) => handleOpenSettings(tab)}
      />

      {/* Global Real-time Toasts (Telegram Auto-Post & Downloads) */}
      <ToastContainer toasts={globalToasts} onDismiss={dismissGlobalToast} />
    </div>
  );
}
