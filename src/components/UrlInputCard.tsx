import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  DownloadType,
  VideoQuality,
  VideoFormatChoice,
  FluxLoadSettings,
  TaskStatus,
  VideoInfo,
  AudioBitrateChoice,
  RateLimitChoice,
  AppNavMode,
} from '../types';
import {
  Download,
  Clipboard,
  ClipboardPaste,
  Trash2,
  Film,
  Music,
  HardDrive,
  Sparkles,
  Sliders,
  ListPlus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pause,
  Play,
  Ban,
  RotateCcw,
  FolderDown,
  ExternalLink,
  Activity,
  Cookie,
  Plus,
  Clock,
  Eye,
  User,
  Scissors,
  Subtitles,
  Gauge,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  QrCode,
  Zap,
  Key,
  Send,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { QrCodeModal } from './QrCodeModal';
import { downloadFileWithBlob } from '../lib/downloadHelper';

export type DownloadPhase =
  | 'idle'
  | 'preparing'
  | 'detecting'
  | 'downloading'
  | 'processing'
  | 'saving'
  | 'completed'
  | 'paused'
  | 'error'
  | 'cancelled';

interface SpeedPoint {
  time: string;
  speed: number;
}

export const VIDEO_QUALITIES: { id: VideoQuality; label: string; badge: string; desc: string }[] = [
  { id: '144p', label: '144p', badge: 'Saver', desc: '144p Tiny' },
  { id: '240p', label: '240p', badge: 'Low', desc: '240p Low' },
  { id: '360p', label: '360p', badge: 'SD', desc: '360p Standard' },
  { id: '480p', label: '480p', badge: 'SD', desc: '480p Standard Def' },
  { id: '720p', label: '720p', badge: 'HD', desc: '720p High Def' },
  { id: '1080p', label: '1080p', badge: 'FHD', desc: '1080p Full HD' },
  { id: '1440p', label: '2K', badge: 'QHD', desc: '1440p 2K' },
  { id: '4k', label: '4K', badge: 'UHD', desc: '4K Ultra HD' },
  { id: 'auto', label: 'Best', badge: 'Max', desc: 'Highest Available' },
];

export const getPlatformBadge = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { name: 'YouTube', color: 'bg-red-500/20 text-red-300 border-red-500/40' };
  }
  if (lower.includes('tiktok.com')) {
    return { name: 'TikTok', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' };
  }
  if (lower.includes('instagram.com')) {
    return { name: 'Instagram', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
  }
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) {
    return { name: 'Facebook', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
  }
  if (lower.includes('twitter.com') || lower.includes('x.com')) {
    return { name: 'X / Twitter', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' };
  }
  if (lower.includes('reddit.com')) {
    return { name: 'Reddit', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
  }
  return { name: 'Media Stream', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
};

interface UrlInputCardProps {
  onStartSingleDownload: (
    url: string,
    config: {
      type: DownloadType;
      quality: VideoQuality;
      format: VideoFormatChoice;
      title?: string;
      trimStart?: string;
      trimEnd?: string;
      downloadSubtitles?: boolean;
      subtitlesLang?: string;
      embedSubtitles?: boolean;
      audioBitrate?: AudioBitrateChoice;
      embedThumbnail?: boolean;
      rateLimit?: RateLimitChoice;
      scheduledAt?: number;
    }
  ) => void;
  onAnalyzeBatch: (urls: string[]) => void;
  onPreviewFetched?: (info: VideoInfo) => void;
  taskStatus?: TaskStatus | null;
  videoInfo?: VideoInfo | null;
  taskId?: string | null;
  phase: DownloadPhase;
  error?: string | null;
  mode: AppNavMode;
  onModeChange: (mode: AppNavMode) => void;
  settings?: FluxLoadSettings;
  onOpenSettings?: (platform?: string) => void;
  onOpenTelegramExport?: (params: {
    taskId?: string;
    downloadUrl?: string;
    title?: string;
    thumbnail?: string;
    fileSize?: string;
    format?: string;
    isAudio?: boolean;
  }) => void;
  onOpenTelegramSettings?: () => void;
  onOpenAudioCutter?: (taskId?: string, mediaUrl?: string, title?: string) => void;
  onOpenMediaPlayer?: (url: string, title?: string, type?: 'video' | 'audio', taskId?: string) => void;
  onPauseSingle?: () => void;
  onResumeSingle?: () => void;
  onCancelSingle?: () => void;
  onRetrySingle?: () => void;
  onResetSingle?: () => void;
  autoSaveStatus?: {
    isSaving: boolean;
    success: boolean;
    loadedFormatted: string;
    totalFormatted: string;
    percent: number;
    error: string | null;
  };
}

export const UrlInputCard: React.FC<UrlInputCardProps> = ({
  onStartSingleDownload,
  onAnalyzeBatch,
  onPreviewFetched,
  taskStatus,
  videoInfo,
  taskId,
  phase,
  error,
  mode,
  onModeChange,
  settings,
  onOpenSettings,
  onOpenTelegramExport,
  onOpenTelegramSettings,
  onOpenAudioCutter,
  onOpenMediaPlayer,
  onPauseSingle,
  onResumeSingle,
  onCancelSingle,
  onRetrySingle,
  onResetSingle,
  autoSaveStatus,
}) => {
  const [singleUrl, setSingleUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);

  // Quick format & quality choices
  const [quickType, setQuickType] = useState<DownloadType>(settings?.defaultType || 'video');
  const [quickQuality, setQuickQuality] = useState<VideoQuality>(settings?.defaultQuality || '720p');
  const [quickFormat, setQuickFormat] = useState<VideoFormatChoice>(settings?.defaultFormat || 'mp4');

  // Advanced Media Options (Feature 1, 2)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [downloadSubtitles, setDownloadSubtitles] = useState(false);
  const [subtitlesLang, setSubtitlesLang] = useState('all');
  const [embedSubtitles, setEmbedSubtitles] = useState(true);
  const [audioBitrate, setAudioBitrate] = useState<AudioBitrateChoice>('320k');
  const [embedThumbnail, setEmbedThumbnail] = useState(true);
  const [rateLimit, setRateLimit] = useState<RateLimitChoice>('unlimited');
  const [scheduledDelayMinutes, setScheduledDelayMinutes] = useState<number>(0);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Preview state
  const [analyzingPreview, setAnalyzingPreview] = useState(false);
  const [localPreview, setLocalPreview] = useState<VideoInfo | null>(null);
  const previewAbortControllerRef = useRef<AbortController | null>(null);
  const lastAnalyzedUrlRef = useRef<string>('');

  const activePreview = localPreview || videoInfo || null;

  // Dynamically filter video qualities so ONLY qualities that exist for this video are displayed!
  // (Video অনুযায়ী Quality শো করবে, যে Quality নাই তা শো করবে না)
  const availableVideoQualities = useMemo(() => {
    // 1. If server returned explicit availableQualities
    if (activePreview?.availableQualities && activePreview.availableQualities.length > 0) {
      const allowed = new Set<string>(activePreview.availableQualities);
      return VIDEO_QUALITIES.filter((q) => allowed.has(q.id));
    }

    // 2. Client-side strict extraction from activePreview formats or dimensions
    if (activePreview) {
      const detected = new Set<string>();

      const evaluateStreamTier = (h?: number, w?: number) => {
        if (!h || h <= 0) return;
        const tier = (w && w > 0) ? Math.min(h, w) : h;
        if (tier >= 2000) detected.add('4k');
        else if (tier >= 1400) detected.add('1440p');
        else if (tier >= 1000) detected.add('1080p');
        else if (tier >= 700) detected.add('720p');
        else if (tier >= 450) detected.add('480p');
        else if (tier >= 330) detected.add('360p');
        else if (tier >= 220) detected.add('240p');
        else if (tier >= 120) detected.add('144p');
      };

      if (activePreview.maxHeight) {
        evaluateStreamTier(activePreview.maxHeight, activePreview.maxWidth);
      }

      if (Array.isArray(activePreview.formats) && activePreview.formats.length > 0) {
        for (const f of activePreview.formats) {
          if (f.vcodec === 'none') continue; // Audio format, skip!
          let h = typeof f.height === 'number' && f.height > 0 ? f.height : undefined;
          let w = typeof f.width === 'number' && f.width > 0 ? f.width : undefined;
          if (!h && f.resolution && f.resolution.includes('x')) {
            const parts = f.resolution.split('x').map((p) => parseInt(p, 10));
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
              w = parts[0];
              h = parts[1];
            }
          }
          if (h) {
            evaluateStreamTier(h, w);
          } else {
            const note = `${f.format_note || ''} ${f.resolution || ''}`.toLowerCase();
            if (note.includes('2160') || note.includes('4k') || note.includes('uhd')) detected.add('4k');
            else if (note.includes('1440') || note.includes('2k') || note.includes('qhd')) detected.add('1440p');
            else if (note.includes('1080') || note.includes('fhd')) detected.add('1080p');
            else if (note.includes('720') || note.includes('hd')) detected.add('720p');
            else if (note.includes('480') || note.includes('sd')) detected.add('480p');
            else if (note.includes('360')) detected.add('360p');
            else if (note.includes('240')) detected.add('240p');
            else if (note.includes('144')) detected.add('144p');
          }
        }
      }

      if (detected.size > 0) {
        detected.add('auto');
        return VIDEO_QUALITIES.filter((q) => detected.has(q.id));
      }

      if (activePreview.maxHeight) {
        const h = activePreview.maxHeight;
        if (h >= 1000) return VIDEO_QUALITIES.filter((q) => ['1080p', '720p', 'auto'].includes(q.id));
        if (h >= 700) return VIDEO_QUALITIES.filter((q) => ['720p', 'auto'].includes(q.id));
        if (h >= 450) return VIDEO_QUALITIES.filter((q) => ['480p', 'auto'].includes(q.id));
        return VIDEO_QUALITIES.filter((q) => ['360p', 'auto'].includes(q.id));
      }
    }

    // Baseline common qualities before video analysis (Auto Best, 1080p, 720p)
    return VIDEO_QUALITIES.filter((q) => ['720p', '1080p', 'auto'].includes(q.id));
  }, [activePreview]);

  // If the active video changes and current quickQuality is not available in the video,
  // automatically adapt to the highest available quality for this video!
  useEffect(() => {
    if (activePreview && availableVideoQualities.length > 0) {
      const isCurrentQualityAvailable = availableVideoQualities.some((q) => q.id === quickQuality);
      if (!isCurrentQualityAvailable) {
        // Pick highest available resolution (excluding 'auto' which is Best)
        const highestNonAuto = availableVideoQualities.filter((q) => q.id !== 'auto').pop();
        if (highestNonAuto) {
          setQuickQuality(highestNonAuto.id);
        } else {
          setQuickQuality('auto');
        }
      }
    }
  }, [activePreview, availableVideoQualities, quickQuality]);

  // Live speed graph history
  const [speedHistory, setSpeedHistory] = useState<SpeedPoint[]>([]);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  // Direct safe blob downloader states
  const [isSavingToDisk, setIsSavingToDisk] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{
    percent: number;
    loadedFormatted: string;
    totalFormatted: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveToDevice = async () => {
    if (!taskStatus?.downloadUrl || isSavingToDisk) return;
    setIsSavingToDisk(true);
    setSaveError(null);
    setSaveProgress(null);
    try {
      const rawTitle = activePreview?.title || videoInfo?.title || taskStatus?.filename || 'video';
      const cleanTitle = rawTitle.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
      const ext = isAudioOnly ? 'mp3' : 'mp4';
      const filename = `${cleanTitle}.${ext}`;
      await downloadFileWithBlob(taskStatus.downloadUrl, filename, (p) => {
        setSaveProgress(p);
      });
      setSaveSuccess(true);
    } catch (err: any) {
      console.error('Save error in UrlInputCard:', err);
      setSaveError(err.message || 'Failed to save file');
    } finally {
      setIsSavingToDisk(false);
    }
  };

  // Dynamic check for YouTube, Instagram & Telegram authentication/integration state
  const [hasYtAuth, setHasYtAuth] = useState<boolean>(false);
  const [hasIgAuth, setHasIgAuth] = useState<boolean>(false);
  const [hasTgAuth, setHasTgAuth] = useState<boolean>(false);
  const [tgChannelTitle, setTgChannelTitle] = useState<string>('');
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/cookies/status');
        if (res.ok) {
          const data = await res.json();
          setHasYtAuth(Boolean(data.hasCookies && (data.hasYouTubeLoginInfo || data.hasYouTubeSID)));
          setHasIgAuth(Boolean(data.hasInstagramSession || data.platforms?.instagram?.hasCookies || data.detectedDomains?.includes('instagram.com')));
        }
      } catch {}

      try {
        const tgRes = await fetch('/api/telegram/config');
        if (tgRes.ok) {
          const tgData = await tgRes.json();
          setHasTgAuth(Boolean(tgData.configured));
          if (tgData.configured) {
            setTgChannelTitle(tgData.channelTitle || tgData.chatId || '');
          }
        }
      } catch {}
    };
    checkAuth();
  }, []);

  // Trigger preview analysis
  const triggerFetchPreview = (urlToAnalyze: string) => {
    const clean = urlToAnalyze.trim();
    if (!clean || !clean.startsWith('http')) return;
    if (clean === lastAnalyzedUrlRef.current && (localPreview || videoInfo)) return;

    if (previewAbortControllerRef.current) {
      previewAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    previewAbortControllerRef.current = controller;
    lastAnalyzedUrlRef.current = clean;
    setAnalyzingPreview(true);

    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: clean }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Preview unavailable'))))
      .then((info: VideoInfo) => {
        if (info && (info.title || info.thumbnail)) {
          setLocalPreview(info);
          if (onPreviewFetched) onPreviewFetched(info);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          // Subtle error
        }
      })
      .finally(() => {
        setAnalyzingPreview(false);
      });
  };

  useEffect(() => {
    const trimmed = singleUrl.trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      setLocalPreview(null);
      lastAnalyzedUrlRef.current = '';
      return;
    }

    const timer = setTimeout(() => {
      triggerFetchPreview(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [singleUrl]);

  // Parse speed for bandwidth chart
  useEffect(() => {
    if (phase === 'downloading' && taskStatus?.speed) {
      const speedStr = taskStatus.speed.toLowerCase();
      let num = 0;
      const match = speedStr.match(/([\d.]+)\s*(mib|kib|mb|kb|gb)\/s/);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit.includes('ki') || unit.includes('kb')) {
          num = val / 1024;
        } else if (unit.includes('gi')) {
          num = val * 1024;
        } else {
          num = val;
        }
      } else {
        const fallbackMatch = speedStr.match(/([\d.]+)/);
        if (fallbackMatch) {
          num = parseFloat(fallbackMatch[1]);
        }
      }

      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      setSpeedHistory((prev) => {
        const updated = [...prev, { time: timeLabel, speed: parseFloat(num.toFixed(2)) }];
        return updated.slice(-15);
      });
    } else if (phase === 'completed') {
      setSpeedHistory((prev) => [...prev, { time: 'Done', speed: 0 }]);
    } else if (phase === 'idle') {
      setSpeedHistory([]);
    }
  }, [taskStatus?.speed, phase]);

  // Extract cleaned URLs from batch text (supports newlines, commas, spaces)
  const getCleanBatchUrls = () => {
    if (!batchText.trim()) return [];
    const matches = batchText.match(/(https?:\/\/[^\s,;"'<>]+)/gi);
    if (matches && matches.length > 0) {
      return Array.from<string>(new Set(matches.map((u) => u.replace(/[.,;!?>)\]]+$/, '')))).filter(
        (u: string) =>
          u.length > 0 &&
          !u.toLowerCase().includes('curl.se') &&
          !u.toLowerCase().includes('cookie_spec')
      );
    }
    return batchText
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(
        (u) =>
          u.length > 0 &&
          !u.startsWith('#') &&
          !u.toLowerCase().includes('curl.se') &&
          (u.startsWith('http') || u.includes('.'))
      );
  };

  const batchUrls = getCleanBatchUrls();

  // Validate URL on client before starting
  const validateUrl = (url: string): boolean => {
    setUrlValidationError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlValidationError('Please paste or enter a media URL.');
      return false;
    }

    const lower = trimmed.toLowerCase();
    if (
      trimmed.startsWith('#') ||
      lower.includes('curl.se') ||
      lower.includes('cookie_spec') ||
      trimmed.includes('# Netscape') ||
      trimmed.includes('\tTRUE\t') ||
      trimmed.includes('\tFALSE\t')
    ) {
      setUrlValidationError('This looks like cookie text instead of a video URL. To use cookies, please paste them in Settings → Site Cookies.');
      return false;
    }

    if (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('192.168.') ||
      lower.includes('10.') ||
      lower.includes('172.16.') ||
      lower.startsWith('file://') ||
      lower.startsWith('ftp://')
    ) {
      setUrlValidationError('Localhost and private network addresses are not permitted.');
      return false;
    }

    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      if (lower.includes('.')) {
        // Auto-fix missing protocol
        const fixed = `https://${trimmed}`;
        setSingleUrl(fixed);
        return true;
      }
      setUrlValidationError('Please enter a valid URL starting with https://');
      return false;
    }

    return true;
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = singleUrl.trim();
    if (!validateUrl(clean)) return;

    // Check if user submitted multiple URLs (by newline or space/comma)
    const multiUrls = Array.from(new Set(clean.match(/(https?:\/\/[^\s,;"'<>]+)/gi) || []));
    if (multiUrls.length > 1) {
      onModeChange('batch');
      setBatchText(multiUrls.join('\n'));
      onAnalyzeBatch(multiUrls);
      return;
    }

    // Automatically start the entire workflow with selected quality and advanced tools
    const scheduledAt = scheduledDelayMinutes > 0 ? Date.now() + scheduledDelayMinutes * 60 * 1000 : undefined;
    onStartSingleDownload(clean, {
      type: quickType,
      quality: quickQuality,
      format: quickFormat,
      title: activePreview?.title,
      trimStart: trimStart.trim() || undefined,
      trimEnd: trimEnd.trim() || undefined,
      downloadSubtitles,
      subtitlesLang: downloadSubtitles ? subtitlesLang : undefined,
      embedSubtitles: downloadSubtitles ? embedSubtitles : undefined,
      audioBitrate: quickType === 'audio' ? audioBitrate : undefined,
      embedThumbnail: quickType === 'audio' ? embedThumbnail : undefined,
      rateLimit: rateLimit !== 'unlimited' ? rateLimit : undefined,
      scheduledAt,
    });
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchUrls.length === 0) return;
    onAnalyzeBatch(batchUrls);
  };

  const handlePasteSingle = async () => {
    setUrlValidationError(null);
    let text = '';
    const isMobileDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setUrlValidationError(
        isMobileDevice
          ? 'ক্লিপবোর্ড অ্যাক্সেস করতে বক্সে চেপে ধরে (Long Press) "Paste" করুন / Long-press inside the input box to Paste.'
          : 'Unable to access clipboard automatically. Please press Ctrl+V or Cmd+V to paste.'
      );
      return;
    }

    const clean = text?.trim();
    if (!clean) {
      setUrlValidationError('Clipboard is empty. Please copy a media URL first.');
      return;
    }

    // Auto-detect if user pasted multiple URLs while in single mode (newlines or spaces/commas)
    const multiPastedUrls = Array.from(new Set(clean.match(/(https?:\/\/[^\s,;"'<>]+)/gi) || []));
    if (multiPastedUrls.length > 1 || clean.includes('\n')) {
      const urlsToBatch = multiPastedUrls.length > 1 ? multiPastedUrls : clean.split('\n').map((u) => u.trim()).filter(Boolean);
      if (urlsToBatch.length > 1) {
        onModeChange('batch');
        setBatchText(urlsToBatch.join('\n'));
        onAnalyzeBatch(urlsToBatch);
        return;
      }
    }

    // Single URL normalization, validation, and auto-trigger preview analysis
    let target = clean;
    if (!target.startsWith('http://') && !target.startsWith('https://') && target.includes('.')) {
      target = `https://${target}`;
    }
    setSingleUrl(target);

    const isValid = validateUrl(target);
    if (isValid) {
      triggerFetchPreview(target);
    }
  };

  const handlePasteBatch = async () => {
    setUrlValidationError(null);
    let text = '';
    const isMobileDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setUrlValidationError(
        isMobileDevice
          ? 'ক্লিপবোর্ড থেকে পেস্ট করতে বক্সে আঙুল দিয়ে চেপে ধরে (Long Press) "Paste" চাপুন।'
          : 'Unable to access clipboard automatically. Please paste using Ctrl+V or Cmd+V directly in the input.'
      );
      return;
    }

    const clean = text?.trim();
    if (!clean) return;

    setBatchText((prev) => (prev ? `${prev}\n${clean}` : clean));

    // Automatically trigger validation and analysis sequence for all detected batch URLs
    const lines = clean
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && !u.startsWith('#'));

    const validUrls = lines
      .map((u) =>
        !u.startsWith('http://') && !u.startsWith('https://') && u.includes('.')
          ? `https://${u}`
          : u
      )
      .filter(
        (u) =>
          (u.startsWith('http://') || u.startsWith('https://')) &&
          !u.toLowerCase().includes('curl.se') &&
          !u.toLowerCase().includes('cookie_spec')
      );

    if (validUrls.length > 0) {
      onAnalyzeBatch(validUrls);
    }
  };

  const handleLoadSamples = () => {
    const samples = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.tiktok.com/@tiktok/video/7106594312292453678',
    ].join('\n');
    setBatchText(samples);
  };

  const isBusy =
    phase === 'preparing' ||
    phase === 'detecting' ||
    phase === 'downloading' ||
    phase === 'processing' ||
    phase === 'saving';

  // Format safe filename matching actual title
  const rawBase =
    videoInfo?.title?.trim() ||
    taskStatus?.filename?.replace(/\.[^/.]+$/, '').replace(/^media_[a-f0-9]+/, '') ||
    'video';
  const cleanTitle = rawBase
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^_+|_+$/g, '')
    .replace(/__+/g, '_')
    .trim();
  const fileExt = taskStatus?.filename?.split('.').pop() || quickFormat;
  const displayFilename = `${cleanTitle || 'video'}.${fileExt}`;

  // Primary button label and state
  const renderPrimaryButtonContent = () => {
    switch (phase) {
      case 'preparing':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Preparing...</span>
          </>
        );
      case 'detecting':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Detecting media...</span>
          </>
        );
      case 'downloading':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Downloading... ({taskStatus?.progress?.toFixed(0) || 0}%)</span>
          </>
        );
      case 'processing':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
            <span>Processing...</span>
          </>
        );
      case 'saving':
        return (
          <>
            <FolderDown className="w-5 h-5 animate-bounce text-emerald-300" />
            <span>Saving to Downloads...</span>
          </>
        );
      case 'completed':
        return (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            <span>✓ Complete & Auto-Saved! Click to Download Another</span>
          </>
        );
      case 'paused':
        return (
          <>
            <Play className="w-5 h-5 fill-current text-amber-300" />
            <span>Paused (Click to Resume)</span>
          </>
        );
      case 'error':
        return (
          <>
            <RotateCcw className="w-5 h-5" />
            <span>Retry Download</span>
          </>
        );
      case 'cancelled':
        return (
          <>
            <RotateCcw className="w-5 h-5" />
            <span>Restart Download</span>
          </>
        );
      case 'idle':
      default: {
        const qualityText =
          quickType === 'video'
            ? quickQuality === 'auto'
              ? 'BEST QUALITY'
              : quickQuality.toUpperCase()
            : 'AUDIO';
        return (
          <>
            <Download className="w-5 h-5 animate-bounce" />
            <span>DOWNLOAD {qualityText} ({quickFormat.toUpperCase()})</span>
          </>
        );
      }
    }
  };

  const handlePrimaryButtonClick = (e: React.MouseEvent) => {
    if (phase === 'paused' && onResumeSingle) {
      e.preventDefault();
      onResumeSingle();
      return;
    }
    if ((phase === 'error' || phase === 'cancelled') && onRetrySingle) {
      e.preventDefault();
      onRetrySingle();
      return;
    }
    if (phase === 'completed') {
      // Completed, user can click to reset
      if (onResetSingle) {
        onResetSingle();
        setSingleUrl('');
        setLocalPreview(null);
        lastAnalyzedUrlRef.current = '';
      }
      return;
    }
  };

  const isAudioOnly = displayFilename.endsWith('.mp3') || displayFilename.endsWith('.m4a');
  const platformBadge = getPlatformBadge(singleUrl || activePreview?.webpage_url || '');

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-800/80">
        <div className="flex flex-wrap bg-slate-950/80 p-1 rounded-2xl border border-slate-800 gap-1">
          <button
            type="button"
            onClick={() => onModeChange('single')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              mode === 'single'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Single URL</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('social')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              mode === 'social'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-md shadow-pink-500/20'
                : 'text-slate-400 hover:text-pink-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-pink-400" />
            <span>Social Quick</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('batch')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              mode === 'batch'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListPlus className="w-4 h-4 text-cyan-400" />
            <span>Multiple Download (একাধিক)</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('cutter')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              mode === 'cutter'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Scissors className="w-4 h-4 text-amber-400" />
            <span>Audio Cutter</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('converter')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              mode === 'converter'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Transcoder</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center space-x-1.5 text-xs text-cyan-400/90 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full font-mono">
          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          <span>Direct to Downloads</span>
        </div>
      </div>

      {mode === 'single' ? (
        /* Single Media Form */
        <form onSubmit={handleSingleSubmit} className="space-y-5">
          {/* URL Input Bar */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="text"
                value={singleUrl}
                onChange={(e) => {
                  setSingleUrl(e.target.value);
                  if (urlValidationError) setUrlValidationError(null);
                }}
                disabled={isBusy}
                placeholder="Paste media link here (YouTube, TikTok, Instagram, Telegram Channel, Twitter, Facebook, etc.)..."
                required
                className="w-full pl-4 pr-16 sm:pr-52 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm md:text-base transition-all shadow-inner disabled:opacity-60"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                {singleUrl && !isBusy && (
                  <button
                    type="button"
                    onClick={() => {
                      setSingleUrl('');
                      setLocalPreview(null);
                      setUrlValidationError(null);
                      lastAnalyzedUrlRef.current = '';
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Clear URL"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePasteSingle}
                  disabled={isBusy}
                  className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm disabled:opacity-50 active:scale-95 whitespace-nowrap cursor-pointer"
                  title="Paste from Clipboard & automatically trigger media analysis"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Paste<span className="hidden sm:inline"> from Clipboard</span>
                  </span>
                </button>
              </div>
            </div>

            {urlValidationError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 pl-2 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{urlValidationError}</span>
              </p>
            )}
          </div>

          {/* MEDIA PREVIEW CARD */}
          {analyzingPreview ? (
            <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 flex items-center gap-4 animate-pulse shadow-lg">
              <div className="w-24 sm:w-28 h-18 sm:h-20 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 bg-slate-800 rounded-md w-3/4"></div>
                <div className="h-3 bg-slate-800/70 rounded-md w-1/2"></div>
                <p className="text-xs text-cyan-400 font-mono flex items-center gap-1.5 pt-1">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Fetching media preview & stream qualities (144p – 4K)...</span>
                </p>
              </div>
            </div>
          ) : activePreview ? (
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 shadow-xl">
              <div className="flex flex-col sm:flex-row gap-3.5 sm:items-center">
                {/* Thumbnail with overlays */}
                <div className="relative w-full sm:w-36 h-28 sm:h-24 bg-slate-900 rounded-xl overflow-hidden shrink-0 border border-slate-800 shadow-inner group">
                  {activePreview.thumbnail ? (
                    <img
                      src={activePreview.thumbnail}
                      alt={activePreview.title || 'Media thumbnail'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  {/* Duration pill */}
                  {activePreview.duration_string && (
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] font-semibold tracking-wider">
                      {activePreview.duration_string}
                    </div>
                  )}

                  {/* Platform badge */}
                  <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-semibold border border-white/10 text-cyan-300">
                    {platformBadge.name}
                  </div>
                </div>

                {/* Info & Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformBadge.color}`}>
                      {platformBadge.name}
                    </span>
                    {activePreview.uploader && (
                      <span className="text-xs text-slate-400 truncate max-w-[200px] flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-200 font-medium">{activePreview.uploader}</span>
                      </span>
                    )}
                  </div>

                  <h3
                    className="text-sm sm:text-base font-bold text-slate-100 line-clamp-2 leading-snug"
                    title={activePreview.title}
                  >
                    {activePreview.title || 'Detected Media Stream'}
                  </h3>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono flex-wrap">
                    {activePreview.duration ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {activePreview.duration_string || `${Math.floor(activePreview.duration / 60)}m ${activePreview.duration % 60}s`}
                      </span>
                    ) : null}
                    {activePreview.view_count ? (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-slate-500" />
                        {activePreview.view_count.toLocaleString()} views
                      </span>
                    ) : null}
                    <span className="text-emerald-400 flex items-center gap-1 font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready to Download
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 144p TO 4K QUALITY & FORMAT SELECTOR */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-inner">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Select Quality (144p to 4K) & Format
              </span>

              {/* Type Switcher (Video vs Audio) */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setQuickType('video');
                    setQuickFormat('mp4');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    quickType === 'video'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  } disabled:opacity-50`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setQuickType('audio');
                    setQuickFormat('mp3');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    quickType === 'audio'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  } disabled:opacity-50`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Audio (MP3)</span>
                </button>
              </div>
            </div>

            {/* Video Quality Options: Filtered dynamically to only show existing qualities */}
            {quickType === 'video' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    {activePreview ? (
                      <span className="text-cyan-300 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                        এই ভিডিওর উপলভ্য কোয়ালিটি ({availableVideoQualities.filter((q) => q.id !== 'auto').length}টি অপশন)
                      </span>
                    ) : (
                      'কোয়ালিটি নির্বাচন করুন:'
                    )}
                  </span>
                  {activePreview?.maxHeight && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                      সর্বোচ্চ: {activePreview.maxHeight}p
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {availableVideoQualities.map((q) => {
                    const isSelected = quickQuality === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setQuickQuality(q.id)}
                        className={`flex-1 min-w-[70px] sm:min-w-[85px] max-w-[120px] flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-gradient-to-b from-cyan-500/25 to-blue-600/30 border-cyan-400 text-white shadow-lg shadow-cyan-500/20 scale-[1.02] ring-1 ring-cyan-400/50'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                        } disabled:opacity-50 cursor-pointer`}
                      >
                        <span className="text-xs font-bold font-mono tracking-tight">{q.label}</span>
                        <span
                          className={`text-[9px] font-mono px-1 rounded uppercase tracking-wider mt-0.5 ${
                            isSelected ? 'bg-cyan-400/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {q.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Container Format Selection (MP4 / WEBM) */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/90 text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">Container:</span>
                  <div className="flex items-center gap-2">
                    {(['mp4', 'webm'] as VideoFormatChoice[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setQuickFormat(fmt)}
                        className={`px-3 py-1 rounded-lg font-mono uppercase text-xs font-bold transition-all ${
                          quickFormat === fmt
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        } disabled:opacity-50`}
                      >
                        .{fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Audio Format & Bitrate Options */
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { format: 'mp3', label: 'MP3 320k', badge: 'Studio Hi-Fi', br: '320k' },
                    { format: 'mp3', label: 'MP3 256k', badge: 'High Quality', br: '256k' },
                    { format: 'mp3', label: 'MP3 192k', badge: 'Standard', br: '192k' },
                    { format: 'flac', label: 'FLAC', badge: 'Lossless Hi-Res', br: '320k' },
                    { format: 'wav', label: 'WAV', badge: 'Uncompressed', br: '320k' },
                    { format: 'm4a', label: 'M4A', badge: 'Apple AAC', br: '256k' },
                  ].map((opt) => {
                    const isSelected = quickFormat === opt.format && (opt.format !== 'mp3' || audioBitrate === opt.br);
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setQuickFormat(opt.format as VideoFormatChoice);
                          if (opt.br) setAudioBitrate(opt.br as AudioBitrateChoice);
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/40'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        } disabled:opacity-50`}
                      >
                        <div className="text-xs font-bold text-slate-200">{opt.label}</div>
                        <div className="text-[10px] text-cyan-400 font-mono mt-0.5">{opt.badge}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Cover Art Embed Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/90 text-xs">
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    Embed Album Art & ID3 Metadata:
                  </span>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setEmbedThumbnail(!embedThumbnail)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      embedThumbnail
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }`}
                  >
                    {embedThumbnail ? '✓ Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ADVANCED MEDIA TOOLS (TRIM, SUBTITLES, BANDWIDTH LIMIT, SCHEDULER) */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden transition-all">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setShowAdvancedTools(!showAdvancedTools)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white transition-colors bg-slate-900/40 hover:bg-slate-900/80"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                <span>Advanced Media Tools & Automation</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Trim • Subtitles • Speed • Timer
                </span>
              </div>
              {showAdvancedTools ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdvancedTools && (
              <div className="p-4 space-y-4 border-t border-slate-800/80 bg-slate-950/80 text-xs">
                {/* 1. Video Trimming / Range */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                    <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Trim / Extract Specific Time Range:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">Start Time (e.g. 00:00:30)</label>
                      <input
                        type="text"
                        value={trimStart}
                        onChange={(e) => setTrimStart(e.target.value)}
                        placeholder="00:00:00"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono block mb-1">End Time (e.g. 00:02:15)</label>
                      <input
                        type="text"
                        value={trimEnd}
                        onChange={(e) => setTrimEnd(e.target.value)}
                        placeholder="00:00:00 (optional)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Subtitles & CC */}
                <div className="space-y-2 pt-3 border-t border-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                      <Subtitles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Download Subtitles / CC:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDownloadSubtitles(!downloadSubtitles)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        downloadSubtitles
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-900 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {downloadSubtitles ? '✓ Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {downloadSubtitles && (
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 font-mono">Language:</span>
                        <select
                          value={subtitlesLang}
                          onChange={(e) => setSubtitlesLang(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                        >
                          <option value="all">All Available</option>
                          <option value="en.*">English (Auto + Manual)</option>
                          <option value="bn.*">Bengali (বাংলা)</option>
                          <option value="es.*">Spanish</option>
                          <option value="hi.*">Hindi</option>
                        </select>
                      </div>

                      {quickType === 'video' && quickFormat === 'mp4' && (
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                          <input
                            type="checkbox"
                            checked={embedSubtitles}
                            onChange={(e) => setEmbedSubtitles(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                          />
                          <span className="text-[11px]">Embed inside MP4</span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Speed / Rate Limiter */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download Speed Limiter:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'unlimited', label: 'Max' },
                      { id: '10M', label: '10 MB/s' },
                      { id: '5M', label: '5 MB/s' },
                      { id: '2M', label: '2 MB/s' },
                    ].map((rl) => (
                      <button
                        key={rl.id}
                        type="button"
                        onClick={() => setRateLimit(rl.id as RateLimitChoice)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all ${
                          rateLimit === rl.id
                            ? 'bg-cyan-500 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {rl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Scheduled Download */}
                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                    <CalendarClock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Schedule Download:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[
                      { mins: 0, label: 'Now' },
                      { mins: 15, label: '+15m' },
                      { mins: 30, label: '+30m' },
                      { mins: 60, label: '+1h' },
                      { mins: 120, label: '+2h' },
                    ].map((sc) => (
                      <button
                        key={sc.mins}
                        type="button"
                        onClick={() => setScheduledDelayMinutes(sc.mins)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all ${
                          scheduledDelayMinutes === sc.mins
                            ? 'bg-cyan-500 text-white font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ONE PRIMARY BUTTON [ DOWNLOAD ] */}
          <div>
            <button
              type={phase === 'idle' ? 'submit' : 'button'}
              onClick={handlePrimaryButtonClick}
              disabled={
                (phase === 'idle' && !singleUrl.trim()) ||
                phase === 'preparing' ||
                phase === 'detecting' ||
                phase === 'processing' ||
                phase === 'saving'
              }
              className={`w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm md:text-base tracking-wide shadow-xl ${
                phase === 'completed'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 cursor-pointer'
                  : phase === 'paused'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25 cursor-pointer'
                  : phase === 'error' || phase === 'cancelled'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/25 cursor-pointer'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
              }`}
            >
              {renderPrimaryButtonContent()}
            </button>
          </div>

          {/* LIVE PROGRESS SECTION (Opens automatically during or after download) */}
          {phase !== 'idle' && taskStatus && (
            <div className="bg-slate-950/85 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
              {/* Top Row: Filename, Format, Quality, and Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {quickType === 'video' ? 'VIDEO' : 'AUDIO'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {quickFormat.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {quickQuality === 'auto' ? 'Auto Quality' : quickQuality}
                    </span>
                  </div>
                  <h4
                    className="text-sm font-semibold text-slate-200 truncate max-w-md"
                    title={displayFilename}
                  >
                    {displayFilename}
                  </h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                      phase === 'completed'
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : phase === 'paused'
                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                        : phase === 'error' || phase === 'cancelled'
                        ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    }`}
                  >
                    {phase === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : phase === 'paused' ? (
                      <Pause className="w-3.5 h-3.5 text-amber-400" />
                    ) : phase === 'error' || phase === 'cancelled' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                    )}
                    <span className="capitalize">
                      {phase === 'processing'
                        ? 'Processing (FFmpeg)'
                        : phase === 'saving'
                        ? 'Saving File'
                        : phase}
                    </span>
                  </span>
                </div>
              </div>

              {/* Progress Bar & Percentage */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="font-mono">Progress:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {taskStatus.status === 'completed' || phase === 'completed'
                      ? '100'
                      : phase === 'processing' || taskStatus.progress >= 99
                      ? '99'
                      : Math.round(taskStatus.progress || 0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      phase === 'completed'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : phase === 'paused'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 shadow-md shadow-cyan-500/50'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, taskStatus.progress || 0))}%` }}
                  />
                </div>
              </div>

              {/* Downloaded Size, Speed, ETA Grid */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Size</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                    {phase === 'error' ? '0 MB' : (taskStatus.downloadedSize || '0 MB')} / {phase === 'error' ? 'Failed' : (taskStatus.totalSize || '...')}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Speed</div>
                  <div className={`text-xs font-mono font-bold mt-0.5 ${phase === 'error' ? 'text-rose-400' : 'text-cyan-400'}`}>
                    {phase === 'error' ? 'Failed' : (taskStatus.speed || '0 KB/s')}
                  </div>
                </div>
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2.5">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">ETA</div>
                  <div className="text-xs font-mono font-bold text-slate-200 mt-0.5">
                    {phase === 'error' ? '--:--' : (taskStatus.eta || 'Calculating...')}
                  </div>
                </div>
              </div>

              {/* Actionable Error Resolution Card */}
              {(phase === 'error' || taskStatus?.status === 'error' || (error && phase !== 'completed')) && (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-bold text-rose-200">
                        Download Interrupted
                      </div>
                      <div className="text-xs text-rose-300 leading-relaxed break-words">
                        {taskStatus?.error || error || 'The media host rate-limited or blocked anonymous access. Adding site cookies or retrying may resolve this.'}
                      </div>
                    </div>
                  </div>

                  {/* Contextual helper buttons */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {(taskStatus?.isInstagramError ||
                      activePreview?.isInstagramBlocked ||
                      (taskStatus?.error && taskStatus.error.toLowerCase().includes('instagram')) ||
                      (error && error.toLowerCase().includes('instagram'))) && onOpenSettings ? (
                      <button
                        type="button"
                        onClick={() => onOpenSettings('instagram')}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-pink-600/30 cursor-pointer"
                      >
                        <Cookie className="w-3.5 h-3.5" />
                        <span>Add Instagram Cookies (ইনস্টাগ্রাম কুকিজ যোগ করুন)</span>
                      </button>
                    ) : (taskStatus?.needsCookies ||
                      taskStatus?.botBlocked ||
                      (taskStatus?.error && (
                        taskStatus.error.toLowerCase().includes('cookie') ||
                        taskStatus.error.toLowerCase().includes('bot') ||
                        taskStatus.error.toLowerCase().includes('login')
                      )) ||
                      (error && (
                        error.toLowerCase().includes('cookie') ||
                        error.toLowerCase().includes('bot')
                      ))) && onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings()}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
                      >
                        <Cookie className="w-3.5 h-3.5" />
                        <span>Open Site Cookies Settings</span>
                      </button>
                    )}

                    {onRetrySingle && (
                      <button
                        type="button"
                        onClick={onRetrySingle}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Try Again</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Bandwidth Speed Chart */}
              {speedHistory.length > 2 && (
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-cyan-400" />
                      Live Transfer Speed
                    </span>
                    <span className="font-mono text-cyan-400">{taskStatus.speed || '0 KB/s'}</span>
                  </div>
                  <div className="h-24 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={speedHistory} margin={{ top: 2, right: 2, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={9} tickLine={false} unit="M" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.5rem',
                            fontSize: '11px',
                            color: '#f8fafc',
                          }}
                          formatter={(val: any) => [`${val} MB/s`, 'Speed']}
                        />
                        <Area
                          type="monotone"
                          dataKey="speed"
                          stroke="#06b6d4"
                          strokeWidth={1.5}
                          fillOpacity={1}
                          fill="url(#speedGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Completed In-App Media Player Preview */}
              {phase === 'completed' && taskStatus.downloadUrl && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      {isAudioOnly ? <Music className="w-3.5 h-3.5 text-cyan-400" /> : <Film className="w-3.5 h-3.5 text-cyan-400" />}
                      Instant In-App Preview
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">Saved to Downloads</span>
                  </div>
                  {isAudioOnly ? (
                    <audio
                      ref={mediaRef as any}
                      src={taskStatus.downloadUrl}
                      controls
                      className="w-full h-8 accent-cyan-500"
                    />
                  ) : (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 max-h-48 flex items-center justify-center">
                      <video
                        ref={mediaRef as any}
                        src={taskStatus.downloadUrl}
                        controls
                        className="w-full h-full object-contain"
                        poster={videoInfo?.thumbnail}
                      />
                    </div>
                  )}

                  {saveError && (
                    <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-300">
                      <span>{saveError}</span>
                      <button
                        type="button"
                        onClick={handleSaveToDevice}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 font-semibold rounded-lg text-xs cursor-pointer ml-2"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Auto-Save Status & Next Step */}
                  {(autoSaveStatus?.isSaving || isSavingToDisk) ? (
                    <div className="w-full py-3 px-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                          <span>কম্পিউটারে স্বয়ংক্রিয়ভাবে সেভ হচ্ছে... (Auto-Saving to Downloads)</span>
                        </span>
                        <span className="font-mono">{autoSaveStatus?.percent || saveProgress?.percent || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                          style={{ width: `${autoSaveStatus?.percent || saveProgress?.percent || 0}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono text-right">
                        {autoSaveStatus?.loadedFormatted || saveProgress?.loadedFormatted || '0 MB'} / {autoSaveStatus?.totalFormatted || saveProgress?.totalFormatted || '...'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center space-x-3 text-xs sm:text-sm font-bold text-emerald-300">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>🎉 সম্পূর্ণ ভিডিও আপনার ডিভাইসের Downloads ফোল্ডারে স্বয়ংক্রিয়ভাবে সেভ হয়েছে! (Auto-Saved)</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onResetSingle) {
                              onResetSingle();
                              setSingleUrl('');
                              setLocalPreview(null);
                              lastAnalyzedUrlRef.current = '';
                            }
                          }}
                          className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 text-xs sm:text-sm tracking-wide cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>🔄 পরবর্তী ভিডিও ডাউনলোড করুন</span>
                        </button>
                        {onOpenTelegramExport && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenTelegramExport({
                                taskId: taskStatus.id,
                                downloadUrl: taskStatus.downloadUrl,
                                title: activePreview?.title || videoInfo?.title || taskStatus?.filename || 'Downloaded Media',
                                thumbnail: activePreview?.thumbnail || videoInfo?.thumbnail,
                                fileSize: taskStatus.downloadedSize || taskStatus.totalSize,
                                format: quickFormat,
                                isAudio: isAudioOnly,
                              })
                            }
                            className="py-3 px-4 bg-sky-500/25 hover:bg-sky-500/35 border border-sky-500/40 text-sky-300 font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-xs sm:text-sm cursor-pointer"
                            title="সরাসরি টেলিগ্রাম চ্যানেলে ফাইলটি পোস্ট করুন"
                          >
                            <Send className="w-4 h-4 text-sky-400" />
                            <span>টেলিগ্রাম চ্যানেলে পাঠান</span>
                          </button>
                        )}
                      </div>
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveToDevice()}
                          disabled={isSavingToDisk}
                          className="text-[11px] text-slate-400 hover:text-cyan-300 underline cursor-pointer transition-colors"
                        >
                          যদি কোনো কারণে ফাইলটি সেভ না হয়ে থাকে, তবে এখানে ক্লিক করুন (Manual Save)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Controls: Pause, Resume, Cancel, Retry, Download Another */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {/* Pause / Resume Button */}
                {phase === 'downloading' && onPauseSingle && (
                  <button
                    type="button"
                    onClick={onPauseSingle}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                {phase === 'paused' && onResumeSingle && (
                  <button
                    type="button"
                    onClick={onResumeSingle}
                    className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {/* Cancel Button */}
                {(phase === 'downloading' || phase === 'paused' || phase === 'processing') &&
                  onCancelSingle && (
                    <button
                      type="button"
                      onClick={onCancelSingle}
                      className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                {/* Retry Button */}
                {(phase === 'error' || phase === 'cancelled') && onRetrySingle && (
                  <button
                    type="button"
                    onClick={onRetrySingle}
                    className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                )}

                {/* QR to Phone */}
                {phase === 'completed' && taskStatus.downloadUrl && (
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="py-2 px-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR to Phone</span>
                  </button>
                )}

                {/* Trim as Ringtone / Audio */}
                {phase === 'completed' && taskStatus.downloadUrl && onOpenAudioCutter && (
                  <button
                    type="button"
                    onClick={() => onOpenAudioCutter(taskStatus.id, taskStatus.downloadUrl, activePreview?.title || videoInfo?.title)}
                    className="py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                    title="Trim snippet as ringtone or audio clip"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>✂️ Trim / রিংটোন</span>
                  </button>
                )}

                {/* Full Player Modal */}
                {phase === 'completed' && taskStatus.downloadUrl && onOpenMediaPlayer && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenMediaPlayer(
                        taskStatus.downloadUrl!,
                        activePreview?.title || videoInfo?.title,
                        isAudioOnly ? 'audio' : 'video',
                        taskStatus.id
                      )
                    }
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                    title="Open full in-app player with loop and speed control"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Player</span>
                  </button>
                )}

                {/* Send to Telegram Channel Button */}
                {phase === 'completed' && taskStatus.downloadUrl && onOpenTelegramExport && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenTelegramExport({
                        taskId: taskStatus.id,
                        downloadUrl: taskStatus.downloadUrl,
                        title: activePreview?.title || videoInfo?.title || taskStatus?.filename || 'Downloaded Media',
                        thumbnail: activePreview?.thumbnail || videoInfo?.thumbnail,
                        fileSize: taskStatus.downloadedSize || taskStatus.totalSize,
                        format: quickFormat,
                        isAudio: isAudioOnly,
                      })
                    }
                    className="py-2 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                    title="টেলিগ্রাম চ্যানেলে পাঠান"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>টেলিগ্রাম চ্যানেল</span>
                  </button>
                )}

                {/* Download Another Video Button */}
                {(phase === 'completed' || phase === 'cancelled' || phase === 'error') &&
                  onResetSingle && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetSingle();
                        setSingleUrl('');
                      }}
                      className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ml-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Download Another</span>
                    </button>
                  )}
              </div>
            </div>
          )}

          {isQrModalOpen && taskStatus?.downloadUrl && (
            <QrCodeModal
              isOpen={isQrModalOpen}
              onClose={() => setIsQrModalOpen(false)}
              downloadUrl={taskStatus.downloadUrl}
              filename={displayFilename}
            />
          )}

          {error && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
              {(error.toLowerCase().includes('cookie') ||
                error.toLowerCase().includes('bot') ||
                error.toLowerCase().includes('verification')) &&
                onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Cookie className="w-4 h-4" />
                    <span>Configure YouTube Cookies in Settings to Unlock</span>
                  </button>
                )}
            </div>
          )}
        </form>
      ) : (
        /* Multiple / Batch Input Form */
        <form onSubmit={handleBatchSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Paste multiple video URLs here (one URL per line)...&#10;https://www.youtube.com/watch?v=...&#10;https://www.tiktok.com/@...&#10;https://www.instagram.com/p/..."
              rows={4}
              required
              className="w-full p-4 pb-14 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-xs md:text-sm transition-all shadow-inner resize-none font-mono"
            />
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                  {batchUrls.length} {batchUrls.length === 1 ? 'URL' : 'URLs'} detected
                </span>
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline decoration-slate-600 cursor-pointer hidden sm:inline"
                >
                  Load sample links
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {batchText && (
                  <button
                    type="button"
                    onClick={() => setBatchText('')}
                    className="p-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
                    title="Clear"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePasteBatch}
                  className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                  title="Paste from Clipboard & automatically validate & analyze URLs"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>
                    Paste<span className="hidden sm:inline"> from Clipboard</span>
                  </span>
                </button>
                <button
                  type="submit"
                  disabled={batchUrls.length === 0}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
                >
                  <ListPlus className="w-3.5 h-3.5" />
                  <span>Queue & Analyze ({batchUrls.length})</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Supported Platforms Tag Pills */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 pt-4 border-t border-slate-800/60">
        <button
          type="button"
          onClick={onOpenSettings}
          className={`px-2.5 py-0.5 rounded-full border transition-colors flex items-center gap-1 font-medium cursor-pointer ${
            hasYtAuth
              ? 'bg-red-950/50 border-red-500/40 text-red-300 hover:bg-red-900/50'
              : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
          }`}
          title={
            hasYtAuth
              ? 'YouTube Session is Connected & Authenticated. Click to manage cookies in Settings.'
              : 'YouTube: Click to add cookies in Settings to bypass cloud bot restrictions.'
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasYtAuth ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          <span>YouTube {hasYtAuth ? '(Connected)' : '(Add Cookies)'}</span>
        </button>
        <span className="px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-300">
          TikTok
        </span>
        <button
          type="button"
          onClick={() => onOpenSettings ? onOpenSettings('instagram') : undefined}
          className={`px-2.5 py-0.5 rounded-full border transition-colors flex items-center gap-1 font-medium cursor-pointer ${
            hasIgAuth
              ? 'bg-gradient-to-r from-pink-950/60 to-purple-950/60 border-pink-500/40 text-pink-300 hover:from-pink-900/60 hover:to-purple-900/60'
              : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-pink-500/50 hover:text-pink-300'
          }`}
          title={
            hasIgAuth
              ? 'Instagram Session Connected! Public & private Reels/Posts download smoothly. Click to manage cookies.'
              : 'Instagram: Click to add your sessionid / cookies to download any Instagram Reel or video without limits.'
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasIgAuth ? 'bg-emerald-400' : 'bg-pink-400'}`}></span>
          <span>Instagram {hasIgAuth ? '(Connected)' : '(Add Cookies)'}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (onOpenTelegramSettings) {
              onOpenTelegramSettings();
            } else if (onOpenSettings) {
              onOpenSettings('telegram');
            }
          }}
          className={`px-2.5 py-0.5 rounded-full border transition-colors flex items-center gap-1 font-medium cursor-pointer ${
            hasTgAuth
              ? 'bg-sky-950/60 border-sky-500/40 text-sky-300 hover:bg-sky-900/60'
              : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-sky-500/50 hover:text-sky-300'
          }`}
          title={
            hasTgAuth
              ? `Telegram Channel Connected (${tgChannelTitle})! Click to manage channel or bot.`
              : 'Telegram: Public channel/video download supported. Click to connect your Telegram Channel & Bot.'
          }
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasTgAuth ? 'bg-sky-400' : 'bg-slate-400'}`}></span>
          <span>Telegram {hasTgAuth ? `(${tgChannelTitle || 'Connected'})` : '(Channel & Bot)'}</span>
        </button>
        <span className="px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-300">
          Facebook
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-300">
          X / Twitter
        </span>
        <span className="px-2 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/40 text-slate-300">
          xHamster & 1000+ More
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-semibold flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-cyan-400" />
          Unlimited Size (2000GB+)
        </span>
      </div>
    </div>
  );
};
