import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BatchItem,
  BatchSettings,
  DownloadType,
  VideoQuality,
  VideoFormatChoice,
} from '../types';
import {
  Download,
  Trash2,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Film,
  Music,
  ArrowLeft,
  Settings2,
  HardDrive,
  ExternalLink,
  RotateCcw,
  Zap,
  CheckSquare,
  Square,
  FolderDown,
  XCircle,
  Cookie,
  Link2,
  Check,
  X,
  ClipboardPaste,
  FileDown,
  FileText,
  FileJson,
  ChevronDown,
  Copy,
  Archive,
  FileUp,
  ListPlus,
} from 'lucide-react';
import { downloadFileWithBlob } from '../lib/downloadHelper';

export interface BatchUrlValidationResult {
  original: string;
  isValid: boolean;
  normalizedUrl: string;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * Validates a single batch input string.
 * Checks for empty input, cookie/header dumps, local addresses, supported protocols (http/https),
 * valid hostname and structure, and duplicates against existing queue items.
 */
export const validateBatchUrl = (
  raw: string,
  existingUrls: Set<string>
): BatchUrlValidationResult => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { original: raw, isValid: false, normalizedUrl: '', error: 'Empty line' };
  }

  const lower = trimmed.toLowerCase();
  // Check for Netscape cookie file headers, curl.se, or tab-delimited cookie values
  if (
    trimmed.startsWith('#') ||
    lower.includes('curl.se') ||
    lower.includes('cookie_spec') ||
    trimmed.includes('\tTRUE\t') ||
    trimmed.includes('\tFALSE\t')
  ) {
    return {
      original: raw,
      isValid: false,
      normalizedUrl: '',
      error: 'Contains cookie/header data instead of a media URL',
    };
  }

  // Check for local addresses and disallowed protocols
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('192.168.') ||
    lower.includes('10.') ||
    lower.startsWith('file:') ||
    lower.startsWith('ftp:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:')
  ) {
    return {
      original: raw,
      isValid: false,
      normalizedUrl: '',
      error: 'Local or unsupported protocol (only http:// and https:// supported)',
    };
  }

  let candidate = trimmed;
  // If protocol missing, auto-prepend https:// if it has a plausible domain
  if (!/^https?:\/\//i.test(candidate)) {
    if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      return {
        original: raw,
        isValid: false,
        normalizedUrl: '',
        error: 'Missing http:// or https:// protocol',
      };
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        original: raw,
        isValid: false,
        normalizedUrl: '',
        error: 'Only http:// and https:// protocols are supported',
      };
    }

    if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) {
      return {
        original: raw,
        isValid: false,
        normalizedUrl: '',
        error: 'Missing or invalid domain name',
      };
    }

    // Hostname must be composed of valid characters
    const hostParts = parsed.hostname.split('.');
    if (hostParts.some((part) => !part || !/^[a-zA-Z0-9-]+$/.test(part))) {
      return {
        original: raw,
        isValid: false,
        normalizedUrl: '',
        error: 'Hostname contains invalid characters',
      };
    }

    const norm = parsed.href;
    const cleanNorm = norm.toLowerCase().replace(/\/$/, '');
    const isDuplicate =
      existingUrls.has(norm.toLowerCase()) || existingUrls.has(cleanNorm);

    return {
      original: raw,
      isValid: true,
      normalizedUrl: norm,
      isDuplicate,
    };
  } catch {
    return {
      original: raw,
      isValid: false,
      normalizedUrl: '',
      error: 'Malformed URL format',
    };
  }
};

interface BatchDownloadManagerProps {
  items: BatchItem[];
  onUpdateItem: (id: string, updates: Partial<BatchItem>) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onAddUrls: (urls: string[]) => void;
  onStartBatchDownload: (selectedIds: string[]) => void;
  onCancelItem: (id: string) => void;
  onCancelAll: () => void;
  onRetryItem: (id: string) => void;
  onResetToInput: () => void;
  onOpenSettings?: () => void;
  isDownloadingAny: boolean;
  batchSettings: BatchSettings;
  onUpdateBatchSettings: (settings: Partial<BatchSettings>) => void;
}

