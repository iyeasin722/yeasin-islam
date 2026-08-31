import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UrlInputCard } from './components/UrlInputCard';
import { VideoInfoCard } from './components/VideoInfoCard';
import { DownloadProgressCard } from './components/DownloadProgressCard';
import { YtDlpAlertBanner } from './components/YtDlpAlertBanner';
import { Footer } from './components/Footer';
import { ErrorTestModal } from './components/ErrorTestModal';
import { VideoInfo, DownloadType, VideoQuality, VideoFormatChoice, TaskStatus } from './types';

export default function App() {
  const [step, setStep] = useState<'url' | 'info' | 'downloading'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isErrorTestModalOpen, setIsErrorTestModalOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({
    id: '',
    status: 'queued',
    progress: 0,
    speed: '0 KB/s',
    downloadedSize: '0 MB',
    totalSize: 'Unknown',
    eta: 'Calculating...',
  });

  const [urlQueue, setUrlQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(1);
  const [totalQueue, setTotalQueue] = useState(1);

  // Check system status on mount
  useEffect(() => {
    fetch('/api/system-status')
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(err => console.error('Failed to fetch system status:', err));
  }, []);

  // Handle URL Analysis (supports single or multi-line batch queue)
  const handleAnalyze = async (urls: string[]) => {
    if (urls.length === 0) return;
    setIsLoading(true);
    setError(null);

    const primaryUrl = urls[0];
    const remaining = urls.slice(1);
    setUrlQueue(remaining);
    setQueueIndex(1);
    setTotalQueue(urls.length);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: primaryUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze URL');
      }
      setVideoInfo(data);
      setStep('info');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze URL. Please verify the link.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-advance queue sequentially when download completes
  useEffect(() => {
    if (taskStatus.status === 'completed' && urlQueue.length > 0) {
      const nextUrl = urlQueue[0];
      const nextQueue = urlQueue.slice(1);
      const nextIdx = queueIndex + 1;

      const timer = setTimeout(() => {
        setUrlQueue(nextQueue);
        setQueueIndex(nextIdx);
        handleAnalyze([nextUrl]);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [taskStatus.status, urlQueue, queueIndex]);

  // Handle Start Download
  const handleStartDownload = async (config: {
    type: DownloadType;
    quality: VideoQuality;
    format: VideoFormatChoice;
  }) => {
    if (!videoInfo) return;
    setError(null);
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoInfo.webpage_url,
          ...config,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start download');
      }
      setTaskId(data.id);
      setTaskStatus({
        id: data.id,
        status: 'downloading',
        progress: 0,
        speed: '0 KB/s',
        downloadedSize: '0 MB',
        totalSize: 'Unknown',
        eta: 'Calculating...',
      });
      setStep('downloading');
    } catch (err: any) {
      setError(err.message || 'Failed to start download process');
    }
  };

  // Poll Download Status
  useEffect(() => {
    if (!taskId || step !== 'downloading' || taskId.startsWith('test-err-')) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${taskId}`);
        if (res.ok) {
          const statusData: TaskStatus = await res.json();
          setTaskStatus(statusData);

          if (statusData.status === 'completed' || statusData.status === 'error' || statusData.status === 'cancelled') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error fetching task status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [taskId, step]);

  // Handle Cancel
  const handleCancel = async () => {
    if (!taskId) return;
    if (taskId.startsWith('test-err-')) {
      setTaskStatus(prev => ({ ...prev, status: 'cancelled' }));
      return;
    }
    try {
      await fetch(`/api/cancel/${taskId}`, { method: 'POST' });
      setTaskStatus(prev => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  // Reset to initial state
  const handleReset = () => {
    setStep('url');
    setVideoInfo(null);
    setTaskId(null);
    setError(null);
    setTaskStatus({
      id: '',
      status: 'queued',
      progress: 0,
      speed: '0 KB/s',
      downloadedSize: '0 MB',
      totalSize: 'Unknown',
      eta: 'Calculating...',
    });
  };

  // Handle Error Test Trigger from Diagnostics Modal
  const handleTriggerErrorTest = (errorType: string, errorMsg: string) => {
    if (['invalid_url', 'video_unavailable', 'network_timeout'].includes(errorType)) {
      setStep('url');
      setVideoInfo(null);
      setError(`[Diagnostics Test] ${errorMsg}`);
    } else {
      setStep('downloading');
      setTaskId('test-err-' + Date.now());
      setTaskStatus({
        id: 'test-err-' + Date.now(),
        status: 'error',
        progress: 40,
        speed: '0 KB/s',
        downloadedSize: '14.2 MB',
        totalSize: '65.0 MB',
        eta: 'Failed',
        error: `[Diagnostics Test] ${errorMsg}`
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <Header onOpenErrorTest={() => setIsErrorTestModalOpen(true)} />

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-3xl z-10">
          <YtDlpAlertBanner status={systemStatus} />

          {totalQueue > 1 && (
            <div className="mb-4 bg-cyan-950/60 border border-cyan-800/80 rounded-xl p-3.5 flex items-center justify-between text-xs text-cyan-200 shadow-lg backdrop-blur-md">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-semibold">Batch Queue Active: Processing Item {queueIndex} of {totalQueue}</span>
              </div>
              <span className="text-cyan-400 font-mono">
                {urlQueue.length} remaining in queue
              </span>
            </div>
          )}

          {step === 'url' && (
            <UrlInputCard onAnalyze={handleAnalyze} isLoading={isLoading} error={error} />
          )}

          {step === 'info' && videoInfo && (
            <VideoInfoCard info={videoInfo} onStartDownload={handleStartDownload} onReset={handleReset} />
          )}

          {step === 'downloading' && (
            <DownloadProgressCard
              taskStatus={taskStatus}
              onCancel={handleCancel}
              onReset={handleReset}
            />
          )}
        </div>
      </main>

      <Footer />

      <ErrorTestModal
        isOpen={isErrorTestModalOpen}
        onClose={() => setIsErrorTestModalOpen(false)}
        onTriggerErrorTest={handleTriggerErrorTest}
      />
    </div>
  );
}
