import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  Download,
  ExternalLink,
  Calendar,
  Film,
  Music,
  Star,
  Search,
  Play,
  Scissors,
  Bookmark,
  Sparkles,
  Filter
} from 'lucide-react';

export interface HistoryItem {
  id: string;
  userId?: string;
  title: string;
  url: string;
  type?: string;
  quality?: string;
  format?: string;
  createdAt: string;
  downloadUrl?: string;
  taskId?: string;
  isFavorite?: boolean;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onSelectUrl: (url: string) => void;
  onToggleFavorite?: (id: string) => void;
  onPlayMedia?: (url: string, title?: string, type?: 'video' | 'audio', taskId?: string) => void;
  onTrimMedia?: (taskId?: string, url?: string, title?: string) => void;
  isSignedIn?: boolean;
  onSignIn?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onDelete,
  onSelectUrl,
  onToggleFavorite,
  onPlayMedia,
  onTrimMedia,
  isSignedIn,
  onSignIn,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'youtube' | 'tiktok' | 'instagram' | 'audio' | 'video'>('all');

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // Search text match
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.url?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Platform & Category filters
      const itemUrl = item.url?.toLowerCase() || '';
      if (activeFilter === 'favorites') return !!item.isFavorite;
      if (activeFilter === 'youtube') return itemUrl.includes('youtube.com') || itemUrl.includes('youtu.be');
      if (activeFilter === 'tiktok') return itemUrl.includes('tiktok.com');
      if (activeFilter === 'instagram') return itemUrl.includes('instagram.com');
      if (activeFilter === 'audio') return item.type === 'audio' || ['mp3', 'm4a', 'wav', 'flac'].includes(item.format || '');
      if (activeFilter === 'video') return item.type === 'video' || ['mp4', 'webm'].includes(item.format || '');

      return true;
    });
  }, [history, searchTerm, activeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">Download History & Bookmarks</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                  {history.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">ডাউনলোড হিস্টোরি ও বুকমার্ক করা মিডিয়া</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or URL (টাইটেল বা লিঙ্ক দিয়ে খুঁজুন)..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2 pl-10 pr-4 text-xs text-slate-200 placeholder:text-slate-500 outline-none transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {(
              [
                { id: 'all', label: 'All Items' },
                { id: 'favorites', label: '⭐ Bookmarks' },
                { id: 'youtube', label: 'YouTube' },
                { id: 'tiktok', label: 'TikTok' },
                { id: 'instagram', label: 'Instagram' },
                { id: 'audio', label: 'Audio Only' },
                { id: 'video', label: 'Video Only' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer shrink-0 border ${
                  activeFilter === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Film className="w-10 h-10 mx-auto text-slate-600 opacity-50" />
              <p className="text-sm font-medium">কোনো হিস্টোরি পাওয়া যায়নি (No items found)</p>
              <p className="text-xs text-slate-500">
                {searchTerm || activeFilter !== 'all'
                  ? 'ফিল্টার বা সার্চ পরিবর্তন করে চেষ্টা করুন।'
                  : 'ডাউনলোড সম্পন্ন হলে স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isFav = !!item.isFavorite;
              const isAudio = item.type === 'audio' || ['mp3', 'm4a', 'wav'].includes(item.format || '');
              const streamLink = item.downloadUrl || (item.taskId ? `/api/file/${item.taskId}?inline=true` : undefined);

              return (
                <div
                  key={item.id}
                  className={`bg-slate-850/80 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isFav
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* Star Bookmark button */}
                      <button
                        type="button"
                        onClick={() => onToggleFavorite && onToggleFavorite(item.id)}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-300'
                        }`}
                        title={isFav ? 'Remove Bookmark' : 'Add to Bookmarks'}
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>

                      <h3
                        className="text-sm font-semibold text-slate-200 truncate flex-1"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 pl-7">
                      {item.type && (
                        <span className={`px-2 py-0.5 rounded uppercase font-semibold text-[10px] ${
                          isAudio ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}>
                          {item.type}
                        </span>
                      )}
                      {item.quality && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded font-semibold text-[10px] border border-emerald-500/20">
                          {item.quality}
                        </span>
                      )}
                      {item.format && (
                        <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded uppercase font-semibold text-[10px] border border-cyan-500/20">
                          {item.format}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 self-end sm:self-center pl-7 sm:pl-0">
                    {/* Play / Preview button */}
                    {streamLink && onPlayMedia && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onPlayMedia(streamLink, item.title, isAudio ? 'audio' : 'video', item.taskId);
                        }}
                        className="p-2 bg-slate-800 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700/80 rounded-xl text-xs transition cursor-pointer"
                        title="প্লে করুন (Preview Media)"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {/* Ringtone / Audio Trimmer shortcut */}
                    {onTrimMedia && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onTrimMedia(item.taskId, streamLink, item.title);
                        }}
                        className="p-2 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700/80 rounded-xl text-xs transition cursor-pointer"
                        title="রিংটোন কাটার (Trim Audio)"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Redownload */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectUrl(item.url);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                      title="পুনরায় ডাউনলোড করুন"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition cursor-pointer"
                      title="Delete from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div>
            {isSignedIn ? (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Cloud Synced (Firestore database)
              </span>
            ) : (
              <span className="text-slate-400">
                Stored in local browser storage.
              </span>
            )}
          </div>
          {!isSignedIn && onSignIn && (
            <button
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
            >
              Sign in to sync across all devices
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
