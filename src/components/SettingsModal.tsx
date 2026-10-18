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
  Send,
  Tv,
  Bot,
  Share2,
  HelpCircle,
  Database,
  Save,
  Download,
  Cloud,
  Plus,
  Radio,
  AtSign,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { FluxLoadSettings, DEFAULT_SETTINGS, VideoQuality, VideoFormatChoice, DownloadType, CookieStatus } from '../types';
import { soundNotify } from '../lib/soundNotify';
import { ToastContainer, ToastData } from './Toast';
import { TelegramHealthDashboard } from './TelegramHealthDashboard';

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
  initialTab?: 'general' | 'cookies' | 'diagnostics' | 'telegram' | 'data';
  initialPlatform?: string;
  user?: User | null;
  history?: any[];
  onSyncAllData?: () => Promise<{ success: boolean; syncedItemsCount: number; error?: string }>;
  onExportAllData?: () => void;
  onImportAllData?: (jsonStr: string) => Promise<{ success: boolean; error?: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
  initialTab = 'general',
  initialPlatform,
  user,
  history = [],
  onSyncAllData,
  onExportAllData,
  onImportAllData,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'cookies' | 'diagnostics' | 'telegram' | 'data'>(initialTab);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Telegram Integration State
  const [telegramConfig, setTelegramConfig] = useState<{
    configured: boolean;
    botTokenMasked?: string;
    chatId?: string;
    channelTitle?: string;
    channels?: Array<{
      chatId: string;
      channelTitle?: string;
      enabled?: boolean;
      botToken?: string;
      botUsername?: string;
      customCaption?: string;
    }>;
    channelCount?: number;
    activeChannelCount?: number;
    botUsername?: string;
    autoSend?: boolean;
    removeSizeLimit?: boolean;
    maxUploadGb?: number;
    uploadDeliveryMode?: 'smart_10gb' | 'direct_50mb' | 'local_2gb';
    localApiServerUrl?: string;
  } | null>(null);
  const [newChannelInput, setNewChannelInput] = useState('');
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [expandedChannelChatId, setExpandedChannelChatId] = useState<string | null>(null);
  const [channelCustomBot, setChannelCustomBot] = useState<Record<string, string>>({});
  const [channelCustomCaption, setChannelCustomCaption] = useState<Record<string, string>>({});
  const [isSavingChannel, setIsSavingChannel] = useState<Record<string, boolean>>({});
  const [showChannelBotToken, setShowChannelBotToken] = useState<Record<string, boolean>>({});
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [isTgSaving, setIsTgSaving] = useState(false);
  const [isTgTesting, setIsTgTesting] = useState(false);
  const [tgMsg, setTgMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [showTgGuide, setShowTgGuide] = useState(false);

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

  const fetchTelegramConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setTelegramConfig(data);
        if (data.chatId && !tgChatId) {
          setTgChatId(data.chatId);
        }
        if (data.channels && Array.isArray(data.channels) && data.channels.length > 0) {
          try {
            localStorage.setItem('fluxload_saved_channels', JSON.stringify(data.channels));
          } catch {}
          const botMap: Record<string, string> = {};
          const captionMap: Record<string, string> = {};
          data.channels.forEach((c: any) => {
            if (c.botToken) botMap[c.chatId] = c.botToken;
            if (c.customCaption) captionMap[c.chatId] = c.customCaption;
          });
          setChannelCustomBot((prev) => ({ ...botMap, ...prev }));
          setChannelCustomCaption((prev) => ({ ...captionMap, ...prev }));
        } else {
          // If server channels lost or wiped during high load/crash, restore from localStorage
          try {
            const saved = localStorage.getItem('fluxload_saved_channels');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 1) {
                const restRes = await fetch('/api/telegram/channels/restore', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ channels: parsed }),
                });
                if (restRes.ok) {
                  const restData = await restRes.json();
                  if (restData.channels) {
                    setTelegramConfig((prev) => (prev ? { ...prev, channels: restData.channels } : prev));
                  }
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }, [tgChatId]);

  useEffect(() => {
    if (isOpen) {
      fetchCookieStatus();
      fetchDiagnostics();
      fetchTelegramConfig();
      if (initialTab) {
        setActiveTab(initialTab);
      }
      if (initialPlatform) {
        setActiveTab('cookies');
        setActivePlatformModal(initialPlatform);
      }
    }
  }, [isOpen, initialTab, initialPlatform, fetchCookieStatus, fetchDiagnostics, fetchTelegramConfig]);

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

  const handleSaveTelegram = async (forceDirect = false) => {
    if (!tgBotToken.trim() || !tgChatId.trim()) {
      setTgMsg({ type: 'error', text: 'Bot Token এবং Channel Username উভয়ই প্রদান করুন।' });
      return;
    }
    setIsTgSaving(true);
    setTgMsg(null);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgBotToken.trim(),
          chatId: tgChatId.trim(),
          forceSave: forceDirect,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.isWarning) {
          setTgMsg({ type: 'warning', text: data.message });
          addToast('warning', 'Data Saved', 'বট ও চ্যানেলের সকল তথ্য সফলভাবে সেভ হয়েছে!');
        } else {
          setTgMsg({ type: 'success', text: data.message || 'Telegram Bot সফলভাবে চ্যানেলে সংযুক্ত হয়েছে!' });
          addToast('success', 'Telegram Connected', data.message || 'বট প্রস্তুত রয়েছে।');
        }
        // Save local copy for backup
        try {
          localStorage.setItem('fluxload_telegram_config', JSON.stringify({
            chatId: data.chatId || tgChatId.trim(),
            channelTitle: data.channelTitle,
            botUsername: data.botUsername,
            configured: true,
            savedAt: new Date().toISOString(),
          }));
        } catch {}
        setTgBotToken('');
        fetchTelegramConfig();
      } else {
        setTgMsg({ type: 'error', text: data.error || 'টেলিগ্রাম বটের সাথে কানেক্ট করা যায়নি।' });
        addToast('error', 'Connection Notice', data.error || 'বট পারমিশন চেক করুন।');
      }
    } catch (e: any) {
      setTgMsg({ type: 'error', text: e.message || 'Network error' });
    } finally {
      setIsTgSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTgTesting(true);
    setTgMsg(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgBotToken.trim() || undefined,
          allChannels: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const detailLines = data.results
          ? data.results.map((r: any) => `${r.success ? '✅' : '❌'} ${r.channelTitle || r.targetChat}: ${r.success ? 'সফল' : (r.error || 'ব্যর্থ')}`).join('\n')
          : '';
        const msgText = detailLines ? `${data.message}\n\n${detailLines}` : data.message;
        setTgMsg({ type: 'success', text: msgText });
        addToast('success', 'Test Message Sent 🚀', data.message || 'সকল চ্যানেলে টেস্ট মেসেজ পাঠানো হয়েছে।');
      } else {
        setTgMsg({ type: 'error', text: data.error || 'টেস্ট ব্যর্থ হয়েছে।' });
        addToast('error', 'Test Failed', data.error || 'বটকে চ্যানেলে অ্যাডমিন পারমিশন দিন।');
      }
    } catch (e: any) {
      setTgMsg({ type: 'error', text: e.message || 'Error executing test.' });
    } finally {
      setIsTgTesting(false);
    }
  };

  const handleDeleteTelegram = async () => {
    try {
      const res = await fetch('/api/telegram/config', { method: 'DELETE' });
      if (res.ok) {
        addToast('info', 'Disconnected', 'টেলিগ্রাম কনফিগারেশন মুছে ফেলা হয়েছে।');
        setTelegramConfig({ configured: false });
        setTgChatId('');
        setTgBotToken('');
        setTgMsg(null);
      }
    } catch {}
  };

  const handleSaveTelegramPreferences = async (prefs: {
    maxUploadGb: number;
    uploadDeliveryMode: 'smart_10gb' | 'direct_50mb' | 'local_2gb';
    localApiServerUrl?: string;
  }) => {
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgBotToken.trim() || 'configured',
          chatId: telegramConfig?.chatId || tgChatId.trim() || '@channel',
          maxUploadGb: prefs.maxUploadGb,
          uploadDeliveryMode: prefs.uploadDeliveryMode,
          localApiServerUrl: prefs.localApiServerUrl,
          forceSave: true,
        }),
      });
      if (res.ok) {
        addToast('success', '10 GB Settings Saved', 'টেলিগ্রাম ১০ জিবি আপলোড কনফিগারেশন সফলভাবে সেভ হয়েছে।');
        fetchTelegramConfig();
      }
    } catch (e: any) {
      addToast('error', 'Error Saving Preferences', e.message);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannelInput.trim()) return;
    setIsAddingChannel(true);
    try {
      const res = await fetch('/api/telegram/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: newChannelInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewChannelInput('');
        addToast('success', 'চ্যানেল যুক্ত হয়েছে 📡', data.message);
        if (data.channels) {
          setTelegramConfig((prev) =>
            prev
              ? {
                  ...prev,
                  channels: data.channels,
                  channelCount: data.channels.length,
                  activeChannelCount: data.channels.filter((c: any) => c.enabled !== false).length,
                }
              : prev
          );
        }
      } else {
        addToast('error', 'চ্যানেল যুক্ত করা যায়নি', data.error || 'চ্যানেলটি সঠিক কিনা চেক করুন।');
      }
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleRemoveChannel = async (targetChatId: string) => {
    try {
      const res = await fetch('/api/telegram/channels/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast('info', 'চ্যানেল সরানো হয়েছে', data.message);
        if (data.channels) {
          setTelegramConfig((prev) =>
            prev
              ? {
                  ...prev,
                  channels: data.channels,
                  channelCount: data.channels.length,
                  activeChannelCount: data.channels.filter((c: any) => c.enabled !== false).length,
                }
              : prev
          );
        }
      } else {
        addToast('error', 'Error', data.error || 'চ্যানেল সরানো যায়নি');
      }
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    }
  };

  const handleToggleChannel = async (targetChatId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch('/api/telegram/channels/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: targetChatId, enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (res.ok && data.channels) {
        setTelegramConfig((prev) =>
          prev
            ? {
                ...prev,
                channels: data.channels,
                channelCount: data.channels.length,
                activeChannelCount: data.channels.filter((c: any) => c.enabled !== false).length,
              }
            : prev
        );
        try {
          localStorage.setItem('fluxload_saved_channels', JSON.stringify(data.channels));
        } catch {}
      }
    } catch {}
  };

  const handleSaveChannelCustomSettings = async (targetChatId: string) => {
    setIsSavingChannel((prev) => ({ ...prev, [targetChatId]: true }));
    try {
      const botToken = channelCustomBot[targetChatId] !== undefined ? channelCustomBot[targetChatId].trim() : '';
      const customCaption = channelCustomCaption[targetChatId] !== undefined ? channelCustomCaption[targetChatId] : '';
      const res = await fetch('/api/telegram/channels/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          botToken,
          customCaption,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast('success', 'চ্যানেল সেটিংস সেভ হয়েছে ✅', data.message);
        if (data.channels) {
          setTelegramConfig((prev) =>
            prev
              ? {
                  ...prev,
                  channels: data.channels,
                  channelCount: data.channels.length,
                  activeChannelCount: data.channels.filter((c: any) => c.enabled !== false).length,
                }
              : prev
          );
          try {
            localStorage.setItem('fluxload_saved_channels', JSON.stringify(data.channels));
          } catch {}
        }
      } else {
        addToast('error', 'সেটিংস সেভ ব্যর্থ', data.error || 'বট টোকেন বা চ্যানেল তথ্য সঠিক কিনা চেক করুন।');
      }
    } catch (e: any) {
      addToast('error', 'Error', e.message);
    } finally {
      setIsSavingChannel((prev) => ({ ...prev, [targetChatId]: false }));
    }
  };

  const handlePerformSync = async () => {
    if (!onSyncAllData) return;
    setIsSyncingAll(true);
    setSyncFeedback(null);
    try {
      const res = await onSyncAllData();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: `সফলভাবে ক্লাউডে সব ডাটা সেভ হয়েছে! (${res.syncedItemsCount}টি আইটেম ও সেটিংস সিঙ্ক সম্পন্ন)`,
        });
        addToast('success', 'Data Saved', 'সব ডাটা সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে।');
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'ক্লাউড সিঙ্ক সম্পন্ন করা যায়নি।',
        });
        addToast('error', 'Sync Failed', res.error || 'সিঙ্ক ব্যর্থ হয়েছে');
      }
    } catch (err: any) {
      setSyncFeedback({ type: 'error', message: err.message || 'Error syncing data' });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSaveAllDataNow = async () => {
    setIsSyncingAll(true);
    setSyncFeedback(null);
    try {
      // 1. Commit settings to localStorage
      onUpdateSettings({});

      // 2. Persist Telegram config to localStorage if active
      let tgData = telegramConfig;
      if (!tgData?.configured && tgChatId) {
        tgData = { configured: true, chatId: tgChatId, channelTitle: tgChatId };
      }
      try {
        localStorage.setItem('fluxload_settings', JSON.stringify(settings));
        localStorage.setItem('fluxload_download_history', JSON.stringify(history));
        if (tgData) {
          localStorage.setItem('fluxload_telegram_config', JSON.stringify(tgData));
        }
      } catch {}

      // 3. Cloud sync if logged in
      let cloudMsg = '';
      if (user && onSyncAllData) {
        const cRes = await onSyncAllData();
        if (cRes.success) {
          cloudMsg = ` এবং ক্লাউডে ${cRes.syncedItemsCount}টি রেকর্ড সিঙ্ক সম্পন্ন!`;
        }
      }

      // 4. Trigger JSON backup download
      if (onExportAllData) {
        onExportAllData();
      }

      setSyncFeedback({
        type: 'success',
        message: `সব ডাটা সফলভাবে সেভ হয়েছে (All Data Saved)! সেটিংস, হিস্টোরি ও টেলিগ্রাম ব্যাকআপ ফাইল ডাউনলোড হয়েছে${cloudMsg}`,
      });
      addToast('success', 'All Data Saved', 'আপনার সব ডাটা সম্পূর্ণভাবে সংরক্ষিত হয়েছে!');
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: `ডাটা সেভ করতে সমস্যা হয়েছে: ${err.message}`,
      });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (onImportAllData && content) {
        setIsImporting(true);
        try {
          const res = await onImportAllData(content);
          if (res.success) {
            addToast('success', 'Backup Restored', 'ব্যাকআপ থেকে সব ডাটা সফলভাবে ফিরিয়ে আনা হয়েছে!');
            setSyncFeedback({ type: 'success', message: 'সব ডাটা সফলভাবে রিস্টোর হয়েছে!' });
          } else {
            addToast('error', 'Restore Failed', res.error || 'রিস্টোর করা যায়নি।');
            setSyncFeedback({ type: 'error', message: res.error || 'Invalid backup file' });
          }
        } finally {
          setIsImporting(false);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-orange-500/40 shadow-md shadow-orange-500/20 bg-black shrink-0">
              <img
                src="/logo.jpg"
                alt="FluxLoad"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
                FluxLoad System Settings
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20">
                  power by YEASIN
                </span>
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

          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'telegram'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>টেলিগ্রাম চ্যানেল</span>
            {telegramConfig?.configured && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Telegram Bot Connected" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'data'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>সব ডাটা সেভ</span>
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

            {/* 4. Smart Retry for Network Errors */}
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-2xl space-y-3.5 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${settings.smartRetryEnabled !== false ? 'animate-spin-slow' : ''}`} />
                  Smart Retry (নেটওয়ার্ক এরর অটো-রীট্রাই)
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
                    settings.smartRetryEnabled !== false
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {settings.smartRetryEnabled !== false ? 'Active' : 'Disabled'}
                </span>
              </div>

              {/* Enable / Disable Toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="pr-4">
                  <span className="text-xs font-semibold text-slate-200 block">
                    Automatic Network Error Recovery
                  </span>
                  <span className="text-[11px] text-slate-400 leading-relaxed block mt-0.5">
                    Automatically recovers and retries downloads when interrupted by temporary socket timeouts, Wi-Fi blips, or server disconnections without restarting from scratch.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      smartRetryEnabled: settings.smartRetryEnabled === false ? true : false,
                    })
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    settings.smartRetryEnabled !== false ? 'bg-amber-500' : 'bg-slate-800'
                  }`}
                  title={settings.smartRetryEnabled !== false ? 'Disable Smart Retry' : 'Enable Smart Retry'}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.smartRetryEnabled !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Configurable Limit for Retry Attempts (when enabled) */}
              {settings.smartRetryEnabled !== false && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-300 block">Maximum Retry Limit</span>
                      <span className="text-[11px] text-slate-400">
                        Number of attempts before alerting and switching to manual retry
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold">
                      {settings.smartRetryMaxAttempts ?? 3} Attempts
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => onUpdateSettings({ smartRetryMaxAttempts: num })}
                        className={`py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          (settings.smartRetryMaxAttempts ?? 3) === num
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-bold shadow-sm ring-1 ring-amber-400/40'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {num} {num === 1 ? 'Time' : 'Times'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                    <span>1: Quick failover</span>
                    <span className="text-amber-400/90 font-medium">3: Recommended (Balanced)</span>
                    <span>5: High persistence</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Batch Settings */}
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

            {/* 6. Video File Size Limit Safeguard */}
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

        {/* TAB 4: TELEGRAM CHANNEL INTEGRATION */}
        {activeTab === 'telegram' && (
          <div className="space-y-5 text-sm animate-fadeIn">
            {/* Top Banner */}
            <div className="bg-sky-950/40 border border-sky-500/30 p-4 rounded-2xl flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Send className="w-5 h-5 fill-current/20" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>Telegram Channel Integration (টেলিগ্রাম চ্যানেল)</span>
                  {telegramConfig?.configured && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Connected
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ডাউনলোড হওয়া যেকোনো ভিডিও ও অডিও এক ক্লিকে সরাসরি আপনার টেলিগ্রাম চ্যানেলে পাঠাতে আপনার টেলিগ্রাম বট কানেক্ট করুন।
                </p>
              </div>
            </div>

            {/* Status Feedback Message */}
            {tgMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                  tgMsg.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : tgMsg.type === 'warning'
                    ? 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="whitespace-pre-line font-sans">{tgMsg.text}</div>
                {tgMsg.type === 'error' && (tgMsg.text.toLowerCase().includes('member') || tgMsg.text.toLowerCase().includes('forbidden') || tgMsg.text.toLowerCase().includes('permission')) && (
                  <div className="mt-2.5 pt-2.5 border-t border-rose-500/20 text-[11px] text-rose-200 space-y-1.5">
                    <p className="font-bold flex items-center gap-1">
                      <span>💡 সমাধান (How to Fix in 10 seconds):</span>
                    </p>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-300">
                      <li>আপনার Telegram চ্যানেলের নাম/প্রোফাইলে ট্যাপ করুন ➜ <strong>Edit (⚙️)</strong> ➜ <strong>Administrators</strong> এ যান।</li>
                      <li><strong>Add Admin</strong>-এ ট্যাপ করে আপনার বট ইউজারনেম (e.g. <code className="text-sky-300 font-mono">@{telegramConfig?.botUsername || 'black_world722_bot'}</code>) সিলেক্ট করুন।</li>
                      <li><strong>'Post Messages'</strong> পারমিশন অন করে <strong>Save / Done</strong> করুন।</li>
                    </ol>
                    <div className="pt-1.5">
                      <a
                        href={`https://t.me/${telegramConfig?.botUsername || 'black_world722_bot'}?startchannel=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>১-ক্লিকে বটকে @FluxLoad চ্যানেলে অ্যাডমিন করুন (1-Click Add Admin)</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* REAL-TIME TELEGRAM API HEALTH & 10GB UPLOAD MONITOR */}
            <TelegramHealthDashboard
              onTriggerTestMessage={handleTestTelegram}
              isTestingMessage={isTgTesting}
              configured={Boolean(telegramConfig?.configured)}
              channelTitle={telegramConfig?.channelTitle}
              chatId={telegramConfig?.chatId}
              botUsername={telegramConfig?.botUsername}
              onSavePreferences={handleSaveTelegramPreferences}
            />

            {/* Configured State or Setup Form */}
            {telegramConfig?.configured ? (
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{telegramConfig.channelTitle}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {telegramConfig.chatId} {telegramConfig.botUsername ? `• @${telegramConfig.botUsername}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Token: {telegramConfig.botTokenMasked}
                  </span>
                </div>

                {/* Official Community Channel Invitation */}
                <div className="p-3.5 bg-gradient-to-r from-sky-950/60 via-slate-900 to-blue-950/60 border border-sky-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/30">
                      <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-100">Official Channel: https://t.me/FluxLoad</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                          Community
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300 font-medium">
                        Join now everybody! ক্লাউড ভিডিও ডেলিভারি ও স্টিকারের জন্য আমাদের অফিশিয়াল চ্যানেলে যোগ দিন।
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <a
                      href="https://t.me/FluxLoad"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Join @FluxLoad</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Auto-Post on Complete Toggle */}
                <div className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>ভিডিও ডাউনলোড শেষ হলে অটো টেলিগ্রামে পোস্ট (Auto-Post on Complete)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      ভিডিও ডাউনলোড হওয়ার সাথে সাথে স্বয়ংক্রিয়ভাবে আপনার Telegram চ্যানেলে চলে যাবে। (৫০ MB এর নিচের ভিডিও সরাসরি ফাইল হিসেবে, এবং ৫০ MB - ১০ GB এর ফাইল আল্ট্রা কার্ড ও স্ট্রিমিং সহ)।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !telegramConfig.autoSend;
                      try {
                        const res = await fetch('/api/telegram/toggle-auto-send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ autoSend: next }),
                        });
                        if (res.ok) {
                          setTelegramConfig((prev) => (prev ? { ...prev, autoSend: next } : prev));
                          addToast(
                            'success',
                            next ? 'Auto-Post Enabled 🚀' : 'Auto-Post Disabled',
                            next
                              ? 'ভিডিও ডাউনলোড শেষ হলেই টেলিগ্রাম চ্যানেলে চলে যাবে।'
                              : 'অটো পোস্ট বন্ধ রাখা হয়েছে।'
                          );
                        }
                      } catch {}
                    }}
                    className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      telegramConfig.autoSend
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span>{telegramConfig.autoSend ? '✓ চালু (ACTIVE)' : 'বন্ধ (OFF)'}</span>
                  </button>
                </div>

                {/* .size remove / Remove Size Limit Toggle (10GB+ Unlimited Engine) */}
                <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>সাইজ লিমিট রিমুভ (.size remove / 10GB+ Unlimited Engine)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      টেলিগ্রামের সাধারণ ৫০ MB সীমা সম্পূর্ণ প্রত্যাহার করে ১০ জিবি পর্যন্ত যে কোনো সাইজের ফাইল সরাসরি হাই-স্পিড ক্লাউড স্ট্রিম ও ডাউনলোড কার্ডের মাধ্যমে ডেলিভারি করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !telegramConfig.removeSizeLimit;
                      try {
                        const res = await fetch('/api/telegram/toggle-remove-size-limit', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ removeSizeLimit: next }),
                        });
                        if (res.ok) {
                          setTelegramConfig((prev) => (prev ? { ...prev, removeSizeLimit: next } : prev));
                          addToast(
                            'success',
                            next ? 'Size Limit Removed ⚡' : 'Standard Limit Mode',
                            next
                              ? 'সাইজ লিমিট সফলভাবে রিমুভ করা হয়েছে (১০ জিবি পর্যন্ত ডেলিভারি)।'
                              : 'সাধারণ সাইজ লিমিট মোড চালু হয়েছে।'
                          );
                        }
                      } catch {}
                    }}
                    className={`shrink-0 px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                      telegramConfig.removeSizeLimit
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span>{telegramConfig.removeSizeLimit ? '✓ সাইজ লিমিট রিমুভড (10GB+)' : 'স্ট্যান্ডার্ড মোড'}</span>
                  </button>
                </div>

                {/* MULTI-CHANNEL BROADCAST MANAGEMENT (একই সাথে অনেক টেলিগ্রাম চ্যানেলে আপলোড) */}
                <div className="p-4 bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-sky-500/30 rounded-xl space-y-3.5 shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                        <span>মাল্টি-চ্যানেল ব্রডকাস্ট (Multi-Channel Broadcast)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-bold">
                          {telegramConfig?.channels?.filter(c => c.enabled !== false).length || 1} টি চ্যানেলে সক্রিয়
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        একই সাথে অনেকগুলো টেলিগ্রাম চ্যানেলে ভিডিও আপলোড করুন। যেকোনো ডাউনলোড সম্পন্ন হলে সব সক্রিয় চ্যানেলে সমান্তরালভাবে (Simultaneous Parallel) আপলোড হবে।
                      </p>
                    </div>
                  </div>

                  {/* Channels List */}
                  <div className="space-y-2">
                    {(telegramConfig?.channels && telegramConfig.channels.length > 0
                      ? telegramConfig.channels
                      : [{ chatId: '@FluxLoad', channelTitle: 'FluxLoad (Official)', enabled: true }]
                    ).map((channel) => {
                      const isOfficial = channel.chatId.toLowerCase() === '@fluxload';
                      const isEnabled = channel.enabled !== false;
                      const isExpanded = expandedChannelChatId === channel.chatId;
                      const hasDedicatedBot = Boolean(channel.botToken);
                      const hasCustomCaption = Boolean(channel.customCaption);
                      const isSavingThis = Boolean(isSavingChannel[channel.chatId]);
                      const showToken = Boolean(showChannelBotToken[channel.chatId]);
                      const currentBotVal = channelCustomBot[channel.chatId] !== undefined
                        ? channelCustomBot[channel.chatId]
                        : (channel.botToken || '');
                      const currentCaptionVal = channelCustomCaption[channel.chatId] !== undefined
                        ? channelCustomCaption[channel.chatId]
                        : (channel.customCaption || '');

                      return (
                        <div
                          key={channel.chatId}
                          className={`rounded-xl border transition-all ${
                            isEnabled
                              ? 'bg-slate-950/80 border-sky-500/30'
                              : 'bg-slate-950/40 border-slate-800 opacity-70'
                          }`}
                        >
                          {/* Channel Card Header */}
                          <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isOfficial ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-300'
                              }`}>
                                <Tv className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-100 truncate">
                                    {channel.channelTitle || channel.chatId}
                                  </span>
                                  {isOfficial && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                      Official
                                    </span>
                                  )}
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                    isEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                                  }`}>
                                    {isEnabled ? '✓ সক্রিয়' : 'বিরত'}
                                  </span>
                                  {hasDedicatedBot && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                      <Bot className="w-2.5 h-2.5" />
                                      {channel.botUsername ? `@${channel.botUsername}` : 'আলাদা বট'}
                                    </span>
                                  )}
                                  {hasCustomCaption && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                      <FileText className="w-2.5 h-2.5" />
                                      কাস্টম ক্যাপশন
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">
                                  {channel.chatId}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Expand/Collapse Custom Bot & Caption */}
                              <button
                                type="button"
                                onClick={() => setExpandedChannelChatId(isExpanded ? null : channel.chatId)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? 'bg-sky-500/30 text-sky-300 border border-sky-500/40'
                                    : hasDedicatedBot || hasCustomCaption
                                    ? 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                }`}
                                title="এই চ্যানেলের জন্য আলাদা বট ও ক্যাপশন কনফিগার করুন"
                              >
                                <Bot className="w-3 h-3 text-sky-400" />
                                <span>আলাদা বট ও ক্যাপশন</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              {/* Toggle Enable/Disable */}
                              <button
                                type="button"
                                onClick={() => handleToggleChannel(channel.chatId, isEnabled)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                  isEnabled
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                                }`}
                              >
                                {isEnabled ? 'অন' : 'অফ'}
                              </button>

                              {/* Remove channel button (if not official) */}
                              {!isOfficial && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChannel(channel.chatId)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="চ্যানেল মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 1-Click Admin Link */}
                              <a
                                href={`https://t.me/${channel.botUsername || telegramConfig?.botUsername || 'black_world722_bot'}?startchannel=true`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 rounded-lg transition-colors"
                                title="বটকে চ্যানেলে অ্যাডমিন করুন"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>

                          {/* Inline Expansion: Dedicated Bot Token & Custom Caption Settings */}
                          {isExpanded && (
                            <div className="p-3.5 border-t border-slate-800/80 bg-slate-900/60 rounded-b-xl space-y-3 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                                <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                                  <Bot className="w-3.5 h-3.5" />
                                  <span>{channel.channelTitle || channel.chatId} - আলাদা বট ও ক্যাপশন কনফিগারেশন</span>
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  একটি বট একটি চ্যানেলে আপলোড করবে (লোড ফ্রি)
                                </span>
                              </div>

                              {/* Dedicated Bot Token Input */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                                    <Key className="w-3 h-3 text-amber-400" />
                                    <span>এই চ্যানেলের জন্য আলাদা বট টোকেন (Dedicated Bot Token):</span>
                                  </label>
                                  {channel.botUsername && (
                                    <span className="text-[10px] font-mono text-emerald-400">
                                      যুক্ত বট: @{channel.botUsername}
                                    </span>
                                  )}
                                </div>
                                <div className="relative">
                                  <input
                                    type={showToken ? 'text' : 'password'}
                                    value={currentBotVal}
                                    onChange={(e) =>
                                      setChannelCustomBot((prev) => ({
                                        ...prev,
                                        [channel.chatId]: e.target.value,
                                      }))
                                    }
                                    placeholder="e.g. 123456789:ABCdefGhIjk..."
                                    className="w-full px-3 py-2 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowChannelBotToken((prev) => ({
                                        ...prev,
                                        [channel.chatId]: !showToken,
                                      }))
                                    }
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                                  >
                                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                  💡 <b>টিপস:</b> প্রতিটি চ্যানেলের জন্য আলাদা বট দিলে একযোগে একাধিক চ্যানেলে আপলোড করার সময় কোনো 429 লিমিট বা ক্র্যাশ হবে না। ফাঁকা রাখলে প্রধান ডিফল্ট বট ব্যবহার হবে।
                                </p>
                              </div>

                              {/* Custom Caption Template */}
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-200 mb-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-sky-400" />
                                  <span>কাস্টম ক্যাপশন টেমপ্লেট (Custom Post Caption):</span>
                                </label>
                                <textarea
                                  rows={3}
                                  value={currentCaptionVal}
                                  onChange={(e) =>
                                    setChannelCustomCaption((prev) => ({
                                      ...prev,
                                      [channel.chatId]: e.target.value,
                                    }))
                                  }
                                  placeholder={`🎬 <b>{title}</b>\n\n📦 <b>{part}</b>\n⚡ সরাসরি Telegram এ প্লে হবে\n📢 <b>Join: {channel}</b>`}
                                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 resize-y"
                                />
                                {/* Quick Tag Inserters */}
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  <span className="text-[10px] text-slate-400">ট্যাগ ইনসার্ট:</span>
                                  {['{title}', '{part}', '{size}', '{channel}', '{chatId}'].map((tag) => (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        const prev = currentCaptionVal;
                                        const updated = prev ? `${prev} ${tag}` : tag;
                                        setChannelCustomCaption((p) => ({
                                          ...p,
                                          [channel.chatId]: updated,
                                        }));
                                      }}
                                      className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer transition-colors"
                                    >
                                      +{tag}
                                    </button>
                                  ))}
                                  {currentCaptionVal && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setChannelCustomCaption((p) => ({
                                          ...p,
                                          [channel.chatId]: '',
                                        }))
                                      }
                                      className="text-[10px] text-rose-400 hover:underline ml-auto cursor-pointer"
                                    >
                                      রিসেট
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Save Button */}
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                                <button
                                  type="button"
                                  onClick={() => setExpandedChannelChatId(null)}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                                >
                                  বন্ধ করুন
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveChannelCustomSettings(channel.chatId)}
                                  disabled={isSavingThis}
                                  className="px-4 py-1.5 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                  {isSavingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5" />
                                  )}
                                  <span>সেটিংস সেভ করুন</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add New Channel Input */}
                  <div className="pt-2.5 border-t border-slate-800/80">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      আরেকটি টেলিগ্রাম চ্যানেল যুক্ত করুন (Add Another Channel):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChannelInput}
                        onChange={(e) => setNewChannelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChannel();
                          }
                        }}
                        placeholder="@MyChannel অথবা https://t.me/MyChannel"
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddChannel}
                        disabled={isAddingChannel || !newChannelInput.trim()}
                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                      >
                        {isAddingChannel ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        <span>যুক্ত করুন</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      💡 যেকোনো চ্যানেল যুক্ত করার পর বটকে (<code className="text-sky-300 font-mono">@{telegramConfig?.botUsername || 'black_world722_bot'}</code>) ঐ চ্যানেলে Administrator করে 'Post Messages' পারমিশন দিয়ে রাখুন।
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={isTgTesting}
                    className="py-2 px-3.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isTgTesting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    <span>টেস্ট মেসেজ পাঠান (Test Post)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteTelegram}
                    className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ডিসকানেক্ট করুন (Remove Bot)
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-sky-400" />
                    <span>Telegram Bot Token:</span>
                  </label>
                  <input
                    type="text"
                    value={tgBotToken}
                    onChange={(e) => setTgBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhIjklmNoPqRstUvwXyz..."
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    টেলিগ্রামের <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline font-mono">@BotFather</a> থেকে পাওয়া বটের গোপন API Token
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                    <Tv className="w-3.5 h-3.5 text-sky-400" />
                    <span>Channel Username বা Chat ID:</span>
                  </label>
                  <input
                    type="text"
                    value={tgChatId}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      const urlMatch = val.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/i);
                      if (urlMatch && urlMatch[1] && !val.includes('/+')) {
                        setTgChatId('@' + urlMatch[1]);
                      } else {
                        setTgChatId(e.target.value);
                      }
                    }}
                    onBlur={() => {
                      const val = tgChatId.trim();
                      if (val && !val.startsWith('@') && !val.startsWith('-') && /^[a-zA-Z0-9_]{3,}$/.test(val)) {
                        setTgChatId('@' + val);
                      }
                    }}
                    placeholder="@crypto_mining_s_e_x অথবা -100123456789"
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    আপনার চ্যানেলের ইউজারনেম (যেমন: <code className="text-sky-300">@crypto_mining_s_e_x</code>) অথবা প্রাইভেট চ্যানেলের Chat ID
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTgGuide(!showTgGuide)}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showTgGuide ? 'গাইড বন্ধ করুন' : 'কীভাবে বট তৈরি করবেন?'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveTelegram(true)}
                      disabled={isTgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="কোনো ভেরিফিকেশন ছাড়া সরাসরি সেভ করুন (Save directly without API check)"
                    >
                      <Save className="w-3.5 h-3.5 text-slate-400" />
                      <span>সরাসরি সেভ করুন</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveTelegram(false)}
                      disabled={isTgSaving || !tgBotToken.trim() || !tgChatId.trim()}
                      className="py-2.5 px-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {isTgSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>কানেক্ট ও সেভ করুন</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Telegram Setup Guide */}
            {(showTgGuide || !telegramConfig?.configured) && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>টেলিগ্রাম চ্যানেল কানেক্ট করার সহজ ৪টি ধাপ:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    টেলিগ্রাম অ্যাপে <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline font-mono">@BotFather</a> সার্চ করে ওপেন করুন এবং <code className="text-amber-300">/newbot</code> লিখে সেন্ড করুন।
                  </li>
                  <li>
                    বটের নাম ও ইউজারনেম দিন (শেষে bot থাকতে হবে)। BotFather আপনাকে একটি <span className="text-amber-300 font-bold">API Token</span> দেবে।
                  </li>
                  <li>
                    আপনার টেলিগ্রাম চ্যানেলের সেটিংসে যান &rarr; <strong>Administrators</strong> &rarr; <strong>Add Admin</strong>-এ গিয়ে তৈরি করা বটটিকে অ্যাড করুন এবং <strong>Post Messages</strong> পারমিশন দিন।
                  </li>
                  <li>
                    টোকেন এবং চ্যানেলের ইউজারনেম (যেমন: <code className="text-sky-300">@your_channel</code>) উপরের বক্সে দিয়ে <strong>"কানেক্ট ও সেভ করুন"</strong> বাটনে ক্লিক করুন।
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ALL DATA SAVE & BACKUP */}
        {activeTab === 'data' && (
          <div className="space-y-6 text-sm animate-fadeIn">
            {/* Master Action: Save All Data Card */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/80 via-teal-950/50 to-slate-900 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-emerald-950/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <h4 className="text-sm sm:text-base font-bold text-emerald-200 flex items-center gap-2">
                    <Save className="w-4 h-4 text-emerald-400" />
                    <span>এক ক্লিকে সব ডাটা সেভ করুন (Save All Data Now)</span>
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  বর্তমান সেটিংস, ডাউনলোড হিস্টোরি, বুকমার্ক এবং টেলিগ্রাম কনফিগারেশন একসাথে লোকাল স্টোরেজ ও ক্লাউডে সেভ হবে এবং ব্যাকআপ ফাইল ডাউনলোড হবে।
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAllDataNow}
                disabled={isSyncingAll}
                className="py-3 px-5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shrink-0 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>সেভ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>সব ডাটা সেভ করুন</span>
                  </>
                )}
              </button>
            </div>

            {/* Status Feedback Message */}
            {syncFeedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-2 ${
                  syncFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                {syncFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{syncFeedback.message}</span>
              </div>
            )}

            {/* Storage Status Overview Card */}
            <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <span>Data Persistence & Cloud Sync</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                        {user ? 'Cloud Active' : 'Local Storage'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      {user ? `Google Account: ${user.email}` : 'Guest Mode • Browser Storage'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 font-mono text-cyan-300">
                    {history.length} Saved Records
                  </span>
                </div>
              </div>

              {/* Real-time Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Firestore Database</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    {user ? 'স্বয়ংক্রিয় ক্লাউড সিঙ্ক চালু (Auto-Sync)' : 'লগইন করলে ক্লাউডে সিঙ্ক হবে'}
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80 space-y-1">
                  <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Device Local Storage</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200">
                    সব সেটিংস ও হিস্টোরি ডিভাইসে সংরক্ষিত
                  </div>
                </div>
              </div>

              {/* Cloud Sync Button */}
              {user && onSyncAllData && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePerformSync}
                    disabled={isSyncingAll}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>সব ডাটা ক্লাউডে সেভ ও সিঙ্ক হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-4 h-4" />
                        <span>সব ডাটা ক্লাউডে সেভ ও সিঙ্ক করুন (Sync All to Cloud Now)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Offline Backup & Restore Section */}
            <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Offline JSON Backup & Restore (অফলাইন ব্যাকআপ)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  আপনার সম্পূর্ণ সেটিংস, ডাউনলোড হিস্টোরি ও বুকমার্ক করা মিডিয়া একটি ফাইলে ডাউনলোড করে রাখুন অথবা ফাইল আপলোড করে ফিরিয়ে আনুন।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Export Button */}
                <button
                  type="button"
                  onClick={onExportAllData}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 hover:text-cyan-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>সব ডাটা ব্যাকআপ ডাউনলোড (Export JSON)</span>
                </button>

                {/* Import Button */}
                <label className="py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500/50 text-slate-200 hover:text-purple-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm">
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  ) : (
                    <Upload className="w-4 h-4 text-purple-400" />
                  )}
                  <span>ব্যাকআপ ফাইল রিস্টোর (Import JSON)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
              </div>
            </div>

            {/* Explicit Save Current Settings Confirmation */}
            <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>বর্তমান অ্যাপ সেটিংস সেভ করুন</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  ডিফল্ট কোয়ালিটি ({settings.defaultQuality}), ফরম্যাট ({settings.defaultFormat}) এবং কনকারেন্সি ব্রাউজারে সংরক্ষিত।
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onUpdateSettings({});
                  addToast('success', 'Settings Saved', 'বর্তমান সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
                  setSyncFeedback({ type: 'success', message: 'বর্তমান সেটিংস সফলভাবে সংরক্ষিত হয়েছে!' });
                }}
                className="py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-1.5 shrink-0 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Settings Now</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-5 mt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAllDataNow}
              disabled={isSyncingAll}
              className="py-2 px-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="সব সেটিংস, হিস্টোরি ও কনফিগারেশন সেভ করুন"
            >
              {isSyncingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>সব ডাটা সেভ করুন</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
