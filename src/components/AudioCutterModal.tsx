import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Download,
  Upload,
  CheckCircle2,
  Music,
  Bell,
  Sparkles,
  X,
  Smartphone,
  Sliders,
  Radio,
  FileAudio
} from 'lucide-react';
import { soundNotify } from '../lib/soundNotify';
import { downloadFileWithBlob } from '../lib/downloadHelper';

interface AudioCutterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTaskId?: string;
  initialMediaUrl?: string;
  initialTitle?: string;
  playNotificationSound?: boolean;
}

export function AudioCutterModal({
  isOpen,
  onClose,
  initialTaskId,
  initialMediaUrl,
  initialTitle = 'Audio Track',
  playNotificationSound = true,
}: AudioCutterModalProps) {
  const [activeMediaUrl, setActiveMediaUrl] = useState<string>(initialMediaUrl || '');
  const [taskId, setTaskId] = useState<string>(initialTaskId || '');
  const [mediaTitle, setMediaTitle] = useState<string>(initialTitle);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Playback & Timing state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);

  // Trimming configurations
  const [format, setFormat] = useState<'mp3' | 'm4a' | 'wav' | 'mp4'>('mp3');
  const [audioBitrate, setAudioBitrate] = useState<'320k' | '192k' | '128k'>('320k');
  const [volumeBoost, setVolumeBoost] = useState<number>(1.2); // 120% default for ringtones
  const [fadeIn, setFadeIn] = useState<boolean>(true);
  const [fadeOut, setFadeOut] = useState<boolean>(true);

  // Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialMediaUrl) setActiveMediaUrl(initialMediaUrl);
    if (initialTaskId) setTaskId(initialTaskId);
    if (initialTitle) setMediaTitle(initialTitle);
  }, [initialMediaUrl, initialTaskId, initialTitle]);

  // When audio metadata is loaded
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (!isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
        setStartTime(0);
        // Default to either 30s or entire duration
        setEndTime(Math.min(30, dur));
      }
    }
  };

  // Time update listener during playback
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      setCurrentTime(curr);
      // Auto-loop within the trimmed region if user is previewing
      if (curr >= endTime) {
        audioRef.current.pause();
        audioRef.current.currentTime = startTime;
        setIsPlaying(false);
      }
    }
  };

  const togglePlaySnippet = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = startTime;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Preset Handlers
  const applyPreset = (seconds: number) => {
    if (duration > 0) {
      const newEnd = Math.min(startTime + seconds, duration);
      setEndTime(newEnd);
    } else {
      setEndTime(startTime + seconds);
    }
  };

  // Format MM:SS helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setMediaTitle(file.name);
      setTaskId('');
      const objectUrl = URL.createObjectURL(file);
      setActiveMediaUrl(objectUrl);
      setResultDownloadUrl(null);
      setErrorMessage(null);
    }
  };

  // Submit Trim Job to Server
  const handleCutAndExport = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setResultDownloadUrl(null);

    try {
      let response: Response;

      if (uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('startTime', startTime.toString());
        formData.append('endTime', endTime.toString());
        formData.append('format', format);
        formData.append('audioBitrate', audioBitrate);
        formData.append('volume', volumeBoost.toString());
        formData.append('fadeIn', fadeIn.toString());
        formData.append('fadeOut', fadeOut.toString());

        response = await fetch('/api/trim-media', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/trim-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: taskId || undefined,
            startTime,
            endTime,
            format,
            audioBitrate,
            volume: volumeBoost,
            fadeIn,
            fadeOut,
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Trimming failed');
      }

      const data = await response.json();
      setResultDownloadUrl(data.downloadUrl);
      setResultFilename(data.filename);

      if (playNotificationSound) {
        soundNotify.playCompleteSound();
      }

      // Automatically trigger browser download via blob to prevent cookie check HTML
      await downloadFileWithBlob(data.downloadUrl, data.filename || 'fluxload_ringtone.mp3');
    } catch (err: any) {
      console.error('Trim error:', err);
      setErrorMessage(err.message || 'Failed to trim media. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const clipDuration = Math.max(0, endTime - startTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Audio & Ringtone Cutter
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-medium border border-cyan-500/30">
                  রিংটোন মেকার
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xs md:max-w-md">
                {mediaTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Audio Player Element */}
          {activeMediaUrl && (
            <audio
              ref={audioRef}
              src={activeMediaUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* If No Media Loaded: Provide Upload / Source Box */}
          {!activeMediaUrl && (
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-2xl p-8 text-center bg-slate-950/40 transition-colors">
              <FileAudio className="w-12 h-12 mx-auto text-cyan-400 mb-3 opacity-80" />
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                গান বা ভিডিও ফাইল সিলেক্ট করুন / Select Audio or Video
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                ফোনে বা পিসিতে থাকা যেকোনো গান বা ভিডিও ফাইল থেকে সরাসরি রিংটোন তৈরি করুন
              </p>
              <label className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-cyan-500/20 transition-all">
                <Upload className="w-4 h-4" />
                <span>ফাইল আপলোড করুন / Choose File</span>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Interactive Scrubber & Waveform Bar */}
          {activeMediaUrl && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>Start: <strong className="text-cyan-300">{formatTime(startTime)}</strong></span>
                </div>
                <div>
                  <span className="text-slate-500">Selected Clip: </span>
                  <span className="text-amber-400 font-bold">{clipDuration.toFixed(1)}s</span>
                </div>
                <div>
                  <span>End: <strong className="text-cyan-300">{formatTime(endTime)}</strong></span>
                </div>
              </div>

              {/* Graphical Timeline Bar */}
              <div className="relative w-full h-12 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center px-1">
                {/* Simulated visual waveform bars */}
                <div className="absolute inset-0 flex items-center justify-between px-3 opacity-25 pointer-events-none">
                  {Array.from({ length: 48 }).map((_, i) => {
                    const h = 20 + Math.sin(i * 0.7) * 16 + (i % 3 === 0 ? 10 : 0);
                    return (
                      <div
                        key={i}
                        className="w-1 bg-cyan-400 rounded-full"
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
                </div>

                {/* Selected region highlight */}
                {duration > 0 && (
                  <div
                    className="absolute h-full bg-cyan-500/25 border-x-2 border-cyan-400 pointer-events-none transition-all"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${((endTime - startTime) / duration) * 100}%`,
                    }}
                  />
                )}

                {/* Current playback cursor indicator */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 transition-all pointer-events-none"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                )}
              </div>

              {/* Start & End Dual Range Controls */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>শুরুর সময় (Start Point)</span>
                    <span className="text-cyan-400 font-mono">{formatTime(startTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={startTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setStartTime(val);
                      if (val >= endTime) setEndTime(Math.min(val + 5, duration || 100));
                    }}
                    className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>শেষের সময় (End Point)</span>
                    <span className="text-cyan-400 font-mono">{formatTime(endTime)}</span>
                  </div>
                  <input
                    type="range"
                    min={startTime + 0.5}
                    max={duration || 100}
                    step={0.1}
                    value={endTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEndTime(val);
                    }}
                    className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Play & Preview Controller */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={togglePlaySnippet}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-cyan-400" />}
                  <span>{isPlaying ? 'Pause Snippet' : 'Preview Snippet (শুনুন)'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = startTime;
                        setCurrentTime(startTime);
                      }
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition cursor-pointer"
                    title="Jump to Start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-400">
                    Pos: {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              কুইক রিংটোন প্রিসেট (Quick Length Presets):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="px-3 py-2 bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>রিংটোন (30s)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset(15)}
                className="px-3 py-2 bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-purple-400" />
                <span>শর্ট হুক (15s)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset(10)}
                className="px-3 py-2 bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>নোটিফিকেশন (10s)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartTime(0);
                  setEndTime(duration || 60);
                }}
                className="px-3 py-2 bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/50 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>সম্পূর্ণ গান (Full)</span>
              </button>
            </div>
          </div>

          {/* Audio Quality & Effects Settings */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              অডিও কোয়ালিটি ও সাউন্ড সেটিংস (Audio Output Options)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Format */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1.5">আউটপুট ফরম্যাট (Format):</label>
                <div className="flex gap-2">
                  {(['mp3', 'm4a', 'wav'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                        format === fmt
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {fmt === 'm4a' ? 'M4A (iPhone)' : fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bitrate */}
              {format === 'mp3' && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1.5">বিটরেট (Bitrate):</label>
                  <div className="flex gap-2">
                    {(['320k', '192k', '128k'] as const).map((br) => (
                      <button
                        key={br}
                        type="button"
                        onClick={() => setAudioBitrate(br)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                          audioBitrate === br
                            ? 'bg-cyan-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {br}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Volume Boost & Fade In/Out */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/80">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-cyan-400" />
                    সাউন্ড বুস্ট (Volume):
                  </span>
                  <span className="font-mono text-cyan-400">{Math.round(volumeBoost * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={2.0}
                  step={0.1}
                  value={volumeBoost}
                  onChange={(e) => setVolumeBoost(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={fadeIn}
                  onChange={(e) => setFadeIn(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 accent-cyan-500 bg-slate-800"
                />
                <span>Fade In (স্মুথ শুরু)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={fadeOut}
                  onChange={(e) => setFadeOut(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 accent-cyan-500 bg-slate-800"
                />
                <span>Fade Out (স্মুথ শেষ)</span>
              </label>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs">
              {errorMessage}
            </div>
          )}

          {/* Success Download Banner */}
          {resultDownloadUrl && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">
                    রিংটোন সফলভাবে তৈরি হয়েছে! (Ready!)
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate max-w-xs">{resultFilename}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (resultDownloadUrl) {
                    downloadFileWithBlob(resultDownloadUrl, resultFilename || 'ringtone.mp3');
                  }
                }}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 sticky bottom-0 z-20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            বাতিল / Close
          </button>

          <button
            type="button"
            onClick={handleCutAndExport}
            disabled={isProcessing || (!activeMediaUrl && !uploadedFile)}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/25 flex items-center space-x-2 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Scissors className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>
              {isProcessing
                ? 'কাটা হচ্ছে... (Processing)'
                : `✂️ রিংটোন ডাউনলোড করুন (${clipDuration.toFixed(1)}s)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
