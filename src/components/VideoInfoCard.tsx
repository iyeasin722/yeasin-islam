import React, { useState, useMemo } from 'react';
import { VideoInfo, DownloadType, VideoQuality, VideoFormatChoice, VideoFormat } from '../types';
import {
  Clock,
  Download,
  Film,
  Music,
  Check,
  ArrowLeft,
  HardDrive,
  Copy,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileVideo,
  Sparkles,
  Info
} from 'lucide-react';

interface VideoInfoCardProps {
  info: VideoInfo;
  onStartDownload: (config: { type: DownloadType; quality: VideoQuality; format: VideoFormatChoice }) => void;
  onReset: () => void;
}

// Format bytes into readable string (KB, MB, GB)
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Unknown';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

// Sanitize filename to ensure safe cross-platform saving
export function sanitizeFilename(name: string): string {
  if (!name) return 'video';
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export const VideoInfoCard: React.FC<VideoInfoCardProps> = ({ info, onStartDownload, onReset }) => {
  const [downloadType, setDownloadType] = useState<DownloadType>('video');
  const [quality, setQuality] = useState<VideoQuality>('auto');
  const [format, setFormat] = useState<VideoFormatChoice>('mp4');
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [showAllStreams, setShowAllStreams] = useState(false);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTypeChange = (type: DownloadType) => {
    setDownloadType(type);
    if (type === 'audio') {
      setFormat('mp3');
    } else {
      setFormat('mp4');
    }
  };

  const cleanTitle = useMemo(() => sanitizeFilename(info.title), [info.title]);
  const plannedFilename = `${cleanTitle}.${format}`;

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(info.title || cleanTitle).catch(() => {});
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  // Calculate or estimate size for each video quality option
  const qualitySizeMap = useMemo(() => {
    const formats = info.formats || [];
    const duration = info.duration || 0;

    const computeSize = (q: VideoQuality): { sizeText: string; isApprox: boolean; bytes: number } => {
      if (q === 'auto') {
        const sorted = [...formats]
          .filter((f) => f.vcodec !== 'none' && (f.filesize || f.filesize_approx))
          .sort((a, b) => (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0));
        const best = sorted[0];
        if (best?.filesize) return { sizeText: formatBytes(best.filesize), isApprox: false, bytes: best.filesize };
        if (best?.filesize_approx) return { sizeText: `~${formatBytes(best.filesize_approx)}`, isApprox: true, bytes: best.filesize_approx };
        if (duration > 0) {
          const est = duration * 600 * 1024;
          return { sizeText: `~${formatBytes(est)}`, isApprox: true, bytes: est };
        }
        return { sizeText: 'Best Quality', isApprox: true, bytes: 0 };
      }

      const targetHeight =
        q === '4k' ? 2160 :
        q === '1080p' ? 1080 :
        q === '720p' ? 720 :
        q === '480p' ? 480 :
        q === '360p' ? 360 : 1080;

      const matched = formats.find((f) => {
        const res = f.resolution || f.format_note || '';
        return res.includes(String(targetHeight)) || (q === '4k' && (res.includes('2160') || res.toLowerCase().includes('4k')));
      });

      if (matched?.filesize) {
        return { sizeText: formatBytes(matched.filesize), isApprox: false, bytes: matched.filesize };
      }
      if (matched?.filesize_approx) {
        return { sizeText: `~${formatBytes(matched.filesize_approx)}`, isApprox: true, bytes: matched.filesize_approx };
      }

      // Bitrate estimate based on video duration
      if (duration > 0) {
        const rates: Record<string, number> = {
          '4k': 2400 * 1024,   // ~2.4 MB/s (~19 Mbps)
          '1080p': 580 * 1024,  // ~580 KB/s (~4.6 Mbps)
          '720p': 290 * 1024,   // ~290 KB/s (~2.3 Mbps)
          '480p': 145 * 1024,   // ~145 KB/s (~1.1 Mbps)
          '360p': 85 * 1024,    // ~85 KB/s (~680 Kbps)
        };
        const est = duration * (rates[q] || 350 * 1024);
        return { sizeText: `~${formatBytes(est)}`, isApprox: true, bytes: est };
      }

      return { sizeText: 'Estimated', isApprox: true, bytes: 0 };
    };

    const map: Record<string, { sizeText: string; isApprox: boolean; bytes: number }> = {};
    const qualities: VideoQuality[] = ['auto', '4k', '1080p', '720p', '480p', '360p'];
    for (const q of qualities) {
      map[q] = computeSize(q);
    }
    return map;
  }, [info.formats, info.duration]);

  // Calculate audio sizes for MP3 and M4A
  const audioSizeMap = useMemo(() => {
    const formats = info.formats || [];
    const duration = info.duration || 0;

    const audioStream = formats.find((f) => f.vcodec === 'none' && (f.filesize || f.filesize_approx));
    const baseAudioBytes = audioStream?.filesize || audioStream?.filesize_approx || (duration > 0 ? duration * 32 * 1024 : 3.5 * 1024 * 1024);

    return {
      mp3: formatBytes(Math.round(baseAudioBytes * 1.1)),
      m4a: formatBytes(Math.round(baseAudioBytes * 0.9)),
    };
  }, [info.formats, info.duration]);

  // Selected format size
  const currentSelectedSize = useMemo(() => {
    if (downloadType === 'audio') {
      return audioSizeMap[format === 'm4a' ? 'm4a' : 'mp3'] || '~4.0 MB';
    }
    return qualitySizeMap[quality]?.sizeText || 'Detecting...';
  }, [downloadType, quality, format, audioSizeMap, qualitySizeMap]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartDownload({
      type: downloadType,
      quality,
      format,
    });
  };

  // Available raw formats from yt-dlp
  const sortedRawStreams = useMemo(() => {
    if (!info.formats || info.formats.length === 0) return [];
    return [...info.formats].sort((a, b) => {
      const aSize = a.filesize || a.filesize_approx || 0;
      const bSize = b.filesize || b.filesize_approx || 0;
      return bSize - aSize;
    });
  }, [info.formats]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/85 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl animate-fadeIn">
      {/* Navigation & Status Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/80">
        <button
          onClick={onReset}
          className="inline-flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors bg-slate-800/60 hover:bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to URL Input</span>
        </button>
        <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5 shadow-sm">
          <Check className="w-3.5 h-3.5" /> Video Info & Sizes Loaded
        </span>
      </div>

      {/* Video Information Header (Thumbnail, Title, Metadata) */}
      <div className="flex flex-col md:flex-row gap-5 mb-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
        {/* Thumbnail */}
        <div className="w-full md:w-52 shrink-0 aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative shadow-md">
          {info.thumbnail ? (
            <img
              src={info.thumbnail}
              alt={info.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Film className="w-10 h-10" />
            </div>
          )}
          {info.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-200 flex items-center gap-1 border border-white/10 shadow-sm">
              <Clock className="w-3 h-3 text-cyan-400" />
              {formatDuration(info.duration)}
            </div>
          )}
        </div>

        {/* Title, Channel, & Metadata */}
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-base md:text-lg font-bold text-slate-100 line-clamp-2 leading-snug">
              {info.title}
            </h3>
            <button
              onClick={handleCopyTitle}
              className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 border border-slate-700/50 transition-colors"
              title="Copy video title"
            >
              {copiedTitle ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-slate-400">
            <p className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Channel / Author:</span>
              <span className="text-slate-200 font-medium">{info.uploader || 'Creator'}</span>
            </p>
            {info.view_count ? (
              <p className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Views:</span>
                <span className="text-slate-300">{info.view_count.toLocaleString()}</span>
              </p>
            ) : null}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">
                <HardDrive className="w-3 h-3 text-cyan-400" />
                No Size Limit (2000GB+ Supported)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {info.formats?.length || 0} streams detected
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Guaranteed Filename Confirmation Banner */}
      <div className="mb-6 p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileVideo className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Saves to device with video name:
            </div>
            <div className="font-mono text-xs font-semibold text-cyan-300 truncate max-w-sm sm:max-w-md" title={plannedFilename}>
              {plannedFilename}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-medium border border-emerald-500/30">
            <Check className="w-3 h-3" /> Same Title As Video
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Download Type Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            1. Select Media Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('video')}
              className={`flex items-center justify-center space-x-2.5 py-3.5 px-4 rounded-2xl border text-sm font-semibold transition-all ${
                downloadType === 'video'
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/15'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Full Video + Audio</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('audio')}
              className={`flex items-center justify-center space-x-2.5 py-3.5 px-4 rounded-2xl border text-sm font-semibold transition-all ${
                downloadType === 'audio'
                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/15'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Audio Only (Music / Speech)</span>
            </button>
          </div>
        </div>

        {/* Video Quality with Exact / Approx File Sizes */}
        {downloadType === 'video' && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. Choose Video Quality & File Size
              </label>
              <span className="text-[11px] text-cyan-400 font-mono font-medium">
                Selected: {qualitySizeMap[quality]?.sizeText || ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'auto', label: 'Auto (Best)', sub: 'Highest Quality' },
                  { id: '4k', label: '4K Ultra HD', sub: '2160p' },
                  { id: '1080p', label: '1080p Full HD', sub: 'High Definition' },
                  { id: '720p', label: '720p HD', sub: 'Standard HD' },
                  { id: '480p', label: '480p SD', sub: 'Standard Def' },
                  { id: '360p', label: '360p Low', sub: 'Data Saver' },
                ] as const
              )
                .filter((item) => {
                  if (item.id === 'auto') return true;
                  if (info.availableQualities && info.availableQualities.length > 0) {
                    return info.availableQualities.includes(item.id as VideoQuality);
                  }
                  if (info.formats && info.formats.length > 0) {
                    return info.formats.some((f) => {
                      if (f.vcodec === 'none') return false;
                      const h = f.height || (f.resolution ? parseInt(f.resolution.split('x')[1] || f.resolution, 10) : 0);
                      if (item.id === '4k') return h >= 2000;
                      if (item.id === '1080p') return h >= 1000 && h < 1400;
                      if (item.id === '720p') return h >= 700 && h < 1000;
                      if (item.id === '480p') return h >= 450 && h < 700;
                      if (item.id === '360p') return h >= 330 && h < 450;
                      return false;
                    });
                  }
                  if (info.maxHeight) {
                    const h = info.maxHeight;
                    if (item.id === '1080p') return h >= 1000;
                    if (item.id === '720p') return h >= 700;
                    if (item.id === '480p') return h >= 450;
                    if (item.id === '360p') return h >= 330;
                    return false;
                  }
                  return ['auto', '720p', '1080p'].includes(item.id);
                })
                .map((item) => {
                const isSelected = quality === item.id;
                const sizeInfo = qualitySizeMap[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuality(item.id as VideoQuality)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border-cyan-500 text-slate-100 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-500/40'
                        : 'bg-slate-950/70 border-slate-800/90 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold tracking-tight">{item.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">{item.sub}</span>
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-slate-800/90 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        {sizeInfo?.sizeText || 'Detecting...'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Audio Quality & Formats if Audio Type */}
        {downloadType === 'audio' && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. Choose Audio Format & Size
              </label>
              <span className="text-[11px] text-cyan-400 font-mono font-medium">
                Size: {currentSelectedSize}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  format === 'mp3'
                    ? 'bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border-cyan-500 text-slate-100 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-slate-100">MP3 (320kbps)</div>
                  <div className="text-[11px] text-slate-400">Universal Audio Format</div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {audioSizeMap.mp3}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('m4a')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  format === 'm4a'
                    ? 'bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border-cyan-500 text-slate-100 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-500/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-slate-100">M4A (AAC)</div>
                  <div className="text-[11px] text-slate-400">High Efficiency Audio</div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {audioSizeMap.m4a}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Video Format Choice (MP4 vs WebM) */}
        {downloadType === 'video' && (
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              3. Container Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['mp4', 'webm'] as VideoFormatChoice[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 ${
                    format === f
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/15'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  <span>{f}</span>
                  {format === f && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Final Download Summary Card */}
        <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              {downloadType === 'video' ? <Film className="w-5 h-5" /> : <Music className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Ready to Download:</div>
              <div className="text-slate-100 font-bold text-sm">
                {downloadType === 'video' ? `${quality.toUpperCase()} ${format.toUpperCase()}` : `${format.toUpperCase()} Audio`}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
            <div className="text-right">
              <div className="text-slate-500 text-[10px]">Estimated Size:</div>
              <div className="text-cyan-300 font-mono font-bold text-sm">
                {currentSelectedSize}
              </div>
            </div>
          </div>
        </div>

        {/* Main Action Button */}
        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center space-x-2 text-sm tracking-wide"
        >
          <Download className="w-5 h-5" />
          <span>Start Download ({currentSelectedSize})</span>
        </button>

        {/* Expandable Stream Formats & Exact Sizes Details */}
        {sortedRawStreams.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAllStreams((prev) => !prev)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950/50 hover:bg-slate-800/50 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                View All {sortedRawStreams.length} Detected Stream Formats & Exact Sizes
              </span>
              {showAllStreams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAllStreams && (
              <div className="mt-3 bg-slate-950 rounded-2xl border border-slate-800 p-3 max-h-60 overflow-y-auto space-y-1.5 text-xs">
                {sortedRawStreams.slice(0, 15).map((s, idx) => {
                  const size = s.filesize ? formatBytes(s.filesize) : s.filesize_approx ? `~${formatBytes(s.filesize_approx)}` : 'Varies';
                  return (
                    <div
                      key={s.format_id || idx}
                      className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold shrink-0">
                          {s.format_id}
                        </span>
                        <span className="font-medium text-slate-200 truncate">
                          {s.resolution || s.format_note || 'Audio Stream'} ({s.ext})
                        </span>
                        {s.fps && <span className="text-[10px] text-slate-500">{s.fps}fps</span>}
                      </div>
                      <span className="font-mono font-semibold text-slate-300 shrink-0 text-[11px]">
                        {size}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
