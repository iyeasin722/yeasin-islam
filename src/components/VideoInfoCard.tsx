import React, { useState } from 'react';
import { VideoInfo, DownloadType, VideoQuality, VideoFormatChoice } from '../types';
import { Clock, Download, Film, Music, Check, ShieldAlert, ArrowLeft } from 'lucide-react';

interface VideoInfoCardProps {
  info: VideoInfo;
  onStartDownload: (config: { type: DownloadType; quality: VideoQuality; format: VideoFormatChoice }) => void;
  onReset: () => void;
}

export const VideoInfoCard: React.FC<VideoInfoCardProps> = ({ info, onStartDownload, onReset }) => {
  const [downloadType, setDownloadType] = useState<DownloadType>('video');
  const [quality, setQuality] = useState<VideoQuality>('720p');
  const [format, setFormat] = useState<VideoFormatChoice>('mp4');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartDownload({
      type: downloadType,
      quality,
      format,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <button
          onClick={onReset}
          className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to URL Input</span>
        </button>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Ready for Download
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Thumbnail */}
        <div className="w-full md:w-56 shrink-0 aspect-video md:aspect-16/10 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative shadow-md">
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
            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-medium text-slate-200 flex items-center gap-1 border border-white/10">
              <Clock className="w-3 h-3 text-cyan-400" />
              {formatDuration(info.duration)}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-semibold text-slate-100 line-clamp-2 leading-snug mb-2">
            {info.title}
          </h3>
          <div className="space-y-1 text-xs text-slate-400">
            <p className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Uploader:</span>
              <span className="text-slate-300 font-medium">{info.uploader || 'Unknown'}</span>
            </p>
            {info.view_count && (
              <p className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Views:</span>
                <span className="text-slate-300">{info.view_count.toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Download Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Download Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleTypeChange('video')}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                downloadType === 'video'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Video + Audio</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('audio')}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                downloadType === 'audio'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-lg shadow-cyan-500/10'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Music className="w-4 h-4" />
              <span>Audio Only</span>
            </button>
          </div>
        </div>

        {/* Quality Selector (if video) */}
        {downloadType === 'video' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Video Quality
            </label>
            <div className="grid grid-cols-4 gap-2.5">
              {(['360p', '480p', '720p', '1080p'] as VideoQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    quality === q
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Format Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            Format Container
          </label>
          <div className="grid grid-cols-2 gap-3">
            {downloadType === 'video' ? (
              <>
                {(['mp4', 'webm'] as VideoFormatChoice[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`py-3 rounded-xl border text-xs font-semibold uppercase tracking-wide transition-all ${
                      format === f
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </>
            ) : (
              <>
                {(['mp3', 'm4a'] as VideoFormatChoice[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`py-3 rounded-xl border text-xs font-semibold uppercase tracking-wide transition-all ${
                      format === f
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Download Action Button */}
        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 text-sm tracking-wide"
        >
          <Download className="w-5 h-5" />
          <span>Start Download Now</span>
        </button>
      </form>
    </div>
  );
};
