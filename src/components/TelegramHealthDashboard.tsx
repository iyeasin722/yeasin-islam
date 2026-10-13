import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Wifi,
  Gauge,
  ShieldCheck,
  Radio,
  Server,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HardDrive,
  Bot,
  Tv,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  Send,
  Sliders,
  Check,
  Lock,
} from 'lucide-react';
import { TelegramHealthData } from '../types';

interface TelegramHealthDashboardProps {
  onTriggerTestMessage?: () => void;
  isTestingMessage?: boolean;
  configured?: boolean;
  channelTitle?: string;
  chatId?: string;
  botUsername?: string;
  onSavePreferences?: (prefs: { maxUploadGb: number; uploadDeliveryMode: 'smart_10gb' | 'direct_50mb' | 'local_2gb'; localApiServerUrl?: string }) => void;
}

export const TelegramHealthDashboard: React.FC<TelegramHealthDashboardProps> = ({
  onTriggerTestMessage,
  isTestingMessage = false,
  configured = false,
  channelTitle,
  chatId,
  botUsername,
  onSavePreferences,
}) => {
  const [health, setHealth] = useState<TelegramHealthData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [lastPingTime, setLastPingTime] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [pingHistory, setPingHistory] = useState<number[]>([]);

  // 10GB Upload Engine Configuration State
  const [selectedMaxUploadGb, setSelectedMaxUploadGb] = useState<number>(10);
  const [deliveryMode, setDeliveryMode] = useState<'smart_10gb' | 'direct_50mb' | 'local_2gb'>('smart_10gb');
  const [localApiUrl, setLocalApiUrl] = useState<string>('');
  const [isSavedPref, setIsSavedPref] = useState<boolean>(false);

  const fetchHealth = useCallback(async (isManualPing = false) => {
    if (isManualPing) {
      setIsPinging(true);
    } else {
      setIsLoading(true);
    }
    try {
      const res = await fetch('/api/telegram/health');
      if (res.ok) {
        const data: TelegramHealthData = await res.json();
        setHealth(data);
        setLastPingTime(new Date());
        setPingHistory((prev) => [...prev.slice(-9), data.pingMs]);
        if (data.uploadLimits) {
          setSelectedMaxUploadGb(data.uploadLimits.activeMaxLimitGb || 10);
          if (data.uploadLimits.deliveryMode === 'direct_50mb' || data.uploadLimits.deliveryMode === 'local_2gb') {
            setDeliveryMode(data.uploadLimits.deliveryMode);
          } else {
            setDeliveryMode('smart_10gb');
          }
          if (data.uploadLimits.customApiUrl) {
            setLocalApiUrl(data.uploadLimits.customApiUrl);
          }
        }
      }
    } catch (err) {
      console.error('Failed to query Telegram health:', err);
    } finally {
      setIsLoading(false);
      setIsPinging(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth(false);
  }, [fetchHealth]);

  // Periodic polling for real-time health every 25 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchHealth(false);
    }, 25000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchHealth]);

  const handleApplyUploadSettings = () => {
    if (onSavePreferences) {
      onSavePreferences({
        maxUploadGb: selectedMaxUploadGb,
        uploadDeliveryMode: deliveryMode,
        localApiServerUrl: localApiUrl.trim() || undefined,
      });
      setIsSavedPref(true);
      setTimeout(() => setIsSavedPref(false), 2500);
    }
  };

  const getPingColor = (ms: number) => {
    if (ms < 120) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (ms < 350) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    if (ms < 700) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getStatusBadge = () => {
    if (!health) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Checking Gateway...
        </span>
      );
    }

    if (health.status === 'optimal') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Optimal • Telegram Live
        </span>
      );
    }
    if (health.status === 'good') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          Healthy Connection
        </span>
      );
    }
    if (health.status === 'throttled') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          Rate Throttled ({health.rateLimit.floodWaitSeconds}s)
        </span>
      );
    }
    if (health.status === 'unconfigured') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-sky-400" />
          API Gateway Reachable (Ready to Link)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
        <AlertCircle className="w-3 h-3 text-rose-400" />
        Connection Degraded
      </span>
    );
  };

  const effectiveChannelTitle = health?.channel?.title || channelTitle || 'Telegram Channel';
  const effectiveChatId = health?.channel?.username ? `@${health.channel.username}` : (health?.channel?.id || chatId || 'Not connected');
  const effectiveBot = health?.bot?.username ? `@${health.bot.username}` : (botUsername ? `@${botUsername}` : 'Bot Session');

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 1. TOP HEADER HEALTH CARD */}
      <div className="bg-slate-950/70 border border-sky-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg shadow-sky-950/30">
        {/* Glowing atmospheric background */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-sky-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600/30 to-blue-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 shadow-md shadow-sky-500/10">
              <Activity className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  Telegram API Connection Health
                </h4>
                {getStatusBadge()}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <span>Real-time ping monitor, rate limits & 10GB ultra upload state</span>
                {lastPingTime && (
                  <span className="text-slate-500 font-mono">
                    • checked {lastPingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchHealth(true)}
              disabled={isPinging || isLoading}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 border border-slate-700 hover:border-sky-500/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Ping Telegram Cloud API servers now"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isPinging ? 'animate-spin' : ''}`} />
              <span>{isPinging ? 'Pinging...' : 'Live Ping'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                autoRefresh
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
              title={autoRefresh ? 'Auto-refresh active (25s)' : 'Auto-refresh paused'}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* METRICS GRID: PING, RATE LIMIT, BUFFER, SECURITY */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          {/* 1. Live Ping Latency */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 relative group hover:border-sky-500/30 transition-colors">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-sky-400" />
                API Ping Latency
              </span>
              <span className="text-[10px] font-mono text-slate-500">RTT</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-slate-100">
                {health ? `${health.pingMs}` : '--'}
              </span>
              <span className="text-xs font-mono text-slate-400">ms</span>
              {health && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono border ml-auto ${getPingColor(health.pingMs)}`}>
                  {health.pingMs < 120 ? 'FAST' : health.pingMs < 350 ? 'GOOD' : 'SLOW'}
                </span>
              )}
            </div>
            {/* Visual Ping Sparkline Dots */}
            <div className="flex items-end gap-1 mt-2 h-3">
              {pingHistory.map((p, idx) => {
                const heightPercent = Math.min(100, Math.max(20, Math.round((p / 600) * 100)));
                return (
                  <div
                    key={idx}
                    className="w-1.5 bg-sky-500/40 rounded-t-sm hover:bg-sky-400 transition-all"
                    style={{ height: `${heightPercent}%` }}
                    title={`Ping ${idx + 1}: ${p}ms`}
                  />
                );
              })}
            </div>
          </div>

          {/* 2. Global Rate Limit Gauge */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 relative hover:border-emerald-500/30 transition-colors">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-emerald-400" />
                Burst Quota
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {health?.rateLimit ? `${health.rateLimit.safeHeadroomPercent}%` : '100%'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-emerald-300">
                {health?.rateLimit ? `${health.rateLimit.remainingBurst}` : '30'}
              </span>
              <span className="text-xs font-mono text-slate-400">/ 30 req/s</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${health?.rateLimit?.safeHeadroomPercent ?? 100}%` }}
              />
            </div>
          </div>

          {/* 3. Channel Throttle Safeguard */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 relative hover:border-cyan-500/30 transition-colors">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Channel Safety
              </span>
              <span className="text-[10px] font-mono text-slate-500">20 / min</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-cyan-300">
                {health?.rateLimit?.floodWaitSeconds === 0 ? '0s' : `${health?.rateLimit?.floodWaitSeconds}s`}
              </span>
              <span className="text-xs text-slate-400 font-sans">
                {health?.rateLimit?.floodWaitSeconds === 0 ? 'Wait (Safe)' : 'Throttle active'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-2 font-mono">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Anti-Flood Protection</span>
            </div>
          </div>

          {/* 4. Active Gateway & TLS Cipher */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 relative hover:border-purple-500/30 transition-colors">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-purple-400" />
                API Gateway
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> TLS 1.3
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-slate-200 truncate mt-1" title={health?.gatewayUrl || 'https://api.telegram.org'}>
              {health?.gatewayUrl ? health.gatewayUrl.replace('https://', '').replace('http://', '') : 'api.telegram.org'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-2 truncate">
              Edge: Cloudflare Direct CDN
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE CHANNEL SESSION & BOT IDENTITY PANEL */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-start space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Tv className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                <span>মাল্টি-চ্যানেল ব্রডকাস্ট সেশন</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono font-bold">
                  {(health?.channels?.filter(c => c.enabled !== false).length) || 1} টি চ্যানেলে একযোগে আপলোড
                </span>
                {health?.configured && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </div>

              {/* Connected Channels List */}
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                {(health?.channels && health.channels.length > 0
                  ? health.channels
                  : [{ chatId: '@FluxLoad', channelTitle: 'FluxLoad (Official)', enabled: true }]
                ).map((c) => (
                  <div
                    key={c.chatId}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="font-semibold text-slate-200">{c.channelTitle || c.chatId}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({c.chatId})</span>
                  </div>
                ))}
                <span className="text-[11px] text-sky-300 font-mono ml-1">Bot: {effectiveBot}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onTriggerTestMessage && (
              <button
                type="button"
                onClick={onTriggerTestMessage}
                disabled={isTestingMessage || (!health?.configured && !configured)}
                className="py-1.5 px-3 bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 border border-sky-500/40 text-sky-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className={`w-3.5 h-3.5 ${isTestingMessage ? 'animate-spin' : ''}`} />
                <span>{isTestingMessage ? 'সেন্ড হচ্ছে...' : 'সব চ্যানেলে টেস্ট পাঠান'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Permissions Checklist */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Verified Bot Channel Permissions & Session State:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300 font-medium">Post Messages</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300 font-medium">Send Video & Audio</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300 font-medium">Edit Messages</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="text-[11px] text-slate-300 font-medium">Embed Web Links</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. "10 GB ULTRA UPLOAD & DELIVERY ENGINE" (১০ জিবি ফাইল আপলোড ও হাই-স্পিড শেয়ারিং) */}
      <div className="bg-gradient-to-r from-amber-950/40 via-orange-950/20 to-slate-950/80 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl shadow-amber-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md shadow-amber-500/10">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-200">
                  10 GB Ultra Upload & Delivery Engine
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold">
                  10 GB Ready 🚀
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                টেলিগ্রাম চ্যানেলে ১০ জিবি (10 GB) সাইজ পর্যন্ত হাই-স্পিড ভিডিও ও অডিও সরাসরি ডেলিভারি করার পূর্ণ সক্ষমতা
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1 font-semibold transition cursor-pointer self-start sm:self-auto"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'অপশন বন্ধ করুন' : '১০ জিবি আপলোড সেটিংস'}</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 10GB Upload Modes Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Mode 1: 50MB Direct Bot API */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                ১. সরাসরি ফাইল (&le; ৫০ MB)
              </span>
              <span className="text-[10px] font-mono text-sky-300 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded">
                Standard
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ৫০ মেগাবাইট বা তার কম সাইজের ফাইল সরাসরি টেলিগ্রাম ভিডিও প্লেয়ার ফাইল হিসেবে চ্যানেলে আপলোড হয়।
            </p>
          </div>

          {/* Mode 2: 2GB Local Bot API */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-purple-400" />
                ২. লোকাল বট সার্ভার (&le; ২ GB)
              </span>
              <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded">
                2 GB Native
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              কাস্টম Local Bot API Server দিয়ে সর্বোচ্চ ২ জিবি সাইজের ফাইলও সরাসরি টেলিগ্রামে নেটিভ আপলোড করা যায়।
            </p>
          </div>

          {/* Mode 3: 10GB Ultra Cloud Stream Hub */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 space-y-1.5 bg-amber-950/15">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-200 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                ৩. আল্ট্রা ক্লাউড হাব (&le; ১০ GB)
              </span>
              <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
                10 GB Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              ৫০ MB থেকে ১০ জিবি পর্যন্ত ফাইলগুলোর জন্য সরাসরি ফুল-স্পিড ডাউনলোড ও লাইভ এইচডি স্ট্রিমিং কার্ড চ্যানেলে পৌঁছে যায়।
            </p>
          </div>
        </div>

        {/* Visual 10GB Capacity Meter Bar */}
        <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              Maximum Supported Transfer Ceiling:
            </span>
            <span className="font-mono font-bold text-amber-300 text-sm">
              {selectedMaxUploadGb} GB / 10 GB (Max)
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
            <div className="bg-sky-500 h-2.5 w-[5%]" title="0-50MB: Native direct bot upload" />
            <div className="bg-purple-500 h-2.5 w-[20%]" title="50MB-2GB: Local Bot API ceiling" />
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2.5 w-[75%]" title="2GB-10GB: Ultra Cloud Stream Hub" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>0 MB</span>
            <span>50 MB (Bot)</span>
            <span>2 GB (Local API)</span>
            <span className="text-amber-300 font-bold">10 GB (Ultra Mode)</span>
          </div>
        </div>

        {/* ADVANCED 10GB CONTROLS & LOCAL BOT API SERVER CONFIG */}
        {showAdvanced && (
          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3.5 text-xs animate-fadeIn">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-200">
                টেলিগ্রাম আপলোড মোড নির্বাচন করুন (Delivery Mode):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('smart_10gb')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    deliveryMode === 'smart_10gb'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>Smart 10GB Auto (সুপারিশকৃত)</span>
                    {deliveryMode === 'smart_10gb' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    ৫০MB পর্যন্ত সরাসরি, বড় ফাইলে ১০GB স্ট্রিমিং কার্ড
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMode('direct_50mb')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    deliveryMode === 'direct_50mb'
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>Strict 50MB Bot Only</span>
                    {deliveryMode === 'direct_50mb' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    শুধু ৫০MB-এর ভেতরের ভিডিও টেলিগ্রামে পাঠাবে
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMode('local_2gb')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    deliveryMode === 'local_2gb'
                      ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>Local Bot API (2GB Native)</span>
                    {deliveryMode === 'local_2gb' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    নিজস্ব লোকাল বট সার্ভারের মাধ্যমে ২GB সরাসরি
                  </div>
                </button>
              </div>
            </div>

            {/* Local Bot API Server URL (Optional) */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <Server className="w-3 h-3 text-purple-400" />
                <span>Custom Telegram Bot API Server URL (ঐচ্ছিক - 2GB ডিরেক্ট আপলোডের জন্য):</span>
              </label>
              <input
                type="text"
                value={localApiUrl}
                onChange={(e) => setLocalApiUrl(e.target.value)}
                placeholder="http://my-telegram-bot-api:8081 (ডিফল্ট api.telegram.org ব্যবহার করতে ফাঁকা রাখুন)"
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-slate-400">
                টেলিগ্রামের অফিসিয়াল ওপেন সোর্স <code className="text-purple-300">telegram-bot-api</code> সার্ভার চালালে এই লিংক দিলে ৫০MB-এর জায়গায় ২ জিবি ফাইল সরাসরি বট ফাইল হিসেবে পাঠানো সম্ভব।
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-400 font-medium">
                {isSavedPref ? '✓ ১০ জিবি আপলোড সেটিংস সংরক্ষিত হয়েছে!' : ''}
              </span>
              <button
                type="button"
                onClick={handleApplyUploadSettings}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>১০ জিবি সেটিংস সেভ করুন</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
