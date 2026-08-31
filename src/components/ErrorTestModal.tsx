import React, { useState } from 'react';
import { AlertTriangle, X, Bug, Zap, ShieldAlert, WifiOff, ServerCrash, RefreshCw } from 'lucide-react';

interface ErrorTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerErrorTest: (errorType: string, errorMsg: string) => void;
}

const ERROR_SCENARIOS = [
  {
    id: 'invalid_url',
    title: 'Invalid / Malformed URL',
    description: 'Simulates supplying a broken, empty, or unsupported URL string.',
    icon: Bug,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    message: 'Error 400: Malformed or unsupported video URL format provided.'
  },
  {
    id: 'video_unavailable',
    title: 'Video Unavailable / Private',
    description: 'Simulates trying to fetch a private, deleted, or region-locked video.',
    icon: ShieldAlert,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    message: 'Error 403: Video unavailable. It may be private, deleted, or geoblocked.'
  },
  {
    id: 'network_timeout',
    title: 'Network Timeout',
    description: 'Simulates upstream gateway timeout while resolving video metadata.',
    icon: WifiOff,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    message: 'Error 504: Gateway Timeout - Network connection timed out while contacting host.'
  },
  {
    id: 'ffmpeg_error',
    title: 'FFmpeg Muxing Error',
    description: 'Simulates FFmpeg failure during video and audio stream merging.',
    icon: ServerCrash,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    message: 'FFmpeg Error: Muxing failed (codec audio/video mismatch or stream interrupted).'
  },
  {
    id: 'rate_limit',
    title: 'Rate Limit (HTTP 429)',
    description: 'Simulates rate limiting or bot detection blocks by the target platform.',
    icon: Zap,
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    message: 'HTTP Error 429: Too Many Requests - Rate limited by target platform.'
  },
  {
    id: 'connection_reset',
    title: 'Connection Reset (ECONNRESET)',
    description: 'Simulates sudden mid-download socket termination by peer.',
    icon: RefreshCw,
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    message: 'Network Error: ECONNRESET - Connection reset by peer during chunked transfer.'
  }
];

export const ErrorTestModal: React.FC<ErrorTestModalProps> = ({
  isOpen,
  onClose,
  onTriggerErrorTest
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Error Test & Diagnostics Suite</h3>
              <p className="text-xs text-slate-400">Simulate and verify application error handling across all failure modes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scenarios Grid */}
        <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {ERROR_SCENARIOS.map((scenario) => {
            const IconComponent = scenario.icon;
            return (
              <div
                key={scenario.id}
                className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all group"
              >
                <div className="flex items-start space-x-3.5 pr-4">
                  <div className={`p-2.5 rounded-lg border shrink-0 mt-0.5 ${scenario.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-200 group-hover:text-slate-100 transition-colors">
                      {scenario.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">{scenario.description}</p>
                    <code className="inline-block mt-2 text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {scenario.message}
                    </code>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onTriggerErrorTest(scenario.id, scenario.message);
                    onClose();
                  }}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-xs font-medium rounded-lg border border-slate-700 hover:border-cyan-500 transition-all shrink-0 shadow-sm"
                >
                  Test Error
                </button>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Diagnostics Mode Active</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
