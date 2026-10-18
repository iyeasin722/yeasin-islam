import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Timer,
  Play,
  X,
  Sparkles,
  Moon,
  Sun,
  Zap,
  Send,
  Download,
  Bell,
  CheckCircle2,
  AlertCircle,
  Film,
  Music,
} from 'lucide-react';
import { BatchItem, ScheduledBatchTask, DownloadType, VideoQuality, VideoFormatChoice } from '../types';

interface BatchScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: BatchItem[];
  selectedItemIds: string[];
  defaultConcurrency?: number;
  onScheduleCreated: (newBatch: ScheduledBatchTask) => void;
}

export const BatchScheduleModal: React.FC<BatchScheduleModalProps> = ({
  isOpen,
  onClose,
  items,
  selectedItemIds,
  defaultConcurrency = 1,
  onScheduleCreated,
}) => {
  if (!isOpen) return null;

  // Selected item scope: 'selected' or 'all'
  const [scope, setScope] = useState<'selected' | 'all'>(
    selectedItemIds.length > 0 ? 'selected' : 'all'
  );

  const targetItems = useMemo(() => {
    if (scope === 'selected' && selectedItemIds.length > 0) {
      return items.filter((i) => selectedItemIds.includes(i.id));
    }
    return items;
  }, [items, selectedItemIds, scope]);

  // Generate ISO local string helper (YYYY-MM-DDTHH:mm)
  const formatDateTimeLocal = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  // Default to 1 hour from now
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
    d.setSeconds(0);
    return d;
  }, []);

  const [scheduledDateTime, setScheduledDateTime] = useState<string>(
    formatDateTimeLocal(defaultDate)
  );
  const [batchName, setBatchName] = useState<string>(
    `Scheduled Batch (${targetItems.length} videos)`
  );
  const [concurrency, setConcurrency] = useState<number>(defaultConcurrency || 1);
  const [autoSendTelegram, setAutoSendTelegram] = useState<boolean>(true);
  const [autoSaveToDownloads, setAutoSaveToDownloads] = useState<boolean>(false);
  const [notifyOnStart, setNotifyOnStart] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep name synced if user hasn't heavily customized it
  useEffect(() => {
    if (!batchName || batchName.startsWith('Scheduled Batch')) {
      setBatchName(`Scheduled Batch (${targetItems.length} videos)`);
    }
  }, [targetItems.length]);

  // Calculate countdown / validity
  const scheduledTimeMs = useMemo(() => {
    if (!scheduledDateTime) return NaN;
    return new Date(scheduledDateTime).getTime();
  }, [scheduledDateTime]);

  const nowMs = Date.now();
  const diffMs = scheduledTimeMs - nowMs;
  const isTimeInFuture = !isNaN(diffMs) && diffMs > 15000; // at least 15 seconds in future

  const countdownText = useMemo(() => {
    if (isNaN(diffMs)) return 'Invalid date/time';
    if (diffMs <= 0) return 'Selected time must be in the future';
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
    parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);

    return `Starts in ${parts.join(' ')}`;
  }, [diffMs]);

  // Presets
  const applyPreset = (preset: 'in15m' | 'in1h' | 'in3h' | 'night' | 'tomorrowMorning') => {
    const d = new Date();
    switch (preset) {
      case 'in15m':
        d.setMinutes(d.getMinutes() + 15);
        break;
      case 'in1h':
        d.setHours(d.getHours() + 1);
        break;
      case 'in3h':
        d.setHours(d.getHours() + 3);
        break;
      case 'night': {
        // Tonight at 2:00 AM (or next 2 AM if already past 2 AM)
        if (d.getHours() >= 2) {
          d.setDate(d.getDate() + 1);
        }
        d.setHours(2, 0, 0, 0);
        break;
      }
      case 'tomorrowMorning': {
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        break;
      }
    }
    setScheduledDateTime(formatDateTimeLocal(d));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTimeInFuture) {
      setErrorMsg('Please select a time in the future.');
      return;
    }

    if (targetItems.length === 0) {
      setErrorMsg('No video URLs selected to schedule.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    // Request notification permission if requested
    if (notifyOnStart && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }

    try {
      const payload = {
        name: batchName.trim() || `Scheduled Batch (${targetItems.length} videos)`,
        scheduledTime: new Date(scheduledDateTime).toISOString(),
        items: targetItems.map((i) => ({
          id: i.id,
          url: i.url,
          title: i.info?.title || i.title || i.url,
          type: i.type,
          quality: i.quality,
          format: i.format,
        })),
        concurrency,
        autoSendTelegram,
        autoSaveToDownloads,
      };

      const res = await fetch('/api/scheduled-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save scheduled batch');
      }

      const data = await res.json();
      if (data.batch) {
        onScheduleCreated(data.batch);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating scheduled batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Task Scheduler</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Batch Manager
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                নির্দিষ্ট সময় ও তারিখে স্বয়ংক্রিয়ভাবে ডাউনলোড শুরু করার সময়সূচী নির্ধারণ করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Time Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick Schedule Presets (সহজ শর্টকাট):</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => applyPreset('night')}
                className="p-2.5 bg-slate-950/80 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold mb-0.5">
                  <Moon className="w-3.5 h-3.5" />
                  <span>Night Turbo</span>
                </div>
                <div className="text-[11px] text-slate-400">Tonight 2:00 AM (অফ-পিক)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('in1h')}
                className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold mb-0.5">
                  <Timer className="w-3.5 h-3.5" />
                  <span>In 1 Hour</span>
                </div>
                <div className="text-[11px] text-slate-400">+৬০ মিনিট পর</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('in3h')}
                className="p-2.5 bg-slate-950/80 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-500/50 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5 text-blue-400 font-semibold mb-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>In 3 Hours</span>
                </div>
                <div className="text-[11px] text-slate-400">+৩ ঘণ্টা পর</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('tomorrowMorning')}
                className="p-2.5 bg-slate-950/80 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center space-x-1.5 text-amber-400 font-semibold mb-0.5">
                  <Sun className="w-3.5 h-3.5" />
                  <span>Tomorrow</span>
                </div>
                <div className="text-[11px] text-slate-400">সকাল ৮:০০ AM</div>
              </button>
            </div>
          </div>

          {/* Date & Time Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Execution Date & Time (ডাউনলোড শুরুর সময়):</span>
              </span>
              {isTimeInFuture && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                  {countdownText}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={scheduledDateTime}
                min={formatDateTimeLocal(new Date())}
                onChange={(e) => {
                  setScheduledDateTime(e.target.value);
                  setErrorMsg(null);
                }}
                required
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 font-mono shadow-inner"
              />
            </div>
            {!isTimeInFuture && scheduledDateTime && (
              <p className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>অনুগ্রহ করে ভবিষ্যতের কোনো সময় নির্বাচন করুন (Please pick a future time).</span>
              </p>
            )}
          </div>

          {/* Task / Batch Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Task Schedule Name (কাজের নাম):
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Night Batch 4K Videos"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>

          {/* Items Scope & List Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Videos in this Schedule ({targetItems.length} items):
              </label>
              {selectedItemIds.length > 0 && selectedItemIds.length !== items.length && (
                <div className="flex items-center space-x-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setScope('selected')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      scope === 'selected'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Selected only ({selectedItemIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      scope === 'all'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All items ({items.length})
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Mini Item Preview */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
              {targetItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No items selected in batch queue.
                </div>
              ) : (
                targetItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1.5 px-2 bg-slate-900/60 rounded-lg border border-slate-800/80 text-slate-300 hover:border-slate-700 text-[11px]"
                  >
                    <div className="flex items-center space-x-2 truncate pr-2">
                      <span className="text-[10px] text-slate-500 font-mono w-4 shrink-0">
                        #{idx + 1}
                      </span>
                      {item.type === 'audio' ? (
                        <Music className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Film className="w-3 h-3 text-cyan-400 shrink-0" />
                      )}
                      <span className="truncate text-slate-200 font-medium">
                        {item.info?.title || item.title || item.url}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.quality} • {item.format}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Options & Concurrency */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-300 font-medium flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download Concurrency (গতি নিয়ন্ত্রণ):</span>
              </span>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-500"
              >
                <option value={1}>1 Video 1 Download (Sequential - Recommended)</option>
                <option value={2}>2 at a time</option>
                <option value={3}>3 at a time</option>
                <option value={5}>5 at a time (Max speed)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendTelegram}
                  onChange={(e) => setAutoSendTelegram(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                />
                <span className="flex items-center gap-1">
                  <Send className="w-3 h-3 text-cyan-400" />
                  <span>Auto-forward finished videos to connected Telegram Channels</span>
                </span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveToDownloads}
                  onChange={(e) => setAutoSaveToDownloads(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                />
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Auto-save completed files to browser Downloads folder</span>
                </span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnStart}
                  onChange={(e) => setNotifyOnStart(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                />
                <span className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-amber-400" />
                  <span>Notify me with desktop notification and chime when download starts</span>
                </span>
              </label>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isTimeInFuture || targetItems.length === 0 || isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Calendar className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Scheduling Batch...'
                  : `Schedule Download (${targetItems.length} videos)`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
