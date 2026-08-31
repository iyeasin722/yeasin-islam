import React, { useState } from 'react';
import { AlertTriangle, Terminal, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface SystemStatus {
  installed: boolean;
  version?: string;
  instructions: {
    mac: string;
    linux: string;
    windows: string;
    pip: string;
  };
}

interface Props {
  status: SystemStatus | null;
}

export const YtDlpAlertBanner: React.FC<Props> = ({ status }) => {
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!status || status.installed) {
    return null;
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 md:p-5 text-amber-200 shadow-lg shadow-amber-500/5 mb-6 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-100">
              System Notice: yt-dlp is not installed
            </h3>
            <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
              The application is currently running in fallback / simulation mode because the <code className="bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-300">yt-dlp</code> binary was not detected on this system. To enable full media downloads, please install yt-dlp.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center space-x-1 text-xs font-medium text-amber-300 hover:text-amber-100 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{expanded ? 'Hide Instructions' : 'Installation Guide'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-3 text-xs">
          <p className="text-amber-200/90 font-medium">Choose your operating system to install yt-dlp:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Linux */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Linux (Ubuntu / Debian)</span>
                <button
                  onClick={() => handleCopy(status.instructions.linux, 'linux')}
                  className="text-slate-400 hover:text-amber-300 flex items-center gap-1"
                  title="Copy command"
                >
                  {copiedKey === 'linux' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copiedKey === 'linux' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] text-amber-300 bg-slate-950 p-2 rounded block overflow-x-auto select-all font-mono">
                {status.instructions.linux}
              </code>
            </div>

            {/* macOS */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">macOS (Homebrew)</span>
                <button
                  onClick={() => handleCopy(status.instructions.mac, 'mac')}
                  className="text-slate-400 hover:text-amber-300 flex items-center gap-1"
                  title="Copy command"
                >
                  {copiedKey === 'mac' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copiedKey === 'mac' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] text-amber-300 bg-slate-950 p-2 rounded block overflow-x-auto select-all font-mono">
                {status.instructions.mac}
              </code>
            </div>

            {/* Windows */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Windows (Winget)</span>
                <button
                  onClick={() => handleCopy(status.instructions.windows, 'windows')}
                  className="text-slate-400 hover:text-amber-300 flex items-center gap-1"
                  title="Copy command"
                >
                  {copiedKey === 'windows' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copiedKey === 'windows' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] text-amber-300 bg-slate-950 p-2 rounded block overflow-x-auto select-all font-mono">
                {status.instructions.windows}
              </code>
            </div>

            {/* Python Pip */}
            <div className="bg-slate-900/80 rounded-xl p-3 border border-amber-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-200">Python PIP (All OS)</span>
                <button
                  onClick={() => handleCopy(status.instructions.pip, 'pip')}
                  className="text-slate-400 hover:text-amber-300 flex items-center gap-1"
                  title="Copy command"
                >
                  {copiedKey === 'pip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copiedKey === 'pip' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-[11px] text-amber-300 bg-slate-950 p-2 rounded block overflow-x-auto select-all font-mono">
                {status.instructions.pip}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
