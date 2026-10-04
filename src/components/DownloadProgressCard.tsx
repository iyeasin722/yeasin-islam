import React, { useState, useEffect, useRef } from 'react';
import { TaskStatus, FluxLoadSettings } from '../types';
import {
  Download,
  Ban,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  HardDrive,
  Activity,
  FolderCheck,
  Play,
  Pause,
  Volume2,
  Film,
  Music,
  Cookie,
  ExternalLink,
  QrCode,
  Smartphone,
  HelpCircle,
  Share2,
  Scissors,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { soundNotify } from '../lib/soundNotify';
import { downloadFileWithBlob } from '../lib/downloadHelper';
import { QrCodeModal } from './QrCodeModal';
import { MobileGuideModal } from './MobileGuideModal';

interface DownloadProgressCardProps {
  taskStatus: TaskStatus;
  onCancel: () => void;
  onReset: () => void;
  onRetry?: () => void;
  settings?: FluxLoadSettings;
  videoTitle?: string;
  thumbnail?: string;
  onOpenSettings?: () => void;
  onOpenAudioCutter?: (taskId?: string, mediaUrl?: string, title?: string) => void;
  onOpenMediaPlayer?: (url: string, title?: string, type?: 'video' | 'audio', taskId?: string) => void;
}

interface SpeedPoint {
  time: string;
  speed: number; // in MB/s
}

export const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  taskStatus,
  onCancel,
  onReset,
  onRetry,
  settings,
  videoTitle,
  thumbnail,
  onOpenSettings,
  onOpenAudioCutter,
  onOpenMediaPlayer,
}) => {
  const [speedHistory, setSpeedHistory] = useState<SpeedPoint[]>([]);
  const [hasAutoSaved, setHasAutoSaved] = useState(false);
  const [showPreviewPlayer, setShowPreviewPlayer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileGuideOpen, setIsMobileGuideOpen] = useState(false);
  const [isSavingToDisk, setIsSavingToDisk] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{
    percent: number;
    loadedFormatted: string;
    totalFormatted: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasSavedSuccess, setHasSavedSuccess] = useState(false);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const isCompleted = taskStatus.status === 'completed';
  const isError = taskStatus.status === 'error';
  const isCancelled = taskStatus.status === 'cancelled';
  const isDownloading = taskStatus.status === 'downloading' || taskStatus.status === 'processing';

  // Format safe filename matching video's actual title without extraneous prefixes or double underscores
  const rawBase =
    videoTitle?.trim() ||
    taskStatus.filename?.replace(/\.[^/.]+$/, "").replace(/^media_[a-f0-9]+/, "") ||
    "video";
  const cleanTitle = rawBase
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  const fileExt = taskStatus.filename?.split('.').pop() || 'mp4';
  const prefix = settings?.saveFolderPrefix?.trim() && settings.saveFolderPrefix.trim() !== 'FluxLoad'
    ? `${settings.saveFolderPrefix.trim()}_`
    : '';
  const finalFilename = `${prefix}${cleanTitle || 'video'}.${fileExt}`
    .replace(/__+/g, "_")
    .replace(/^_+/, "");

  const handleSaveToDisk = async () => {
    if (!taskStatus.downloadUrl || isSavingToDisk) return;
    setIsSavingToDisk(true);
    setSaveError(null);
    setSaveProgress(null);
    try {
      await downloadFileWithBlob(taskStatus.downloadUrl, finalFilename, (progress) => {
        setSaveProgress(progress);
      });
      setHasSavedSuccess(true);
    } catch (err: any) {
      console.error('Save to disk error:', err);
      setSaveError(err.message || 'Failed to save video to device');
    } finally {
      setIsSavingToDisk(false);
    }
  };

  // Handle auto-save, notifications, and chimes when status switches to completed
  useEffect(() => {
    if (isCompleted && taskStatus.downloadUrl && !hasAutoSaved) {
      setHasAutoSaved(true);

      // 1. Play chime audio if enabled
      if (settings?.playNotificationSound !== false) {
        soundNotify.playCompleteSound();
      }

      // 2. Trigger browser notification if enabled
      if (settings?.browserNotifications) {
        soundNotify.showNotification('FluxLoad: Download Complete! 🎉', {
          body: `File ready: ${finalFilename}`,
        });
      }

      // 3. Auto-save using authenticated blob download if enabled
      if (settings?.autoSaveToDownloads !== false && !isMobile) {
        handleSaveToDisk();
      }
    } else if (isError) {
      if (settings?.playNotificationSound !== false) {
        soundNotify.playErrorSound();
      }
    }
  }, [isCompleted, isError, taskStatus.downloadUrl, hasAutoSaved, settings, finalFilename, isMobile]);

  // Parse speed string into MB/s number for Recharts
  useEffect(() => {
    if (isDownloading && taskStatus.speed) {
      const speedStr = taskStatus.speed.toLowerCase();
      let num = 0;
      const match = speedStr.match(/([\d.]+)\s*(mib|kib|mb|kb|gb)\/s/);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit.includes('ki') || unit.includes('kb')) {
          num = val / 1024; // KB to MB
        } else if (unit.includes('gi')) {
          num = val * 1024; // GB to MB
        } else {
          num = val; // MB
        }
      } else {
        const fallbackMatch = speedStr.match(/([\d.]+)/);
        if (fallbackMatch) {
          num = parseFloat(fallbackMatch[1]);
        }
      }

      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setSpeedHistory((prev) => {
        const newPoint = { time: timeLabel, speed: parseFloat(num.toFixed(2)) };
        const updated = [...prev, newPoint];
        if (updated.length > 15) {
          return updated.slice(updated.length - 15);
        }
        return updated;
      });
    } else if (!isDownloading && isCompleted) {
      setSpeedHistory((prev) => [...prev, { time: 'Done', speed: 0 }]);
    }
  }, [taskStatus.speed, isDownloading, isCompleted]);

  const togglePlayMedia = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      mediaRef.current.play();
      setIsPlaying(true);
    }
  };

  const isAudioOnly = finalFilename.endsWith('.mp3') || finalFilename.endsWith('.m4a');

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/85 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl animate-fadeIn">
      {/* Status Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-4 shadow-lg">
          {isCompleted ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          ) : isError || isCancelled ? (
            <AlertCircle className="w-8 h-8 text-rose-400" />
          ) : (
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          )}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-slate-100 tracking-tight">
          {isCompleted
            ? 'Download Completed & Saved!'
            : isError
            ? 'Download Failed'
            : isCancelled
            ? 'Download Cancelled'
            : taskStatus.progress >= 99
            ? 'Finalizing & Merging Streams...'
            : 'Downloading & Processing Media...'}
        </h3>
        <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-md mx-auto">
          {isCompleted ? (
            <span className="text-emerald-400 font-medium flex items-center justify-center gap-1.5">
              <FolderCheck className="w-4 h-4" />
              Saved to Downloads / {settings?.saveFolderPrefix || 'FluxLoad'}
            </span>
          ) : isError ? (
            taskStatus.error || 'An unexpected error occurred during stream extraction.'
          ) : isCancelled ? (
            'The download task was stopped and temporary files cleaned up.'
          ) : taskStatus.progress >= 99 ? (
            <span className="text-cyan-300 font-medium flex items-center justify-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Download finished! FFmpeg is now merging video and audio into your final MP4...
            </span>
          ) : (
            videoTitle || 'Processing high-speed stream with yt-dlp & FFmpeg...'
          )}
        </p>

        <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
          <span className="text-slate-500 font-medium">Filename:</span>
          <span className="font-mono text-cyan-400 font-medium truncate max-w-[280px] sm:max-w-md" title={finalFilename}>
            {finalFilename}
          </span>
        </div>

        {isError && (
          <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs max-w-md mx-auto text-left space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Cookie className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Host Protection, Rate Limit or Verification</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              {taskStatus.error || 'The media host rate-limited or blocked anonymous cloud requests. You can bypass this easily by adding site cookies in Settings.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex-1 py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Cookie className="w-3.5 h-3.5" />
                  <span>Open Cookie Settings</span>
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 py-2 px-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-xl text-cyan-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Download</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar & Real-time Live Stats */}
      {isDownloading && (
        <div className="space-y-6 mb-8">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                {taskStatus.progress >= 99 ? 'Merging Streams (FFmpeg)' : 'Live Stream Download'}
              </span>
              <span className="text-cyan-400 font-mono font-bold text-sm">
                {taskStatus.progress >= 99 ? '99.5% (Merging...)' : `${taskStatus.progress.toFixed(1)}%`}
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-300 shadow-sm shadow-cyan-500/50"
                style={{ width: `${Math.max(2, taskStatus.progress)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl text-center shadow-inner">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                {taskStatus.progress >= 99 ? 'Phase' : 'Speed'}
              </span>
              <span className="text-sm font-bold text-cyan-300 font-mono">
                {taskStatus.progress >= 99 ? 'Merging...' : taskStatus.speed || '2.4 MB/s'}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl text-center shadow-inner">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Total Size
              </span>
              <span className="text-sm font-bold text-slate-200 font-mono">{taskStatus.totalSize || '15.4 MB'}</span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-2xl text-center shadow-inner">
              <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                ETA
              </span>
              <span className="text-sm font-bold text-slate-200 font-mono">
                {taskStatus.progress >= 99 ? 'Finishing...' : taskStatus.eta || '00:06'}
              </span>
            </div>
          </div>

          {/* Real-time Transfer Speed Graph */}
          {settings?.speedGraphEnabled !== false && (
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Bandwidth Transfer Speed
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                  Live Stream
                </span>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={speedHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit=" MB/s" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#22d3ee' }}
                      formatter={(value: any) => [`${value} MB/s`, 'Speed']}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#speedGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed In-App Media Player / Preview */}
      {isCompleted && taskStatus.downloadUrl && (
        <div className="mb-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              {isAudioOnly ? <Music className="w-4 h-4 text-cyan-400" /> : <Film className="w-4 h-4 text-cyan-400" />}
              Instant In-App Player
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-medium">Ready</span>
          </div>

          {isAudioOnly ? (
            <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-between border border-slate-800">
              <audio ref={mediaRef as any} src={taskStatus.downloadUrl} controls className="w-full h-10 accent-cyan-500" />
            </div>
          ) : (
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative">
              <video
                ref={mediaRef as any}
                src={taskStatus.downloadUrl}
                controls
                className="w-full h-full object-contain"
                poster={thumbnail}
              />
            </div>
          )}
        </div>
      )}

      {/* Guidance Notice for Large/Completed Videos */}
      {isCompleted && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-slate-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-emerald-300">Video download completed on server!</p>
            <p className="text-slate-400">
              For 20+ minute large videos (100MB+), click <strong className="text-white">"Save to PC"</strong> to download directly, or click <strong className="text-white">"Open in New Tab"</strong> to play/save natively in your browser.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {saveError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-xs text-rose-300">
            <span>{saveError}</span>
            <button
              type="button"
              onClick={handleSaveToDisk}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 font-semibold rounded-lg text-xs cursor-pointer ml-2"
            >
              পুনরায় চেষ্টা করুন (Retry)
            </button>
          </div>
        )}

        {isCompleted && taskStatus.downloadUrl && isMobile && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300 shadow-sm">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ভিডিও প্রস্তুত! নিচে <strong>&quot;ফোনে সেভ করুন&quot;</strong> চাপুন।</span>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileGuideOpen(true)}
              className="text-[11px] underline text-cyan-300 shrink-0 font-semibold hover:text-white"
            >
              ফোন সহায়তা
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {isCompleted && taskStatus.downloadUrl && (
            <>
              <button
                type="button"
                onClick={handleSaveToDisk}
                disabled={isSavingToDisk}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-75 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 text-sm tracking-wide active:scale-98 cursor-pointer"
              >
                {isSavingToDisk ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>
                      ডিভাইসে সেভ হচ্ছে... {saveProgress ? `${saveProgress.loadedFormatted} / ${saveProgress.totalFormatted} (${saveProgress.percent}%)` : 'প্রস্তুত হচ্ছে...'}
                    </span>
                  </>
                ) : hasSavedSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                    <span>{isMobile ? '✅ সেভ হয়েছে (আবার করতে চাপুন)' : '✅ Saved to Downloads (Click to Save Again)'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>{isMobile ? 'Download to Phone / ফোনে সেভ করুন' : 'Save to PC / Downloads'}</span>
                  </>
                )}
              </button>
              <a
                href={`${taskStatus.downloadUrl}${taskStatus.downloadUrl.includes('?') ? '&' : '?'}inline=true`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-4 px-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm shadow-md active:scale-98"
                title="Open video in a new browser tab to play or right-click 'Save video as...'"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{isMobile ? 'Open Stream / সরাসরি দেখুন' : 'Open in New Tab'}</span>
              </a>
              {!isMobile ? (
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm shadow-md active:scale-98"
                  title="Scan QR Code to download directly to smartphone or tablet"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR to Phone</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMobileGuideOpen(true)}
                  className="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 hover:text-cyan-200 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm shadow-md active:scale-98"
                  title="Mobile download help and troubleshooting"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Help / সহায়তা</span>
                </button>
              )}

              {/* Enhanced Action: Trim as Ringtone */}
              {onOpenAudioCutter && (
                <button
                  type="button"
                  onClick={() => onOpenAudioCutter(taskStatus.id, taskStatus.downloadUrl, videoTitle)}
                  className="py-4 px-4 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-1.5 text-xs shadow-md active:scale-98 cursor-pointer"
                  title="অডিও বা রিংটোন হিসেবে কেটে নিন"
                >
                  <Scissors className="w-4 h-4" />
                  <span>✂️ Trim / রিংটোন</span>
                </button>
              )}

              {/* Enhanced Action: Open Full Player Modal */}
              {onOpenMediaPlayer && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenMediaPlayer(
                      taskStatus.downloadUrl!,
                      videoTitle,
                      isAudioOnly ? 'audio' : 'video',
                      taskStatus.id
                    )
                  }
                  className="py-4 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-1.5 text-xs shadow-md active:scale-98 cursor-pointer"
                  title="লুপ এবং স্পিড সহ ফুল প্লেয়ার"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Player</span>
                </button>
              )}
            </>
          )}

          {isDownloading && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm active:scale-98"
            >
              <Ban className="w-4 h-4" />
              <span>Cancel Download</span>
            </button>
          )}

          {(isCompleted || isError || isCancelled) && (
            <>
              {isError && onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex-1 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm shadow-lg shadow-cyan-500/20 active:scale-98"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Download</span>
                </button>
              )}
              <button
                type="button"
                onClick={onReset}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm active:scale-98"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Download Another Video</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-center text-xs text-slate-500 gap-2">
        <HardDrive className="w-4 h-4 text-slate-400" />
        <span>Auto-saved to your device. Temporary cloud files are cleaned up automatically.</span>
      </div>

      {/* QR Code File Transfer Modal */}
      {isCompleted && taskStatus.downloadUrl && (
        <QrCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          downloadUrl={taskStatus.downloadUrl}
          filename={finalFilename}
        />
      )}

      {/* Mobile Guide Modal */}
      <MobileGuideModal
        isOpen={isMobileGuideOpen}
        onClose={() => setIsMobileGuideOpen(false)}
      />
    </div>
  );
};
