import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  Download,
  Send,
  Upload,
  Check,
  RefreshCw,
  Sliders,
  Palette,
  Type,
  Smile,
  Shield,
  Zap,
  Film,
  Flame,
  Rocket,
  Crown,
  Heart,
  Star,
  ExternalLink,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
} from 'lucide-react';

interface LogoStickerMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramConfig?: {
    configured: boolean;
    chatId?: string;
    channelTitle?: string;
    botUsername?: string;
  } | null;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

const PRESET_ICONS = [
  { id: 'send', label: 'Telegram', icon: Send },
  { id: 'zap', label: 'Lightning', icon: Zap },
  { id: 'rocket', label: 'Rocket', icon: Rocket },
  { id: 'film', label: 'Video', icon: Film },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'crown', label: 'Crown', icon: Crown },
  { id: 'shield', label: 'Shield', icon: Shield },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
];

const PRESET_EMOJIS = ['⚡', '🚀', '🎬', '🔥', '💎', '📥', '👑', '💯', '✨', '⭐', '❤️', '🏆'];

const GRADIENT_THEMES = [
  { id: 'transparent', label: 'Transparent (Sticker)', bg: 'transparent', border: '#38bdf8' },
  { id: 'cyan_blue', label: 'Flux Cyber', bg: 'linear-gradient(135deg, #06b6d4, #2563eb)', border: '#06b6d4' },
  { id: 'amber_orange', label: 'Golden Pro', bg: 'linear-gradient(135deg, #f59e0b, #ea580c)', border: '#f59e0b' },
  { id: 'purple_pink', label: 'Neon Cyber', bg: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: '#ec4899' },
  { id: 'emerald_green', label: 'Emerald Speed', bg: 'linear-gradient(135deg, #10b981, #047857)', border: '#10b981' },
  { id: 'obsidian_dark', label: 'Dark Obsidian', bg: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#475569' },
  { id: 'fire_red', label: 'Fire Energy', bg: 'linear-gradient(135deg, #ef4444, #f97316)', border: '#ef4444' },
];

export const LogoStickerMakerModal: React.FC<LogoStickerMakerModalProps> = ({
  isOpen,
  onClose,
  telegramConfig,
  onShowToast,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Studio Mode: 'sticker' (Telegram Sticker 512x512) or 'logo' (Channel Brand Logo)
  const [makerMode, setMakerMode] = useState<'sticker' | 'logo'>('sticker');

  // Text options
  const [brandTitle, setBrandTitle] = useState<string>('FluxLoad');
  const [brandSubtitle, setBrandSubtitle] = useState<string>('power by YEASIN');
  const [selectedIcon, setSelectedIcon] = useState<string>('send');
  const [selectedEmoji, setSelectedEmoji] = useState<string>('⚡');
  const [badgeText, setBadgeText] = useState<string>('PRO');
  const [showBadge, setShowBadge] = useState<boolean>(true);

  // Appearance
  const [theme, setTheme] = useState<string>('transparent');
  const [stickerBorderWidth, setStickerBorderWidth] = useState<number>( makerMode === 'sticker' ? 12 : 0 );
  const [stickerBorderColor, setStickerBorderColor] = useState<string>('#ffffff');
  const [hasDropShadow, setHasDropShadow] = useState<boolean>(true);
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [fontSize, setFontSize] = useState<number>(56);
  const [iconSize, setIconSize] = useState<number>(140);

  // Uploaded custom graphic
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);

  // .size remove options
  const [removeSizePadding, setRemoveSizePadding] = useState<boolean>(true);
  const [compressUnder512Kb, setCompressUnder512Kb] = useState<boolean>(true);
  const [currentFileSizeKb, setCurrentFileSizeKb] = useState<number>(45);

  // Sending state
  const [isSendingToTelegram, setIsSendingToTelegram] = useState<boolean>(false);
  const [targetChannelInput, setTargetChannelInput] = useState<string>(
    telegramConfig?.chatId || '@FluxLoad'
  );

  // Auto-switch defaults when mode changes
  useEffect(() => {
    if (makerMode === 'sticker') {
      setTheme('transparent');
      setStickerBorderWidth(12);
      setShowBadge(true);
    } else {
      setTheme('cyan_blue');
      setStickerBorderWidth(0);
      setShowBadge(true);
    }
  }, [makerMode]);

  // Handle uploaded image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setUploadedImage(img);
        setUploadedImageSrc(src);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleUseFluxLogo = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setUploadedImage(img);
      setUploadedImageSrc('/logo.jpg');
    };
    img.src = '/logo.jpg';
  };

  // Render sticker to 512x512 Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Telegram Stickers requirement: exactly 512 x 512 pixels
    const width = 512;
    const height = 512;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const activeTheme = GRADIENT_THEMES.find((t) => t.id === theme) || GRADIENT_THEMES[0];

    // Background rendering
    if (theme !== 'transparent') {
      const radius = makerMode === 'sticker' ? 64 : 48;
      ctx.save();
      ctx.beginPath();
      // Rounded rect
      ctx.roundRect(16, 16, width - 32, height - 32, radius);
      ctx.clip();

      if (activeTheme.bg.startsWith('linear-gradient')) {
        const grad = ctx.createLinearGradient(16, 16, width - 16, height - 16);
        if (theme === 'cyan_blue') {
          grad.addColorStop(0, '#06b6d4');
          grad.addColorStop(1, '#1d4ed8');
        } else if (theme === 'amber_orange') {
          grad.addColorStop(0, '#f59e0b');
          grad.addColorStop(1, '#ea580c');
        } else if (theme === 'purple_pink') {
          grad.addColorStop(0, '#8b5cf6');
          grad.addColorStop(1, '#ec4899');
        } else if (theme === 'emerald_green') {
          grad.addColorStop(0, '#10b981');
          grad.addColorStop(1, '#047857');
        } else if (theme === 'obsidian_dark') {
          grad.addColorStop(0, '#1e293b');
          grad.addColorStop(1, '#0b0f17');
        } else if (theme === 'fire_red') {
          grad.addColorStop(0, '#ef4444');
          grad.addColorStop(1, '#ea580c');
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = activeTheme.bg;
      }
      ctx.fillRect(0, 0, width, height);

      // Add modern subtle mesh overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.arc(width - 40, 40, 180, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Border outline for logo
      ctx.save();
      ctx.strokeStyle = activeTheme.border || '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(16, 16, width - 32, height - 32, radius);
      ctx.stroke();
      ctx.restore();
    }

    // Shadow & Sticker Outline effect
    if (makerMode === 'sticker' && hasDropShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 10;
    }

    // Draw uploaded custom graphic OR procedural logo icon
    const centerY = height * 0.42;

    if (uploadedImage) {
      ctx.save();
      const imgSize = removeSizePadding ? 310 : 260;
      const x = (width - imgSize) / 2;
      const y = centerY - imgSize / 2;

      // Draw sticker die-cut white outline around image if enabled
      if (stickerBorderWidth > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = stickerBorderColor;
        ctx.beginPath();
        ctx.roundRect(
          x - stickerBorderWidth,
          y - stickerBorderWidth,
          imgSize + stickerBorderWidth * 2,
          imgSize + stickerBorderWidth * 2,
          40
        );
        ctx.fill();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.roundRect(x, y, imgSize, imgSize, 32);
      ctx.clip();
      ctx.drawImage(uploadedImage, x, y, imgSize, imgSize);
      ctx.restore();
    } else {
      // Procedural Vector Icon
      ctx.save();
      const currentIconSize = removeSizePadding ? iconSize * 1.15 : iconSize;
      const iconX = width / 2;
      const iconY = centerY;

      // Circular/Shield badge behind icon
      if (theme === 'transparent') {
        // Draw white sticker contour backing
        if (stickerBorderWidth > 0) {
          ctx.save();
          ctx.fillStyle = stickerBorderColor;
          ctx.beginPath();
          ctx.arc(iconX, iconY, currentIconSize * 0.65 + stickerBorderWidth, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Gradient inner circle
        const circleGrad = ctx.createLinearGradient(
          iconX - currentIconSize,
          iconY - currentIconSize,
          iconX + currentIconSize,
          iconY + currentIconSize
        );
        circleGrad.addColorStop(0, '#0284c7');
        circleGrad.addColorStop(0.5, '#2563eb');
        circleGrad.addColorStop(1, '#4f46e5');

        ctx.fillStyle = circleGrad;
        ctx.beginPath();
        ctx.arc(iconX, iconY, currentIconSize * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Main Emoji or Icon Symbol
      ctx.font = `${currentIconSize * 0.72}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selectedEmoji, iconX, iconY + 4);
      ctx.restore();
    }

    // Draw Main Title Text
    ctx.save();
    const titleY = height * 0.76;
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // White contour stroke on text for sticker look
    if (makerMode === 'sticker' && stickerBorderWidth > 0) {
      ctx.strokeStyle = stickerBorderColor;
      ctx.lineWidth = stickerBorderWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(brandTitle, width / 2, titleY);
    }

    // Text Fill
    if (theme === 'transparent' && !uploadedImage) {
      ctx.fillStyle = '#0f172a';
    } else {
      ctx.fillStyle = textColor;
    }
    ctx.fillText(brandTitle, width / 2, titleY);
    ctx.restore();

    // Draw Subtitle / Tagline
    if (brandSubtitle) {
      ctx.save();
      const subtitleY = height * 0.87;
      ctx.font = `600 20px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = theme === 'transparent' ? '#334155' : '#cbd5e1';

      if (makerMode === 'sticker' && stickerBorderWidth > 0) {
        ctx.strokeStyle = stickerBorderColor;
        ctx.lineWidth = 4;
        ctx.strokeText(brandSubtitle, width / 2, subtitleY);
      }

      ctx.fillText(brandSubtitle, width / 2, subtitleY);
      ctx.restore();
    }

    // Draw Badge (e.g. "PRO", "10GB", "ULTRA")
    if (showBadge && badgeText) {
      ctx.save();
      const badgeX = width * 0.78;
      const badgeY = centerY - 90;
      ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const badgeWidth = textMetrics.width + 24;
      const badgeHeight = 28;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect(badgeX - badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 14);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX, badgeY + 1);
      ctx.restore();
    }

    // Calculate approximate size
    const dataUrl = canvas.toDataURL('image/webp', 0.9);
    const byteSize = Math.round((dataUrl.length * 3) / 4);
    setCurrentFileSizeKb(Math.round(byteSize / 1024));
  }, [
    makerMode,
    brandTitle,
    brandSubtitle,
    selectedEmoji,
    badgeText,
    showBadge,
    theme,
    stickerBorderWidth,
    stickerBorderColor,
    hasDropShadow,
    textColor,
    fontSize,
    iconSize,
    uploadedImage,
    removeSizePadding,
  ]);

  useEffect(() => {
    if (isOpen) {
      renderCanvas();
    }
  }, [isOpen, renderCanvas]);

  // Export functions
  const handleDownloadStickerWebp = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/webp', 0.92);
    const link = document.createElement('a');
    link.download = `${brandTitle.toLowerCase().replace(/\s+/g, '_')}_sticker_512.webp`;
    link.href = dataUrl;
    link.click();
    if (onShowToast) {
      onShowToast(`Telegram Sticker (.webp 512x512) সফলভাবে ডাউনলোড হয়েছে!`, 'success');
    }
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${brandTitle.toLowerCase().replace(/\s+/g, '_')}_logo_512.png`;
    link.href = dataUrl;
    link.click();
    if (onShowToast) {
      onShowToast(`HD 512x512 PNG লোগো ডাউনলোড হয়েছে!`, 'success');
    }
  };

  const handleCopyClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        if (onShowToast) onShowToast('স্টিকার ক্লিপবোর্ডে কপি হয়েছে!', 'success');
      });
    } catch {
      if (onShowToast) onShowToast('ক্লিপবোর্ডে কপি ব্যর্থ হয়েছে', 'error');
    }
  };

  // Direct Send to Telegram Channel API
  const handleSendToTelegram = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSendingToTelegram(true);

    try {
      const stickerDataUrl = canvas.toDataURL('image/webp', 0.92);
      const res = await fetch('/api/telegram/send-sticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stickerDataUrl,
          emoji: selectedEmoji,
          caption: `${brandTitle} Official Sticker (${makerMode.toUpperCase()})`,
          customChatId: targetChannelInput.trim() || '@FluxLoad',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send sticker to Telegram');
      }

      if (onShowToast) {
        onShowToast(
          `স্টিকার সফলভাবে Telegram চ্যানেল (${targetChannelInput}) এ পোস্ট করা হয়েছে!`,
          'success'
        );
      }
    } catch (err: any) {
      if (onShowToast) {
        onShowToast(`টেলিগ্রামে পাঠাতে ব্যর্থ: ${err.message}`, 'error');
      }
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>FluxLoad Logo & Sticker Maker</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  Telegram 512x512
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                টেলিগ্রাম স্টিকার ও চ্যানেলের জন্য কাস্টম লোগো তৈরি করুন (.size remove সহ)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href="https://t.me/FluxLoad"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-colors"
            >
              <Send className="w-3 h-3 text-sky-400" />
              <span>Join @FluxLoad</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Official Channel Sticky Alert */}
        <div className="bg-gradient-to-r from-sky-950/70 via-slate-900 to-sky-950/70 px-4 py-2 border-b border-sky-800/40 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="font-semibold text-sky-300">Official Channel:</span>
            <span className="font-mono text-slate-300">https://t.me/FluxLoad</span>
            <span className="text-amber-400 font-medium hidden md:inline">• join now everybody!</span>
          </div>
          <button
            onClick={() => window.open('https://t.me/FluxLoad', '_blank', 'noopener,noreferrer')}
            className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer"
          >
            এখনই জয়েন করুন ➜
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Canvas Preview Area (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start space-y-4">
            {/* Mode Switcher */}
            <div className="w-full flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setMakerMode('sticker')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  makerMode === 'sticker'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Telegram Sticker</span>
              </button>
              <button
                type="button"
                onClick={() => setMakerMode('logo')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  makerMode === 'logo'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Channel Logo</span>
              </button>
            </div>

            {/* 512x512 Canvas Container with Transparent Grid Backdrop */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 border-slate-700/80 shadow-2xl overflow-hidden flex items-center justify-center bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain filter drop-shadow-md transition-all"
                style={{ imageRendering: 'auto' }}
              />

              <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-slate-700">
                512 × 512 px
              </div>
            </div>

            {/* Telegram 512KB Size Meter & Status */}
            <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Telegram Sticker Size:
                </span>
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {currentFileSizeKb} KB / 512 KB max
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (currentFileSizeKb / 512) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                টেলিগ্রামের অফিসিয়াল রিকোয়ারমেন্ট অনুযায়ী ৫১২x৫১২ সাইজ এবং ৫১২ কেবির নিচে অপটিমাইজড।
              </p>
            </div>

            {/* Action Buttons for Download & Post */}
            <div className="w-full flex flex-col space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadStickerWebp}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  title="Download .webp sticker ready for @Stickers bot"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Sticker (.webp)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Download transparent HD 512x512 PNG"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG 512px</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyClipboard}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={renderCanvas}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  title="Redraw / Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Direct Send to Telegram Channel Box */}
              <div className="mt-2 p-3 bg-sky-950/30 border border-sky-800/40 rounded-xl flex flex-col space-y-2">
                <label className="text-[11px] font-semibold text-sky-300 flex items-center justify-between">
                  <span>Send directly to Telegram:</span>
                  <span className="font-mono text-[10px] text-slate-400">@FluxLoad</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={targetChannelInput}
                    onChange={(e) => setTargetChannelInput(e.target.value)}
                    placeholder="@FluxLoad or Channel ID"
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSendToTelegram}
                    disabled={isSendingToTelegram}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isSendingToTelegram ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>Post</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Controls & Customization Area (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* .size remove & Optimizer Section */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-sky-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-300">
                    .size remove & Auto-Crop Tool
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                  Zero Bloat
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                খালি মার্জিন ও অপ্রয়োজনীয় ক্যানভাস সাইজ স্বয়ংক্রিয়ভাবে রিমুভ করে স্টিকার ফ্রেম পারফেক্ট করুন।
              </p>

              <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center space-x-2 text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeSizePadding}
                    onChange={(e) => setRemoveSizePadding(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Remove Size Padding (ফুল স্ক্রিন ফিট)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 bg-slate-950/60 p-2 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compressUnder512Kb}
                    onChange={(e) => setCompressUnder512Kb(e.target.checked)}
                    className="rounded text-sky-500 focus:ring-sky-500"
                  />
                  <span>512KB Limit Enforcer (Telegram Spec)</span>
                </label>
              </div>
            </div>

            {/* Text & Title Customization */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-cyan-400" />
                <span>Text & Branding (টেক্সট ও ব্র্যান্ডিং)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Main Title (প্রধান নাম):
                  </label>
                  <input
                    type="text"
                    value={brandTitle}
                    onChange={(e) => setBrandTitle(e.target.value)}
                    placeholder="FluxLoad"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Subtitle (ট্যাগলাইন / সাবটাইটেল):
                  </label>
                  <input
                    type="text"
                    value={brandSubtitle}
                    onChange={(e) => setBrandSubtitle(e.target.value)}
                    placeholder="power by YEASIN"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Badge text */}
              <div className="flex items-center space-x-3 pt-1">
                <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBadge}
                    onChange={(e) => setShowBadge(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Show Badge:</span>
                </label>
                {showBadge && (
                  <div className="flex items-center gap-1.5">
                    {['PRO', '10GB', 'ULTRA', 'VIP', 'HD'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBadgeText(b)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                          badgeText === b
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={badgeText}
                      onChange={(e) => setBadgeText(e.target.value)}
                      className="w-16 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-[11px] text-amber-300 font-bold"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sticker Icon & Emoji Selector */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-amber-400" />
                  Sticker Symbol & Emoji (স্টিকার ইমোজি বা ছবি)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Telegram Tag: {selectedEmoji}</span>
              </h3>

              {/* Emoji quick pick */}
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setSelectedEmoji(emoji);
                      setUploadedImage(null);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer ${
                      selectedEmoji === emoji && !uploadedImage
                        ? 'bg-sky-500/30 border-2 border-sky-400 scale-110 shadow-md'
                        : 'bg-slate-900 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Or Use Image / Upload Custom Graphic */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUseFluxLogo}
                  className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Use FluxLoad Official Logo</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Custom Image</span>
                </button>

                {uploadedImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImage(null);
                      setUploadedImageSrc(null);
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto"
                  >
                    Clear Image
                  </button>
                )}
              </div>
            </div>

            {/* Sticker Contour Outline & Styling */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Sticker White Contour & Border (স্টিকার বর্ডার)
                </span>
                <span className="text-[10px] font-mono text-purple-300">
                  {stickerBorderWidth}px stroke
                </span>
              </h3>

              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={stickerBorderWidth}
                    onChange={(e) => setStickerBorderWidth(Number(e.target.value))}
                    className="flex-1 accent-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setStickerBorderWidth(12)}
                    className="text-[10px] text-sky-400 hover:underline"
                  >
                    Reset (12px)
                  </button>
                </div>

                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDropShadow}
                      onChange={(e) => setHasDropShadow(e.target.checked)}
                      className="rounded text-sky-500"
                    />
                    <span>Soft Drop Shadow (ছায়া এফেক্ট)</span>
                  </label>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Border Color:</span>
                    <input
                      type="color"
                      value={stickerBorderColor}
                      onChange={(e) => setStickerBorderColor(e.target.value)}
                      className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Background Theme Preset */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                <span>Background Canvas (ব্যাকগ্রাউন্ড)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {GRADIENT_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left truncate cursor-pointer flex items-center space-x-1.5 ${
                      theme === t.id
                        ? 'border-2 border-sky-400 bg-slate-800 text-sky-300 shadow-sm'
                        : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-600 flex-shrink-0"
                      style={{
                        background: t.id === 'transparent' ? '#ffffff' : t.border,
                      }}
                    />
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400 font-semibold">FluxLoad Community:</span>
            <a
              href="https://t.me/FluxLoad"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:underline font-mono"
            >
              https://t.me/FluxLoad
            </a>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
