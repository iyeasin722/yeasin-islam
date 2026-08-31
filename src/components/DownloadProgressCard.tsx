import React, { useState, useEffect } from 'react';
import { TaskStatus } from '../types';
import { Download, Ban, CheckCircle2, AlertCircle, Loader2, RefreshCw, HardDrive, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DownloadProgressCardProps {
  taskStatus: TaskStatus;
  onCancel: () => void;
  onReset: () => void;
}

interface SpeedPoint {
  time: string;
  speed: number; // in MB/s
}

export const DownloadProgressCard: React.FC<DownloadProgressCardProps> = ({
  taskStatus,
  onCancel,
  onReset,
}) => {
  const [speedHistory, setSpeedHistory] = useState<SpeedPoint[]>([]);

  const isCompleted = taskStatus.status === 'completed';
  const isError = taskStatus.status === 'error';
  const isCancelled = taskStatus.status === 'cancelled';
  const isDownloading = taskStatus.status === 'downloading' || taskStatus.status === 'processing';

  // Parse speed string (e.g. "4.2 MiB/s" or "850 KiB/s") into MB/s number for Recharts
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
        // Keep last 15 points for smooth real-time graph
        if (updated.length > 15) {
          return updated.slice(updated.length - 15);
        }
        return updated;
      });
    } else if (!isDownloading) {
      if (isCompleted) {
        setSpeedHistory((prev) => [
          ...prev,
          { time: 'Done', speed: 0 }
        ]);
      }
    }
  }, [taskStatus.speed, isDownloading, isCompleted]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/80 mb-4 shadow-lg">
          {isCompleted ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
          ) : isError || isCancelled ? (
            <AlertCircle className="w-7 h-7 text-rose-400" />
          ) : (
            <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-100 tracking-tight">
          {isCompleted
            ? 'Download Completed Successfully!'
            : isError
            ? 'Download Failed'
            : isCancelled
            ? 'Download Cancelled'
            : 'Downloading Media...'}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {isCompleted
            ? 'Your file has been processed and is ready for download.'
            : isError
            ? taskStatus.error || 'An unexpected error occurred during download.'
            : isCancelled
            ? 'The download task was stopped and temporary files cleaned up.'
            : 'Processing stream using yt-dlp & FFmpeg on your local server.'}
        </p>
      </div>

      {/* Progress Bar & Stats (only while downloading) */}
      {isDownloading && (
        <div className="space-y-6 mb-8">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
              <span>Progress</span>
              <span className="text-cyan-400 font-mono">{taskStatus.progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300 shadow-sm shadow-cyan-500/50"
                style={{ width: `${Math.max(2, taskStatus.progress)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                Speed
              </span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{taskStatus.speed}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                Size
              </span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{taskStatus.totalSize}</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl text-center">
              <span className="block text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1">
                ETA
              </span>
              <span className="text-sm font-semibold text-slate-200 font-mono">{taskStatus.eta}</span>
            </div>
          </div>

          {/* Real-time Transfer Speed Graph using Recharts */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Real-Time Transfer Speed</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">Live Stream</span>
            </div>
            <div className="h-36 w-full">
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
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px', color: '#f8fafc' }}
                    itemStyle={{ color: '#22d3ee' }}
                    formatter={(value: any) => [`${value} MB/s`, 'Speed']}
                  />
                  <Area type="monotone" dataKey="speed" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#speedGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {isCompleted && taskStatus.downloadUrl && (
          <a
            href={taskStatus.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={taskStatus.filename || 'downloaded_media.mp4'}
            className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 text-sm tracking-wide"
          >
            <Download className="w-5 h-5" />
            <span>Download File to Device</span>
          </a>
        )}

        {isDownloading && (
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 text-sm"
          >
            <Ban className="w-4 h-4" />
            <span>Cancel Download</span>
          </button>
        )}

        {(isCompleted || isError || isCancelled) && (
          <button
            onClick={onReset}
            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Download Another Video</span>
          </button>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-center text-xs text-slate-500 gap-2">
        <HardDrive className="w-4 h-4 text-slate-400" />
        <span>Temporary files are automatically deleted after download delivery.</span>
      </div>
    </div>
  );
};
