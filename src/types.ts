export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  qualityLabel?: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  duration_string?: string;
  thumbnail: string;
  uploader?: string;
  view_count?: number;
  formats: VideoFormat[];
  webpage_url: string;
  needsCookies?: boolean;
  botBlocked?: boolean;
  isInstagramBlocked?: boolean;
  warning?: string;
  maxHeight?: number;
  maxWidth?: number;
  availableQualities?: VideoQuality[];
}

export type DownloadType = 'video' | 'audio';
export type VideoQuality =
  | 'auto'
  | '144p'
  | '240p'
  | '360p'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '4k'
  | 'best';
export type VideoFormatChoice = 'mp4' | 'webm' | 'mp3' | 'm4a' | 'flac' | 'wav';
export type AudioBitrateChoice = '320k' | '256k' | '192k' | '128k';
export type RateLimitChoice = 'unlimited' | '1M' | '2M' | '5M' | '10M';

export interface PlatformCookieProfile {
  hasCookies: boolean;
  count: number;
  lastModified?: string;
  account?: string;
}

export interface CookieStatus {
  hasCookies: boolean;
  source: 'file' | 'env' | 'user_saved' | 'none';
  linesCount: number;
  lastModified?: string;
  preview?: string;
  cookiesContent?: string;
  detectedDomains?: string[];
  hasYouTubeSID?: boolean;
  hasYouTubeLoginInfo?: boolean;
  hasYouTubeSAPISID?: boolean;
  hasInstagramSession?: boolean;
  platforms?: {
    youtube?: PlatformCookieProfile;
    facebook?: PlatformCookieProfile;
    instagram?: PlatformCookieProfile;
    tiktok?: PlatformCookieProfile;
  };
}

export interface DownloadRequest {
  url: string;
  type: DownloadType;
  quality: VideoQuality;
  format: VideoFormatChoice;
  title?: string;
  bdixFirstSpeed?: boolean;
  trimStart?: string;
  trimEnd?: string;
  downloadSubtitles?: boolean;
  subtitlesLang?: string;
  embedSubtitles?: boolean;
  audioBitrate?: AudioBitrateChoice;
  embedThumbnail?: boolean;
  rateLimit?: string; // 'unlimited' | '1M' | '2M' | '5M' | '10M'
  scheduledAt?: number;
}

export type SingleDownloadConfig = Omit<DownloadRequest, 'url'>;

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'paused' | 'completed' | 'done' | 'error' | 'cancelled';

export type BatchItemStatus =
  | 'pending_analysis'
  | 'analyzing'
  | 'ready'
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'done'
  | 'error'
  | 'cancelled';

export interface BatchItem {
  id: string;
  url: string;
  title?: string;
  info?: VideoInfo | null;
  status: BatchItemStatus;
  selected: boolean;
  type: DownloadType;
  quality: VideoQuality;
  format: VideoFormatChoice;
  taskId?: string;
  progress: number;
  speed: string;
  downloadedSize: string;
  totalSize: string;
  eta: string;
  filename?: string;
  downloadUrl?: string;
  error?: string;
}

export interface BatchSettings {
  concurrency: number;
  autoTriggerBrowserDownload: boolean;
}

export interface ScheduledBatchTask {
  id: string;
  name: string;
  scheduledTime: string; // ISO timestamp
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
  items: Array<{
    id: string;
    url: string;
    title?: string;
    type?: DownloadType;
    quality?: VideoQuality;
    format?: VideoFormatChoice;
  }>;
  concurrency: number;
  autoSendTelegram?: boolean;
  autoSaveToDownloads?: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  executedTaskIds?: string[];
}

export interface TelegramChannelItem {
  chatId: string;
  channelTitle?: string;
  enabled?: boolean;
  botToken?: string;
  botUsername?: string;
  customCaption?: string;
}

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  channelName?: string;
  channelTitle?: string;
  channels?: TelegramChannelItem[];
  botUsername?: string;
  autoSendCompleted?: boolean;
  maxUploadGb?: number;
  uploadDeliveryMode?: 'smart_10gb' | 'direct_50mb' | 'local_2gb';
  localApiServerUrl?: string;
}

export interface TelegramHealthData {
  healthy: boolean;
  configured: boolean;
  status: 'optimal' | 'good' | 'degraded' | 'throttled' | 'unconfigured';
  pingMs: number;
  gatewayUrl: string;
  sslSecured: boolean;
  protocol: string;
  bot?: {
    id?: number;
    username?: string;
    firstName?: string;
    canJoinGroups?: boolean;
    canReadAllGroupMessages?: boolean;
    supportsInlineQueries?: boolean;
  } | null;
  channel?: {
    id?: string;
    title?: string;
    username?: string;
    type?: string;
    description?: string;
    membersCount?: number;
  } | null;
  channels?: TelegramChannelItem[];
  permissions?: {
    canPostMessages: boolean;
    canEditMessages: boolean;
    canSendMedia: boolean;
    canSendDocuments: boolean;
    canAddWebPagePreviews: boolean;
    isAdministrator: boolean;
  };
  rateLimit: {
    status: 'optimal' | 'warning' | 'throttled';
    globalLimitPerSec: number;
    channelLimitPerMin: number;
    requestsLastMinute: number;
    requestsLastSecond: number;
    remainingBurst: number;
    floodWaitSeconds: number;
    safeHeadroomPercent: number;
    antiFloodActive: boolean;
    lastRequestTime: string | null;
  };
  uploadLimits: {
    standardBotLimitMb: number;
    localBotLimitMb: number;
    ultraCloudStreamLimitGb: number;
    activeMaxLimitGb: number;
    upload10GbReady: boolean;
    deliveryMode: string;
    customApiUrl?: string | null;
    supportedTypes: string[];
  };
  error?: string | null;
  serverTime: string;
}

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  channelPostUrl?: string;
  channelTitle?: string;
  fileSizeMb?: number;
  formattedSize?: string;
  warning?: string;
  shareUrl?: string;
  error?: string;
  botNeedsAdmin?: boolean;
  adminAddUrl?: string;
  totalTargets?: number;
  successCount?: number;
  failedCount?: number;
  channelPostUrls?: string[];
  results?: Array<{
    targetChat: string;
    success: boolean;
    channelPostUrl?: string;
    error?: string;
    channelTitle?: string;
  }>;
}