export const BatchDownloadManager: React.FC<BatchDownloadManagerProps> = ({
  items,
  onUpdateItem,
  onRemoveItem,
  onClearAll,
  onAddUrls,
  onStartBatchDownload,
  onCancelItem,
  onCancelAll,
  onRetryItem,
  onResetToInput,
  onOpenSettings,
  isDownloadingAny,
  batchSettings,
  onUpdateBatchSettings,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrlsText, setNewUrlsText] = useState('');
  const [globalType, setGlobalType] = useState<DownloadType>('video');
  const [globalQuality, setGlobalQuality] = useState<VideoQuality>('720p');
  const [globalFormat, setGlobalFormat] = useState<VideoFormatChoice>('mp4');
  const [downloadedFileIds, setDownloadedFileIds] = useState<Set<string>>(new Set());

  // Quick Add input state with immediate validation
  const [quickUrl, setQuickUrl] = useState('');
  const [quickUrlError, setQuickUrlError] = useState<string | null>(null);

  // Modal validation state & feedback banners
  const [modalError, setModalError] = useState<string | null>(null);
  const [validationBanner, setValidationBanner] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
    submessage?: string;
  } | null>(null);

  // Direct Multiple Download Textarea state on empty or quick input
  const [multipleDirectText, setMultipleDirectText] = useState('');
  const [multipleDirectError, setMultipleDirectError] = useState<string | null>(null);

  const directDetectedUrls = useMemo(() => {
    return multipleDirectText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && !u.startsWith('#') && !u.toLowerCase().includes('curl.se') && !u.toLowerCase().includes('cookie_spec') && (u.startsWith('http://') || u.startsWith('https://') || u.includes('.')));
  }, [multipleDirectText]);

  // Auto-remove completed setting (Default: OFF, persisted in localStorage)
  const [autoRemoveCompleted, setAutoRemoveCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fluxload_batch_auto_remove_completed') === 'true';
    } catch {
      return false;
    }
  });

  const removedCompletedIdsRef = useRef<Set<string>>(new Set());

  // Export queue state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // Export queue items as TXT or JSON
  const exportBatchQueue = (format: 'txt' | 'json', target: 'all' | 'selected' = 'all') => {
    const targetItems = target === 'selected' ? items.filter((i) => i.selected) : items;
    if (targetItems.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let blob: Blob;
    let filename: string;

    if (format === 'txt') {
      // Plain text with one URL per line
      const content = targetItems.map((item) => item.url).join('\n') + '\n';
      blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      filename = `fluxload_queue_${target === 'selected' ? 'selected_' : ''}${timestamp}.txt`;
    } else {
      // JSON format with structured metadata
      const data = {
        exportedAt: new Date().toISOString(),
        totalItems: targetItems.length,
        isPartialSelection: target === 'selected',
        urls: targetItems.map((item) => item.url),
        items: targetItems.map((item) => ({
          url: item.url,
          title: item.title || item.info?.title || null,
          type: item.type,
          quality: item.quality,
          format: item.format,
          status: item.status,
          duration: item.info?.duration || null,
          thumbnail: item.info?.thumbnail || null,
        })),
      };
      const content = JSON.stringify(data, null, 2);
      blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      filename = `fluxload_queue_${target === 'selected' ? 'selected_' : ''}${timestamp}.json`;
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    setValidationBanner({
      type: 'success',
      message: `Exported ${targetItems.length} ${targetItems.length === 1 ? 'URL' : 'URLs'} as ${format.toUpperCase()}`,
      submessage: `File saved as ${filename}`,
    });
    setShowExportMenu(false);
  };

  const handleCopyUrls = async (target: 'all' | 'selected' = 'all') => {
    const targetItems = target === 'selected' ? items.filter((i) => i.selected) : items;
    if (targetItems.length === 0) return;
    try {
      const text = targetItems.map((i) => i.url).join('\n');
      await navigator.clipboard.writeText(text);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2500);
      setValidationBanner({
        type: 'success',
        message: `Copied ${targetItems.length} URLs to clipboard`,
      });
      setShowExportMenu(false);
    } catch {
      // Clipboard fallback
    }
  };

  // Auto-dismiss validation banner after 6 seconds
  useEffect(() => {
    if (!validationBanner) return;
    const timer = setTimeout(() => {
      setValidationBanner(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [validationBanner]);

  // Set of existing queue URLs for fast duplicate detection
  const existingUrlSet = useMemo(() => {
    return new Set(items.map((i) => i.url.toLowerCase().replace(/\/$/, '')));
  }, [items]);

  // Real-time URL validation analysis for the Add Modal
  const modalValidationResults = useMemo(() => {
    if (!newUrlsText.trim()) return [];
    const lines = newUrlsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return lines.map((line) => validateBatchUrl(line, existingUrlSet));
  }, [newUrlsText, existingUrlSet]);

  const validEntries = modalValidationResults.filter((r) => r.isValid && !r.isDuplicate);
  const duplicateEntries = modalValidationResults.filter((r) => r.isValid && r.isDuplicate);
  const invalidEntries = modalValidationResults.filter((r) => !r.isValid);

  const selectedCount = items.filter((i) => i.selected).length;
  const completedCount = items.filter((i) => i.status === 'completed' || i.status === 'done').length;
  const downloadingCount = items.filter(
    (i) => i.status === 'downloading' || i.status === 'processing'
  ).length;
  const queuedCount = items.filter((i) => i.status === 'queued').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  const allSelected = items.length > 0 && selectedCount === items.length;

  // Calculate overall batch progress
  const totalItemsCount = items.length;
  const overallProgress =
    totalItemsCount === 0
      ? 0
      : items.reduce((acc, curr) => {
          if (curr.status === 'completed' || curr.status === 'done') return acc + 100;
          if (curr.status === 'downloading' || curr.status === 'processing') return acc + curr.progress;
          return acc;
        }, 0) / totalItemsCount;

  // Auto-download to browser when an item completes if enabled
  useEffect(() => {
    if (!batchSettings.autoTriggerBrowserDownload) return;

    items.forEach((item) => {
      const isDone = item.status === 'completed' || item.status === 'done';
      if (isDone && (item.downloadUrl || item.taskId) && !downloadedFileIds.has(item.id)) {
        triggerBrowserDownload(item);
        setDownloadedFileIds((prev) => new Set(prev).add(item.id));
      }
    });
  }, [items, batchSettings.autoTriggerBrowserDownload, downloadedFileIds]);

  // Auto-remove completed items from the list when enabled (does not delete file on PC)
  useEffect(() => {
    if (!autoRemoveCompleted) return;

    items.forEach((item) => {
      const isDone = item.status === 'completed' || item.status === 'done';
      if (isDone && !removedCompletedIdsRef.current.has(item.id)) {
        removedCompletedIdsRef.current.add(item.id);

        // Ensure browser download fires if not yet triggered
        if (!downloadedFileIds.has(item.id) && (item.downloadUrl || item.taskId)) {
          triggerBrowserDownload(item);
          setDownloadedFileIds((prev) => new Set(prev).add(item.id));
        }

        // Graceful delay so the user sees completion, then remove the item from the list UI
        setTimeout(() => {
          onRemoveItem(item.id);
        }, 1500);
      }
    });
  }, [items, autoRemoveCompleted, downloadedFileIds, onRemoveItem]);

  const triggerBrowserDownload = (item: BatchItem) => {
    if (!item.downloadUrl && !item.taskId) return;
    const url = item.downloadUrl || `/api/file/${item.taskId}`;
    const rawTitle = item.info?.title || item.title || item.filename || `media_${item.id}`;
    const cleanExt = (item.format || 'mp4').toLowerCase().replace(/^\./, '');
    const baseWithoutExt = rawTitle.replace(/\.(mp4|webm|mkv|mp3|m4a|wav|opus|ogg|flv|avi|mov)$/i, '');
    const safeTitle = baseWithoutExt
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/["'`;]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\.{2,}/g, '.')
      .replace(/^[\s_.-]+|[\s_.-]+$/g, '')
      .trim()
      .slice(0, 100);
    const finalName = `${safeTitle || 'media'}.${cleanExt}`;
    const fullUrl = url.includes('?') ? `${url}&filename=${encodeURIComponent(finalName)}` : `${url}?filename=${encodeURIComponent(finalName)}`;
    downloadFileWithBlob(fullUrl, finalName).catch((err) => {
      console.error('Batch download file error:', err);
    });
  };

  const handleDownloadAllCompleted = () => {
    items
      .filter((i) => i.status === 'completed')
      .forEach((item, index) => {
        setTimeout(() => {
          triggerBrowserDownload(item);
        }, index * 400);
      });
  };

  const [isZipping, setIsZipping] = useState(false);
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadAllAsZip = async () => {
    const completedTasks = items.filter(
      (i) => (i.status === 'completed' || i.status === 'done') && i.taskId
    );
    if (completedTasks.length === 0) return;

    setIsZipping(true);
    try {
      const taskIds = completedTasks.map((i) => i.taskId!);
      const response = await fetch('/api/batch-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to create ZIP package');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FluxLoad_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('ZIP creation error:', err);
      // Fallback to sequential individual downloads
      handleDownloadAllCompleted();
    } finally {
      setIsZipping(false);
    }
  };

  const handleImportQueueFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        let urlsToProcess: string[] = [];
        if (file.name.endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              urlsToProcess = parsed
                .map((it: any) => (typeof it === 'string' ? it : it.url))
                .filter(Boolean);
            } else if (parsed && Array.isArray(parsed.items)) {
              urlsToProcess = parsed.items.map((it: any) => it.url).filter(Boolean);
            }
          } catch {}
        }

        if (urlsToProcess.length === 0) {
          urlsToProcess = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#'));
        }

        if (urlsToProcess.length > 0) {
          const results = urlsToProcess.map((u) => validateBatchUrl(u, existingUrlSet));
          const validNonDups = results
            .filter((r) => r.isValid && !r.isDuplicate)
            .map((r) => r.normalizedUrl);

          if (validNonDups.length > 0) {
            onAddUrls(validNonDups);
            setValidationBanner({
              type: 'success',
              message: `Imported ${validNonDups.length} URL(s) from ${file.name} to the queue.`,
            });
          } else {
            setValidationBanner({
              type: 'warning',
              message: 'No new unique URLs found to import from file.',
            });
          }
        }
      } catch (err) {
        console.error('Failed to import file:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleSelectAll = () => {
    const nextState = !allSelected;
    items.forEach((item) => {
      if (item.status !== 'downloading' && item.status !== 'processing') {
        onUpdateItem(item.id, { selected: nextState });
      }
    });
  };

  const handleApplyGlobalSettings = () => {
    items.forEach((item) => {
      if (item.status === 'ready' || item.status === 'pending_analysis' || item.status === 'error') {
        onUpdateItem(item.id, {
          type: globalType,
          quality: globalQuality,
          format: globalFormat,
        });
      }
    });
  };

  const handleKeepOnlyValidUrls = () => {
    const validLines = modalValidationResults
      .filter((r) => r.isValid && !r.isDuplicate)
      .map((r) => r.normalizedUrl)
      .join('\n');
    setNewUrlsText(validLines);
    setModalError(null);
  };

  const handlePasteQuickAdd = async () => {
    setQuickUrlError(null);
    let text = '';
    const isMobileDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setQuickUrlError(
        isMobileDevice
          ? 'ক্লিপবোর্ড অ্যাক্সেস করতে বক্সে চেপে ধরে (Long Press) "Paste" করুন।'
          : 'Unable to access clipboard automatically. Please press Ctrl+V to paste.'
      );
      return;
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      setQuickUrlError('Clipboard is empty. Please copy a media URL first.');
      return;
    }

    // Check if multiple URLs were pasted
    if (trimmed.includes('\n')) {
      const lines = trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const results = lines.map((line) => validateBatchUrl(line, existingUrlSet));
      const validUrls = results
        .filter((r) => r.isValid && !r.isDuplicate)
        .map((r) => r.normalizedUrl);
      if (validUrls.length > 0) {
        onAddUrls(validUrls);
        setQuickUrl('');
        setValidationBanner({
          type: 'success',
          message: `Added ${validUrls.length} validated URL(s) from clipboard to the batch queue.`,
        });
        return;
      }
    }

    setQuickUrl(trimmed);
    // Strict URL validation step for quick add input
    const result = validateBatchUrl(trimmed, existingUrlSet);
    if (!result.isValid) {
      setQuickUrlError(result.error || 'Invalid media URL. Please provide a valid http:// or https:// address.');
      return;
    }

    if (result.isDuplicate) {
      setQuickUrlError('This media URL is already present in your batch queue.');
      return;
    }

    // Automatically trigger validation and adding/analysis sequence
    onAddUrls([result.normalizedUrl]);
    setQuickUrl('');
    setValidationBanner({
      type: 'success',
      message: 'Validated and added 1 media URL from clipboard to the queue.',
    });
  };

  const handlePasteModalUrls = async () => {
    setModalError(null);
    let text = '';
    const isMobileDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setModalError(
        isMobileDevice
          ? 'ক্লিপবোর্ড থেকে পেস্ট করতে বক্সে আঙুল দিয়ে চেপে ধরে (Long Press) "Paste" চাপুন।'
          : 'Unable to access clipboard automatically. Please paste using Ctrl+V or Cmd+V.'
      );
      return;
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      setModalError('Clipboard is empty. Please copy URLs first.');
      return;
    }

    setNewUrlsText(trimmed);

    // Validate all URLs and auto-trigger if valid URLs exist
    const rawLines = trimmed
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    const results = rawLines.map((line) => validateBatchUrl(line, existingUrlSet));
    const nonDuplicates = results.filter((r) => r.isValid && !r.isDuplicate);
    const invalidList = results.filter((r) => !r.isValid);

    if (nonDuplicates.length > 0) {
      const urlsToAdd = nonDuplicates.map((v) => v.normalizedUrl);
      onAddUrls(urlsToAdd);
      setNewUrlsText('');
      setModalError(null);
      setShowAddModal(false);

      if (invalidList.length > 0) {
        setValidationBanner({
          type: 'warning',
          message: `Added ${urlsToAdd.length} valid URL(s) from clipboard to batch queue.`,
          submessage: `${invalidList.length} invalid line(s) skipped.`,
        });
      } else {
        setValidationBanner({
          type: 'success',
          message: `Added ${urlsToAdd.length} verified URL(s) from clipboard to batch queue.`,
        });
      }
    } else if (results.every((r) => r.isDuplicate)) {
      setModalError('All pasted URLs are already present in your queue.');
    } else {
      setModalError('No valid media URLs found in clipboard. Please check the URLs.');
    }
  };

  const handlePasteDirectMultiple = async () => {
    setMultipleDirectError(null);
    let text = '';
    const isMobileDevice = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setMultipleDirectError(
        isMobileDevice
          ? 'ক্লিপবোর্ড থেকে পেস্ট করতে বক্সে আঙুল দিয়ে চেপে ধরে "Paste" চাপুন।'
          : 'Unable to access clipboard automatically. Please paste using Ctrl+V or Cmd+V.'
      );
      return;
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      setMultipleDirectError('Clipboard is empty. Please copy video links first.');
      return;
    }
    setMultipleDirectText(trimmed);
  };

  const handleDirectMultipleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMultipleDirectError(null);
    const rawLines = multipleDirectText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (rawLines.length === 0) {
      setMultipleDirectError('Please enter or paste at least one video URL.');
      return;
    }

    const results = rawLines.map((line) => validateBatchUrl(line, existingUrlSet));
    const validList = results.filter((r) => r.isValid);
    const nonDuplicates = validList.filter((r) => !r.isDuplicate);

    if (validList.length === 0) {
      setMultipleDirectError('None of the lines are valid media URLs. Ensure URLs start with http:// or https://');
      return;
    }

    if (nonDuplicates.length === 0) {
      setMultipleDirectError('All entered URLs are already in your queue.');
      return;
    }

    const urlsToAdd = nonDuplicates.map((v) => v.normalizedUrl);
    onAddUrls(urlsToAdd);
    setMultipleDirectText('');
    setValidationBanner({
      type: 'success',
      message: `Added ${urlsToAdd.length} video(s) to the download queue! Click Start Batch Download to begin.`,
    });
  };

  const handleLoadSampleLinks = () => {
    const samples = [
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      'https://www.instagram.com/reel/Dd75uqqymQs/',
      'https://www.tiktok.com/@tiktok/video/7106594312292453678',
    ];
    setMultipleDirectText(samples.join('\n'));
    setMultipleDirectError(null);
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickUrlError(null);
    const trimmed = quickUrl.trim();
    if (!trimmed) return;

    // Strict URL validation step for quick add input
    const result = validateBatchUrl(trimmed, existingUrlSet);
    if (!result.isValid) {
      setQuickUrlError(result.error || 'Invalid media URL. Please provide a valid http:// or https:// address.');
      return;
    }

    if (result.isDuplicate) {
      setQuickUrlError('This media URL is already present in your batch queue.');
      return;
    }

    onAddUrls([result.normalizedUrl]);
    setQuickUrl('');
    setValidationBanner({
      type: 'success',
      message: 'Added 1 validated URL to the batch queue.',
    });
  };

  const handleAddMoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const rawLines = newUrlsText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (rawLines.length === 0) {
      setModalError('Please enter or paste at least one URL.');
      return;
    }

    // Strict URL validation step: validate all input strings
    const results = rawLines.map((line) => validateBatchUrl(line, existingUrlSet));
    const validList = results.filter((r) => r.isValid);
    const nonDuplicates = validList.filter((r) => !r.isDuplicate);
    const invalidList = results.filter((r) => !r.isValid);

    // If none of the input strings are valid URLs, reject and notify user
    if (validList.length === 0) {
      setModalError(
        `Validation failed: None of the ${rawLines.length} entered lines are valid media URLs. Please check for typos and ensure URLs use http:// or https://.`
      );
      return;
    }

    // If all valid URLs are already queued duplicates
    if (nonDuplicates.length === 0) {
      setModalError(
        `All ${validList.length} entered valid URL(s) are already in your download queue.`
      );
      return;
    }

    // Only add verified, valid, non-duplicate URLs to the batch list
    const urlsToAdd = nonDuplicates.map((v) => v.normalizedUrl);
    onAddUrls(urlsToAdd);
    setNewUrlsText('');
    setModalError(null);
    setShowAddModal(false);

    // Provide immediate informative notification banner
    if (invalidList.length > 0 || duplicateEntries.length > 0) {
      const parts: string[] = [];
      if (invalidList.length > 0) parts.push(`${invalidList.length} invalid line(s) skipped`);
      if (duplicateEntries.length > 0) parts.push(`${duplicateEntries.length} duplicate(s) skipped`);
      setValidationBanner({
        type: 'warning',
        message: `Added ${urlsToAdd.length} valid URL(s) to the batch queue.`,
        submessage: parts.join(' and ') + '.',
      });
    } else {
      setValidationBanner({
        type: 'success',
        message: `Added ${urlsToAdd.length} verified URL(s) to the batch queue.`,
      });
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) {
      return `${hrs}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlatformBadge = (url: string) => {
    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (host.includes('youtube') || host.includes('youtu.be')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-semibold border border-red-500/30">YouTube</span>;
      }
      if (host.includes('tiktok')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-500/20 text-pink-400 font-semibold border border-pink-500/30">TikTok</span>;
      }
      if (host.includes('instagram')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30">Instagram</span>;
      }
      if (host.includes('facebook') || host.includes('fb.')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">Facebook</span>;
      }
      if (host.includes('xhamster') || host.includes('xnxx') || host.includes('pornhub')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">Web Video</span>;
      }
      if (host.includes('twitter') || host.includes('x.com')) {
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30">X / Twitter</span>;
      }
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-300 font-semibold">{u.hostname.replace('www.', '')}</span>;
    } catch {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700/50 text-slate-300 font-semibold">Web Link</span>;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <button
              onClick={onResetToInput}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50"
              title="Add more URLs or go back"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Input</span>
            </button>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Multiple Download Queue</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                  {items.length} {items.length === 1 ? 'Media' : 'Medias'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700/50 hidden sm:inline">
                  Unlimited Size (2000GB+)
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => {
                setShowAddModal(true);
                setModalError(null);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title="Add one or multiple URLs with live validation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add URLs</span>
            </button>
            {completedCount > 0 && (
              <>
                <button
                  onClick={handleDownloadAllCompleted}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-emerald-600/20"
                  title="Save all completed files individually to disk"
                >
                  <FolderDown className="w-3.5 h-3.5" />
                  <span>Save All ({completedCount})</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllAsZip}
                  disabled={isZipping}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-cyan-600/25 cursor-pointer disabled:opacity-50"
                  title="Pack and download all completed files into a single ZIP archive"
                >
                  <Archive className={`w-3.5 h-3.5 ${isZipping ? 'animate-spin' : ''}`} />
                  <span>{isZipping ? 'Zipping...' : `Download as ZIP (${completedCount})`}</span>
                </button>
              </>
            )}

            {/* Import Queue from File */}
            <input
              type="file"
              ref={fileImportInputRef}
              onChange={handleImportQueueFile}
              accept=".json,.txt"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileImportInputRef.current?.click()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              title="Import saved URLs from .json or .txt file"
            >
              <FileUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Import</span>
            </button>

            {/* Export Queue Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((prev) => !prev)}
                disabled={items.length === 0}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Export list of URLs in the queue as JSON or TXT file for later use"
              >
                <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Queue</span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${
                    showExportMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 py-1.5 animate-fadeIn">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                    <span>Export {items.length} {items.length === 1 ? 'URL' : 'URLs'}</span>
                    <span className="font-mono text-[9px] text-cyan-400">Save for Later</span>
                  </div>

                  {/* Export as TXT */}
                  <button
                    type="button"
                    onClick={() => exportBatchQueue('txt', 'all')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-cyan-300 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>Export as TXT (.txt)</span>
                        <span className="text-[10px] px-1 rounded bg-cyan-500/15 text-cyan-300 font-mono">TXT</span>
                      </div>
                      <div className="text-[10px] text-slate-400">One URL per line, import-ready</div>
                    </div>
                  </button>

                  {/* Export as JSON */}
                  <button
                    type="button"
                    onClick={() => exportBatchQueue('json', 'all')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-amber-300 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <FileJson className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>Export as JSON (.json)</span>
                        <span className="text-[10px] px-1 rounded bg-amber-500/15 text-amber-300 font-mono">JSON</span>
                      </div>
                      <div className="text-[10px] text-slate-400">Complete queue with quality/format</div>
                    </div>
                  </button>

                  {/* Partial Selected Export (if active subset selected) */}
                  {selectedCount > 0 && selectedCount < items.length && (
                    <>
                      <div className="border-t border-slate-800 my-1" />
                      <div className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        Selected Subset ({selectedCount})
                      </div>
                      <button
                        type="button"
                        onClick={() => exportBatchQueue('txt', 'selected')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-cyan-300 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[11px]">Selected as TXT ({selectedCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportBatchQueue('json', 'selected')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-300 flex items-center space-x-2 transition-colors cursor-pointer"
                      >
                        <FileJson className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[11px]">Selected as JSON ({selectedCount})</span>
                      </button>
                    </>
                  )}

                  <div className="border-t border-slate-800 my-1" />

                  {/* Copy to Clipboard */}
                  <button
                    type="button"
                    onClick={() => handleCopyUrls('all')}
                    className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 hover:text-purple-300 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    {exportCopied ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-4 h-4 text-purple-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-200">
                        {exportCopied ? 'Copied to Clipboard!' : 'Copy URLs to Clipboard'}
                      </div>
                      <div className="text-[10px] text-slate-400">Newline-delimited raw URLs</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClearAll}
              disabled={isDownloadingAny}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 disabled:opacity-40 transition-colors"
              title="Clear queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Validation Result Notification Banner */}
        {validationBanner && (
          <div
            className={`mt-4 p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-all ${
              validationBanner.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {validationBanner.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">{validationBanner.message}</p>
                {validationBanner.submessage && (
                  <p className="text-[11px] opacity-80 mt-0.5">{validationBanner.submessage}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setValidationBanner(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Add URL with Instant Validation */}
        <form onSubmit={handleQuickAdd} className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Link2 className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <input
                type="text"
                value={quickUrl}
                onChange={(e) => {
                  setQuickUrl(e.target.value);
                  if (quickUrlError) setQuickUrlError(null);
                }}
                placeholder="Quick add: paste a media URL (YouTube, TikTok, Instagram, X...) to validate & queue"
                className={`w-full pl-9 pr-8 py-2 bg-slate-950/90 rounded-xl text-xs text-slate-200 placeholder-slate-500 border focus:outline-none transition-colors font-mono ${
                  quickUrlError
                    ? 'border-rose-500/60 focus:ring-1 focus:ring-rose-500/50'
                    : 'border-slate-800 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30'
                }`}
              />
              {quickUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickUrl('');
                    setQuickUrlError(null);
                  }}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handlePasteQuickAdd}
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-sm whitespace-nowrap active:scale-95 cursor-pointer"
              title="Paste from Clipboard & automatically validate and add to queue"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Paste from Clipboard</span>
            </button>
            <button
              type="submit"
              disabled={!quickUrl.trim()}
              className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm shadow-cyan-600/20 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Validate & Add</span>
            </button>
          </div>
          {quickUrlError && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{quickUrlError}</span>
            </div>
          )}
        </form>

        {/* Global Progress Bar (if downloading or completed) */}
        {(isDownloadingAny || completedCount > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-300 font-medium">
                {isDownloadingAny ? (
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Downloading Batch ({downloadingCount} active, {queuedCount} queued)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Batch Completed ({completedCount}/{totalItemsCount})</span>
                  </span>
                )}
              </div>
              <span className="font-mono text-cyan-400 font-bold">{overallProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.max(2, overallProgress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Bulk Preset Controls & Action Bar */}
        <div className="mt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-4 border-t border-slate-800/60 text-xs">
          {/* Left: Selection and Bulk Set */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center space-x-1.5 text-slate-300 hover:text-slate-100 font-medium bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-cyan-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
            </button>

            <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400">Set All:</span>
              <select
                value={globalQuality}
                onChange={(e) => setGlobalQuality(e.target.value as VideoQuality)}
                className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="auto" className="bg-slate-900 text-slate-200">Auto (Best)</option>
                <option value="4k" className="bg-slate-900 text-slate-200">4K Ultra HD</option>
                <option value="1080p" className="bg-slate-900 text-slate-200">1080p HD</option>
                <option value="720p" className="bg-slate-900 text-slate-200">720p HD</option>
                <option value="480p" className="bg-slate-900 text-slate-200">480p</option>
                <option value="360p" className="bg-slate-900 text-slate-200">360p</option>
              </select>
              <select
                value={globalFormat}
                onChange={(e) => {
                  const val = e.target.value as VideoFormatChoice;
                  setGlobalFormat(val);
                  if (val === 'mp3' || val === 'm4a') {
                    setGlobalType('audio');
                  } else {
                    setGlobalType('video');
                  }
                }}
                className="bg-transparent text-blue-300 font-semibold focus:outline-none cursor-pointer uppercase"
              >
                <option value="mp4" className="bg-slate-900 text-slate-200">MP4</option>
                <option value="webm" className="bg-slate-900 text-slate-200">WEBM</option>
                <option value="mp3" className="bg-slate-900 text-slate-200">MP3 (Audio)</option>
                <option value="m4a" className="bg-slate-900 text-slate-200">M4A (Audio)</option>
              </select>
              <button
                onClick={handleApplyGlobalSettings}
                className="text-cyan-400 hover:text-cyan-300 font-semibold ml-1 px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Right: Parallel Setting & Batch Start Button */}
          <div className="flex items-center flex-wrap gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center space-x-2 text-slate-400">
              <label className="flex items-center space-x-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={batchSettings.autoTriggerBrowserDownload}
                  onChange={(e) =>
                    onUpdateBatchSettings({ autoTriggerBrowserDownload: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30"
                />
                <span className="text-[11px] text-slate-300">Auto-save to disk</span>
              </label>

              <div className="h-3 w-px bg-slate-800 mx-1" />

              <label className="flex items-center space-x-1.5 cursor-pointer select-none" title="Automatically remove completed items from the list. Downloaded files are not deleted from your PC.">
                <input
                  type="checkbox"
                  checked={autoRemoveCompleted}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAutoRemoveCompleted(val);
                    try {
                      localStorage.setItem('fluxload_batch_auto_remove_completed', String(val));
                    } catch {}
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="text-[11px] text-slate-300">Auto-remove completed</span>
              </label>

              <div className="h-3 w-px bg-slate-800 mx-1" />

              {/* 1 Video 1 Download quick toggle */}
              <button
                type="button"
                onClick={() =>
                  onUpdateBatchSettings({ concurrency: batchSettings.concurrency === 1 ? 2 : 1 })
                }
                className={`px-2 py-1 rounded-lg border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                  batchSettings.concurrency === 1
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title="1 Video 1 Download: Download videos sequentially one at a time"
              >
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>1 Video 1 Download {batchSettings.concurrency === 1 ? '✓' : ''}</span>
              </button>

              <div className="flex items-center space-x-1 text-[11px]">
                <select
                  value={batchSettings.concurrency}
                  onChange={(e) =>
                    onUpdateBatchSettings({ concurrency: parseInt(e.target.value, 10) })
                  }
                  className="bg-slate-800 text-slate-200 rounded px-1.5 py-1 border border-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  title="Select download concurrency"
                >
                  <option value={1}>1 at a time (1 Video 1 Download)</option>
                  <option value={2}>2 at a time</option>
                  <option value={3}>3 at a time</option>
                  <option value={5}>5 at a time (Max)</option>
                </select>
              </div>
            </div>

            {isDownloadingAny ? (
              <button
                onClick={onCancelAll}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold rounded-xl transition-all flex items-center space-x-1.5 shadow-sm text-xs"
              >
                <XCircle className="w-4 h-4" />
                <span>Cancel All</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const toDownload = items.filter((i) => i.selected).map((i) => i.id);
                  onStartBatchDownload(toDownload);
                }}
                disabled={selectedCount === 0}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Batch Download ({selectedCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items List or Empty State */}
      {items.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg shadow-cyan-500/10">
              <ListPlus className="w-7 h-7" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-100">
              Multiple Video Download (একাধিক ভিডিও একসাথে ডাউনলোড)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              একসাথে যত খুশি ভিডিও লিংক পেস্ট করে এক ক্লিকে ডাউনলোড করুন (YouTube, Facebook, Instagram, TikTok, Twitter/X ইত্যাদি)।
            </p>
          </div>

          {/* Big Multi-line Textarea */}
          <form onSubmit={handleDirectMultipleSubmit} className="space-y-4 max-w-2xl mx-auto text-left">
            <div className="relative">
              <textarea
                value={multipleDirectText}
                onChange={(e) => {
                  setMultipleDirectText(e.target.value);
                  if (multipleDirectError) setMultipleDirectError(null);
                }}
                placeholder={`Paste multiple video URLs here (one URL per line)...\nhttps://www.youtube.com/watch?v=...\nhttps://www.instagram.com/reel/...\nhttps://www.tiktok.com/@...\nhttps://www.facebook.com/...`}
                rows={5}
                required
                className="w-full p-4 pb-14 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-xs sm:text-sm transition-all shadow-inner font-mono resize-y"
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                    {directDetectedUrls.length} {directDetectedUrls.length === 1 ? 'URL' : 'URLs'} detected
                  </span>
                  <button
                    type="button"
                    onClick={handleLoadSampleLinks}
                    className="text-[11px] text-slate-400 hover:text-cyan-300 underline decoration-slate-600 cursor-pointer hidden sm:inline"
                  >
                    Load samples
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  {multipleDirectText && (
                    <button
                      type="button"
                      onClick={() => setMultipleDirectText('')}
                      className="p-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
                      title="Clear"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePasteDirectMultiple}
                    className="px-3.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-xl transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Paste from Clipboard</span>
                  </button>
                </div>
              </div>
            </div>

            {multipleDirectError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 pl-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{multipleDirectError}</span>
              </p>
            )}

            {/* Presets and Concurrency Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Download Type</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setGlobalType('video')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      globalType === 'video' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalType('audio')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      globalType === 'audio' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Audio (MP3)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Video Quality</label>
                <select
                  value={globalQuality}
                  onChange={(e) => setGlobalQuality(e.target.value as VideoQuality)}
                  disabled={globalType === 'audio'}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                >
                  <option value="auto">Auto / Best Available</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p (Standard)</option>
                  <option value="best">Best Quality</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Concurrency (একসাথে কয়টি)</label>
                <select
                  value={batchSettings.concurrency}
                  onChange={(e) => onUpdateBatchSettings({ concurrency: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>1 Video 1 Save (১টি করে পর্যায়ক্রমে)</option>
                  <option value={2}>2 Videos at a time (২টি একসাথে)</option>
                  <option value={3}>3 Videos at a time (৩টি একসাথে)</option>
                  <option value={5}>5 Videos at a time (৫টি একসাথে)</option>
                </select>
              </div>
            </div>

            {/* Start Multiple Download Button */}
            <button
              type="submit"
              disabled={directDetectedUrls.length === 0}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 text-sm sm:text-base cursor-pointer tracking-wide"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>⚡ Start Multiple Download / সব ভিডিও একসাথে কিউতে যোগ করুন ({directDetectedUrls.length})</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
          const isItemDownloading = item.status === 'downloading' || item.status === 'processing';
          const isItemCompleted = item.status === 'completed';
          const isItemError = item.status === 'error';
          const isItemQueued = item.status === 'queued';
          const isAnalyzing = item.status === 'analyzing';

          return (
            <div
              key={item.id}
              className={`bg-slate-900/80 border rounded-xl p-4 transition-all backdrop-blur-md relative overflow-hidden ${
                isItemDownloading
                  ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10 bg-slate-900'
                  : isItemCompleted
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : isItemError
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Select Checkbox & Index */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isItemDownloading) {
                        onUpdateItem(item.id, { selected: !item.selected });
                      }
                    }}
                    disabled={isItemDownloading}
                    className="text-slate-400 hover:text-cyan-400 disabled:opacity-50"
                  >
                    {item.selected ? (
                      <CheckSquare className="w-5 h-5 text-cyan-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  <span className="text-xs font-mono text-slate-500 w-5">#{index + 1}</span>
                </div>

                {/* Thumbnail / Platform */}
                <div className="w-24 h-16 shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-800 relative shadow-sm">
                  {item.info?.thumbnail ? (
                    <img
                      src={item.info.thumbnail}
                      alt={item.info.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      {item.type === 'audio' ? <Music className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                    </div>
                  )}
                  {item.info?.duration ? (
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-slate-200">
                      {formatDuration(item.info.duration)}
                    </div>
                  ) : null}
                </div>

                {/* Title and Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getPlatformBadge(item.url)}
                    <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                      {item.info?.uploader || 'Media Stream'}
                    </span>
                  </div>

                  <h4
                    className="text-sm font-semibold text-slate-100 truncate mb-1"
                    title={item.info?.title || item.url}
                  >
                    {item.info?.title || item.url}
                  </h4>

                  {/* Format & Quality Pickers (when ready) or Status Bar (when downloading/completed) */}
                  {isItemDownloading || isItemQueued || isItemCompleted || isItemError ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          {isItemDownloading && (
                            <span className="text-cyan-400 font-medium flex items-center gap-1 text-[11px]">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Downloading ({item.speed})</span>
                            </span>
                          )}
                          {isItemQueued && (
                            <span className="text-amber-400 font-medium flex items-center gap-1.5 text-[11px]">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>
                                {batchSettings.concurrency === 1
                                  ? `Queued (#${items.filter((i) => i.status === 'queued').findIndex((i) => i.id === item.id) + 1}) • Waiting for previous video...`
                                  : `Queued (#${items.filter((i) => i.status === 'queued').findIndex((i) => i.id === item.id) + 1}) in batch`}
                              </span>
                            </span>
                          )}
                          {isItemCompleted && (
                            <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Completed ({item.downloadedSize || item.totalSize})</span>
                            </span>
                          )}
                          {isItemError && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-rose-400 font-medium flex items-center gap-1 text-[11px]">
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                <span>{item.error || 'Failed'}</span>
                              </span>
                              <div className="flex items-center gap-2">
                                {(item.error?.toLowerCase().includes('cookie') ||
                                  item.error?.toLowerCase().includes('bot') ||
                                  item.error?.toLowerCase().includes('sign in') ||
                                  item.error?.toLowerCase().includes('instagram') ||
                                  item.error?.toLowerCase().includes('youtube')) && onOpenSettings && (
                                  <button
                                    type="button"
                                    onClick={onOpenSettings}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                  >
                                    <Cookie className="w-3 h-3" />
                                    <span>Add Site Cookies</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onRetryItem(item.id)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {isItemDownloading && (
                          <div className="text-[11px] font-mono text-slate-400">
                            {item.downloadedSize} / {item.totalSize} • {item.progress.toFixed(0)}%
                          </div>
                        )}
                      </div>

                      {isItemDownloading && (
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-cyan-500 rounded-full transition-all duration-200"
                            style={{ width: `${Math.max(2, item.progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center flex-wrap gap-2 text-xs">
                      {/* Quality selector: strictly only shows qualities that exist for this video */}
                      {item.type === 'video' ? (
                        <select
                          value={item.quality}
                          onChange={(e) =>
                            onUpdateItem(item.id, { quality: e.target.value as VideoQuality })
                          }
                          className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-cyan-500"
                        >
                          {(() => {
                            const allQualities: { id: VideoQuality; label: string }[] = [
                              { id: 'auto', label: 'Auto (Best / সেরা)' },
                              { id: '4k', label: '4K Ultra HD' },
                              { id: '1440p', label: '2K (1440p)' },
                              { id: '1080p', label: '1080p Full HD' },
                              { id: '720p', label: '720p HD' },
                              { id: '480p', label: '480p SD' },
                              { id: '360p', label: '360p Low' },
                              { id: '240p', label: '240p Low' },
                              { id: '144p', label: '144p Tiny' },
                            ];
                            const allowed = item.info?.availableQualities && item.info.availableQualities.length > 0
                              ? new Set(item.info.availableQualities)
                              : new Set(['auto', '1080p', '720p']);
                            return allQualities
                              .filter((q) => allowed.has(q.id))
                              .map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.label}
                                </option>
                              ));
                          })()}
                        </select>
                      ) : null}

                      {/* Format Selector */}
                      <select
                        value={item.format}
                        onChange={(e) => {
                          const val = e.target.value as VideoFormatChoice;
                          onUpdateItem(item.id, {
                            format: val,
                            type: val === 'mp3' || val === 'm4a' ? 'audio' : 'video',
                          });
                        }}
                        className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs uppercase focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="mp4">MP4 (Video)</option>
                        <option value="webm">WEBM (Video)</option>
                        <option value="mp3">MP3 (Audio)</option>
                        <option value="m4a">M4A (Audio)</option>
                      </select>

                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.format.toUpperCase()} • {item.quality}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  {isItemCompleted && (
                    <button
                      onClick={() => triggerBrowserDownload(item)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 shadow-md shadow-emerald-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save File</span>
                    </button>
                  )}

                  {isItemError && (
                    <button
                      onClick={() => onRetryItem(item.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}

                  {(isItemDownloading || isItemQueued) && (
                    <button
                      onClick={() => onCancelItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700"
                      title={isItemQueued ? "Remove from queue" : "Cancel download"}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}

                  {!isItemDownloading && !isItemQueued && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove from list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Modal to Add More URLs with Real-Time URL Validation */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>Add URLs to Batch Queue</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Input strings are verified for valid HTTP/HTTPS protocol, domain structure, and queue uniqueness.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePasteModalUrls}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                  title="Paste URLs from Clipboard & automatically validate and queue"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Paste from Clipboard</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setModalError(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleAddMoreSubmit} className="space-y-4 flex-1 flex flex-col min-h-0 overflow-y-auto pr-1">
              <div className="relative">
                <textarea
                  value={newUrlsText}
                  onChange={(e) => {
                    setNewUrlsText(e.target.value);
                    if (modalError) setModalError(null);
                  }}
                  placeholder="Paste URLs here (one per line)...&#10;https://www.youtube.com/watch?v=...&#10;https://www.tiktok.com/@...&#10;https://instagram.com/reel/..."
                  rows={6}
                  required
                  className={`w-full p-3 bg-slate-950 border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 font-mono transition-colors ${
                    modalError
                      ? 'border-rose-500/60 focus:ring-rose-500/40'
                      : 'border-slate-700 focus:ring-cyan-500/50'
                  }`}
                />
              </div>

              {/* Live URL Validation Status */}
              {newUrlsText.trim().length > 0 && (
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-slate-400 font-medium">URL Validation Breakdown:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{validEntries.length} Valid</span>
                      </span>

                      {duplicateEntries.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1" title="Already in your batch queue">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>{duplicateEntries.length} In Queue</span>
                        </span>
                      )}

                      {invalidEntries.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-400" />
                          <span>{invalidEntries.length} Invalid</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Invalid Strings Warning & Action */}
                  {invalidEntries.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/25 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-rose-300 font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{invalidEntries.length} string(s) failed URL validation</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleKeepOnlyValidUrls}
                          className="px-2 py-0.5 rounded bg-rose-900/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-200 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Remove Invalid
                        </button>
                      </div>

                      <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px]">
                        {invalidEntries.slice(0, 5).map((inv, idx) => (
                          <div key={idx} className="text-rose-400/90 flex items-start gap-1">
                            <span className="text-rose-500">•</span>
                            <span className="truncate max-w-[180px] text-slate-300">"{inv.original}"</span>
                            <span className="text-rose-400/70 truncate">— {inv.error}</span>
                          </div>
                        ))}
                        {invalidEntries.length > 5 && (
                          <p className="text-[10px] text-slate-500">
                            + {invalidEntries.length - 5} more invalid strings
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Error Message */}
              {modalError && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{modalError}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800/80 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setModalError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validEntries.length === 0 && newUrlsText.trim().length > 0}
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 rounded-lg shadow-md shadow-cyan-600/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {validEntries.length > 0
                      ? `Add ${validEntries.length} URL${validEntries.length === 1 ? '' : 's'} to Queue`
                      : 'Add to Queue'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
