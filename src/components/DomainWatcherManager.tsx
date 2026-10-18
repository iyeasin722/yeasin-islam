import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe,
  Radio,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Clock,
  Sparkles,
  ExternalLink,
  Film,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Send,
  Layers,
  Search,
  Zap,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Calendar,
  X,
  Sliders,
} from 'lucide-react';
import { DomainWatcher, DiscoveredVideoItem } from '../types';

interface DomainWatcherManagerProps {
  onBackToDownloads: () => void;
  telegramConfig?: {
    configured: boolean;
    chatId?: string;
    channelTitle?: string;
    channels?: Array<{ chatId: string; channelTitle?: string; enabled?: boolean }>;
    autoSend?: boolean;
  } | null;
  onOpenSettings?: () => void;
}

export const DomainWatcherManager: React.FC<DomainWatcherManagerProps> = ({
  onBackToDownloads,
  telegramConfig,
  onOpenSettings,
}) => {
  const [watchers, setWatchers] = useState<DomainWatcher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'watchers' | 'add' | 'preview'>('watchers');

  // New Watcher Form State
  const [domainInput, setDomainInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [maxVideosPerScan, setMaxVideosPerScan] = useState<number>(10);
  const [autoDownload, setAutoDownload] = useState(true);
  const [autoPostTelegram, setAutoPostTelegram] = useState(true);
  const [scanImmediately, setScanImmediately] = useState(true);

  // Preview Scan State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    domainUrl: string;
    pageTitle?: string;
    totalFound: number;
    videos: Array<{ url: string; title: string; thumbnail?: string; duration?: string; source: string; type: string }>;
    error?: string;
  } | null>(null);

  // Selected Watcher Details Modal
  const [selectedWatcher, setSelectedWatcher] = useState<DomainWatcher | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchWatchers = useCallback(async () => {
    try {
      const res = await fetch('/api/crawler/watchers');
      if (res.ok) {
        const data = await res.json();
        if (data.watchers) {
          setWatchers(data.watchers);
          // Update selected watcher if open
          if (selectedWatcher) {
            const updated = data.watchers.find((w: DomainWatcher) => w.id === selectedWatcher.id);
            if (updated) setSelectedWatcher(updated);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch domain watchers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedWatcher]);

  useEffect(() => {
    fetchWatchers();
    const timer = setInterval(fetchWatchers, 6000);
    return () => clearInterval(timer);
  }, [fetchWatchers]);

  // Handle Add New Watcher
  const handleAddWatcher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainInput.trim()) {
      showToast('error', 'দয়া করে একটি সঠিক ওয়েবসাইট বা ডোমেইন URL দিন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/crawler/watchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainUrl: domainInput.trim(),
          name: nameInput.trim() || undefined,
          intervalMinutes,
          maxVideosPerScan,
          autoDownload,
          autoPostTelegram,
          scanNow: scanImmediately,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', data.message || 'ডোমেন ওয়াচার সফলভাবে চালু হয়েছে!');
        setDomainInput('');
        setNameInput('');
        setActiveTab('watchers');
        fetchWatchers();
      } else {
        showToast('error', data.error || 'ওয়াচার তৈরি করা যায়নি।');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Preview Scan
  const handlePreviewScan = async () => {
    if (!domainInput.trim()) {
      showToast('error', 'প্রিভিউ দেখতে আগে ডোমেইন বা লিঙ্ক ইনপুট দিন।');
      return;
    }

    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch('/api/crawler/scan-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainUrl: domainInput.trim(),
          maxItems: maxVideosPerScan,
        }),
      });
      const data = await res.json();
      setPreviewResult(data);
      if (data.success && data.videos && data.videos.length > 0) {
        showToast('success', `${data.totalFound}টি ভিডিও সফলভাবে খুঁজে পাওয়া গেছে!`);
      } else {
        showToast('info', data.error || 'এই পেজে সরাসরি কোনো ভিডিও পাওয়া যায়নি।');
      }
    } catch (err: any) {
      showToast('error', 'প্রিভিউ স্ক্যান ব্যর্থ হয়েছে: ' + err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle Trigger Scan Now
  const handleTriggerScanNow = async (watcherId: string) => {
    setTriggeringId(watcherId);
    try {
      const res = await fetch(`/api/crawler/watchers/${watcherId}/scan-now`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(
          'success',
          `স্ক্যান সম্পন্ন! ${data.result?.newVideosFound || 0}টি নতুন ভিডিও পাওয়া গেছে, ${data.result?.startedTasks || 0}টি ডাউনলোড শুরু হয়েছে।`
        );
        fetchWatchers();
      } else {
        showToast('error', data.error || 'স্ক্যান শুরু করা যায়নি।');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setTriggeringId(null);
    }
  };

  // Handle Toggle Pause/Resume
  const handleToggleWatcher = async (watcherId: string) => {
    try {
      const res = await fetch(`/api/crawler/watchers/${watcherId}/toggle`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('info', data.status === 'active' ? 'ওয়াচার পুনরায় সক্রিয় করা হয়েছে।' : 'ওয়াচার স্থগিত (Paused) করা হয়েছে।');
        fetchWatchers();
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Delete Watcher
  const handleDeleteWatcher = async (watcherId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই ডোমেইন ওয়াচারটি মুছে ফেলতে চান?')) return;
    try {
      const res = await fetch(`/api/crawler/watchers/${watcherId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('info', 'ডোমেইন ওয়াচার মুছে ফেলা হয়েছে।');
        if (selectedWatcher?.id === watcherId) setSelectedWatcher(null);
        fetchWatchers();
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Aggregate stats
  const stats = useMemo(() => {
    const totalWatchers = watchers.length;
    const activeWatchers = watchers.filter((w) => w.status === 'active').length;
    const totalDiscovered = watchers.reduce((sum, w) => sum + (w.totalDiscovered || 0), 0);
    const totalDownloaded = watchers.reduce((sum, w) => sum + (w.totalDownloaded || 0), 0);
    return { totalWatchers, activeWatchers, totalDiscovered, totalDownloaded };
  }, [watchers]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold backdrop-blur-md transition-all ${
            toastMsg.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : toastMsg.type === 'error'
              ? 'bg-rose-500/90 text-white'
              : 'bg-sky-500/90 text-white'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : toastMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={onBackToDownloads}
          className="px-3.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span>← Back to URL Downloader</span>
        </button>

        <div className="flex items-center gap-2">
          {telegramConfig && (
            <div className="px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>টেলিগ্রাম চ্যানেল: <b>{telegramConfig.channelTitle || telegramConfig.chatId || '@FluxLoad'}</b></span>
            </div>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              বট সেটিংস
            </button>
          )}
        </div>
      </div>

      {/* Main Hero Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-purple-950/70 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <Radio className="w-4 h-4 animate-pulse text-indigo-400" />
            <span>Autonomous Web Crawler & Auto-Poster</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            অটো ওয়েবসাইট ডোমেন স্ক্র্যাপার ও অটো-পোস্টার
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            যেকোনো ওয়েবসাইটের লিঙ্ক বা ডোমেইন দিয়ে রাখুন। FluxLoad নিয়মিত বিরতিতে সেই ওয়েবসাইট স্ক্যান করে নতুন ভিডিও খুঁজে বের করবে, স্বয়ংক্রিয়ভাবে ক্লাউড সার্ভারে ডাউনলোড করবে এবং সরাসরি আপনার টেলিগ্রাম চ্যানেলে পোস্ট করে দিবে!
          </p>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="p-3 bg-slate-900/80 border border-indigo-500/20 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase">মোট ওয়াচার</div>
              <div className="text-lg font-black text-white mt-0.5">{stats.totalWatchers} টি</div>
            </div>
            <div className="p-3 bg-slate-900/80 border border-emerald-500/20 rounded-xl">
              <div className="text-[10px] font-bold text-emerald-400 uppercase">সক্রিয় রানিং</div>
              <div className="text-lg font-black text-emerald-300 mt-0.5">{stats.activeWatchers} টি</div>
            </div>
            <div className="p-3 bg-slate-900/80 border border-purple-500/20 rounded-xl">
              <div className="text-[10px] font-bold text-purple-400 uppercase">আবিষ্কৃত ভিডিও</div>
              <div className="text-lg font-black text-purple-300 mt-0.5">{stats.totalDiscovered} টি</div>
            </div>
            <div className="p-3 bg-slate-900/80 border border-sky-500/20 rounded-xl">
              <div className="text-[10px] font-bold text-sky-400 uppercase">অটো-ডাউনলোডেড</div>
              <div className="text-lg font-black text-sky-300 mt-0.5">{stats.totalDownloaded} টি</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('watchers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'watchers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>সক্রিয় ডোমেন ওয়াচার ({watchers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'add'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ নতুন ডোমেন যুক্ত করুন</span>
        </button>
      </div>

      {/* TAB 1: ADD NEW DOMAIN WATCHER */}
      {activeTab === 'add' && (
        <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>নতুন ওয়েবসাইট ডোমেন ওয়াচার সেটআপ করুন</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                যেকোনো ওয়েবসাইট, ব্লগ, মিডিয়া পোর্টাল, বা রেডিট সাবরেডিটের ডোমেন দিন
              </p>
            </div>
          </div>

          <form onSubmit={handleAddWatcher} className="space-y-4">
            {/* Domain URL Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                ওয়েবসাইট লিঙ্ক বা ডোমেইন URL (Website Domain or Page URL): <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="e.g. https://example.com/videos অথবা reddit.com/r/videos"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePreviewScan}
                  disabled={previewLoading || !domainInput.trim()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-700"
                  title="এই পেজে কী কী ভিডিও আছে তা টেস্ট স্ক্যান করুন"
                >
                  {previewLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>টেস্ট স্ক্যান (Preview)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                💡 সাপোর্ট: সাধারণ ওয়েবসাইট (.mp4/HTML5 video), ভিডিও গ্যালারি, YouTube চ্যানেল, Reddit, TikTok পেজ ইত্যাদি।
              </p>
            </div>

            {/* Watcher Name & Frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  ওয়াচারের নাম (Watcher Label - Optional):
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. My Favorite Movie Blog"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  স্ক্যানের সময় ব্যবধান (Scan Frequency):
                </label>
                <select
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={15}>প্রতি ১৫ মিনিট পরপর (Every 15 min)</option>
                  <option value={30}>প্রতি ৩০ মিনিট পরপর (Every 30 min)</option>
                  <option value={60}>প্রতি ১ ঘন্টা পরপর (Every 1 hour - Recommended)</option>
                  <option value={180}>প্রতি ৩ ঘন্টা পরপর (Every 3 hours)</option>
                  <option value={360}>প্রতি ৬ ঘন্টা পরপর (Every 6 hours)</option>
                  <option value={1440}>প্রতি ২৪ ঘন্টা / ১ দিন পরপর (Daily)</option>
                  <option value={0}>শুধুমাত্র ম্যানুয়াল (Run Once on demand)</option>
                </select>
              </div>
            </div>

            {/* Max Videos & Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  প্রতিবার সর্বোচ্চ কয়টি নতুন ভিডিও খুঁজবে (Max Videos Per Scan):
                </label>
                <select
                  value={maxVideosPerScan}
                  onChange={(e) => setMaxVideosPerScan(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={3}>সর্বোচ্চ ৩টি ভিডিও</option>
                  <option value={5}>সর্বোচ্চ ৫টি ভিডিও</option>
                  <option value={10}>সর্বোচ্চ ১০টি ভিডিও (Default)</option>
                  <option value={20}>সর্বোচ্চ ২০টি ভিডিও</option>
                  <option value={30}>সর্বোচ্চ ৩০টি ভিডিও</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    ✓ নতুন ভিডিও পেলে স্বয়ংক্রিয় ডাউনলোড (Auto-Download)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPostTelegram}
                    onChange={(e) => setAutoPostTelegram(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    ✓ ডাউনলোড শেষ হলে টেলিগ্রাম চ্যানেলে অটো-পোস্ট (Auto-Post)
                  </span>
                </label>

                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scanImmediately}
                    onChange={(e) => setScanImmediately(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                  />
                  <span className="text-xs text-slate-300">
                    সেভ করার সাথে সাথে প্রথম স্ক্যান শুরু করুন (Scan Now)
                  </span>
                </label>
              </div>
            </div>

            {/* Preview Box if results ready */}
            {previewResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>প্রিভিউ স্ক্যান রেজাল্ট: {previewResult.totalFound}টি ভিডিও শনাক্ত হয়েছে</span>
                  </span>
                  <span className="text-[11px] text-slate-400">{previewResult.pageTitle}</span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {previewResult.videos.map((v, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Film className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-slate-200 truncate">{v.title}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                        {v.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('watchers')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !domainInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>ডোমেন অটো-ওয়াচার চালু করুন</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: ACTIVE WATCHERS LIST */}
      {activeTab === 'watchers' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
              <p className="text-xs text-slate-400">ডোমেন ওয়াচার লোড হচ্ছে...</p>
            </div>
          ) : watchers.length === 0 ? (
            <div className="p-10 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">এখনো কোনো ডোমেন ওয়াচার যুক্ত করা হয়নি</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                একটি ওয়েবসাইট বা ডোমেইন URL দিয়ে ওয়াচার চালু করুন। এটি স্বয়ংক্রিয়ভাবে ব্যাকগ্রাউন্ডে নিয়মিত স্ক্যান করে ভিডিও ডাউনলোড ও টেলিগ্রাম চ্যানেলে পোস্ট করবে।
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>প্রথম ডোমেন ওয়াচার যুক্ত করুন</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {watchers.map((watcher) => {
                const isActive = watcher.status === 'active';
                const isRunning = watcher.status === 'running' || triggeringId === watcher.id;

                return (
                  <div
                    key={watcher.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isRunning
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                        : isActive
                        ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      {/* Left info */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isRunning
                              ? 'bg-indigo-500/20 text-indigo-400 animate-pulse'
                              : isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          <Globe className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-100 truncate">
                              {watcher.name || watcher.domainUrl}
                            </h4>

                            {/* Status Badge */}
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                isRunning
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                  : isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {isRunning ? (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  <span>স্ক্যান ও অটো-পোস্ট চলছে...</span>
                                </>
                              ) : isActive ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                  <span>সক্রিয় (Active)</span>
                                </>
                              ) : (
                                <span>বিরত (Paused)</span>
                              )}
                            </span>

                            {watcher.intervalMinutes > 0 && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {watcher.intervalMinutes >= 60
                                  ? `প্রতি ${watcher.intervalMinutes / 60} ঘন্টা পরপর`
                                  : `প্রতি ${watcher.intervalMinutes} মিনিট পরপর`}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                            <a
                              href={watcher.domainUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-indigo-400 flex items-center gap-1 truncate"
                            >
                              <span>{watcher.domainUrl}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Right action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Scan Now */}
                        <button
                          type="button"
                          onClick={() => handleTriggerScanNow(watcher.id)}
                          disabled={isRunning}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="এখনই এই ডোমেইন স্ক্যান করুন"
                        >
                          {isRunning ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 fill-current" />
                          )}
                          <span>এখনই স্ক্যান</span>
                        </button>

                        {/* View History & Discovered Items */}
                        <button
                          type="button"
                          onClick={() => setSelectedWatcher(watcher)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="আবিষ্কৃত ভিডিও লিস্ট দেখুন"
                        >
                          <Eye className="w-3 h-3 text-sky-400" />
                          <span>ভিডিও লিস্ট ({watcher.discoveredItems?.length || 0})</span>
                        </button>

                        {/* Pause / Resume */}
                        <button
                          type="button"
                          onClick={() => handleToggleWatcher(watcher.id)}
                          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          }`}
                          title={isActive ? 'পজ করুন' : 'পুনরায় চালু করুন'}
                        >
                          {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteWatcher(watcher.id)}
                          className="p-1.5 bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 rounded-xl transition-colors cursor-pointer"
                          title="ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Footer counters */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                      <div className="flex items-center gap-4">
                        <span>🎯 প্রাপ্ত ভিডিও: <b className="text-slate-200 font-mono">{watcher.totalDiscovered || 0}</b></span>
                        <span>⬇️ ডাউনলোডেড: <b className="text-slate-200 font-mono">{watcher.totalDownloaded || 0}</b></span>
                        <span>📢 টেলিগ্রাম অটো-পোস্ট: <b className="text-emerald-400 font-mono">{watcher.autoPostTelegram ? 'ON' : 'OFF'}</b></span>
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono">
                        {watcher.lastScanAt ? `সর্বশেষ স্ক্যান: ${new Date(watcher.lastScanAt).toLocaleTimeString()}` : 'কোনো স্ক্যান হয়নি'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISCOVERED VIDEOS MODAL */}
      {selectedWatcher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  <span>{selectedWatcher.name} - আবিষ্কৃত ভিডিওসমূহ</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono truncate max-w-md">
                  {selectedWatcher.domainUrl}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWatcher(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {!selectedWatcher.discoveredItems || selectedWatcher.discoveredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  এই ডোমেইনে এখনো কোনো ভিডিও প্রসেস হয়নি। 'এখনই স্ক্যান' বাটনে ক্লিক করে চেক করতে পারেন।
                </div>
              ) : (
                selectedWatcher.discoveredItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate">{item.title || 'Untitled Video'}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{item.url}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(item.foundAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {item.status === 'downloading' ? 'ডাউনলোড ও পোস্ট চলছে' : 'সম্পন্ন ✓'}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-900 rounded-lg"
                        title="সরাসরি লিঙ্ক দেখুন"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedWatcher(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
