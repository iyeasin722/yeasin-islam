import React, { useState, useRef } from 'react';
import {
  FileVideo,
  FileAudio,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  QrCode,
  Sliders,
  Film,
  Music,
  Zap,
} from 'lucide-react';
import { LocalConversionJob, AudioBitrateChoice } from '../types';
import { QrCodeModal } from './QrCodeModal';
import { soundNotify } from '../lib/soundNotify';
import { downloadFileWithBlob } from '../lib/downloadHelper';

interface LocalMediaConverterProps {
  onBackToDownloads: () => void;
  playNotificationSound?: boolean;
}

export const LocalMediaConverter: React.FC<LocalMediaConverterProps> = ({
  onBackToDownloads,
  playNotificationSound = true,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetType, setTargetType] = useState<'video' | 'audio'>('video');
  const [targetFormat, setTargetFormat] = useState<
    'mp4' | 'mp3' | 'webm' | 'gif' | 'flac' | 'wav' | 'm4a'
  >('mp4');
  const [audioBitrate, setAudioBitrate] = useState<AudioBitrateChoice>('320k');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionPhase, setConversionPhase] = useState<'idle' | 'uploading' | 'converting' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{
    downloadUrl: string;
    filename: string;
    fileSize: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setErrorMsg(null);
    setResult(null);
    setConversionPhase('idle');

    // Auto-detect audio vs video based on mime or extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      setTargetType('audio');
      setTargetFormat('mp3');
    } else {
      setTargetType('video');
      setTargetFormat('mp4');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setConversionPhase('uploading');
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('targetFormat', targetFormat);
    formData.append('audioBitrate', audioBitrate);

    try {
      setConversionPhase('converting');
      const response = await fetch('/api/convert-local', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setResult({
          downloadUrl: data.downloadUrl,
          filename: data.filename,
          fileSize: data.fileSize,
        });
        setConversionPhase('done');
        if (playNotificationSound) {
          soundNotify.playCompleteSound();
        }
      } else {
        setConversionPhase('error');
        setErrorMsg(data.error || 'Conversion failed. Please verify file format.');
      }
    } catch (err: any) {
      setConversionPhase('error');
      setErrorMsg(err.message || 'Failed to connect to media converter engine.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setConversionPhase('idle');
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-800/80 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>Local Media Transcoder</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                FFmpeg Powered
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Drag & drop any device video or audio to convert formats instantly with zero quality loss.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToDownloads}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
        >
          ← Back to Web Downloader
        </button>
      </div>

      {/* Drag & Drop Zone */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
            dragActive
              ? 'border-cyan-400 bg-cyan-950/20 scale-[1.01]'
              : 'border-slate-800 hover:border-cyan-500/50 hover:bg-slate-950/60 bg-slate-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="video/*,audio/*,.mkv,.avi,.mov,.flv,.webm,.ts,.mp4,.mp3,.wav,.flac,.aac,.ogg,.m4a"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/10 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-sm sm:text-base font-bold text-slate-200">
              Drag & drop video or audio file here, or{' '}
              <span className="text-cyan-400 underline decoration-cyan-400/40">Browse Files</span>
            </p>
            <p className="text-xs text-slate-500 font-mono">
              Supports MP4, MKV, MOV, AVI, WEBM, MP3, WAV, FLAC, M4A, AAC up to 1GB
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Selected File Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                {selectedFile.type.includes('audio') ? (
                  <FileAudio className="w-5 h-5" />
                ) : (
                  <FileVideo className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-100 truncate" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB •{' '}
                  {selectedFile.type || selectedFile.name.split('.').pop()?.toUpperCase()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              disabled={isConverting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800/80 transition-colors shrink-0 disabled:opacity-50"
            >
              Change File
            </button>
          </div>

          {/* Format Selection Card */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Select Output Format & Quality
              </span>

              {/* Type Switcher */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  disabled={isConverting}
                  onClick={() => {
                    setTargetType('video');
                    setTargetFormat('mp4');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    targetType === 'video'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Video / GIF</span>
                </button>
                <button
                  type="button"
                  disabled={isConverting}
                  onClick={() => {
                    setTargetType('audio');
                    setTargetFormat('mp3');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    targetType === 'audio'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Extract Audio</span>
                </button>
              </div>
            </div>

            {/* Target Formats */}
            {targetType === 'video' ? (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mp4', name: 'MP4', desc: 'Universal (H.264 + AAC)' },
                  { id: 'webm', name: 'WEBM', desc: 'Modern Web (VP9)' },
                  { id: 'gif', name: 'GIF', desc: 'Animated Clip' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    disabled={isConverting}
                    onClick={() => setTargetFormat(fmt.id as any)}
                    className={`py-3 px-3 rounded-xl border text-left transition-all ${
                      targetFormat === fmt.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-bold font-mono">{fmt.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{fmt.desc}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'mp3', name: 'MP3', desc: 'Popular / High Compatibility' },
                    { id: 'm4a', name: 'M4A', desc: 'Apple AAC Format' },
                    { id: 'flac', name: 'FLAC', desc: 'Hi-Res Lossless' },
                    { id: 'wav', name: 'WAV', desc: 'Uncompressed Studio' },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      disabled={isConverting}
                      onClick={() => setTargetFormat(fmt.id as any)}
                      className={`py-3 px-3 rounded-xl border text-left transition-all ${
                        targetFormat === fmt.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold font-mono">{fmt.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{fmt.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Bitrate Selector for MP3 / M4A */}
                {(targetFormat === 'mp3' || targetFormat === 'm4a') && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">Audio Bitrate:</span>
                    <div className="flex items-center gap-1.5">
                      {(['320k', '256k', '192k', '128k'] as AudioBitrateChoice[]).map((br) => (
                        <button
                          key={br}
                          type="button"
                          disabled={isConverting}
                          onClick={() => setAudioBitrate(br)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                            audioBitrate === br
                              ? 'bg-cyan-500 text-white shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {br.replace('k', ' kbps')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Result Card */}
          {conversionPhase === 'done' && result && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Conversion Finished Successfully!</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">
                  {(result.fileSize / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (result.downloadUrl) {
                      downloadFileWithBlob(result.downloadUrl, result.filename);
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Converted File</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrOpen(true)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  title="Scan with phone camera to download directly to smartphone"
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR Transfer to Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Convert Another</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Button */}
          {conversionPhase !== 'done' && (
            <button
              type="button"
              disabled={isConverting}
              onClick={handleConvert}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {conversionPhase === 'uploading' ? 'Uploading Media...' : 'Transcoding with FFmpeg...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>START TRANSCODING TO {targetFormat.toUpperCase()}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* QR Code Modal for Mobile Transfer */}
      {result && (
        <QrCodeModal
          isOpen={isQrOpen}
          onClose={() => setIsQrOpen(false)}
          downloadUrl={result.downloadUrl}
          filename={result.filename}
        />
      )}
    </div>
  );
};
