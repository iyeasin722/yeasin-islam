/**
 * Bulletproof media downloader for AI Studio Cloud Run preview environments.
 * Prevents Google Cloud Run proxy from intercepting <a href> clicks with __cookie_check.html (10.1 KB).
 * Uses authenticated client-side fetch + Blob streaming.
 */

export interface DownloadProgressCallback {
  (progress: {
    loaded: number;
    total: number;
    percent: number;
    loadedFormatted: string;
    totalFormatted: string;
  }): void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// In-flight and recent download lock to guarantee 1 video = 1 save, never 2 times (1 video 1 save 2bar na)
const ongoingDownloads = new Set<string>();
const recentCompletedDownloads = new Map<string, number>();

export async function downloadFileWithBlob(
  url: string,
  suggestedFilename: string,
  onProgress?: DownloadProgressCallback,
  force: boolean = false
): Promise<void> {
  // Normalize keys to prevent duplicate saves across slightly different sanitizations or URLs
  const fileKey = suggestedFilename.toLowerCase().replace(/[^a-z0-9]/g, '');
  const urlKey = url.toLowerCase().split('?')[0].trim();
  const now = Date.now();

  if (!force) {
    if (ongoingDownloads.has(fileKey) || ongoingDownloads.has(urlKey)) {
      console.log(`[downloadFileWithBlob] Blocked duplicate in-flight save for: ${suggestedFilename}`);
      return;
    }
    const lastSavedFile = recentCompletedDownloads.get(fileKey) || 0;
    const lastSavedUrl = recentCompletedDownloads.get(urlKey) || 0;
    if (now - lastSavedFile < 30000 || now - lastSavedUrl < 30000) {
      console.log(`[downloadFileWithBlob] Blocked duplicate save within 30s for: ${suggestedFilename}`);
      return;
    }
  }

  ongoingDownloads.add(fileKey);
  ongoingDownloads.add(urlKey);
  recentCompletedDownloads.set(fileKey, now);
  recentCompletedDownloads.set(urlKey, now);

  try {
    // Ensure same-origin relative URL
  const targetUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;

  const response = await fetch(targetUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Download request failed with status: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    // Intercepted by cookie check HTML!
    const htmlText = await response.text();
    if (htmlText.includes('cookie') || htmlText.includes('Cookie check') || htmlText.length < 15000) {
      throw new Error('Google Cloud session check intercepted this download. Please refresh the page and try again.');
    }
  }

  // Parse total size
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  // Stream chunks to show live progress and assemble blob
  let blob: Blob;

  if (response.body && window.ReadableStream && onProgress) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        receivedBytes += value.length;
        if (onProgress) {
          const percent = total > 0 ? Math.min(100, Math.round((receivedBytes / total) * 100)) : 0;
          onProgress({
            loaded: receivedBytes,
            total: total || receivedBytes,
            percent,
            loadedFormatted: formatBytes(receivedBytes),
            totalFormatted: formatBytes(total || receivedBytes),
          });
        }
      }
    }

    blob = new Blob(chunks, { type: contentType || 'application/octet-stream' });
  } else {
    // Fallback: standard blob conversion
    blob = await response.blob();
  }

  // Double check that blob is not the 10.1 KB HTML error
  if (blob.size < 15000 && contentType.includes('html')) {
    throw new Error('Downloaded file is an authentication check, not media. Please retry.');
  }

  // Trigger browser download via object URL
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = blobUrl;
  anchor.download = suggestedFilename;
  
  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup after browser acknowledges download
  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(blobUrl);
  }, 60000);
  } finally {
    ongoingDownloads.delete(fileKey);
  }
}
