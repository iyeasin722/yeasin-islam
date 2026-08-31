export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution?: string;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
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
}

export type DownloadType = 'video' | 'audio';
export type VideoQuality = '360p' | '480p' | '720p' | '1080p' | 'best';
export type VideoFormatChoice = 'mp4' | 'webm' | 'mp3' | 'm4a';

export interface DownloadRequest {
  url: string;
  type: DownloadType;
  quality: VideoQuality;
  format: VideoFormatChoice;
}

export type DownloadStatus = 'queued' | 'downloading' | 'processing' | 'completed' | 'error' | 'cancelled';

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
}
