import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Repeat,
  FastForward,
  Download,
  Scissors,
  Share2,
  ExternalLink,
  Film,
  Music
} from 'lucide-react';
import { downloadFileWithBlob } from '../lib/downloadHelper';

interface MediaPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  title?: string;
  type?: 'video' | 'audio';
  taskId?: string;
  onOpenAudioCutter?: (taskId?: string, mediaUrl?: string, title?: string) => void;
}

export function MediaPlayerModal({
  isOpen,
  onClose,
  mediaUrl,
  title = 'Media Preview',
  type = 'video',
  taskId,
  onOpenAudioCutter,
}: MediaPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.loop = isLooping;
    }
  }, [isOpen, playbackSpeed, isLooping]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleLoop = () => {
    if (videoRef.current) {
      const next = !isLooping;
      videoRef.current.loop = next;
      setIsLooping(next);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !isMuted;
      videoRef.current.muted = next;
      setIsMuted(next);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      if (v === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col relative text-slate-100">
        
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3 truncate mr-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              {type === 'audio' ? <Music className="w-4 h-4" /> : <Film className="w-4 h-4" />}
            </div>
            <h3 className="text-sm font-bold truncate text-slate-200" title={title}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Media Container */}
        <div className="relative bg-black flex items-center justify-center min-h-[300px] max-h-[50vh]">
          {type === 'audio' ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 animate-pulse">
                <Music className="w-10 h-10 text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-300 max-w-md truncate">{title}</p>
              <audio
                ref={videoRef as any}
                src={mediaUrl}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          ) : (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full max-h-[50vh] object-contain"
              playsInline
              controls={false}
              onClick={togglePlay}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* Big Play/Pause Center Button on Video Overlay */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/50 hover:bg-cyan-500/80 backdrop-blur-sm flex items-center justify-center text-white transition-all transform hover:scale-110 cursor-pointer opacity-80 hover:opacity-100"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 fill-white translate-x-0.5" />
            )}
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-slate-900/95 border-t border-slate-800 space-y-3">
          {/* Timeline Range Bar */}
          <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setCurrentTime(val);
                if (videoRef.current) videoRef.current.currentTime = val;
              }}
              className="flex-1 accent-cyan-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span>{formatTime(duration)}</span>
          </div>

          {/* Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={togglePlay}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-200" />}
              </button>

              {/* Loop toggle */}
              <button
                type="button"
                onClick={toggleLoop}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                  isLooping
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="লুপ রিপিট চালু/বন্ধ করুন"
              >
                <Repeat className="w-4 h-4" />
                <span className="hidden sm:inline">Loop</span>
              </button>

              {/* Speed selector */}
              <div className="flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <FastForward className="w-3.5 h-3.5 text-slate-400 mx-1.5" />
                {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeedChange(s)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      playbackSpeed === s
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Volume & Mute */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 accent-cyan-500 bg-slate-800 h-1.5 rounded cursor-pointer hidden md:inline-block"
                />
              </div>
            </div>

            {/* Actions: Trim, PiP, Download */}
            <div className="flex items-center space-x-2">
              {type !== 'audio' && (
                <button
                  type="button"
                  onClick={togglePiP}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition cursor-pointer hidden sm:flex items-center gap-1"
                  title="Picture-in-Picture"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>PiP</span>
                </button>
              )}

              {onOpenAudioCutter && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAudioCutter(taskId, mediaUrl, title);
                  }}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                  title="Trim as Ringtone or Audio Clip"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>✂️ Trim / রিংটোন</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  downloadFileWithBlob(mediaUrl, `${title || 'media'}.${type === 'audio' ? 'mp3' : 'mp4'}`);
                }}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
