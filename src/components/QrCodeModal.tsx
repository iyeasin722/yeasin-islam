import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  X,
  Copy,
  Check,
  Smartphone,
  ExternalLink,
  Download,
  Share2,
  HelpCircle,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { MobileGuideModal } from './MobileGuideModal';
import { downloadFileWithBlob } from '../lib/downloadHelper';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl: string;
  filename?: string;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({
  isOpen,
  onClose,
  downloadUrl,
  filename,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [fullUrl, setFullUrl] = useState<string>('');
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !downloadUrl) return;

    // Resolve absolute URL
    let target = downloadUrl;
    if (typeof window !== 'undefined' && !downloadUrl.startsWith('http')) {
      target = `${window.location.origin}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
    }
    setFullUrl(target);

    QRCode.toDataURL(target, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0284c7', // Cyan / Sky blue
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [isOpen, downloadUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: filename || 'Video Download',
          text: `Download file: ${filename || 'video'}`,
          url: fullUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-cyan-500/30 w-full max-w-md max-h-[95vh] overflow-y-auto rounded-3xl p-5 sm:p-6 shadow-2xl shadow-cyan-950/50 flex flex-col items-center text-center relative space-y-3.5">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <QrCode className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2">
              <span>Instant Mobile Transfer</span>
              <Smartphone className="w-4 h-4 text-cyan-400" />
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Scan this QR code with your phone camera or QR scanner to download directly to your mobile device.
            </p>
          </div>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-cyan-400/50">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan to Download on Phone"
                className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-lg"
              />
            ) : (
              <div className="w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs">
                Generating QR Code...
              </div>
            )}
          </div>

          {filename && (
            <p className="text-xs text-slate-300 font-mono truncate max-w-[320px] bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              {filename}
            </p>
          )}

          {/* Mobile Warning & Helpful Tip Notice */}
          <div className="w-full bg-slate-950/70 border border-amber-500/30 rounded-xl p-3 text-left space-y-1.5">
            <div className="flex items-center justify-between text-amber-300 font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                ফোনে &quot;Action required&quot; বা সমস্যা হলে?
              </span>
              <button
                type="button"
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="text-[11px] text-cyan-400 hover:underline"
              >
                {showTroubleshoot ? 'লুকান' : 'সমাধান দেখুন'}
              </button>
            </div>

            {showTroubleshoot ? (
              <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800">
                <p>১. ক্যামেরার ভেতরের ব্রাউজার এড়িয়ে সরাসরি <strong>Chrome বা Safari</strong> দিয়ে ওপেন করুন।</p>
                <p>২. গুগলের পারমিশন স্ক্রিন এলে <strong>&quot;Grant permission&quot;</strong> চাপুন।</p>
                <p>৩. আইফোনে ডাউনলোড শেষ হলে ভিডিওটি আপনার <strong>Files &gt; Downloads</strong> এ সেভ হবে।</p>
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="mt-1 text-cyan-300 font-semibold underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  সম্পূর্ণ মোবাইল গাইড বিস্তারিত পড়ুন
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                ক্যামেরা স্ক্যানারে গুগল সিকিউরিটি প্রম্পট এলে নিচে &quot;Copy Link&quot; চেপে আপনার ফোনের ক্রোম বা সাফারি ব্রাউজারে পেস্ট করুন।
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="w-full space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300 text-[11px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span className="truncate">Copy Link</span>
                  </>
                )}
              </button>

              {canShare ? (
                <button
                  type="button"
                  onClick={handleShare}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Share2 className="w-4 h-4 text-cyan-400" />
                  <span>Share / পাঠাই</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>ফোন গাইড</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                downloadFileWithBlob(fullUrl, filename);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Media Directly (সরাসরি ডাউনলোড)</span>
            </button>
          </div>
        </div>
      </div>

      <MobileGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
};