export interface FluxLoadSettings {
  defaultType: DownloadType;
  defaultQuality: VideoQuality;
  defaultFormat: VideoFormatChoice;
  autoSaveToDownloads: boolean;
  saveFolderPrefix: string; // e.g. "FluxLoad"
  playNotificationSound: boolean;
  browserNotifications: boolean;
  autoClearOnFinish: boolean;
  speedGraphEnabled: boolean;
  batchConcurrency: number;
  maxFileSizeGb: number;
  bdixFirstSpeed: boolean;
  defaultRateLimit?: string; // 'unlimited' | '1M' | '2M' | '5M' | '10M'
  telegram?: TelegramConfig;
  smartRetryEnabled?: boolean;
  smartRetryMaxAttempts?: number;
}

export const DEFAULT_SETTINGS: FluxLoadSettings = {
  defaultType: 'video',
  defaultQuality: '720p',
  defaultFormat: 'mp4',
  autoSaveToDownloads: true,
  saveFolderPrefix: '',
  playNotificationSound: true,
  browserNotifications: true,
  autoClearOnFinish: false,
  speedGraphEnabled: true,
  batchConcurrency: 1,
  maxFileSizeGb: 2,
  bdixFirstSpeed: true,
  defaultRateLimit: 'unlimited',
  smartRetryEnabled: true,
  smartRetryMaxAttempts: 3,
};

export interface LocalConversionJob {
  id: string;
  originalName: string;
  targetFormat: 'mp4' | 'mp3' | 'webm' | 'gif' | 'flac' | 'wav' | 'm4a';
  audioBitrate?: AudioBitrateChoice;
  status: 'idle' | 'uploading' | 'converting' | 'completed' | 'error';
  progress: number;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  fileSize?: number;
}

export interface TaskStatus {
  id: string;
  status: DownloadStatus;
  progress: number; // 0 - 100
  speed: string; // e.g. "2.4 MB/s"
  downloadedSize: string; // e.g. "45.2 MB"
  totalSize: string; // e.g. "120 MB"
  eta: string; // e.g. "00:15"
  filename?: string;
  error?: string;
  downloadUrl?: string;
  needsCookies?: boolean;
  botBlocked?: boolean;
  isInstagramError?: boolean;
  platform?: string;
  telegramUploading?: boolean;
  telegramSpeed?: string; // e.g. "5.4 MB/s"
  telegramProgress?: number; // 0 - 100
  telegramEta?: string; // e.g. "12s"
  telegramUploadedBytes?: number;
  telegramTotalBytes?: number;
  telegramStatus?: 'idle' | 'queued' | 'uploading' | 'completed' | 'forbidden_admin_needed' | 'error';
  telegramPostUrl?: string;
  telegramPostUrls?: string[];
  telegramChannels?: Array<{
    targetChat: string;
    channelTitle?: string;
    success: boolean;
    channelPostUrl?: string;
    formattedSize?: string;
    error?: string;
    botNeedsAdmin?: boolean;
  }>;
  telegramSuccessCount?: number;
  telegramTotalTargets?: number;
  telegramMessage?: string;
  telegramError?: string;
}

export interface TelegramUploadHistoryItem {
  id: string;
  taskId?: string;
  title: string;
  filename: string;
  formattedSize: string;
  fileSizeBytes: number;
  channelTitle?: string;
  targetChat: string;
  channelPostUrl?: string;
  uploadedAt: string;
  speed?: string;
  durationSeconds?: number;
  status: 'completed' | 'failed';
  error?: string;
}

export type AppNavMode = 'single' | 'social' | 'batch' | 'crawler' | 'cutter' | 'converter';

export interface DiscoveredVideoItem {
  url: string;
  title: string;
  foundAt: string;
  status: 'discovered' | 'queued' | 'downloading' | 'completed' | 'posted' | 'failed';
  taskId?: string;
  channelPostUrl?: string;
  error?: string;
  fileSizeMb?: number;
}

export interface DomainWatcher {
  id: string;
  name: string;
  domainUrl: string;
  intervalMinutes: number;
  autoDownload: boolean;
  autoPostTelegram: boolean;
  targetChats?: string[];
  maxVideosPerScan: number;
  status: 'active' | 'paused' | 'running';
  lastScanAt?: string;
  nextScanAt?: string;
  totalDiscovered: number;
  totalDownloaded: number;
  totalPosted: number;
  processedUrls: string[];
  discoveredItems: DiscoveredVideoItem[];
  createdAt: string;
}

export interface TrimRequest {
  taskId?: string;
  filename?: string;
  startTime: number;
  endTime?: number;
  format: 'mp3' | 'm4a' | 'wav' | 'mp4';
  audioBitrate?: AudioBitrateChoice;
  volume?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

export interface HistoryRecord {
  id: string;
  url: string;
  title: string;
  type: DownloadType;
  format?: string;
  quality?: string;
  thumbnail?: string;
  createdAt?: any;
  filename?: string;
  taskId?: string;
  isFavorite?: boolean;
  platform?: string;
}

