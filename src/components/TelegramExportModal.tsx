import React, { useState, useEffect } from 'react';
import {
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Bot,
  Tv,
  HelpCircle,
  Copy,
  Check,
  Share2,
  Film,
  Music,
  Lock,
  Sparkles,
  Save,
  Radio,
  Plus,
  Trash2,
} from 'lucide-react';
import { TelegramSendResult } from '../types';

interface TelegramExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  downloadUrl?: string;
  title?: string;
  thumbnail?: string;
  fileSize?: string;
  format?: string;
  isAudio?: boolean;
}

export const TelegramExportModal: React.FC<TelegramExportModalProps> = ({
  isOpen,
  onClose,
  taskId,
  downloadUrl,
  title = 'Downloaded Video',
  thumbnail,
  fileSize = '',
  format = 'mp4',
  isAudio = false,
}) => {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [channelTitle, setChannelTitle] = useState('');
  const [chatId, setChatId] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [botTokenInput, setBotTokenInput] = useState('');
  const [chatIdInput, setChatIdInput] = useState('');
  const [customCaption, setCustomCaption] = useState(title);

  // Multi-Channel State
  const [channels, setChannels] = useState<Array<{ chatId: string; channelTitle?: string; enabled?: boolean }>>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['@FluxLoad']);
  const [newChannelInput, setNewChannelInput] = useState('');
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [showAddChannelInput, setShowAddChannelInput] = useState(false);

  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<TelegramSendResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setCustomCaption(title);
      setErrorMsg(null);
      setWarningNotice(null);
      setSuccessResult(null);
    }
  }, [isOpen, title]);

  const fetchConfig = async () => {
    setIsCheckingConfig(true);
    try {
      const res = await fetch('/api/telegram/config');
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(Boolean(data.configured));
        if (data.configured) {
          setChannelTitle(data.channelTitle || data.chatId);
          setChatId(data.chatId || '');
          setBotUsername(data.botUsername || '');
          const chanList = (Array.isArray(data.channels) && data.channels.length > 0)
            ? data.channels
            : [{ chatId: '@FluxLoad', channelTitle: 'FluxLoad (Official)', enabled: true }];
          setChannels(chanList);
          const activeChatIds = chanList.filter((c: any) => c.enabled !== false).map((c: any) => c.chatId);
          setSelectedChannels(activeChatIds.length > 0 ? activeChatIds : ['@FluxLoad']);
        }
      }
    } catch {
      setIsConfigured(false);
    } finally {
      setIsCheckingConfig(false);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannelInput.trim()) return;
    setIsAddingChannel(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/telegram/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: newChannelInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewChannelInput('');
        setShowAddChannelInput(false);
        if (data.channels) {
          setChannels(data.channels);
          const newChatId = data.channel?.chatId || newChannelInput.trim();
          setSelectedChannels((prev) => Array.from(new Set([...prev, newChatId])));
        }
      } else {
        setErrorMsg(data.error || 'চ্যানেল যুক্ত করা যায়নি।');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error adding channel');
    } finally {
      setIsAddingChannel(false);
    }
  };

  const handleToggleChannelSelection = (targetChatId: string) => {
    setSelectedChannels((prev) => {
      if (prev.includes(targetChatId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((c) => c !== targetChatId);
      } else {
        return [...prev, targetChatId];
      }
    });
  };

  const handleSelectAllChannels = () => {
    if (selectedChannels.length === channels.length) {
      setSelectedChannels(['@FluxLoad']);
    } else {
      setSelectedChannels(channels.map((c) => c.chatId));
    }
  };

  const handleConnectAndSave = async (forceDirect = false) => {
    if (!botTokenInput.trim() || !chatIdInput.trim()) {
      setErrorMsg('Please enter both your Bot Token and Channel Username / ID.');
      return;
    }
    setIsConnecting(true);
    setErrorMsg(null);
    setWarningNotice(null);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botTokenInput.trim(),
          chatId: chatIdInput.trim(),
          forceSave: forceDirect,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsConfigured(true);
        setChannelTitle(data.channelTitle || chatIdInput.trim());
        setChatId(chatIdInput.trim());
        setBotUsername(data.botUsername || '');
        setBotTokenInput('');
        setChatIdInput('');
        if (data.isWarning || data.warning) {
          setWarningNotice(data.warning || data.message);
        }
        try {
          localStorage.setItem('fluxload_telegram_config', JSON.stringify({
            chatId: data.chatId || chatIdInput.trim(),
            channelTitle: data.channelTitle,
            botUsername: data.botUsername,
            configured: true,
            savedAt: new Date().toISOString(),
          }));
        } catch {}
        fetchConfig();
      } else {
        setErrorMsg(data.error || 'Failed to connect bot to channel.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Network error during Telegram connection.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSendToTelegram = async () => {
    setIsSending(true);
    setErrorMsg(null);
    setSuccessResult(null);

    try {
      const targets = selectedChannels.length > 0 ? selectedChannels : ['@FluxLoad'];
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          downloadUrl,
          caption: customCaption.trim() || title,
          targetChats: targets,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessResult(data);
      } else {
        setErrorMsg(data.error || data.message || 'Failed to send media to Telegram.');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error occurred while sending to Telegram.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.origin : '';
  const directDownloadFullUrl = downloadUrl?.startsWith('http')
    ? downloadUrl
    : `${currentHost}${downloadUrl}`;
  const webShareUrl = `https://t.me/share/url?url=${encodeURIComponent(directDownloadFullUrl || '')}&text=${encodeURIComponent(`🎬 ${title}\nDownloaded via FluxLoad`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg bg-slate-900 border border-sky-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-sky-950/50 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Send className="w-5 h-5 fill-current/20" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-1.5">
                <span>টেলিগ্রাম চ্যানেলে পাঠান</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                  Telegram Channel
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ডাউনলোড করা ফাইল সরাসরি আপনার টেলিগ্রাম চ্যানেলে পোস্ট করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Preview Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 mb-4 flex items-center space-x-3">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="w-16 h-12 rounded-lg object-cover bg-slate-900 shrink-0 border border-slate-800"
            />
          ) : (
            <div className="w-16 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400 shrink-0">
              {isAudio ? <Music className="w-5 h-5" /> : <Film className="w-5 h-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate" title={title}>
              {title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono uppercase font-bold">
                {format}
              </span>
              {fileSize && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {fileSize}
                </span>
              )}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                10 GB Ready
              </span>
            </div>
          </div>
        </div>

        {/* Official Telegram Channel Link Under Media Preview */}
        <div className="mb-4 p-2.5 bg-gradient-to-r from-sky-950/40 via-slate-900 to-sky-950/40 border border-sky-500/30 rounded-xl flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 flex-wrap">
                <span>Official Channel:</span>
                <a
                  href="https://t.me/FluxLoad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 font-mono hover:underline font-bold"
                >
                  https://t.me/FluxLoad
                </a>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                সব ভিডিও আপডেট ও নোটিসের জন্য চ্যানেলে যুক্ত থাকুন
              </p>
            </div>
          </div>
          <a
            href="https://t.me/FluxLoad"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm"
          >
            <Send className="w-3 h-3" />
            <span>Join</span>
          </a>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="leading-relaxed flex-1">{errorMsg}</div>
            </div>
            {(errorMsg.toLowerCase().includes('admin') || errorMsg.toLowerCase().includes('member') || errorMsg.toLowerCase().includes('permission') || errorMsg.includes('বট') || errorMsg.includes('অ্যাডমিন')) && (
              <div className="pt-2 border-t border-rose-500/30 flex items-center justify-between gap-2">
                <span className="text-[11px] text-rose-200">বটকে @FluxLoad চ্যানেলে অ্যাডমিন করুন:</span>
                <a
                  href={`https://t.me/${botUsername || 'black_world722_bot'}?startchannel=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                >
                  <Send className="w-3 h-3" />
                  <span>1-Click Add Admin</span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Warning Notice (e.g. data saved but need admin permissions) */}
        {warningNotice && (
          <div className="mb-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="leading-relaxed flex-1 whitespace-pre-line">{warningNotice}</div>
          </div>
        )}

        {/* Success Alert */}
        {successResult && (
          <div className="mb-4 p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {successResult.totalTargets && successResult.totalTargets > 1
                  ? `🎉 সফলভাবে ${successResult.successCount}/${successResult.totalTargets}টি টেলিগ্রাম চ্যানেলে একযোগে পোস্ট সম্পন্ন!`
                  : '🎉 সফলভাবে টেলিগ্রাম চ্যানেলে পোস্ট হয়েছে!'}
              </span>
            </div>

            {/* Individual Channel Results */}
            {successResult.results && successResult.results.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {successResult.results.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${r.success ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span className="font-semibold text-slate-200 truncate">{r.channelTitle || r.targetChat}</span>
                      <span className="text-[10px] text-slate-400 font-mono truncate">{r.targetChat}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {r.success && r.channelPostUrl && (
                        <a
                          href={r.channelPostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[10px] font-bold flex items-center gap-1"
                        >
                          <span>পোস্ট দেখুন</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {!r.success && (
                        <span className="text-[10px] text-rose-300" title={r.error}>
                          {r.botNeedsAdmin ? 'অ্যাডমিন প্রয়োজন' : 'ব্যর্থ'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {successResult.warning && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                {successResult.warning}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {successResult.channelPostUrl && (
                <a
                  href={successResult.channelPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>চ্যানেলে পোস্ট দেখুন</span>
                </a>
              )}
              <a
                href={webShareUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                <span>টেলিগ্রাম অ্যাপে শেয়ার করুন</span>
              </a>
            </div>
          </div>
        )}

        {/* Body Content */}
        {isCheckingConfig ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            <span className="text-xs">টেলিগ্রাম কনফিগারেশন চেক করা হচ্ছে...</span>
          </div>
        ) : isConfigured ? (
          /* When Bot is already Connected */
          <div className="space-y-3.5">
            {/* Multi-Channel Target Selector */}
            <div className="p-3 bg-slate-950/70 border border-sky-500/30 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                  <span>টার্গেট চ্যানেলসমূহ (একই সাথে আপলোড হবে):</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllChannels}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer underline"
                  >
                    {selectedChannels.length === channels.length ? 'সব আনচেক' : 'সব সিলেক্ট'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddChannelInput(!showAddChannelInput)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ চ্যানেল</span>
                  </button>
                </div>
              </div>

              {/* Channels List with Checkboxes */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {channels.map((c) => {
                  const isChecked = selectedChannels.includes(c.chatId);
                  const isOfficial = c.chatId.toLowerCase() === '@fluxload';
                  return (
                    <label
                      key={c.chatId}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-sky-500/10 border-sky-500/40 text-slate-100'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleChannelSelection(c.chatId)}
                          className="w-4 h-4 rounded text-sky-500 border-slate-700 bg-slate-900 focus:ring-sky-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200 truncate">{c.channelTitle || c.chatId}</span>
                            {isOfficial && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                                Official
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{c.chatId}</span>
                        </div>
                      </div>

                      <a
                        href={`https://t.me/${botUsername || 'black_world722_bot'}?startchannel=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 shrink-0"
                        title="বট অ্যাডমিন করুন"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </a>
                    </label>
                  );
                })}
              </div>

              {/* Inline Add Channel Input */}
              {showAddChannelInput && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
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
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddChannel}
                    disabled={isAddingChannel || !newChannelInput.trim()}
                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isAddingChannel ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    <span>যোগ করুন</span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom Caption Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                ক্যাপশন বা বর্ণনা (Optional Caption):
              </label>
              <textarea
                value={customCaption}
                onChange={(e) => setCustomCaption(e.target.value)}
                placeholder="ভিডিওর সাথে যে ক্যাপশন পাঠাতে চান..."
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 resize-none font-sans"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendToTelegram}
                disabled={isSending || selectedChannels.length === 0}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {selectedChannels.length > 1
                        ? `${selectedChannels.length}টি চ্যানেলে পাঠানো হচ্ছে...`
                        : 'টেলিগ্রামে পাঠানো হচ্ছে...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {selectedChannels.length > 1
                        ? `✈️ ${selectedChannels.length}টি চ্যানেলে একযোগে পাঠান`
                        : '✈️ চ্যানেলে পাঠিয়ে দিন (Send to Channel)'}
                    </span>
                  </>
                )}
              </button>

              <a
                href={webShareUrl}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                title="Open Telegram Share"
              >
                <Share2 className="w-4 h-4 text-sky-400" />
                <span className="hidden sm:inline">Web Share</span>
              </a>
            </div>
          </div>
        ) : (
          /* When Bot is NOT yet configured - Easy Setup Form */
          <div className="space-y-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-200">
              <Bot className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                টেলিগ্রাম চ্যানেলে ভিডিও পাঠাতে আপনার একটি টেলিগ্রাম বট টোকেন ও চ্যানেলের ইউজারনেম প্রয়োজন। এটি সম্পূর্ণ ফ্রি ও মাত্র ২ মিনিটে সেটআপ করা যায়।
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Telegram Bot Token:
              </label>
              <input
                type="text"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
                placeholder="123456789:ABCdefGhIjklmNoPqRstUvwXyz..."
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Channel Username বা Chat ID:
              </label>
              <input
                type="text"
                value={chatIdInput}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  const urlMatch = val.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/i);
                  if (urlMatch && urlMatch[1] && !val.includes('/+')) {
                    setChatIdInput('@' + urlMatch[1]);
                  } else {
                    setChatIdInput(e.target.value);
                  }
                }}
                onBlur={() => {
                  const val = chatIdInput.trim();
                  if (val && !val.startsWith('@') && !val.startsWith('-') && /^[a-zA-Z0-9_]{3,}$/.test(val)) {
                    setChatIdInput('@' + val);
                  }
                }}
                placeholder="@crypto_mining_s_e_x অথবা -100123456789"
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showGuide ? 'গাইড বন্ধ করুন' : 'বট বানানোর নিয়ম দেখুন'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConnectAndSave(true)}
                  disabled={isConnecting || !botTokenInput.trim() || !chatIdInput.trim()}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="সরাসরি তথ্য সেভ করুন"
                >
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  <span>সরাসরি সেভ</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConnectAndSave(false)}
                  disabled={isConnecting || !botTokenInput.trim() || !chatIdInput.trim()}
                  className="py-2.5 px-4 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>ভেরিফাই হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>কানেক্ট ও সেভ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Setup Guide Drawer */}
            {showGuide && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-300 space-y-2 animate-fadeIn">
                <div className="font-bold text-sky-300">📖 ২ মিনিটে বট তৈরি ও চ্যানেলে অ্যাড করার নিয়ম:</div>
                <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
                  <li>
                    টেলিগ্রামে গিয়ে সার্চ করুন <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline font-mono">@BotFather</a> এবং স্টার্ট দিয়ে লিখুন <code className="text-amber-300">/newbot</code>।
                  </li>
                  <li>
                    বটের নাম ও ইউজারনেম দিন। BotFather আপনাকে একটি <span className="text-amber-300 font-bold">API Token</span> দিবে, সেটি কপি করে উপরের বক্সে দিন।
                  </li>
                  <li>
                    আপনার টেলিগ্রাম চ্যানেলের <strong>Administrators</strong> সেকশনে গিয়ে তৈরি করা বটটিকে <strong>Admin</strong> হিসেবে অ্যাড করুন এবং <strong>Post Messages</strong> পারমিশন চালু রাখুন।
                  </li>
                  <li>
                    চ্যানেলের লিংক বা ইউজারনেম (যেমন: <code className="text-sky-300">@your_channel</code>) উপরের Channel বক্সে দিয়ে <strong>"কানেক্ট ও সেভ করুন"</strong> বাটনে চাপ দিন।
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
