import React, { useState } from 'react';
import { Link2, Sparkles, Loader2, AlertCircle, ListPlus } from 'lucide-react';

interface UrlInputCardProps {
  onAnalyze: (urls: string[]) => void;
  isLoading: boolean;
  error?: string | null;
}

export const UrlInputCard: React.FC<UrlInputCardProps> = ({ onAnalyze, isLoading, error }) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = inputText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (urls.length === 0) return;
    onAnalyze(urls);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Supports Multi-URL Queue & 1000+ Websites</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-100 tracking-tight mb-2">
          Download Any Video or Audio
        </h2>
        <p className="text-sm text-slate-400">
          Paste single or multiple video URLs (one per line) to queue and process sequentially.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute top-4 left-4 text-slate-400 pointer-events-none">
            <Link2 className="w-5 h-5" />
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste video URL(s) here (one per line for batch queue)...&#10;https://www.youtube.com/watch?v=...&#10;https://www.tiktok.com/@...&#10;https://xhamster.com/videos/..."
            rows={3}
            required
            className="w-full pl-12 pr-4 pt-3.5 pb-16 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm transition-all shadow-inner resize-none font-mono"
          />
          <div className="absolute bottom-3 right-3 flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePaste}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Paste Clipboard
            </button>
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ListPlus className="w-4 h-4" />
                  <span>Queue & Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 px-4 py-3 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-4 border-t border-slate-800/60">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Sequential Batch Queue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> YouTube, TikTok, xHamster
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> MP4 / MP3 Output
        </span>
      </div>
    </div>
  );
};

