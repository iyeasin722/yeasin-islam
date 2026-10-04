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
  platform?: string;
}

export type AppNavMode = 'single' | 'social' | 'batch' | 'cutter' | 'converter';

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

