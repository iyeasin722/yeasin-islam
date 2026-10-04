import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      id="fluxload-toast-container"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2.5rem)] sm:w-96 pointer-events-none"
    >
      <AnimatePresence mode="sync">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const { id, type, title, message, duration = 5000 } = toast;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const config = {
    success: {
      border: 'border-emerald-500/40',
      bg: 'bg-slate-900/95 shadow-emerald-500/10',
      accent: 'bg-emerald-500',
      textAccent: 'text-emerald-400',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
    },
    error: {
      border: 'border-rose-500/40',
      bg: 'bg-slate-900/95 shadow-rose-500/10',
      accent: 'bg-rose-500',
      textAccent: 'text-rose-400',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
    },
    warning: {
      border: 'border-amber-500/40',
      bg: 'bg-slate-900/95 shadow-amber-500/10',
      accent: 'bg-amber-500',
      textAccent: 'text-amber-400',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
    },
    info: {
      border: 'border-cyan-500/40',
      bg: 'bg-slate-900/95 shadow-cyan-500/10',
      accent: 'bg-cyan-500',
      textAccent: 'text-cyan-400',
      icon: <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />,
    },
  }[type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.95 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.border} ${config.bg} p-4 shadow-2xl backdrop-blur-md`}
    >
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className={`text-sm font-semibold tracking-tight ${config.textAccent}`}>
            {title}
          </h4>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed break-words">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-800"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={`absolute bottom-0 left-0 h-0.5 ${config.accent} opacity-60`}
        />
      )}
    </motion.div>
  );
};
