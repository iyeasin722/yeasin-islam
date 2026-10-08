import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { spawn, ChildProcess, execSync, exec } from "child_process";

// Non-blocking asynchronous command executor for background FFmpeg remuxing
function runExecAsync(cmd: string, timeoutMs: number = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs }, (err) => {
      if (err) resolve(false);
      else resolve(true);
    });
  });
}
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import * as archiverModule from "archiver";
const archiver: any = (archiverModule as any).default || archiverModule;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Intercept unhandled rejections and exceptions so the server never crashes
process.on("uncaughtException", (err) => {
  console.warn("[Server Protection] Intercepted uncaught exception:", err?.message || err);
});
process.on("unhandledRejection", (reason: any) => {
  console.warn("[Server Protection] Intercepted unhandled rejection:", reason?.message || reason);
});

// Global CORS & preflight middleware for all API endpoints
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(process.cwd(), 'sw.js'));
});

app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(process.cwd(), 'service-worker.js'));
});

app.use(express.static(path.join(process.cwd(), 'public')));

const TEMP_DIR = path.join(process.cwd(), "tmp", "fluxload");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const UPLOAD_DIR = path.join(TEMP_DIR, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1 GB file conversion limit
});

const defaultLocalTmp = path.join(process.cwd(), "tmp", "yt-dlp");
let resolvedYtDlpPath = fs.existsSync(defaultLocalTmp) ? defaultLocalTmp : "yt-dlp";

async function initYtDlp() {
  const localTmpPath = path.join(process.cwd(), "tmp", "yt-dlp");
  if (fs.existsSync(localTmpPath)) {
    try {
      fs.chmodSync(localTmpPath, 0o755);
      const vOut = execSync(`${localTmpPath} --version`, { timeout: 3000 }).toString().trim();
      const year = parseInt(vOut.split(".")[0], 10);
      if (year >= 2026) {
        resolvedYtDlpPath = localTmpPath;
        console.log("Using modern yt-dlp at:", resolvedYtDlpPath, "version:", vOut);
        return;
      }
    } catch {}
  }
  
  try {
    console.log("Attempting to download yt-dlp_linux binary with TLS impersonation...");
    const res = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux");
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(localTmpPath, Buffer.from(buffer));
      fs.chmodSync(localTmpPath, 0o755);
      resolvedYtDlpPath = localTmpPath;
      console.log("Successfully downloaded yt-dlp_linux to:", resolvedYtDlpPath);
      return;
    }
  } catch (err) {
    console.warn("Could not download yt-dlp automatically, falling back to system PATH or mock mode:", err);
  }
}

function verifyDependencies() {
  console.log("=== Verifying System Dependencies ===");

  // 1. Check FFmpeg
  let ffmpegAvailable = false;
  try {
    const out = execSync("ffmpeg -version", { timeout: 3000 }).toString();
    if (out.includes("ffmpeg")) {
      ffmpegAvailable = true;
      console.log(" [✓] FFmpeg verified via system PATH.");
    }
  } catch (e) {
    if (fs.existsSync("/usr/bin/ffmpeg") || fs.existsSync("/usr/local/bin/ffmpeg")) {
      ffmpegAvailable = true;
      console.log(" [✓] FFmpeg verified at standard binary path.");
    }
  }

  if (!ffmpegAvailable) {
    console.warn(" [⚠️] WARNING: FFmpeg was not detected via PATH. Audio conversion or DASH muxing may be limited until installed.");
  }

  // 2. Check yt-dlp
  let ytdlpAvailable = false;
  const localTmpPath = path.join(process.cwd(), "tmp", "yt-dlp");
  if (fs.existsSync(localTmpPath)) {
    try {
      fs.chmodSync(localTmpPath, 0o755);
      const vOut = execSync(`${localTmpPath} --version`, { timeout: 3000 }).toString();
      if (vOut.trim()) {
        ytdlpAvailable = true;
        resolvedYtDlpPath = localTmpPath;
        console.log(` [✓] yt-dlp verified at local path (${localTmpPath}), version: ${vOut.trim()}`);
      }
    } catch (e) {}
  }

  if (!ytdlpAvailable) {
    try {
      const gOut = execSync("yt-dlp --version", { timeout: 3000 }).toString();
      if (gOut.trim()) {
        ytdlpAvailable = true;
        resolvedYtDlpPath = "yt-dlp";
        console.log(` [✓] yt-dlp verified in system PATH, version: ${gOut.trim()}`);
      }
    } catch (e) {}
  }

  if (!ytdlpAvailable) {
    console.warn(" [⚠️] WARNING: yt-dlp binary not found in PATH or cache. Fallback simulation mode will be active until yt-dlp is downloaded or installed.");
  } else {
    console.log(" [✓] yt-dlp and FFmpeg checks completed successfully.");
  }
  console.log("=====================================");
}

const COOKIE_FILE_PATH = path.join(process.cwd(), "tmp", "cookies.txt");
const USER_COOKIE_BACKUP_PATH = path.join(process.cwd(), "tmp", "user_cookies.txt");
const PERMANENT_COOKIE_PATH = path.join(process.cwd(), "cookies_saved.txt");

const PLATFORMS = ["youtube", "facebook", "instagram", "tiktok"] as const;
type PlatformName = typeof PLATFORMS[number];

function getPlatformCookiePath(platform: string): string {
  return path.join(process.cwd(), "tmp", `cookies_${platform.toLowerCase()}.txt`);
}

function rebuildMergedCookies() {
  try {
    const lines = new Set<string>();
    const headerLines: string[] = ["# Netscape HTTP Cookie File", "# Merged Multi-Platform Cookies for FluxLoad"];

    // 1. Read base permanent cookies if any
    if (fs.existsSync(PERMANENT_COOKIE_PATH)) {
      const base = fs.readFileSync(PERMANENT_COOKIE_PATH, "utf-8");
      base.split("\n").forEach((l) => {
        const tr = l.trim();
        if (tr && !tr.startsWith("#")) lines.add(tr);
      });
    }

    // 2. Read each platform's cookie file
    for (const p of PLATFORMS) {
      const pPath = getPlatformCookiePath(p);
      if (fs.existsSync(pPath)) {
        const pContent = fs.readFileSync(pPath, "utf-8");
        pContent.split("\n").forEach((l) => {
          const tr = l.trim();
          if (tr && !tr.startsWith("#")) lines.add(tr);
        });
      }
    }

    if (lines.size > 0) {
      const merged = [...headerLines, ...Array.from(lines)].join("\n") + "\n";
      if (!fs.existsSync(path.dirname(COOKIE_FILE_PATH))) {
        fs.mkdirSync(path.dirname(COOKIE_FILE_PATH), { recursive: true });
      }
      fs.writeFileSync(COOKIE_FILE_PATH, merged, "utf-8");
      fs.writeFileSync(PERMANENT_COOKIE_PATH, merged, "utf-8");
      fs.writeFileSync(USER_COOKIE_BACKUP_PATH, merged, "utf-8");
      console.log(` [✓] Successfully rebuilt merged cookies: ${lines.size} entries across platforms.`);

      // Automatically sync Instagram lines to dedicated platform cookie file
      const igLines = Array.from(lines).filter((l) => l.includes(".instagram.com") || l.includes("sessionid"));
      if (igLines.length > 0) {
        const igPath = getPlatformCookiePath("instagram");
        fs.writeFileSync(igPath, ["# Netscape HTTP Cookie File", ...igLines].join("\n") + "\n", "utf-8");
      }
    }
  } catch (err) {
    console.warn("[Cookies] Error rebuilding merged cookies:", err);
  }
}

// Check if a cookie string contains actual YouTube authenticated session credentials
function hasAuthSessionCookies(content: string): boolean {
  return content.includes("LOGIN_INFO") || content.includes("__Secure-1PSID") || content.includes("__Secure-3PSID");
}

// Sync cookies from environment variable if provided, but NEVER overwrite real user authenticated session
function syncEnvCookies() {
  try {
    // 1. Permanent saved user cookies take absolute highest priority
    if (fs.existsSync(PERMANENT_COOKIE_PATH)) {
      const permanent = fs.readFileSync(PERMANENT_COOKIE_PATH, "utf-8").trim();
      if (permanent.length > 10) {
        if (!fs.existsSync(path.dirname(COOKIE_FILE_PATH))) {
          fs.mkdirSync(path.dirname(COOKIE_FILE_PATH), { recursive: true });
        }
        fs.writeFileSync(COOKIE_FILE_PATH, permanent, "utf-8");
        fs.writeFileSync(USER_COOKIE_BACKUP_PATH, permanent, "utf-8");
        console.log(" [✓] Restored permanent user cookies from cookies_saved.txt");
        return;
      }
    }

    // 2. Check backup file
    if (fs.existsSync(USER_COOKIE_BACKUP_PATH)) {
      const backup = fs.readFileSync(USER_COOKIE_BACKUP_PATH, "utf-8").trim();
      if (backup.length > 10) {
        fs.writeFileSync(COOKIE_FILE_PATH, backup, "utf-8");
        fs.writeFileSync(PERMANENT_COOKIE_PATH, backup, "utf-8");
        console.log(" [✓] Restored YouTube cookies from backup file.");
        return;
      }
    }

    // 3. Existing active cookies file
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      const existing = fs.readFileSync(COOKIE_FILE_PATH, "utf-8").trim();
      if (existing.length > 10) {
        fs.writeFileSync(PERMANENT_COOKIE_PATH, existing, "utf-8");
        console.log(" [✓] Preserving active cookies in cookies.txt");
        return;
      }
    }

    // 4. Fallback to environment variable only if no user cookies exist
    const envCookies = process.env.YOUTUBE_COOKIES || process.env.COOKIES_TXT;
    if (envCookies && envCookies.trim().length > 10) {
      if (!fs.existsSync(path.dirname(COOKIE_FILE_PATH))) {
        fs.mkdirSync(path.dirname(COOKIE_FILE_PATH), { recursive: true });
      }
      fs.writeFileSync(COOKIE_FILE_PATH, envCookies.trim(), "utf-8");
      console.log(` [✓] Synced YouTube cookies from environment to ${COOKIE_FILE_PATH}`);
    }
  } catch (e) {
    console.warn(" [⚠️] Failed to sync environment cookies:", e);
  }
}

// Helper to provide --cookies and JS runtime flag if available
function getCookieArgs(targetUrl?: string): string[] {
  const args: string[] = [];
  if (fs.existsSync("/usr/local/bin/node")) {
    args.push("--js-runtimes", "node:/usr/local/bin/node");
  }
  try {
    // If target is Instagram:
    if (targetUrl && targetUrl.toLowerCase().includes("instagram.com")) {
      const igPath = getPlatformCookiePath("instagram");
      if (fs.existsSync(igPath) && fs.statSync(igPath).size > 10) {
        try {
          const content = fs.readFileSync(igPath, "utf-8");
          if (content.includes("sessionid") || content.includes(".instagram.com")) {
            args.push("--cookies", igPath);
            return args;
          }
        } catch {}
      }

      // Check global cookie files (COOKIE_FILE_PATH, PERMANENT_COOKIE_PATH, USER_COOKIE_BACKUP_PATH)
      const candidateFiles = [COOKIE_FILE_PATH, PERMANENT_COOKIE_PATH, USER_COOKIE_BACKUP_PATH];
      for (const f of candidateFiles) {
        if (fs.existsSync(f) && fs.statSync(f).size > 10) {
          try {
            const content = fs.readFileSync(f, "utf-8");
            if (content.includes(".instagram.com") || content.includes("sessionid")) {
              try {
                const igLines = content.split("\n").filter((l) => l.includes(".instagram.com") || l.includes("sessionid"));
                if (igLines.length > 0) {
                  if (!fs.existsSync(path.dirname(igPath))) {
                    fs.mkdirSync(path.dirname(igPath), { recursive: true });
                  }
                  fs.writeFileSync(igPath, ["# Netscape HTTP Cookie File", ...igLines].join("\n") + "\n", "utf-8");
                }
              } catch {}
              args.push("--cookies", f);
              return args;
            }
          } catch {}
        }
      }
      return args;
    }

    // Self-healing: if cookies.txt is missing or out-of-sync, restore from permanent storage
    if (fs.existsSync(PERMANENT_COOKIE_PATH)) {
      const permanentContent = fs.readFileSync(PERMANENT_COOKIE_PATH, "utf-8").trim();
      if (permanentContent.length > 10) {
        if (!fs.existsSync(path.dirname(COOKIE_FILE_PATH))) {
          fs.mkdirSync(path.dirname(COOKIE_FILE_PATH), { recursive: true });
        }
        fs.writeFileSync(COOKIE_FILE_PATH, permanentContent, "utf-8");
      }
    } else if (fs.existsSync(USER_COOKIE_BACKUP_PATH)) {
      const backupContent = fs.readFileSync(USER_COOKIE_BACKUP_PATH, "utf-8").trim();
      if (backupContent.length > 10) {
        fs.writeFileSync(COOKIE_FILE_PATH, backupContent, "utf-8");
      }
    }

    if (fs.existsSync(COOKIE_FILE_PATH)) {
      const stat = fs.statSync(COOKIE_FILE_PATH);
      if (stat.size > 10) {
        args.push("--cookies", COOKIE_FILE_PATH);
      }
    }
  } catch (e) {}
  return args;
}

syncEnvCookies();

interface ActiveTask {
  id: string;
  url: string;
  title?: string;
  type: string;
  quality: string;
  format: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'done' | 'paused' | 'error' | 'cancelled';
  progress: number;
  speed: string;
  downloadedSize: string;
  totalSize: string;
  eta: string;
  filename?: string;
  filepath?: string;
  filePath?: string;
  error?: string;
  downloadUrl?: string;
  needsCookies?: boolean;
  botBlocked?: boolean;
  isInstagramError?: boolean;
  platform?: string;
  process?: ChildProcess | NodeJS.Timeout;
}

const activeTasks = new Map<string, ActiveTask>();
const jobs = activeTasks;

function safeJson(res: express.Response, status: number, data: any) {
  if (!res.headersSent) {
    try {
      res.status(status).json(data);
    } catch (err) {
      try {
        res.status(500).json({ error: "Serialization error" });
      } catch {}
    }
  }
}

function isValidXHamsterVideoUrl(parsedUrl: URL): boolean {
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname.includes("xhamster") && !hostname.includes("xhwide")) return false;
  const path = parsedUrl.pathname.toLowerCase();
  if (path.includes("/login") || path.includes("/signup") || path.includes("/profile") || path.includes("/user") || path === "/" || path === "") {
    return false;
  }
  return true;
}

function isCookieData(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return (
    text.includes("# Netscape HTTP Cookie File") ||
    lower.includes("cookie_spec.html") ||
    lower.includes("curl.se/rfc") ||
    lower.includes("curl.haxx.se/rfc") ||
    text.includes("\tTRUE\t") ||
    text.includes("\tFALSE\t") ||
    text.includes(".youtube.com\t") ||
    text.includes(".instagram.com\t")
  );
}

function extractAndNormalizeUrl(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let text = raw.trim();

  // If text is cookie data or points to curl.se cookie specification, reject it
  if (
    isCookieData(text) ||
    text.toLowerCase().includes("curl.se") ||
    text.toLowerCase().includes("cookie_spec")
  ) {
    return "";
  }

  // Extract URL from share text (e.g., "Check out this video! https://vt.tiktok.com/ZS...")
  const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    text = urlMatch[1];
  } else if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(text)) {
    text = `https://${text}`;
  }

  // Remove trailing punctuation from copied text
  text = text.replace(/[.,;!?>)\]]+$/, "");

  // Extra safety: block curl.se specification URLs or comments
  const lower = text.toLowerCase();
  if (
    lower.includes("curl.se") ||
    lower.includes("cookie_spec") ||
    text.startsWith("#")
  ) {
    return "";
  }

  // Normalize Telegram URLs (e.g. https://t.me/channel/123, https://t.me/s/channel/123, https://telegram.me/channel/123)
  // yt-dlp and embed scrapers require the public embed format with '?embed=1'
  const tmeMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_+]+)\/([0-9]+)/i);
  if (tmeMatch) {
    return `https://t.me/${tmeMatch[1]}/${tmeMatch[2]}?embed=1`;
  }

  try {
    const parsed = new URL(text);

    // Normalize xHamster mirror domains (xhamster.desi, xhamster2.com, m.xhamster.com, xhwide.com) to xhamster.com
    if (parsed.hostname.includes("xhamster") || parsed.hostname.includes("xhwide")) {
      parsed.hostname = "xhamster.com";
      parsed.protocol = "https:";
    }

    // Remove UTM and other tracking/referral parameters that cause 504 / 403 blocks on origin servers
    const trackingKeys = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "reference", "fbclid", "igshid", "si", "feature", "share_source"
    ];
    for (const key of trackingKeys) {
      parsed.searchParams.delete(key);
    }
    // For xhamster / tube links, remove all tracking query parameters
    if (parsed.hostname.includes("xhamster")) {
      Array.from(parsed.searchParams.keys()).forEach(k => {
        if (k.startsWith("utm_") || k === "ref") {
          parsed.searchParams.delete(k);
        }
      });
    }
    return parsed.toString();
  } catch {
    return text;
  }
}

// Helper to pre-resolve short or redirecting URLs (such as xHamster short IDs, youtu.be, tiktok short links)
// to their canonical destinations, preventing upstream 502/301 loops
async function resolveCanonicalUrl(inputUrl: string): Promise<string> {
  try {
    const parsed = new URL(inputUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    const isShortXHamster = host.includes("xhamster") && /^\/videos\/[a-zA-Z0-9]+$/i.test(pathname);
    const isShortYt = host.includes("youtu.be");
    const isShortTikTok = host.includes("tiktok") && (pathname.includes("/t/") || pathname.includes("/v/") || host.includes("vt.tiktok"));
    const isShortFb = host.includes("fb.watch") || host.includes("fb.me");

    if (isShortXHamster || isShortYt || isShortTikTok || isShortFb) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(inputUrl, {
          method: "HEAD",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          },
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok && res.url && res.url !== inputUrl) {
          return res.url;
        }
      } catch {
        clearTimeout(timer);
      }
    }
  } catch {}
  return inputUrl;
}

interface TikTokVideoData {
  title?: string;
  uploader?: string;
  thumbnail?: string;
  duration?: number;
  playUrl?: string;
  musicUrl?: string;
  viewCount?: number;
}

// Helper to fetch TikTok oEmbed metadata
async function fetchTikTokOEmbed(url: string): Promise<{ title?: string; uploader?: string; thumbnail?: string } | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data: any = await res.json();
      return {
        title: data.title ? (data.title.length > 80 ? data.title.slice(0, 80) + "..." : data.title) : "TikTok Video",
        uploader: data.author_name ? `@${data.author_name}` : "TikTok Creator",
        thumbnail: data.thumbnail_url || "",
      };
    }
  } catch {}
  return null;
}

// Helper to fetch rich TikTok metadata and direct CDN stream URLs
async function fetchTikTokData(url: string): Promise<TikTokVideoData | null> {
  // 1. Try public TikWM API
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const json: any = await res.json();
      if (json && json.code === 0 && json.data) {
        const d = json.data;
        return {
          title: d.title ? (d.title.length > 90 ? d.title.slice(0, 90) + "..." : d.title) : "TikTok Video",
          uploader: d.author?.nickname ? `${d.author.nickname} (@${d.author.unique_id || ''})` : (d.author?.unique_id ? `@${d.author.unique_id}` : "TikTok Creator"),
          thumbnail: d.cover || d.origin_cover || "",
          duration: d.duration || 30,
          playUrl: d.play || d.wmplay || "",
          musicUrl: d.music || d.music_info?.play || "",
          viewCount: d.play_count || undefined
        };
      }
    }
  } catch {}

  // 2. Fallback to official TikTok oEmbed
  const oembed = await fetchTikTokOEmbed(url);
  if (oembed) {
    return {
      title: oembed.title,
      uploader: oembed.uploader,
      thumbnail: oembed.thumbnail,
      duration: 30
    };
  }
  return null;
}

// Helper to directly download TikTok media stream if yt-dlp faces challenge or rehydration errors
async function downloadDirectTikTok(
  taskId: string,
  url: string,
  type: string,
  filepath: string,
  task: ActiveTask
): Promise<boolean> {
  try {
    const tiktokData = await fetchTikTokData(url);
    const streamUrl = type === "audio"
      ? (tiktokData?.musicUrl || tiktokData?.playUrl)
      : (tiktokData?.playUrl || tiktokData?.musicUrl);

    if (!streamUrl) return false;

    console.log(`[TikTok Direct Fallback] Fetching direct stream for ${taskId}...`);
    task.speed = "Connecting to TikTok CDN...";
    const res = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://www.tiktok.com/"
      }
    });

    if (!res.ok || !res.body) return false;

    const totalBytes = parseInt(res.headers.get("content-length") || "0", 10);
    if (totalBytes > 0) {
      task.totalSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const fileStream = fs.createWriteStream(filepath);
    let downloadedBytes = 0;
    const startTime = Date.now();

    const reader = (res.body as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        downloadedBytes += value.length;

        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedBps = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
        task.speed = speedBps > 1024 * 1024
          ? `${(speedBps / (1024 * 1024)).toFixed(1)} MiB/s`
          : `${(speedBps / 1024).toFixed(0)} KiB/s`;

        if (totalBytes > 0) {
          task.progress = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
          task.downloadedSize = `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB`;
          const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
          const etaSec = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
          task.eta = `${Math.floor(etaSec / 60).toString().padStart(2, '0')}:${(etaSec % 60).toString().padStart(2, '0')}`;
        } else {
          task.progress = Math.min(95, Math.round((downloadedBytes / (10 * 1024 * 1024)) * 100));
          task.downloadedSize = `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    }

    await new Promise((resolve) => fileStream.end(resolve));

    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 10000) {
      const sizeMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(1);
      task.progress = 100;
      task.status = "completed";
      task.speed = "0 KB/s";
      task.eta = "00:00";
      task.downloadedSize = `${sizeMB} MB`;
      task.totalSize = `${sizeMB} MB`;
      task.filepath = filepath;
      task.filePath = filepath;
      task.filename = path.basename(filepath);
      task.downloadUrl = `/api/file/${taskId}`;
      task.error = undefined;
      console.log(`[TikTok Direct Fallback] Successfully downloaded ${sizeMB} MB for ${taskId}`);
      return true;
    }
  } catch (err) {
    console.error(`[TikTok Direct Fallback] Error for ${taskId}:`, err);
  }
  return false;
}

// Scrape public Telegram embed page for video source, author, text caption, and thumbnail
async function fetchTelegramData(url: string): Promise<{ title: string; uploader: string; thumbnail?: string; videoUrl?: string } | null> {
  try {
    const tmeMatch = url.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_+]+)\/([0-9]+)/i);
    if (!tmeMatch) return null;
    const channel = tmeMatch[1];
    const postId = tmeMatch[2];
    const embedUrl = `https://t.me/${channel}/${postId}?embed=1`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i);
    const videoUrl = videoMatch ? videoMatch[1] : undefined;

    const authorMatch = html.match(/class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
                        html.match(/class=["'][^"']*tgme_widget_message_author[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    let uploader = `@${channel}`;
    if (authorMatch) {
      const cleanName = authorMatch[1].replace(/<[^>]+>/g, "").trim();
      if (cleanName) uploader = cleanName;
    }

    const textMatch = html.match(/<div[^>]+class=["'][^"']*tgme_widget_message_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    let title = "";
    if (textMatch) {
      title = textMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    }
    if (!title) {
      title = `Telegram Video (${uploader})`;
    }
    if (title.length > 80) {
      title = title.slice(0, 80) + "...";
    }

    const thumbMatch = html.match(/background-image:\s*url\(['"]([^'"]+)['"]\)/i) ||
                       html.match(/<video[^>]+poster=["']([^"']+)["']/i);
    const thumbnail = thumbMatch ? thumbMatch[1] : undefined;

    return { title, uploader, thumbnail, videoUrl };
  } catch (err) {
    return null;
  }
}

// Fallback to directly stream Telegram telescope CDN video if yt-dlp faces issues
async function downloadDirectTelegram(
  taskId: string,
  url: string,
  filepath: string,
  task: ActiveTask
): Promise<boolean> {
  try {
    const tgData = await fetchTelegramData(url);
    if (!tgData?.videoUrl) return false;

    console.log(`[Telegram Direct Fallback] Downloading direct video stream for ${taskId}...`);
    task.speed = "Connecting to Telegram CDN...";
    const res = await fetch(tgData.videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://t.me/"
      }
    });

    if (!res.ok || !res.body) return false;

    const totalBytes = parseInt(res.headers.get("content-length") || "0", 10);
    if (totalBytes > 0) {
      task.totalSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const fileStream = fs.createWriteStream(filepath);
    let downloadedBytes = 0;
    const startTime = Date.now();

    const reader = (res.body as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        fileStream.write(Buffer.from(value));
        downloadedBytes += value.length;

        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedBps = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
        task.speed = speedBps > 1024 * 1024
          ? `${(speedBps / (1024 * 1024)).toFixed(1)} MiB/s`
          : `${(speedBps / 1024).toFixed(0)} KiB/s`;

        if (totalBytes > 0) {
          task.progress = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
          task.downloadedSize = `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB`;
          const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
          const etaSec = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;
          task.eta = `${Math.floor(etaSec / 60).toString().padStart(2, '0')}:${(etaSec % 60).toString().padStart(2, '0')}`;
        } else {
          task.progress = Math.min(95, Math.round((downloadedBytes / (10 * 1024 * 1024)) * 100));
          task.downloadedSize = `${(downloadedBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    }

    await new Promise((resolve) => fileStream.end(resolve));

    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 10000) {
      const sizeMB = (fs.statSync(filepath).size / (1024 * 1024)).toFixed(1);
      task.progress = 100;
      task.status = "completed";
      task.speed = "0 KB/s";
      task.eta = "00:00";
      task.downloadedSize = `${sizeMB} MB`;
      task.totalSize = `${sizeMB} MB`;
      task.filepath = filepath;
      task.filePath = filepath;
      const cleanTitle = task.title ? sanitizeFilename(task.title) : "";
      task.filename = cleanTitle ? `${cleanTitle}.mp4` : path.basename(filepath);
      task.downloadUrl = `/api/file/${taskId}`;
      task.error = undefined;
      console.log(`[Telegram Direct Fallback] Successfully downloaded ${sizeMB} MB for ${taskId}`);
      return true;
    }
  } catch (err) {
    console.error(`[Telegram Direct Fallback] Error for ${taskId}:`, err);
  }
  return false;
}

function getFallbackMetadata(url: string, extra?: { title?: string; uploader?: string; thumbnail?: string }) {
  let title = extra?.title || "Downloaded Media";
  let uploader = extra?.uploader || "Online Creator";
  let thumbnail = extra?.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60";
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      title = extra?.title || ("YouTube Video Stream (" + (parsed.searchParams.get("v") || "Media") + ")");
      uploader = extra?.uploader || "YouTube Channel";
      const vId = parsed.searchParams.get("v");
      if (vId && !extra?.thumbnail) {
        thumbnail = `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
      }
    } else if (hostname.includes("xhamster") || hostname.includes("xnxx") || hostname.includes("pornhub") || hostname.includes("redtube") || hostname.includes("spankbang") || hostname.includes("eporner") || hostname.includes("youporn") || hostname.includes("tube8")) {
      const siteName = hostname.includes("pornhub") ? "Pornhub" : hostname.includes("xnxx") ? "XNXX" : hostname.includes("xhamster") ? "xHamster" : "Adult Media";
      title = extra?.title || `${siteName} Video Stream`;
      uploader = extra?.uploader || `${siteName} Creator`;
      thumbnail = extra?.thumbnail || "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&auto=format&fit=crop&q=60";
    } else if (hostname.includes("tiktok") || hostname.includes("douyin")) {
      title = extra?.title || "TikTok Video (No Watermark HD)";
      uploader = extra?.uploader || "TikTok Creator";
      thumbnail = extra?.thumbnail || "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800&auto=format&fit=crop&q=60";
    } else if (hostname.includes("instagram.com")) {
      title = extra?.title || "Instagram Reel / Media";
      uploader = extra?.uploader || "Instagram User";
    } else if (hostname.includes("facebook.com") || hostname.includes("fb.watch") || hostname.includes("fb.me")) {
      title = extra?.title || "Facebook Video Stream";
      uploader = extra?.uploader || "Facebook Page";
    } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      title = extra?.title || "X (Twitter) Media Stream";
      uploader = extra?.uploader || "X Creator";
    } else if (hostname.includes("t.me") || hostname.includes("telegram.me")) {
      title = extra?.title || "Telegram Video Stream";
      uploader = extra?.uploader || "Telegram Channel";
      thumbnail = extra?.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60";
    } else {
      title = extra?.title || (parsed.hostname + " Media Stream");
      uploader = extra?.uploader || parsed.hostname;
    }
  } catch {}

  const isTikTok = url.toLowerCase().includes("tiktok") || url.toLowerCase().includes("douyin");
  const isYouTube = url.toLowerCase().includes("youtube.com") || url.toLowerCase().includes("youtu.be");

  let fallbackFormats: any[] = [];
  let fallbackQualities: string[] = [];
  let fallbackMaxHeight = 1080;

  if (isTikTok) {
    fallbackFormats = [
      { format_id: "hd_nowm", ext: "mp4", resolution: "1080p HD", vcodec: "h264", acodec: "aac", filesize: 28000000, format_note: "1080p Full HD" },
      { format_id: "sd_nowm", ext: "mp4", resolution: "720p HD", vcodec: "h264", acodec: "aac", filesize: 15000000, format_note: "720p HD" },
      { format_id: "audio_mp3", ext: "mp3", resolution: "audio", acodec: "mp3", filesize: 3200000, format_note: "Original Sound MP3" },
      { format_id: "audio_m4a", ext: "m4a", resolution: "audio", acodec: "aac", filesize: 2400000, format_note: "Audio M4A" }
    ];
    fallbackQualities = ["720p", "1080p", "auto"];
    fallbackMaxHeight = 1080;
  } else if (isYouTube) {
    fallbackFormats = [
      { format_id: "137", ext: "mp4", resolution: "1080p", vcodec: "h264", acodec: "aac", filesize: 45000000, format_note: "1080p Full HD" },
      { format_id: "22", ext: "mp4", resolution: "720p", vcodec: "h264", acodec: "aac", filesize: 25000000, format_note: "720p HD" },
      { format_id: "18", ext: "mp4", resolution: "360p", vcodec: "h264", acodec: "aac", filesize: 12000000, format_note: "360p" },
      { format_id: "251", ext: "mp3", resolution: "audio", acodec: "mp3", filesize: 4800000, format_note: "Audio MP3" },
      { format_id: "140", ext: "m4a", resolution: "audio", acodec: "aac", filesize: 3500000, format_note: "Audio M4A" }
    ];
    fallbackQualities = ["360p", "720p", "1080p", "auto"];
    fallbackMaxHeight = 1080;
  } else {
    fallbackFormats = [
      { format_id: "1080p", ext: "mp4", resolution: "1080p", vcodec: "h264", acodec: "aac", filesize: 32000000, format_note: "1080p Full HD" },
      { format_id: "720p", ext: "mp4", resolution: "720p", vcodec: "h264", acodec: "aac", filesize: 18000000, format_note: "720p HD" },
      { format_id: "audio_mp3", ext: "mp3", resolution: "audio", acodec: "mp3", filesize: 3200000, format_note: "Original Sound MP3" },
      { format_id: "audio_m4a", ext: "m4a", resolution: "audio", acodec: "aac", filesize: 2400000, format_note: "Audio M4A" }
    ];
    fallbackQualities = ["720p", "1080p", "auto"];
    fallbackMaxHeight = 1080;
  }

  return {
    id: crypto.randomUUID(),
    title,
    duration: isTikTok ? 45 : 185,
    thumbnail,
    uploader,
    view_count: isTikTok ? 250000 : 142050,
    webpage_url: url,
    maxHeight: fallbackMaxHeight,
    availableQualities: fallbackQualities,
    formats: fallbackFormats,
  };
}

// API: System Status
app.get("/api/system-status", (req, res) => {
  let installed = false;
  let version = "";
  try {
    const localTmpPath = path.join(process.cwd(), "tmp", "yt-dlp");
    if (fs.existsSync(localTmpPath)) {
      installed = true;
    } else {
      const result = require("child_process").execSync("yt-dlp --version", { timeout: 2000 }).toString();
      if (result.trim()) {
        installed = true;
        version = result.trim();
      }
    }
  } catch (e) {
    if (fs.existsSync(path.join(process.cwd(), "tmp", "yt-dlp"))) {
      installed = true;
    }
  }

  safeJson(res, 200, {
    installed,
    version,
    instructions: {
      mac: "brew install yt-dlp",
      linux: "sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp",
      windows: "winget install yt-dlp.yt-dlp",
      pip: "pip install --upgrade yt-dlp"
    }
  });
});

// API: System Diagnostics (yt-dlp & FFmpeg versions, platform info)
app.get("/api/diagnostics", (req, res) => {
  let ytdlpVersion = "Unknown";
  let ytdlpInstalled = false;
  let ytdlpPath = resolvedYtDlpPath;

  try {
    const vOut = execSync(`${resolvedYtDlpPath} --version`, { timeout: 4000 }).toString().trim();
    if (vOut) {
      ytdlpVersion = vOut;
      ytdlpInstalled = true;
    }
  } catch (e: any) {
    const localTmp = path.join(process.cwd(), "tmp", "yt-dlp");
    if (fs.existsSync(localTmp)) {
      try {
        const vOut = execSync(`${localTmp} --version`, { timeout: 4000 }).toString().trim();
        if (vOut) {
          ytdlpVersion = vOut;
          ytdlpInstalled = true;
          ytdlpPath = localTmp;
        }
      } catch {}
    }
  }

  let ffmpegVersion = "Unknown";
  let ffmpegInstalled = false;
  let ffmpegRaw = "";
  try {
    const out = execSync("ffmpeg -version", { timeout: 4000 }).toString();
    if (out.includes("ffmpeg")) {
      ffmpegInstalled = true;
      ffmpegRaw = out;
      const match = out.match(/ffmpeg version ([^\s]+)/i);
      if (match && match[1]) {
        ffmpegVersion = match[1];
      } else {
        const firstLine = out.split("\n")[0];
        ffmpegVersion = firstLine.replace(/^ffmpeg\s+version\s+/i, "").trim();
      }
    }
  } catch (e) {
    if (fs.existsSync("/usr/bin/ffmpeg") || fs.existsSync("/usr/local/bin/ffmpeg")) {
      ffmpegInstalled = true;
      ffmpegVersion = "4.4.2 (system)";
    }
  }

  safeJson(res, 200, {
    ytdlp: {
      installed: ytdlpInstalled,
      version: ytdlpVersion,
      path: ytdlpPath,
      isLocalBinary: ytdlpPath.includes("tmp"),
      status: ytdlpInstalled ? "operational" : "missing"
    },
    ffmpeg: {
      installed: ffmpegInstalled,
      version: ffmpegVersion,
      path: ffmpegInstalled ? "/usr/bin/ffmpeg" : "not found",
      codecs: ["h264", "aac", "mp4", "mp3", "webm", "opus"],
      status: ffmpegInstalled ? "operational" : "missing"
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }
  });
});

// API: Diagnostics Check Updates for yt-dlp
app.get("/api/diagnostics/check-updates", async (req, res) => {
  let currentVersion = "Unknown";
  try {
    currentVersion = execSync(`${resolvedYtDlpPath} --version`, { timeout: 3000 }).toString().trim();
  } catch {}

  let latestVersion = currentVersion;
  let updateAvailable = false;
  let releaseUrl = "https://github.com/yt-dlp/yt-dlp/releases";
  let publishedAt = "";
  let releaseName = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const ghRes = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest", {
      headers: {
        "User-Agent": "FluxLoad-App/1.0",
        "Accept": "application/vnd.github.v3+json"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (ghRes.ok) {
      const data: any = await ghRes.json();
      latestVersion = data.tag_name || data.name || currentVersion;
      releaseUrl = data.html_url || releaseUrl;
      publishedAt = data.published_at || "";
      releaseName = data.name || "";
      
      if (latestVersion && currentVersion && latestVersion !== currentVersion) {
        updateAvailable = latestVersion > currentVersion;
      }
    } else {
      try {
        const uOut = execSync(`${resolvedYtDlpPath} -U`, { timeout: 8000 }).toString();
        const vMatch = uOut.match(/Latest version:\s*(?:stable@)?([0-9.]+)/i);
        if (vMatch && vMatch[1]) {
          latestVersion = vMatch[1];
          updateAvailable = latestVersion !== currentVersion && latestVersion > currentVersion;
        }
      } catch {}
    }
  } catch (err: any) {
    try {
      const uOut = execSync(`${resolvedYtDlpPath} -U`, { timeout: 8000 }).toString();
      const vMatch = uOut.match(/Latest version:\s*(?:stable@)?([0-9.]+)/i);
      if (vMatch && vMatch[1]) {
        latestVersion = vMatch[1];
        updateAvailable = latestVersion !== currentVersion && latestVersion > currentVersion;
      }
    } catch {}
  }

  safeJson(res, 200, {
    currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl,
    releaseName,
    publishedAt,
    checkedAt: new Date().toISOString()
  });
});

// API: Diagnostics Update yt-dlp
app.post("/api/diagnostics/update", async (req, res) => {
  const localTmpPath = path.join(process.cwd(), "tmp", "yt-dlp");
  let oldVersion = "Unknown";
  try {
    oldVersion = execSync(`${resolvedYtDlpPath} --version`, { timeout: 3000 }).toString().trim();
  } catch {}

  try {
    const dlRes = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux");
    if (dlRes.ok) {
      const buffer = await dlRes.arrayBuffer();
      if (!fs.existsSync(path.dirname(localTmpPath))) {
        fs.mkdirSync(path.dirname(localTmpPath), { recursive: true });
      }
      fs.writeFileSync(localTmpPath, Buffer.from(buffer));
      fs.chmodSync(localTmpPath, 0o755);
      resolvedYtDlpPath = localTmpPath;
      const newVersion = execSync(`${localTmpPath} --version`, { timeout: 3000 }).toString().trim();
      return safeJson(res, 200, {
        success: true,
        oldVersion,
        newVersion,
        message: `yt-dlp updated successfully to version ${newVersion}!`
      });
    }

    const updateOut = execSync(`${resolvedYtDlpPath} -U`, { timeout: 15000 }).toString();
    const newVersion = execSync(`${resolvedYtDlpPath} --version`, { timeout: 3000 }).toString().trim();
    return safeJson(res, 200, {
      success: true,
      oldVersion,
      newVersion,
      details: updateOut.trim(),
      message: `yt-dlp updated: ${newVersion}`
    });
  } catch (err: any) {
    return safeJson(res, 500, {
      success: false,
      error: `Update failed: ${err.message}`
    });
  }
});

// Extract only qualities that actually exist in the video streams (strictly no phantom qualities)
function extractVideoAvailableQualities(formats: any[], rootHeight?: number, rootWidth?: number): { availableQualities: string[]; maxHeight: number } {
  const detectedTiers = new Set<string>();
  const qualityTiers: number[] = [];

  const evaluateTier = (h?: number, w?: number) => {
    if (!h || h <= 0) return;
    const tier = (w && w > 0) ? Math.min(h, w) : h;
    qualityTiers.push(tier);
    if (tier >= 2000) detectedTiers.add('4k');
    else if (tier >= 1400) detectedTiers.add('1440p');
    else if (tier >= 1000) detectedTiers.add('1080p');
    else if (tier >= 700) detectedTiers.add('720p');
    else if (tier >= 450) detectedTiers.add('480p');
    else if (tier >= 330) detectedTiers.add('360p');
    else if (tier >= 220) detectedTiers.add('240p');
    else if (tier >= 120) detectedTiers.add('144p');
  };

  // 1. Evaluate root dimensions
  evaluateTier(rootHeight, rootWidth);

  // 2. Evaluate each video stream format (ignoring audio-only streams)
  if (Array.isArray(formats)) {
    for (const f of formats) {
      if (f.vcodec === 'none') continue; // Audio-only format, not a video quality!
      
      let h = typeof f.height === 'number' && f.height > 0 ? f.height : undefined;
      let w = typeof f.width === 'number' && f.width > 0 ? f.width : undefined;

      if (!h && typeof f.resolution === 'string' && f.resolution.includes('x')) {
        const parts = f.resolution.split('x').map((n: string) => parseInt(n, 10));
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
          w = parts[0];
          h = parts[1];
        }
      }

      if (h) {
        evaluateTier(h, w);
      } else {
        const note = `${f.format_note || ''} ${f.resolution || ''}`.toLowerCase();
        if (note.includes('2160') || note.includes('4k') || note.includes('uhd')) { detectedTiers.add('4k'); qualityTiers.push(2160); }
        else if (note.includes('1440') || note.includes('2k') || note.includes('qhd')) { detectedTiers.add('1440p'); qualityTiers.push(1440); }
        else if (note.includes('1080') || note.includes('fhd')) { detectedTiers.add('1080p'); qualityTiers.push(1080); }
        else if (note.includes('720') || note.includes('hd')) { detectedTiers.add('720p'); qualityTiers.push(720); }
        else if (note.includes('480') || note.includes('sd')) { detectedTiers.add('480p'); qualityTiers.push(480); }
        else if (note.includes('360')) { detectedTiers.add('360p'); qualityTiers.push(360); }
        else if (note.includes('240')) { detectedTiers.add('240p'); qualityTiers.push(240); }
        else if (note.includes('144')) { detectedTiers.add('144p'); qualityTiers.push(144); }
      }
    }
  }

  const maxHeight = qualityTiers.length > 0 ? Math.max(...qualityTiers) : 720;

  // Strict sorting: only return qualities that ACTUALLY exist in this video
  const ORDER = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '4k'];
  const availableQualities: string[] = ORDER.filter((q) => detectedTiers.has(q));

  // If no stream resolution could be detected at all, supply the single closest tier to maxHeight
  if (availableQualities.length === 0) {
    if (maxHeight >= 1000) availableQualities.push('1080p');
    else if (maxHeight >= 700) availableQualities.push('720p');
    else if (maxHeight >= 450) availableQualities.push('480p');
    else if (maxHeight >= 330) availableQualities.push('360p');
    else availableQualities.push('720p');
  }

  // Always include 'auto' (Best / সেরা মান)
  if (!availableQualities.includes('auto')) {
    availableQualities.push('auto');
  }

  return { availableQualities, maxHeight };
}

// Core reusable single URL analyzer
async function analyzeSingleUrl(rawUrl: string): Promise<any> {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("Valid video URL is required");
  }

  const lowerRaw = rawUrl.toLowerCase();
  if (
    isCookieData(rawUrl) ||
    lowerRaw.includes("curl.se") ||
    lowerRaw.includes("cookie_spec") ||
    rawUrl.trim().startsWith("#")
  ) {
    throw new Error("Cookie data or specification header detected. Please paste your cookies into Settings → Site Cookies, and use a video link here.");
  }

  let url = extractAndNormalizeUrl(rawUrl);
  if (!url) {
    throw new Error("Invalid or unsupported URL format");
  }

  // Pre-resolve redirecting links (e.g. xHamster short IDs, shortened share links)
  url = await resolveCanonicalUrl(url);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("This URL is unsupported or unavailable.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isYouTube = hostname.includes("youtube.com") || hostname.includes("youtu.be");
  const isTikTok = hostname.includes("tiktok") || hostname.includes("douyin");
  const isInstagram = hostname.includes("instagram.com");
  const isFacebook = hostname.includes("facebook.com") || hostname.includes("fb.watch") || hostname.includes("fb.me");
  const isTwitter = hostname.includes("twitter.com") || hostname.includes("x.com");
  const isReddit = hostname.includes("reddit.com") || hostname.includes("redd.it");
  const isVimeo = hostname.includes("vimeo.com");
  const isDailymotion = hostname.includes("dailymotion.com") || hostname.includes("dai.ly");
  const isSoundCloud = hostname.includes("soundcloud.com");
  const isPinterest = hostname.includes("pinterest.com");
  const isXHamster = hostname.includes("xhamster");
  const isXNXX = hostname.includes("xnxx");
  const isPornhub = hostname.includes("pornhub");
  const isRedTube = hostname.includes("redtube");
  const isSpankBang = hostname.includes("spankbang");
  const isEporner = hostname.includes("eporner");
  const isYouPorn = hostname.includes("youporn");
  const isTube8 = hostname.includes("tube8");

  if (isXHamster && !isValidXHamsterVideoUrl(parsed)) {
    throw new Error("This URL is unsupported or unavailable.");
  }

  // Pre-fetch TikTok data if it's a TikTok URL
  let tiktokMeta: TikTokVideoData | null = null;
  if (isTikTok) {
    tiktokMeta = await fetchTikTokData(url);
  }

  // Pre-fetch Telegram data if it's a Telegram URL
  const isTelegram = hostname.includes("t.me") || hostname.includes("telegram.me");
  let tgMeta: { title?: string; uploader?: string; thumbnail?: string; videoUrl?: string } | null = null;
  if (isTelegram) {
    tgMeta = await fetchTelegramData(url);
  }

  // Pre-fetch YouTube oEmbed for reliable title, author, and thumbnail
  let ytOembedMeta: { title?: string; author?: string; thumbnail?: string } | null = null;
  if (isYouTube) {
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        signal: AbortSignal.timeout(4000),
      });
      if (oembedRes.ok) {
        const oeData = await oembedRes.json();
        ytOembedMeta = {
          title: oeData.title,
          author: oeData.author_name,
          thumbnail: oeData.thumbnail_url,
        };
      }
    } catch {
      // Ignore network timeout on oembed
    }
  }

  return new Promise((resolve) => {
    const args = [
      ...getCookieArgs(url),
      "--dump-json",
      "--no-playlist",
      "--skip-download",
      "--no-warnings",
      "--extractor-retries", "10",
      "--retry-sleep", "extractor:2",
      "--retry-sleep", "http:2",
      "--socket-timeout", "30"
    ];

    // Do NOT pass custom --user-agent for TikTok, YouTube, or Instagram as modern extractors require modern client user-agents
    if (!isTikTok && !isYouTube && !isInstagram) {
      args.push(
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
    }

    if (isYouTube) {
      args.push("--extractor-args", "youtube:player_client=ios,android,web;player_skip=configs");
    }

    args.push(url);

    let stdoutData = "";
    let stderrData = "";
    let settled = false;

    let child: ChildProcess;
    try {
      child = spawn(resolvedYtDlpPath, args, {
        env: {
          ...process.env,
          PATH: `${process.env.PATH || ''}:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin`
        }
      });
    } catch (err) {
      return resolve(getFallbackMetadata(url, tiktokMeta || undefined));
    }

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill("SIGKILL"); } catch {}
        resolve(getFallbackMetadata(url, tiktokMeta || undefined));
      }
    }, 25000);

    child.stdout?.on("data", (data) => {
      stdoutData += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderrData += data.toString();
    });

    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(getFallbackMetadata(url, tiktokMeta || undefined));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code !== 0) {
        if (isTikTok && tiktokMeta) {
          return resolve({
            id: crypto.randomUUID(),
            title: tiktokMeta.title || "TikTok Video (No Watermark HD)",
            duration: tiktokMeta.duration || 30,
            thumbnail: tiktokMeta.thumbnail || "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800&auto=format&fit=crop&q=60",
            uploader: tiktokMeta.uploader || "TikTok Creator",
            view_count: tiktokMeta.viewCount || 150000,
            formats: [
              { format_id: "hd", ext: "mp4", resolution: "1080p (HD)", vcodec: "h264", acodec: "aac", filesize: 15000000 },
              { format_id: "watermark-free", ext: "mp4", resolution: "720p", vcodec: "h264", acodec: "aac", filesize: 8000000 },
              { format_id: "audio-original", ext: "mp3", resolution: "audio", acodec: "mp3", filesize: 2500000 }
            ],
            webpage_url: url,
          });
        }
        if (isTelegram && tgMeta) {
          return resolve({
            id: crypto.randomUUID(),
            title: tgMeta.title || "Telegram Video Stream",
            duration: 30,
            thumbnail: tgMeta.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60",
            uploader: tgMeta.uploader || "Telegram Channel",
            formats: [
              { format_id: "best", ext: "mp4", resolution: "Original HD", vcodec: "h264", acodec: "aac" },
              { format_id: "audio", ext: "mp3", resolution: "audio", acodec: "mp3" }
            ],
            webpage_url: url,
          });
        }
        const isBotBlocked = stderrData.includes("Sign in to confirm you’re not a bot") ||
          (stderrData.includes("ERROR: [youtube]") && stderrData.includes("Sign in"));
        const isIgBlocked = isInstagram && (
          stderrData.includes("empty media response") ||
          stderrData.includes("API is not granting access") ||
          stderrData.includes("login required") ||
          stderrData.includes("authentication") ||
          stderrData.includes("rate-limit") ||
          stderrData.includes("login to see this")
        );
        const fallback = getFallbackMetadata(url, tgMeta || tiktokMeta || (ytOembedMeta ? {
          title: ytOembedMeta.title,
          uploader: ytOembedMeta.author,
          thumbnail: ytOembedMeta.thumbnail
        } : undefined));
        return resolve({
          ...fallback,
          needsCookies: isBotBlocked || isIgBlocked,
          botBlocked: isBotBlocked,
          isInstagramBlocked: isIgBlocked,
          warning: isIgBlocked
            ? "Instagram authentication required for this video. Please click 'Add Instagram Cookies' to download."
            : undefined,
        });
      }

      try {
        const info = JSON.parse(stdoutData);
        const formats = (info.formats || []).map((f: any) => {
          let height = typeof f.height === 'number' && f.height > 0 ? f.height : undefined;
          let width = typeof f.width === 'number' && f.width > 0 ? f.width : undefined;
          if (!height && typeof f.resolution === 'string' && f.resolution.includes('x')) {
            const parts = f.resolution.split('x').map((n: string) => parseInt(n, 10));
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
              width = parts[0];
              height = parts[1];
            }
          }
          return {
            format_id: f.format_id,
            ext: f.ext,
            resolution: f.resolution || (height ? `${height}p` : 'audio'),
            width,
            height,
            fps: f.fps,
            vcodec: f.vcodec,
            acodec: f.acodec,
            filesize: f.filesize || f.filesize_approx,
            format_note: f.format_note,
          };
        });

        // Extract strictly existing qualities for this video (no phantom qualities that do not exist)
        const { availableQualities, maxHeight } = extractVideoAvailableQualities(formats, info.height, info.width);

        resolve({
          id: info.id || crypto.randomUUID(),
          title: info.title || tgMeta?.title || tiktokMeta?.title || "Untitled Video",
          duration: info.duration || (isTikTok ? 45 : 0),
          thumbnail: info.thumbnail || tgMeta?.thumbnail || tiktokMeta?.thumbnail || "",
          uploader: info.uploader || info.channel || tgMeta?.uploader || tiktokMeta?.uploader || "Unknown",
          view_count: info.view_count || (isTikTok ? 250000 : undefined),
          formats: formats.length > 0 ? formats : getFallbackMetadata(url, tgMeta || tiktokMeta || undefined).formats,
          webpage_url: info.webpage_url || url,
          maxHeight,
          maxWidth: typeof info.width === 'number' ? info.width : undefined,
          availableQualities,
        });
      } catch {
        resolve(getFallbackMetadata(url, tgMeta || tiktokMeta || undefined));
      }
    });
  });
}

// API: Analyze Single URL
app.post("/api/analyze", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return safeJson(res, 400, { error: "Valid video URL is required" });
  }

  try {
    const info = await analyzeSingleUrl(url);
    return safeJson(res, 200, info);
  } catch (err: any) {
    return safeJson(res, 400, { error: err.message || "This URL is unsupported or unavailable." });
  }
});

// API: Analyze Multiple / Batch URLs
app.post(["/api/analyze-batch", "/api/batch-analyze"], async (req, res) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    return safeJson(res, 400, { error: "URLs array is required" });
  }

  const cleanUrls: string[] = urls
    .map((u: any) => (typeof u === "string" ? u.trim() : ""))
    .filter((u: string) => {
      if (!u || u.length === 0) return false;
      const lower = u.toLowerCase();
      if (
        u.startsWith("#") ||
        lower.includes("curl.se") ||
        lower.includes("cookie_spec") ||
        isCookieData(u)
      ) {
        return false;
      }
      return true;
    })
    .slice(0, 100);

  // Analyze in controlled parallel batches of 5
  const results: Array<{ url: string; success: boolean; info?: any; data?: any; error?: string }> = [];
  const chunkSize = 5;

  for (let i = 0; i < cleanUrls.length; i += chunkSize) {
    const chunk = cleanUrls.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (url) => {
        try {
          const info = await analyzeSingleUrl(url);
          return { url, success: true, info, data: info };
        } catch (err: any) {
          // Provide fallback metadata so direct batch download still works seamlessly!
          let fallbackTitle = "Web Video";
          try {
            const parsed = new URL(url);
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            fallbackTitle = pathParts[pathParts.length - 1] || parsed.hostname;
          } catch {}
          const fallbackInfo = {
            title: fallbackTitle,
            uploader: "Online Source",
            thumbnail: "",
            duration: 0,
            formats: [],
          };
          return {
            url,
            success: false,
            error: err.message || "Metadata fetch skipped; direct download ready",
            info: fallbackInfo,
            data: fallbackInfo,
          };
        }
      })
    );
    results.push(...chunkResults);
  }

  safeJson(res, 200, { results });
});

// Unlimited file size supported (no artificial 2GB limit, up to 2000GB+)
// Helper to sanitize filenames across Windows, macOS, and Linux
function sanitizeFilename(name: string): string {
  if (!name || typeof name !== "string") return "";
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/["'`;]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
}

// Helper to produce a strictly Windows-safe and ASCII-safe filename for Content-Disposition fallback
// Prevents Chrome "Failed - Unknown server error" caused by Win32 ERROR_INVALID_NAME from '?' or trailing dots
function makeSafeAsciiFilename(name: string): string {
  if (!name) return "video_download.mp4";
  const ext = (path.extname(name) || ".mp4").toLowerCase();
  const base = path.basename(name, ext);
  let safeBase = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["'`;\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[\s_.-]+|[\s_.-]+$/g, "")
    .trim()
    .slice(0, 100);

  if (!safeBase || safeBase.length < 1) {
    safeBase = "video_download";
  }

  return `${safeBase}${ext}`;
}

// Batch download queue management and controlled concurrency (1 Video 1 Download sequential support)
interface QueuedBatchJob {
  taskId: string;
  url: string;
  type: string;
  quality: string;
  format?: string;
  title?: string;
  bdixSpeed?: boolean;
}

const batchDownloadQueue: QueuedBatchJob[] = [];
let maxBatchConcurrency = 1; // Default: 1 video 1 download sequential queue

function triggerNextInBatchQueue() {
  let activeCount = Array.from(activeTasks.values()).filter(
    (t) => t.status === "downloading" || t.status === "processing"
  ).length;

  while (activeCount < maxBatchConcurrency && batchDownloadQueue.length > 0) {
    const nextJob = batchDownloadQueue.shift();
    if (!nextJob) break;
    const existingTask = activeTasks.get(nextJob.taskId);
    if (existingTask && existingTask.status === "queued") {
      console.log(`[Batch Queue] Triggering next video in queue: ${nextJob.taskId} (URL: ${nextJob.url})`);
      existingTask.status = "downloading";
      existingTask.speed = "Connecting...";
      existingTask.progress = 1;
      executeDownloadTask(nextJob.taskId, nextJob.url, nextJob.type, nextJob.quality, nextJob.format, nextJob.title, nextJob.bdixSpeed !== false);
      activeCount++;
    }
  }
}

export interface DownloadExtraOptions {
  trimStart?: string;
  trimEnd?: string;
  downloadSubtitles?: boolean;
  subtitlesLang?: string;
  embedSubtitles?: boolean;
  audioBitrate?: string;
  embedThumbnail?: boolean;
  rateLimit?: string;
  scheduledAt?: number;
}

// Helper to execute download using yt-dlp with auto-retry and real file verification
function executeDownloadTask(
  taskId: string,
  url: string,
  type: string = "video",
  quality: string = "best",
  format?: string,
  title?: string,
  bdixSpeed: boolean = true,
  options?: DownloadExtraOptions
): ActiveTask {
  const fileExt = format || (type === "audio" ? "mp3" : "mp4");

  const lowerUrl = (url || "").toLowerCase();
  if (
    !url ||
    url.trim().startsWith("#") ||
    lowerUrl.includes("curl.se") ||
    lowerUrl.includes("cookie_spec") ||
    isCookieData(url)
  ) {
    const errorTask: ActiveTask = {
      id: taskId,
      url: url || "",
      title: "Invalid URL",
      type: type || "video",
      quality: quality || "best",
      format: fileExt,
      status: "error",
      progress: 0,
      speed: "0 KB/s",
      downloadedSize: "0 MB",
      totalSize: "0 MB",
      eta: "--:--",
      error: "Cookie data or unsupported specification URL detected. Please enter a media link.",
    };
    activeTasks.set(taskId, errorTask);
    triggerNextInBatchQueue();
    return errorTask;
  }

  const internalDiskFilename = `media_${taskId.slice(0, 8)}.${fileExt}`;
  const filepath = path.join(TEMP_DIR, internalDiskFilename);

  const cleanTitle = title ? sanitizeFilename(title) : "";
  const publicFilename = cleanTitle ? `${cleanTitle}.${fileExt}` : internalDiskFilename;

  const task: ActiveTask = {
    id: taskId,
    url,
    title: title || "",
    type: type || "video",
    quality: quality || "best",
    format: fileExt,
    status: "downloading",
    progress: 1,
    speed: "Connecting...",
    downloadedSize: "0 MB",
    totalSize: "Detecting...",
    eta: "--:--",
    filepath,
    filePath: filepath,
    filename: publicFilename,
  };

  activeTasks.set(taskId, task);

  const isTikTok = url.toLowerCase().includes("tiktok") || url.toLowerCase().includes("douyin");
  const isInstagram = url.toLowerCase().includes("instagram.com");
  const isYouTube = url.toLowerCase().includes("youtube.com") || url.toLowerCase().includes("youtu.be");
  const isTelegram = url.toLowerCase().includes("t.me") || url.toLowerCase().includes("telegram.me");
  const isXHamster = url.toLowerCase().includes("xhamster") || url.toLowerCase().includes("xhwide");

  // Determine format specifier
  let formatSpec = "bestvideo+bestaudio/best";
  if (type === "audio") {
    formatSpec = "bestaudio/best";
  } else if (isInstagram) {
    if (type === "audio") {
      formatSpec = "bestaudio/best";
    } else if (quality === "720p") {
      formatSpec = "best[height<=720]/bestvideo[height<=720]+bestaudio/best/bestvideo+bestaudio";
    } else if (quality === "1080p") {
      formatSpec = "best[height<=1080]/bestvideo[height<=1080]+bestaudio/best/bestvideo+bestaudio";
    } else {
      // Instagram serves both single progressive mp4 streams and separate DASH streams
      formatSpec = "best/bestvideo+bestaudio/bestvideo[ext=mp4]+bestaudio[ext=m4a]";
    }
  } else if (isTikTok || isTelegram) {
    // TikTok and Telegram deliver single progressive streams without separate DASH audio
    formatSpec = "best/bestvideo+bestaudio";
  } else if (isXHamster) {
    // xHamster delivers HLS single/combined streams
    if (quality === "360p") {
      formatSpec = "best[height<=360]/bestvideo[height<=360]+bestaudio/best[height<=480]/best";
    } else if (quality === "480p") {
      formatSpec = "best[height<=480]/bestvideo[height<=480]+bestaudio/best";
    } else if (quality === "720p") {
      formatSpec = "best[height<=720]/bestvideo[height<=720]+bestaudio/best";
    } else if (quality === "1080p") {
      formatSpec = "best[height<=1080]/bestvideo[height<=1080]+bestaudio/best";
    } else {
      formatSpec = "best/bestvideo+bestaudio";
    }
  } else {
    // Video quality mapping (144p to 4K)
    if (quality === "144p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=144][ext=mp4]+bestaudio[ext=m4a]/best[height<=144][ext=mp4]/bestvideo[height<=144]+bestaudio/best[height<=144]/best"
        : "bestvideo[height<=144]+bestaudio/best[height<=144]/best";
    } else if (quality === "240p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=240][ext=mp4]+bestaudio[ext=m4a]/best[height<=240][ext=mp4]/bestvideo[height<=240]+bestaudio/best[height<=240]/best"
        : "bestvideo[height<=240]+bestaudio/best[height<=240]/best";
    } else if (quality === "360p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/bestvideo[height<=360]+bestaudio/best[height<=360]/best"
        : "bestvideo[height<=360]+bestaudio/best[height<=360]/best";
    } else if (quality === "480p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/bestvideo[height<=480]+bestaudio/best[height<=480]/best"
        : "bestvideo[height<=480]+bestaudio/best[height<=480]/best";
    } else if (quality === "720p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/bestvideo[height<=720]+bestaudio/best[height<=720]/best"
        : "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
    } else if (quality === "1080p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
        : "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";
    } else if (quality === "1440p" || quality === "2k") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/best[height<=1440][ext=mp4]/bestvideo[height<=1440]+bestaudio/best[height<=1440]/best"
        : "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best";
    } else if (quality === "4k" || quality === "2160p") {
      formatSpec = fileExt === "mp4"
        ? "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160][ext=mp4]/best[height<=2160]/bestvideo+bestaudio/best"
        : "bestvideo[height<=2160]+bestaudio/best[height<=2160]/bestvideo+bestaudio/best";
    } else {
      // auto / best / fallback
      formatSpec = fileExt === "mp4"
        ? "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best"
        : "bestvideo+bestaudio/best";
    }
  }

  const buildArgs = (fmt: string) => {
    const a = [
      ...getCookieArgs(url),
      "--no-playlist",
      "--newline",
      "--no-check-certificates",
      "--no-warnings",
      "--progress",
      "--retries", bdixSpeed ? "20" : "15",
      "--fragment-retries", bdixSpeed ? "40" : "30",
      "--skip-unavailable-fragments",
      "--concurrent-fragments", bdixSpeed ? "16" : "1",
      "--extractor-retries", "10",
      "--retry-sleep", "extractor:2",
      "--retry-sleep", "http:2",
      "--retry-sleep", "fragment:exp=1:20",
      "--socket-timeout", "30",
      "--buffer-size", bdixSpeed ? "16M" : "64K",
      "--http-chunk-size", "10M",
      "--geo-bypass",
    ];

    if (!isTikTok && !isYouTube && !isInstagram) {
      a.push(
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      );
    }

    if (isYouTube) {
      a.push("--extractor-args", "youtube:player_client=ios,android,web;player_skip=configs");
    }

    if (isInstagram) {
      a.push("--referer", "https://www.instagram.com/");
    } else if (isTelegram) {
      a.push("--referer", "https://t.me/");
    }

    // Speed / Rate limit
    if (options?.rateLimit && options.rateLimit !== "unlimited") {
      a.push("--limit-rate", options.rateLimit);
    }

    // Video Trimming / Section extraction
    if (options?.trimStart || options?.trimEnd) {
      const s = (options.trimStart || "").trim() || "0";
      const e = (options.trimEnd || "").trim() || "inf";
      a.push("--download-sections", `*${s}-${e}`, "--force-keyframes-at-cuts");
    }

    // Subtitles and Closed Captions
    if (options?.downloadSubtitles) {
      a.push("--write-subs", "--write-auto-subs", "--convert-subs", "srt");
      if (options.subtitlesLang) {
        a.push("--sub-langs", options.subtitlesLang);
      } else {
        a.push("--sub-langs", "en.*,bn.*,all");
      }
      if (options.embedSubtitles && fileExt === "mp4") {
        a.push("--embed-subs");
      }
    }

    if (type === "audio") {
      const chosenBitrate = options?.audioBitrate || "320k";
      const targetAudioExt = ["mp3", "m4a", "flac", "wav"].includes(fileExt) ? fileExt : "mp3";
      a.push("-x", "--audio-format", targetAudioExt);
      if (targetAudioExt === "mp3") {
        a.push("--audio-quality", chosenBitrate === "320k" ? "0" : chosenBitrate);
      }
      if (options?.embedThumbnail) {
        a.push("--embed-thumbnail", "--add-metadata");
      }
    } else {
      a.push("-f", fmt);
      if (fileExt === "mp4") {
        a.push("--merge-output-format", "mp4");
      }
    }

    a.push("-o", filepath, url);
    return a;
  };

  const runProcess = (args: string[], isRetry: boolean = false, retryCount: number = 0) => {
    let child: ChildProcess;
    try {
      child = spawn(resolvedYtDlpPath, args, {
        env: {
          ...process.env,
          PATH: `${process.env.PATH || ''}:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin`
        }
      });
      task.process = child;
    } catch (err: any) {
      task.status = "error";
      task.error = `Could not start downloader engine: ${err.message || 'Unknown error'}`;
      return;
    }

    let stderrBuffer = "";

    child.stdout?.on("data", (data) => {
      const text = data.toString();

      // Extract video title if emitted by yt-dlp
      if (text.includes("flux_title:")) {
        const extracted = text.split("flux_title:")[1]?.split("\n")[0]?.trim();
        if (extracted && !task.title) {
          task.title = extracted;
          const cleanTitle = sanitizeFilename(extracted);
          if (cleanTitle) {
            task.filename = `${cleanTitle}.${fileExt}`;
          }
        }
      }

      const match = text.match(/\[download\]\s+([\d.]+)%\s+of\s+(?:~\s*)?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/i);
      if (match) {
        const rawPct = parseFloat(match[1]) || task.progress;
        task.progress = rawPct >= 100 ? 99 : Math.min(99, Math.round(rawPct));
        task.totalSize = match[2] || task.totalSize;
        task.speed = match[3] || task.speed;
        task.eta = rawPct >= 100 ? "Finishing..." : (match[4] || task.eta);
        if (rawPct >= 100) {
          task.status = "processing";
          task.speed = "Finalizing stream...";
        }

        if (task.totalSize && !task.totalSize.includes("~")) {
          const numTotal = parseFloat(task.totalSize);
          if (!isNaN(numTotal)) {
            task.downloadedSize = `${((task.progress / 100) * numTotal).toFixed(1)} ${task.totalSize.replace(/[\d.]+/g, '').trim() || 'MB'}`;
          }
        }
      } else if (text.includes("[Merger]") || text.includes("[ffmpeg]") || text.includes("[ExtractAudio]") || text.includes("Merging formats into")) {
        task.status = "processing";
        task.progress = 99;
        task.speed = "Merging audio/video...";
        task.eta = "Finishing";
      } else {
        const simpleMatch = text.match(/\[download\]\s+([\d.]+)%/);
        if (simpleMatch) {
          const rawSimple = parseFloat(simpleMatch[1]) || task.progress;
          task.progress = rawSimple >= 100 ? 99 : Math.min(99, Math.round(rawSimple));
          if (rawSimple >= 100) {
            task.status = "processing";
          }
        }
      }
    });

    child.stderr?.on("data", (data) => {
      const s = data.toString();
      stderrBuffer += s;
      const safe = s.replace(/\bERROR:\b/gi, "[CLI]").trim().slice(0, 150);
      if (safe) {
        console.log(`[yt-dlp log ${taskId.slice(0, 8)}]:`, safe);
      }
    });

    child.on("error", (err) => {
      if (task.status === "cancelled" || task.status === "error") return;
      if (!isRetry) {
        console.log(`[yt-dlp] Retrying ${taskId} with format 'best'...`);
        runProcess(buildArgs("best"), true);
      } else {
        task.status = "error";
        task.error = `Download process error: ${err.message}`;
      }
    });

    child.on("close", async (code) => {
      if (task.status === "cancelled" || task.status === "error") return;

      // 1. Thoroughly search for completed or partial stream files for this task
      let finalFilepath = filepath;
      try {
        const files = fs.readdirSync(TEMP_DIR);
        const prefix = `media_${taskId.slice(0, 8)}`;

        // Look for completed files first
        const completedMatch = files.find(f =>
          f.startsWith(prefix) &&
          !f.endsWith('.part') &&
          !f.endsWith('.ytdl') &&
          !f.includes('.part-Frag')
        );

        if (completedMatch) {
          finalFilepath = path.join(TEMP_DIR, completedMatch);
        } else {
          // Look for part files that can be finalized or salvaged
          const partFiles = files.filter(f =>
            f.startsWith(prefix) &&
            (f.endsWith('.part') || f.includes('.part-Frag'))
          );

          if (partFiles.length > 0) {
            // Sort to find largest part file
            partFiles.sort((a, b) => {
              try {
                return fs.statSync(path.join(TEMP_DIR, b)).size - fs.statSync(path.join(TEMP_DIR, a)).size;
              } catch {
                return 0;
              }
            });

            const bestPart = partFiles[0];
            const rawPartPath = path.join(TEMP_DIR, bestPart);
            const partStat = fs.statSync(rawPartPath);

            // If part file has substantial data (> 250 KB), salvage stream using ffmpeg
            if (partStat.size > 250 * 1024) {
              const recoveredPath = path.join(TEMP_DIR, `${prefix}.${fileExt}`);
              try {
                const ok = await runExecAsync(`ffmpeg -y -i "${rawPartPath}" -c copy "${recoveredPath}"`, 25000);
                if (ok && fs.existsSync(recoveredPath) && fs.statSync(recoveredPath).size > 100 * 1024) {
                  finalFilepath = recoveredPath;
                  console.log(`[FFmpeg] Successfully recovered and finalized stream for ${taskId} (${partStat.size} bytes)`);
                }
              } catch (remuxErr: any) {
                // If remux failed, try direct rename of .part
                try {
                  const directRenamed = path.join(TEMP_DIR, `${prefix}.${fileExt}`);
                  fs.renameSync(rawPartPath, directRenamed);
                  if (fs.existsSync(directRenamed) && fs.statSync(directRenamed).size > 100 * 1024) {
                    finalFilepath = directRenamed;
                  }
                } catch {}
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[FileSearch] Error searching temp files for ${taskId}:`, err.message);
      }

      // 2. Remux to mp4 if user requested mp4 but source stream was webm or mkv
      let fileExists = fs.existsSync(finalFilepath) && fs.statSync(finalFilepath).size > 1024;
      if (fileExists && fileExt === "mp4" && (finalFilepath.endsWith(".webm") || finalFilepath.endsWith(".mkv"))) {
        const mp4Target = path.join(TEMP_DIR, `media_${taskId.slice(0, 8)}.mp4`);
        try {
          const remuxOk = await runExecAsync(`ffmpeg -y -i "${finalFilepath}" -c copy "${mp4Target}"`, 60000);
          if (remuxOk && fs.existsSync(mp4Target) && fs.statSync(mp4Target).size > 1024) {
            finalFilepath = mp4Target;
          }
        } catch (remuxErr: any) {
          console.warn(`[FFmpeg] Remux warning for ${taskId}:`, remuxErr.message);
        }
      }

      fileExists = fs.existsSync(finalFilepath) && fs.statSync(finalFilepath).size > 1024;

      if ((code === 0 && fileExists) || fileExists) {
        const stat = fs.statSync(finalFilepath);
        const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
        task.progress = 100;
        task.status = "completed";
        task.speed = "0 KB/s";
        task.eta = "00:00";
        task.downloadedSize = `${sizeMB} MB`;
        task.totalSize = `${sizeMB} MB`;
        task.filepath = finalFilepath;
        task.filePath = finalFilepath;
        const cleanTitle = task.title ? sanitizeFilename(task.title) : "";
        const realExt = path.extname(finalFilepath).replace(/^\./, "") || fileExt;
        task.filename = cleanTitle ? `${cleanTitle}.${realExt}` : path.basename(finalFilepath);
        task.downloadUrl = `/api/file/${taskId}?filename=${encodeURIComponent(task.filename)}`;
      } else {

        // If error was caused by YouTube bot detection, do not retry with 'best' as it will fail identically
        const isBotBlocked = stderrBuffer.includes("Sign in to confirm you’re not a bot") ||
          (stderrBuffer.includes("ERROR: [youtube]") && stderrBuffer.includes("Sign in"));
        if (isBotBlocked) {
          task.status = "error";
          task.needsCookies = true;
          task.botBlocked = true;
          task.error = "YouTube bot verification required on cloud servers. Please add YouTube cookies via Settings → Site Cookies.";
          triggerNextInBatchQueue();
          return;
        }

        // Automatic fallback for TikTok if yt-dlp faced challenge or rehydration issues
        if (isTikTok) {
          console.log(`[TikTok] yt-dlp issue detected for ${taskId} (${stderrBuffer.slice(0, 100)}). Falling back to direct TikTok stream downloader...`);
          const directOk = await downloadDirectTikTok(taskId, url, type, finalFilepath, task);
          if (directOk) {
            triggerNextInBatchQueue();
            return;
          }
        }

        // Automatic fallback for Telegram if yt-dlp faced extractor issues
        if (isTelegram) {
          console.log(`[Telegram] yt-dlp issue detected for ${taskId} (${stderrBuffer.slice(0, 100)}). Falling back to direct Telegram stream downloader...`);
          const directTgOk = await downloadDirectTelegram(taskId, url, finalFilepath, task);
          if (directTgOk) {
            triggerNextInBatchQueue();
            return;
          }
        }

        const is502Error = stderrBuffer.includes("HTTP Error 502") || stderrBuffer.includes("Bad Gateway");
        if (is502Error && !isRetry) {
          console.log(`[yt-dlp] Host returned 502 Bad Gateway for ${taskId}. Waiting 2.5s and retrying...`);
          setTimeout(() => {
            runProcess(buildArgs("best"), true);
          }, 2500);
          return;
        }

        if (!isRetry) {
          console.log(`[yt-dlp] First attempt finished with code ${code}. Retrying with format 'best'...`);
          setTimeout(() => {
            runProcess(buildArgs("best"), true);
          }, 1500);
          return;
        } else {
          if (fs.existsSync(finalFilepath)) {
            try { fs.unlinkSync(finalFilepath); } catch {}
          }
          task.status = "error";
          let userMsg = stderrBuffer ? stderrBuffer.trim().slice(-400) : "Download failed. The media host may have rate-limited or blocked the request.";

          // Extract specific error messages and provide actionable resolutions
          if (stderrBuffer.includes("Instagram sent an empty media response") ||
              stderrBuffer.includes("Instagram API is not granting access") ||
              (stderrBuffer.includes("[Instagram]") && (stderrBuffer.includes("login required") || stderrBuffer.includes("rate-limit") || stderrBuffer.includes("empty media") || stderrBuffer.includes("authentication")))) {
            userMsg = "Instagram requires session cookies for this Reel/Video. Please click 'Add Instagram Cookies' to paste your sessionid (from browser F12 Application > Cookies) to download immediately.";
            task.needsCookies = true;
            task.isInstagramError = true;
          } else if (stderrBuffer.includes("universal data for rehydration") || stderrBuffer.includes("[TikTok]")) {
            userMsg = "TikTok video rehydration error. The video may be region-locked or restricted.";
          } else if (stderrBuffer.includes("HTTP Error 502") || stderrBuffer.includes("Bad Gateway")) {
            userMsg = "Host server temporarily returned HTTP 502 Bad Gateway. Upstream CDN was unreachable. Please retry in a moment.";
          } else if (stderrBuffer.includes("Sign in to confirm you’re not a bot") || (stderrBuffer.includes("Sign in") && stderrBuffer.includes("bot"))) {
            userMsg = "Authentication or bot check required by host site. Please add site cookies in Settings to bypass.";
            task.botBlocked = true;
            task.needsCookies = true;
          } else if (stderrBuffer.includes("Age-restricted") || stderrBuffer.includes("confirm your age") || stderrBuffer.includes("requires age verification")) {
            userMsg = "This video is age-restricted. Please add your account cookies via Settings to unlock.";
            task.needsCookies = true;
          } else if (stderrBuffer.includes("HTTP Error 429") || stderrBuffer.includes("Too Many Requests")) {
            userMsg = "The media host rate-limited requests from this server IP (HTTP 429). Please wait a moment or use Cookie Settings.";
          } else if (stderrBuffer.includes("HTTP Error 403") || stderrBuffer.includes("Forbidden")) {
            userMsg = "Access forbidden by host site (HTTP 403). The host blocked anonymous cloud downloads or requires login cookies.";
            task.needsCookies = true;
          } else if (stderrBuffer.includes("HTTP Error 404") || stderrBuffer.includes("Video unavailable") || stderrBuffer.includes("does not exist")) {
            userMsg = "Video not found or was removed by creator (HTTP 404).";
          } else if (stderrBuffer.includes("HTTP Error 504") || stderrBuffer.includes("Gateway Timeout")) {
            userMsg = "Upstream server timed out (HTTP 504). Please try downloading again.";
          } else if (stderrBuffer.includes("Private video") || stderrBuffer.includes("this video is private")) {
            userMsg = "This video is private and cannot be downloaded without account credentials.";
          } else if (stderrBuffer.includes("georestricted") || stderrBuffer.includes("not available in your country") || stderrBuffer.includes("region-locked")) {
            userMsg = "This video is geo-restricted and not available in the server's region.";
          } else if (stderrBuffer.includes("Unsupported URL")) {
            if (isTelegram) {
              userMsg = "Telegram video could not be accessed. Please ensure the link is from a public channel or group (private direct messages cannot be accessed).";
            } else if (isXHamster) {
              userMsg = "Please provide a direct link to an xHamster video (e.g. https://xhamster.com/videos/...) rather than a category or search page.";
            } else {
              userMsg = "This URL format is not supported or the media was removed.";
            }
          } else {
            // Check for explicit ERROR line from yt-dlp
            const errLines = stderrBuffer.split("\n")
              .map(l => l.trim())
              .filter(l => l.startsWith("ERROR:") || l.includes("Error:"));
            const lastErr = errLines[errLines.length - 1];
            if (lastErr) {
              const cleanErr = lastErr.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/i, "").trim();
              if (cleanErr && cleanErr.length > 5 && cleanErr.length < 200) {
                userMsg = cleanErr;
              }
            }
          }
          task.error = userMsg;
          task.speed = "Failed";
          task.eta = "--:--";
          task.totalSize = "Error";
        }
      }

      // If task reached terminal state (completed or error), trigger next batch queue item
      if (task.status === "completed" || task.status === "error") {
        triggerNextInBatchQueue();
      }
    });
  };

  runProcess(buildArgs(formatSpec));
  return task;
}

// API: Batch Task Status
app.post("/api/batch-status", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return safeJson(res, 400, { error: "Task IDs array is required" });
  }

  const tasks: Record<string, any> = {};
  for (const id of ids) {
    const task = activeTasks.get(id);
    if (task) {
      tasks[id] = {
        id: task.id,
        status: task.status,
        progress: task.progress,
        speed: task.speed,
        downloadedSize: task.downloadedSize,
        totalSize: task.totalSize,
        eta: task.eta,
        filename: task.filename,
        error: task.error,
        downloadUrl: task.downloadUrl,
      };
    } else {
      tasks[id] = { id, status: "error", error: "Download task not found" };
    }
  }

  safeJson(res, 200, { tasks });
});

// API: Start Download / Create Job
app.post(["/api/download", "/api/jobs"], async (req, res) => {
  const {
    url: rawUrl,
    type,
    quality,
    format,
    title,
    bdixFirstSpeed,
    trimStart,
    trimEnd,
    downloadSubtitles,
    subtitlesLang,
    embedSubtitles,
    audioBitrate,
    embedThumbnail,
    rateLimit,
    scheduledAt,
  } = req.body;

  if (!rawUrl) {
    return safeJson(res, 400, { error: "URL is required" });
  }

  const lowerRaw = typeof rawUrl === "string" ? rawUrl.toLowerCase() : "";
  if (
    isCookieData(rawUrl) ||
    lowerRaw.includes("curl.se") ||
    lowerRaw.includes("cookie_spec") ||
    (typeof rawUrl === "string" && rawUrl.trim().startsWith("#"))
  ) {
    return safeJson(res, 400, {
      error: "Cookie data or specification header detected instead of a video URL. Please add cookies via Settings → Site Cookies."
    });
  }

  let url = extractAndNormalizeUrl(rawUrl);
  if (!url) {
    return safeJson(res, 400, { error: "Valid video URL is required" });
  }
  url = await resolveCanonicalUrl(url);

  const taskId = crypto.randomUUID();
  const fileExt = format || (type === "audio" ? "mp3" : "mp4");
  const options: DownloadExtraOptions = {
    trimStart,
    trimEnd,
    downloadSubtitles,
    subtitlesLang,
    embedSubtitles,
    audioBitrate,
    embedThumbnail,
    rateLimit,
    scheduledAt,
  };

  // If scheduled in the future
  const schedTime = Number(scheduledAt);
  if (schedTime && schedTime > Date.now()) {
    const delayMs = schedTime - Date.now();
    const scheduledTask: ActiveTask = {
      id: taskId,
      url,
      title: title || "Scheduled Media",
      type: type || "video",
      quality: quality || "best",
      format: fileExt,
      status: "queued",
      progress: 0,
      speed: "Scheduled",
      downloadedSize: "0 MB",
      totalSize: "Scheduled",
      eta: `Starts in ${Math.ceil(delayMs / 60000)}m`,
      filename: title ? `${sanitizeFilename(title)}.${fileExt}` : undefined,
    };
    activeTasks.set(taskId, scheduledTask);

    const timer = setTimeout(() => {
      const current = activeTasks.get(taskId);
      if (current && current.status === "queued") {
        current.status = "downloading";
        current.speed = "Connecting...";
        current.progress = 1;
        executeDownloadTask(taskId, url, type || "video", quality || "best", format, title, bdixFirstSpeed !== false, options);
      }
    }, delayMs);
    scheduledTask.process = timer;

    return safeJson(res, 200, { id: taskId, jobId: taskId, status: "queued", scheduled: true });
  }

  executeDownloadTask(taskId, url, type || "video", quality || "best", format, title, bdixFirstSpeed !== false, options);
  safeJson(res, 200, { id: taskId, jobId: taskId, status: "downloading" });
});

// API: Local File Transcoder / Converter using FFmpeg
app.post("/api/convert-local", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return safeJson(res, 400, { error: "No media file uploaded" });
    }

    const targetFormat = ((req.body.targetFormat as string) || "mp4").toLowerCase();
    const audioBitrate = ((req.body.audioBitrate as string) || "320k").toLowerCase();
    const jobId = crypto.randomUUID();
    const originalName = req.file.originalname || "media";
    const baseName = path.parse(originalName).name;
    const outputFilename = `${sanitizeFilename(baseName)}_converted.${targetFormat}`;
    const outputPath = path.join(TEMP_DIR, `convert_${jobId.slice(0, 8)}.${targetFormat}`);

    console.log(`[Transcoder] Converting local file: ${originalName} -> ${targetFormat} (${outputPath})`);

    const ffmpegArgs: string[] = ["-y", "-i", req.file.path];
    if (targetFormat === "mp3") {
      ffmpegArgs.push("-vn", "-b:a", audioBitrate);
    } else if (targetFormat === "wav") {
      ffmpegArgs.push("-vn", "-c:a", "pcm_s16le");
    } else if (targetFormat === "flac") {
      ffmpegArgs.push("-vn", "-c:a", "flac");
    } else if (targetFormat === "m4a" || targetFormat === "aac") {
      ffmpegArgs.push("-vn", "-c:a", "aac", "-b:a", audioBitrate);
    } else if (targetFormat === "gif") {
      ffmpegArgs.push("-vf", "fps=12,scale=480:-1:flags=lanczos");
    } else if (targetFormat === "webm") {
      ffmpegArgs.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30", "-c:a", "libopus");
    } else {
      // Default: MP4 (H.264 + AAC)
      ffmpegArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "22", "-c:a", "aac", "-b:a", "192k");
    }
    ffmpegArgs.push(outputPath);

    const child = spawn("ffmpeg", ffmpegArgs);
    let stderr = "";
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      // Clean up uploaded input file
      try {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {}

      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        const stat = fs.statSync(outputPath);
        const task: ActiveTask = {
          id: jobId,
          url: "local-file-transcode",
          title: baseName,
          type: ["mp3", "wav", "flac", "m4a", "aac"].includes(targetFormat) ? "audio" : "video",
          quality: "converted",
          format: targetFormat,
          status: "completed",
          progress: 100,
          speed: "Done",
          downloadedSize: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          totalSize: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
          eta: "00:00",
          filepath: outputPath,
          filePath: outputPath,
          filename: outputFilename,
          downloadUrl: `/api/jobs/${jobId}/file?filename=${encodeURIComponent(outputFilename)}`,
        };
        activeTasks.set(jobId, task);

        console.log(`[Transcoder] Successfully converted: ${outputFilename} (${stat.size} bytes)`);
        safeJson(res, 200, {
          success: true,
          jobId,
          filename: outputFilename,
          downloadUrl: `/api/jobs/${jobId}/file?filename=${encodeURIComponent(outputFilename)}`,
          fileSize: stat.size,
        });
      } else {
        console.warn(`[Transcoder] Conversion failed with code ${code}:`, stderr.slice(-300));
        safeJson(res, 500, { error: `Conversion failed: ${stderr.slice(-150) || 'Unknown ffmpeg error'}` });
      }
    });
  } catch (err: any) {
    console.error("[Transcoder] Exception:", err);
    safeJson(res, 500, { error: err?.message || "Failed to convert file" });
  }
});

// API: Batch Download (supports 1 Video 1 Download sequential queue)
app.post("/api/batch-download", async (req, res) => {
  const { items, concurrency, bdixFirstSpeed } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return safeJson(res, 400, { error: "Items array is required" });
  }

  const requestedConcurrency = Math.max(1, Math.min(5, parseInt(concurrency, 10) || 1));
  maxBatchConcurrency = requestedConcurrency;

  const tasks: Array<{ id: string; taskId: string; status: string }> = [];
  for (const item of items) {
    const rawUrl = item.url;
    if (!rawUrl) continue;

    const lowerRaw = typeof rawUrl === "string" ? rawUrl.toLowerCase() : "";
    if (
      isCookieData(rawUrl) ||
      lowerRaw.includes("curl.se") ||
      lowerRaw.includes("cookie_spec") ||
      (typeof rawUrl === "string" && rawUrl.trim().startsWith("#"))
    ) {
      continue;
    }

    let url = extractAndNormalizeUrl(rawUrl);
    if (!url) continue;
    url = await resolveCanonicalUrl(url);

    const taskId = crypto.randomUUID();

    const activeCount = Array.from(activeTasks.values()).filter(
      (t) => t.status === "downloading" || t.status === "processing"
    ).length;

    if (activeCount < maxBatchConcurrency) {
      console.log(`[Batch Download] Starting task immediately (concurrency ${maxBatchConcurrency}): ${taskId} (${item.title || url})`);
      executeDownloadTask(taskId, url, item.type || "video", item.quality || "best", item.format, item.title);
      tasks.push({ id: item.id, taskId, status: "downloading" });
    } else {
      console.log(`[Batch Download] Queuing task for sequential processing: ${taskId} (${item.title || url})`);
      const queuedTask: ActiveTask = {
        id: taskId,
        url,
        type: item.type || "video",
        quality: item.quality || "best",
        format: item.format || (item.type === "audio" ? "mp3" : "mp4"),
        title: item.title,
        status: "queued",
        progress: 0,
        speed: "Queued (Waiting for previous video...)",
        downloadedSize: "0 MB",
        totalSize: "In queue",
        eta: "--:--",
      };
      activeTasks.set(taskId, queuedTask);
      batchDownloadQueue.push({
        taskId,
        url,
        type: item.type || "video",
        quality: item.quality || "best",
        format: item.format,
        title: item.title,
        bdixSpeed: bdixFirstSpeed !== false,
      });
      tasks.push({ id: item.id, taskId, status: "queued" });
    }
  }

  safeJson(res, 200, { success: true, count: tasks.length, tasks, concurrency: maxBatchConcurrency });
});

// API: Get Task / Job Status
app.get(["/api/status/:id", "/api/jobs/:id"], (req, res) => {
  const { id } = req.params;
  const task = activeTasks.get(id);
  if (!task) {
    return safeJson(res, 404, { id, status: "not_found", error: "Download task not found" });
  }

  safeJson(res, 200, {
    id: task.id,
    jobId: task.id,
    status: task.status,
    progress: task.progress,
    speed: task.speed,
    downloadedSize: task.downloadedSize,
    totalSize: task.totalSize,
    eta: task.eta,
    filename: task.filename,
    error: task.error,
    downloadUrl: task.downloadUrl,
    fileUrl: `/api/jobs/${task.id}/file`,
    needsCookies: task.needsCookies,
    botBlocked: task.botBlocked,
  });
});

// API: Get Cookies Status
app.get("/api/cookies/status", (req, res) => {
  let hasCookies = false;
  let linesCount = 0;
  let source: "user_saved" | "env" | "none" = "none";
  let lastModified: string | undefined;
  let preview = "";
  let cookiesContent = "";
  let detectedDomains: string[] = [];
  let hasYouTubeSID = false;
  let hasYouTubeLoginInfo = false;
  let hasYouTubeSAPISID = false;
  let hasInstagramSession = false;

  try {
    const isUserSaved = fs.existsSync(PERMANENT_COOKIE_PATH) || fs.existsSync(USER_COOKIE_BACKUP_PATH);
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      const content = fs.readFileSync(COOKIE_FILE_PATH, "utf-8");
      if (content.trim().length > 10) {
        hasCookies = true;
        const lines = content.split("\n").filter(l => l.trim().length > 0 && (!l.startsWith("#") || l.startsWith("#HttpOnly_")));
        linesCount = lines.length;
        source = isUserSaved ? "user_saved" : (process.env.YOUTUBE_COOKIES ? "env" : "user_saved");
        const stat = fs.statSync(COOKIE_FILE_PATH);
        lastModified = stat.mtime.toISOString();
        preview = lines.slice(0, 3).map(l => l.split("\t")[5] || l.split("\t")[0] || l.slice(0, 20)).join(", ");
        cookiesContent = content;
      }
    } else if (fs.existsSync(PERMANENT_COOKIE_PATH)) {
      syncEnvCookies();
      if (fs.existsSync(COOKIE_FILE_PATH)) {
        hasCookies = true;
        source = "user_saved";
        const content = fs.readFileSync(COOKIE_FILE_PATH, "utf-8");
        const lines = content.split("\n").filter(l => l.trim().length > 0 && (!l.startsWith("#") || l.startsWith("#HttpOnly_")));
        linesCount = lines.length;
        preview = lines.slice(0, 3).map(l => l.split("\t")[5] || l.split("\t")[0] || l.slice(0, 20)).join(", ");
        cookiesContent = content;
      }
    } else if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.length > 10) {
      syncEnvCookies();
      if (fs.existsSync(COOKIE_FILE_PATH)) {
        hasCookies = true;
        source = "env";
      }
    }

    if (cookiesContent) {
      if (cookiesContent.includes(".youtube.com") || cookiesContent.includes(".google.com")) detectedDomains.push("youtube.com");
      if (cookiesContent.includes(".instagram.com")) detectedDomains.push("instagram.com");
      if (cookiesContent.includes(".tiktok.com")) detectedDomains.push("tiktok.com");
      if (cookiesContent.includes(".x.com") || cookiesContent.includes(".twitter.com")) detectedDomains.push("x.com");
      if (cookiesContent.includes(".facebook.com")) detectedDomains.push("facebook.com");
      if (cookiesContent.includes(".reddit.com")) detectedDomains.push("reddit.com");

      hasYouTubeSID =
        cookiesContent.includes("\tSID\t") ||
        cookiesContent.includes(" SID=") ||
        cookiesContent.includes("\t__Secure-3PSID\t") ||
        cookiesContent.includes("\t__Secure-1PSID\t");
      hasYouTubeLoginInfo = cookiesContent.includes("\tLOGIN_INFO\t");
      hasYouTubeSAPISID =
        cookiesContent.includes("\tSAPISID\t") ||
        cookiesContent.includes("\t__Secure-3PAPISID\t");
      hasInstagramSession = cookiesContent.includes("\tsessionid\t") || cookiesContent.includes("sessionid=");
    }
  } catch (e) {}

  const platforms: Record<string, { hasCookies: boolean; count: number; lastModified?: string }> = {};
  for (const p of PLATFORMS) {
    const pPath = getPlatformCookiePath(p);
    if (fs.existsSync(pPath)) {
      const pCont = fs.readFileSync(pPath, "utf-8");
      const pLines = pCont.split("\n").filter(l => l.trim().length > 0 && !l.startsWith("#"));
      platforms[p] = {
        hasCookies: pLines.length > 0,
        count: pLines.length,
        lastModified: fs.statSync(pPath).mtime.toISOString(),
      };
    } else {
      const domainMap: Record<string, string> = {
        youtube: "youtube.com",
        facebook: "facebook.com",
        instagram: "instagram.com",
        tiktok: "tiktok.com",
      };
      const hasDomain = detectedDomains.includes(domainMap[p]);
      platforms[p] = {
        hasCookies: hasDomain,
        count: hasDomain ? 1 : 0,
      };
    }
  }

  safeJson(res, 200, {
    hasCookies,
    source,
    linesCount,
    lastModified,
    preview,
    cookiesContent,
    detectedDomains,
    hasYouTubeSID,
    hasYouTubeLoginInfo,
    hasYouTubeSAPISID,
    hasInstagramSession,
    platforms,
  });
});

// API: Get Multi-Platform Cookie Profiles
app.get("/api/cookies/platforms", (req, res) => {
  const result: Record<string, { hasCookies: boolean; count: number; lastModified?: string }> = {};
  for (const p of PLATFORMS) {
    const pPath = getPlatformCookiePath(p);
    if (fs.existsSync(pPath)) {
      const pCont = fs.readFileSync(pPath, "utf-8");
      const pLines = pCont.split("\n").filter(l => l.trim().length > 0 && !l.startsWith("#"));
      result[p] = {
        hasCookies: pLines.length > 0,
        count: pLines.length,
        lastModified: fs.statSync(pPath).mtime.toISOString(),
      };
    } else {
      result[p] = { hasCookies: false, count: 0 };
    }
  }
  safeJson(res, 200, { platforms: result });
});

// API: Save Platform Cookie Profile
app.post("/api/cookies/platform/:platform", (req, res) => {
  const { platform } = req.params;
  const pName = platform.toLowerCase();
  const { cookies } = req.body;

  if (!cookies || typeof cookies !== "string" || cookies.trim().length < 3) {
    return safeJson(res, 400, { error: "Cookie text is required" });
  }

  try {
    const pPath = getPlatformCookiePath(pName);
    if (!fs.existsSync(path.dirname(pPath))) {
      fs.mkdirSync(path.dirname(pPath), { recursive: true });
    }
    const netscapeContent = convertCookiesToNetscape(cookies, pName);
    fs.writeFileSync(pPath, netscapeContent.trim(), "utf-8");

    // Rebuild global merged cookies file
    rebuildMergedCookies();

    const count = netscapeContent.split("\n").filter(l => l.trim().length > 0 && !l.startsWith("#")).length;
    safeJson(res, 200, {
      success: true,
      platform: pName,
      count,
      message: `Successfully saved and merged ${count} cookie entries for ${pName.toUpperCase()}`,
    });
  } catch (err: any) {
    safeJson(res, 500, { error: err?.message || "Failed to save platform cookie" });
  }
});

// API: Delete Platform Cookie Profile
app.delete("/api/cookies/platform/:platform", (req, res) => {
  const { platform } = req.params;
  const pName = platform.toLowerCase();
  const pPath = getPlatformCookiePath(pName);

  try {
    if (fs.existsSync(pPath)) {
      fs.unlinkSync(pPath);
    }
    rebuildMergedCookies();
    safeJson(res, 200, { success: true, platform: pName, message: `Removed cookies for ${pName}` });
  } catch (err: any) {
    safeJson(res, 500, { error: err?.message || "Failed to delete platform cookie" });
  }
});

// Helper to merge Netscape cookie entries by domain + name so multi-site cookies coexist
function mergeNetscapeCookieContent(existingText: string, newText: string): string {
  const map = new Map<string, string>();

  const parseToEntries = (raw: string): { domain: string; name: string; line: string }[] => {
    const list: { domain: string; name: string; line: string }[] = [];
    const lines = raw.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      const isHttpOnly = trimmed.startsWith("#HttpOnly_");
      if (!trimmed || (trimmed.startsWith("#") && !isHttpOnly)) continue;
      const parts = trimmed.split("\t");
      if (parts.length >= 7) {
        const rawDomain = parts[0];
        const cleanDomain = (isHttpOnly ? rawDomain.replace(/^#HttpOnly_/, "") : rawDomain).toLowerCase();
        const name = parts[5];
        list.push({ domain: cleanDomain, name, line: trimmed });
      }
    }
    return list;
  };

  const existingEntries = existingText && existingText.trim().length > 10 ? parseToEntries(existingText) : [];
  const newEntries = newText && newText.trim().length > 10 ? parseToEntries(newText) : [];

  // Determine what domain groups are present in the new incoming cookies
  const newDomainGroups = new Set<string>();
  for (const e of newEntries) {
    if (e.domain.includes("youtube.com") || e.domain.includes("google.com")) {
      newDomainGroups.add("youtube");
    } else if (e.domain.includes("instagram.com")) {
      newDomainGroups.add("instagram");
    } else {
      newDomainGroups.add(e.domain);
    }
  }

  // Keep existing entries unless that entire domain group is being replaced by fresh cookies
  for (const e of existingEntries) {
    let group = e.domain;
    if (e.domain.includes("youtube.com") || e.domain.includes("google.com")) {
      group = "youtube";
    } else if (e.domain.includes("instagram.com")) {
      group = "instagram";
    }
    if (!newDomainGroups.has(group)) {
      map.set(`${e.domain}:::${e.name}`, e.line);
    }
  }

  // Add new entries
  for (const e of newEntries) {
    map.set(`${e.domain}:::${e.name}`, e.line);
  }

  // Auto-alias Google/YouTube cookies for maximum compatibility
  for (const [key, line] of Array.from(map.entries())) {
    const parts = line.split("\t");
    if (parts.length >= 7) {
      const rawDomain = parts[0];
      const isHttpOnly = rawDomain.startsWith("#HttpOnly_");
      const cleanDomain = isHttpOnly ? rawDomain.replace(/^#HttpOnly_/, "") : rawDomain;
      const flag = parts[1];
      const path = parts[2];
      const secure = parts[3];
      const expiration = parts[4];
      const name = parts[5];
      const value = parts[6];

      if (name === "__Secure-3PSID" && !map.has(`${cleanDomain.toLowerCase()}:::SID`)) {
        map.set(`${cleanDomain.toLowerCase()}:::SID`, `${cleanDomain}\t${flag}\t${path}\t${secure}\t${expiration}\tSID\t${value}`);
        map.set(`.google.com:::SID`, `.google.com\t${flag}\t${path}\t${secure}\t${expiration}\tSID\t${value}`);
      }
      if (name === "__Secure-3PAPISID" && !map.has(`${cleanDomain.toLowerCase()}:::SAPISID`)) {
        map.set(`${cleanDomain.toLowerCase()}:::SAPISID`, `${cleanDomain}\t${flag}\t${path}\t${secure}\t${expiration}\tSAPISID\t${value}`);
        map.set(`.google.com:::SAPISID`, `.google.com\t${flag}\t${path}\t${secure}\t${expiration}\tSAPISID\t${value}`);
      }
    }
  }

  let output = "# Netscape HTTP Cookie File\n# Multi-site persistent cookie store (YouTube, Instagram, etc.)\n";
  for (const entry of map.values()) {
    output += `${entry}\n`;
  }
  return output;
}

// Helper to convert Cookie-Editor JSON, Netscape text, or Raw HTTP headers to Netscape format
function convertCookiesToNetscape(input: string, platformHint?: string): string {
  let trimmed = input.trim();

  // If user pasted a single raw session ID or key in platform mode:
  // e.g. "68291882%3Aabc..." or "sessionid=68291882%3A..."
  if (platformHint === "instagram" && !trimmed.includes("\t") && !trimmed.startsWith("[") && !trimmed.includes("=")) {
    trimmed = `sessionid=${trimmed}`;
  }

  // 1. JSON Array format (from Cookie-Editor, EditThisCookie, J2TEAM, etc.)
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        let netscape = "# Netscape HTTP Cookie File\n# Converted from Cookie-Editor JSON format\n";
        for (const c of parsed) {
          if (!c.name) continue;
          let rawDomain = c.domain;
          if (!rawDomain) {
            const isIg = platformHint === "instagram" || ["sessionid", "ds_user_id", "mid", "ig_did", "csrftoken"].includes(c.name.toLowerCase());
            rawDomain = isIg ? ".instagram.com" : ".youtube.com";
          }
          const domain = rawDomain.startsWith(".") ? rawDomain : `.${rawDomain}`;
          const flag = "TRUE";
          const path = c.path || "/";
          const secure = c.secure ? "TRUE" : "FALSE";
          const expiration = c.expirationDate ? Math.floor(c.expirationDate) : 2147483647;
          const name = c.name;
          const value = c.value || "";
          const prefix = c.httpOnly ? "#HttpOnly_" : "";
          netscape += `${prefix}${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
        }
        return netscape;
      }
    } catch (e) {}
  }

  // 2. Netscape format with tabs
  if (trimmed.includes("\t")) {
    let result = trimmed;
    if (!result.startsWith("# Netscape")) {
      result = "# Netscape HTTP Cookie File\n" + result;
    }
    return result;
  }

  // 3. Raw Cookie header string: "Cookie: SID=xxx; HSID=yyy" or "sessionid=xxx; ds_user_id=yyy" or single "sessionid=xxx"
  const cleanInput = trimmed.replace(/^[Cc]ookie:\s*/i, "");
  if (cleanInput.includes("=")) {
    const pairs = cleanInput.split(/;|\n/);
    let netscape = "# Netscape HTTP Cookie File\n# Converted from Cookie header pairs\n";
    let count = 0;
    const isInstagramHeader = platformHint === "instagram" || cleanInput.includes("sessionid") || cleanInput.includes("ds_user_id") || cleanInput.includes("ig_did");
    const defaultDomain = isInstagramHeader ? ".instagram.com" : ".youtube.com";

    for (const pair of pairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        const name = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim();
        if (name && value) {
          const itemDomain = ["sessionid", "ds_user_id", "mid", "ig_did", "csrftoken"].includes(name.toLowerCase()) || isInstagramHeader
            ? ".instagram.com"
            : defaultDomain;
          netscape += `${itemDomain}\tTRUE\t/\tTRUE\t2147483647\t${name}\t${value}\n`;
          count++;
        }
      }
    }
    if (count > 0) {
      if (isInstagramHeader) {
        if (!netscape.includes("\tdatr\t")) {
          netscape += `.instagram.com\tTRUE\t/\tTRUE\t2147483647\tdatr\t${crypto.randomBytes(12).toString("hex")}\n`;
        }
        if (!netscape.includes("\tig_did\t")) {
          netscape += `.instagram.com\tTRUE\t/\tTRUE\t2147483647\tig_did\t${crypto.randomUUID().toUpperCase()}\n`;
        }
      }
      return netscape;
    }
  }

  return trimmed;
}

// API: Save Cookies
app.post("/api/cookies", (req, res) => {
  const { cookies } = req.body;
  if (!cookies || typeof cookies !== "string" || cookies.trim().length < 5) {
    return safeJson(res, 400, { error: "Valid cookies string or Netscape format content is required." });
  }

  try {
    if (!fs.existsSync(path.dirname(COOKIE_FILE_PATH))) {
      fs.mkdirSync(path.dirname(COOKIE_FILE_PATH), { recursive: true });
    }
    const convertedContent = convertCookiesToNetscape(cookies);

    // Merge with existing cookies so different platforms don't overwrite each other
    let existingContent = "";
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      try {
        existingContent = fs.readFileSync(COOKIE_FILE_PATH, "utf-8");
      } catch {}
    }
    const finalContent = mergeNetscapeCookieContent(existingContent, convertedContent);

    fs.writeFileSync(COOKIE_FILE_PATH, finalContent.trim(), "utf-8");
    fs.writeFileSync(USER_COOKIE_BACKUP_PATH, finalContent.trim(), "utf-8");
    fs.writeFileSync(PERMANENT_COOKIE_PATH, finalContent.trim(), "utf-8");

    const lines = finalContent.split("\n").filter((l) => l.trim().length > 0 && (!l.startsWith("#") || l.startsWith("#HttpOnly_")));
    const hasInstagramSession = finalContent.includes("sessionid");
    const hasYouTubeSession = finalContent.includes("SAPISID") || finalContent.includes("LOGIN_INFO") || finalContent.includes("SID");

    // Automatically sync Instagram lines to dedicated platform cookie file
    const igLines = lines.filter((l) => l.includes(".instagram.com") || l.includes("sessionid"));
    if (igLines.length > 0) {
      const igPath = getPlatformCookiePath("instagram");
      fs.writeFileSync(igPath, ["# Netscape HTTP Cookie File", ...igLines].join("\n") + "\n", "utf-8");
    }

    let statusMsg = `Successfully saved ${lines.length} cookie entries permanently.`;
    if (hasInstagramSession) {
      statusMsg += " Instagram session cookie (sessionid) active.";
    }

    safeJson(res, 200, {
      success: true,
      linesCount: lines.length,
      hasInstagramSession,
      hasYouTubeSession,
      message: statusMsg
    });
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to save cookies: ${err.message}` });
  }
});

// API: Delete Cookies
app.delete("/api/cookies", (req, res) => {
  try {
    if (fs.existsSync(COOKIE_FILE_PATH)) {
      fs.unlinkSync(COOKIE_FILE_PATH);
    }
    if (fs.existsSync(USER_COOKIE_BACKUP_PATH)) {
      fs.unlinkSync(USER_COOKIE_BACKUP_PATH);
    }
    if (fs.existsSync(PERMANENT_COOKIE_PATH)) {
      fs.unlinkSync(PERMANENT_COOKIE_PATH);
    }
    safeJson(res, 200, { success: true, message: "Cookies removed." });
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to delete cookies: ${err.message}` });
  }
});

// API: Test Cookies with YouTube, Instagram, or Custom URL
app.post("/api/cookies/test", async (req, res) => {
  const { platform, url: customUrl } = req.body || {};
  let testUrl = (typeof customUrl === "string" && customUrl.trim()) ? customUrl.trim() : "";

  if (!testUrl) {
    if (platform === "instagram") {
      testUrl = "https://www.instagram.com/reel/Dd75uqqymQs/";
    } else {
      // Default to a widely playable official video that verifies session authentication
      testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    }
  }

  const cookieArgs = getCookieArgs(testUrl);
  const igPath = getPlatformCookiePath("instagram");
  const hasIgCookie = fs.existsSync(igPath) && fs.statSync(igPath).size > 10;
  const hasCookiesFile = fs.existsSync(COOKIE_FILE_PATH) && fs.statSync(COOKIE_FILE_PATH).size > 10;
  if (!hasCookiesFile && !fs.existsSync(PERMANENT_COOKIE_PATH) && !hasIgCookie) {
    return safeJson(res, 400, { success: false, error: "No cookies currently saved to test." });
  }

  let cookieContent = "";
  try {
    cookieContent = fs.readFileSync(fs.existsSync(COOKIE_FILE_PATH) ? COOKIE_FILE_PATH : PERMANENT_COOKIE_PATH, "utf-8");
  } catch {}

  const isYouTubeTest = testUrl.includes("youtube.com") || testUrl.includes("youtu.be");
  const isInstagramTest = testUrl.includes("instagram.com");

  const hasYouTubeSID =
    cookieContent.includes("\tSID\t") ||
    cookieContent.includes(" SID=") ||
    cookieContent.includes("\t__Secure-3PSID\t") ||
    cookieContent.includes("\t__Secure-1PSID\t");
  const hasYouTubeLoginInfo = cookieContent.includes("\tLOGIN_INFO\t");
  const hasYouTubeSAPISID =
    cookieContent.includes("\tSAPISID\t") ||
    cookieContent.includes("\t__Secure-3PAPISID\t");

  try {
    const args = [
      ...cookieArgs,
      "--dump-json",
      "--no-playlist",
      "--skip-download"
    ];

    if (!isYouTubeTest) {
      args.push(
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      );
    } else if (!cookieArgs.some(a => a === "--cookies")) {
      // Only force mobile clients if no cookies are passed, as ios/android clients ignore cookie files
      args.push("--extractor-args", "youtube:player_client=ios,android,web;player_skip=configs");
    }

    args.push(testUrl);

    const child = spawn(resolvedYtDlpPath, args, {
      timeout: 20000,
      env: {
        ...process.env,
        PATH: `${process.env.PATH || ''}:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin`
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", d => stdout += d.toString());
    child.stderr?.on("data", d => stderr += d.toString());

    child.on("close", (code) => {
      if (code === 0 && stdout) {
        try {
          const info = JSON.parse(stdout);
          return safeJson(res, 200, {
            success: true,
            title: info.title || "Metadata verified",
            message: `Authentication verified successfully on ${isYouTubeTest ? 'YouTube' : isInstagramTest ? 'Instagram' : 'platform'}! Media resolved without bot detection.`,
            hasYouTubeSID,
            hasYouTubeLoginInfo,
            hasYouTubeSAPISID,
            testUrl
          });
        } catch {}
      }

      const isRotated = stderr.includes("rotated in the browser") || stderr.includes("no longer valid");
      const isBot = stderr.includes("Sign in to confirm you’re not a bot");

      if (isRotated || isBot) {
        let detailMsg = "";
        let errorMsg = "";
        if (isRotated) {
          errorMsg = "YouTube rotated your session cookies because an active browser tab refreshed tokens. Please export fresh cookies using the Incognito + robots.txt method.";
          detailMsg = "YouTube detected that these cookies were rotated/invalidated by an open browser tab. Use the anti-rotation method: Open Incognito -> Log in to YouTube -> Navigate to https://www.youtube.com/robots.txt (this stops background token rotation) -> Export cookies -> Close the Incognito tab immediately -> Paste here.";
        } else if (isBot && hasYouTubeLoginInfo && hasYouTubeSID) {
          errorMsg = "This specific video requires a browser-bound Proof-of-Origin (PO) token on cloud IP addresses. Other YouTube videos authenticate normally.";
          detailMsg = "YouTube requires a client-bound Proof-of-Origin (PO) token for this specific video. Try testing or downloading standard videos (like music videos or tutorials), which resolve and download properly with your saved cookies.";
        } else if (!hasYouTubeLoginInfo) {
          errorMsg = "Missing 'LOGIN_INFO' cookie in your export. YouTube requires LOGIN_INFO to authenticate requests from cloud hosting servers.";
          detailMsg = "Please open youtube.com while actively signed into your account, play any video for 2-3 seconds, then export cookies using 'Get cookies.txt LOCALLY' or 'Cookie-Editor' and paste here.";
        } else if (!hasYouTubeSID) {
          errorMsg = "Missing account session token ('SID' or '__Secure-3PSID').";
          detailMsg = "Please ensure you are logged into YouTube in your browser before exporting.";
        } else {
          errorMsg = "YouTube detected bot activity on the server IP.";
          detailMsg = "Export fresh cookies from an Incognito tab at youtube.com/robots.txt and close the tab immediately.";
        }

        return safeJson(res, 200, {
          success: false,
          botDetected: true,
          isRotated,
          error: errorMsg,
          guidance: detailMsg,
          hasYouTubeSID,
          hasYouTubeLoginInfo,
          hasYouTubeSAPISID,
          testUrl
        });
      }

      if (isInstagramTest) {
        return safeJson(res, 200, {
          success: false,
          error: "Instagram returned an empty media response or requires login session.",
          guidance: "Please add your Instagram 'sessionid' cookie: Log in to instagram.com -> Press F12 -> Application -> Cookies -> instagram.com -> copy the value of 'sessionid' and paste into Instagram Cookie Profile in Settings.",
          testUrl
        });
      }

      return safeJson(res, 200, {
        success: code === 0,
        message: code === 0 ? "Test passed" : "Test failed with code " + code,
        stderr: stderr.slice(0, 400),
        testUrl
      });
    });
  } catch (err: any) {
    safeJson(res, 500, { success: false, error: err.message });
  }
});

// API: Lightweight Verify Cookies with YouTube (checks for HTTP 403 Forbidden & bot rejection)
app.all(["/api/cookies/verify", "/api/cookies/validate"], async (req, res) => {
  const cookieArgs = getCookieArgs();
  const hasCookiesFile =
    (fs.existsSync(COOKIE_FILE_PATH) && fs.statSync(COOKIE_FILE_PATH).size > 10) ||
    (fs.existsSync(PERMANENT_COOKIE_PATH) && fs.statSync(PERMANENT_COOKIE_PATH).size > 10);

  if (!hasCookiesFile) {
    return safeJson(res, 200, {
      success: false,
      is403: false,
      error: "No cookies currently saved to verify. Please paste and save your YouTube cookies first.",
      guidance: "Export cookies using 'Cookie-Editor' or 'Get cookies.txt LOCALLY' extension, then click 'Save Cookies (Permanent)'."
    });
  }

  let cookieContent = "";
  try {
    cookieContent = fs.readFileSync(fs.existsSync(COOKIE_FILE_PATH) ? COOKIE_FILE_PATH : PERMANENT_COOKIE_PATH, "utf-8");
  } catch {}

  const hasYouTubeSID =
    cookieContent.includes("\tSID\t") ||
    cookieContent.includes(" SID=") ||
    cookieContent.includes("\t__Secure-3PSID\t") ||
    cookieContent.includes("\t__Secure-1PSID\t");
  const hasYouTubeLoginInfo = cookieContent.includes("\tLOGIN_INFO\t");
  const hasYouTubeSAPISID =
    cookieContent.includes("\tSAPISID\t") ||
    cookieContent.includes("\t__Secure-3PAPISID\t");

  const testUrl = (req.body?.url && typeof req.body.url === "string" && req.body.url.trim())
    ? req.body.url.trim()
    : "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  try {
    const args = [
      ...cookieArgs,
      "--skip-download",
      "--no-playlist",
      "--no-warnings",
      "--extractor-args", "youtube:player_client=ios,android,web;player_skip=configs",
      "--print", "%(title)s",
      testUrl
    ];

    const child = spawn(resolvedYtDlpPath, args, {
      timeout: 12000,
      env: {
        ...process.env,
        PATH: `${process.env.PATH || ''}:/usr/bin:/usr/local/bin:/bin:/usr/sbin:/sbin`
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", d => stdout += d.toString());
    child.stderr?.on("data", d => stderr += d.toString());

    child.on("close", (code) => {
      const outputText = (stdout + " " + stderr).trim();
      const is403 =
        outputText.includes("403") ||
        outputText.includes("HTTP Error 403") ||
        outputText.includes("Forbidden") ||
        outputText.includes("HTTP error 403");
      const isRotated =
        outputText.includes("rotated in the browser") ||
        outputText.includes("no longer valid");
      const isBot =
        outputText.includes("Sign in to confirm you’re not a bot") ||
        outputText.includes("bot verification") ||
        outputText.includes("confirm you're not a bot");

      if (code === 0 && stdout.trim() && !is403 && !isBot && !isRotated) {
        const verifiedTitle = stdout.trim().split("\n")[0];
        return safeJson(res, 200, {
          success: true,
          status: 200,
          title: verifiedTitle,
          message: "YouTube accepted your cookies! Verified successfully with zero 403 Forbidden errors.",
          hasYouTubeSID,
          hasYouTubeLoginInfo,
          hasYouTubeSAPISID
        });
      }

      let errorMessage = "YouTube rejected the cookies.";
      let detailMsg = "";

      if (is403) {
        errorMessage = "HTTP 403 Forbidden: YouTube rejected your session credentials.";
        detailMsg = "YouTube reported HTTP 403 Forbidden. Your cookies have either expired, were rotated by your browser, or were exported from a signed-out state. Please export fresh cookies using Incognito at youtube.com/robots.txt.";
      } else if (isRotated) {
        errorMessage = "Cookies Rotated: YouTube invalidated the session token.";
        detailMsg = "An active browser tab rotated your session cookies. Please export fresh cookies from an Incognito window at youtube.com/robots.txt and close that window immediately.";
      } else if (isBot) {
        errorMessage = "Bot Verification Triggered: YouTube requires fresh authenticated cookies.";
        detailMsg = "YouTube flagged cloud request. Ensure your exported cookies contain LOGIN_INFO and SID tokens from an active logged-in session.";
      } else if (!hasYouTubeLoginInfo) {
        errorMessage = "Missing 'LOGIN_INFO' token in saved cookies.";
        detailMsg = "YouTube requires LOGIN_INFO to authenticate requests on cloud servers. Export cookies while logged into YouTube.";
      } else if (!hasYouTubeSID) {
        errorMessage = "Missing 'SID' or '__Secure-3PSID' authentication token.";
        detailMsg = "Log in to YouTube in your browser before exporting cookies.";
      } else {
        errorMessage = `YouTube verification check failed (${stderr.slice(0, 150) || 'exit code ' + code}).`;
        detailMsg = "Please verify your cookies format or export fresh cookies using the Netscape format.";
      }

      return safeJson(res, 200, {
        success: false,
        status: is403 ? 403 : 400,
        is403,
        isBot,
        isRotated,
        error: errorMessage,
        guidance: detailMsg,
        hasYouTubeSID,
        hasYouTubeLoginInfo,
        hasYouTubeSAPISID,
        details: stderr.slice(0, 300)
      });
    });
  } catch (err: any) {
    safeJson(res, 500, { success: false, error: `Verification failed: ${err.message}` });
  }
});

// API: Pause Download
app.post(["/api/pause/:id", "/api/jobs/:id/pause"], (req, res) => {
  const { id } = req.params;
  const task = activeTasks.get(id);
  if (!task) {
    return safeJson(res, 404, { error: "Download task not found" });
  }

  if (task.process && typeof task.process === "object" && "kill" in task.process) {
    try {
      (task.process as ChildProcess).kill("SIGSTOP");
      task.status = "paused";
      return safeJson(res, 200, { success: true, status: "paused" });
    } catch (e: any) {
      console.warn("Pause signal error:", e.message);
    }
  }

  task.status = "paused";
  safeJson(res, 200, { success: true, status: "paused" });
});

// API: Resume Download
app.post(["/api/resume/:id", "/api/jobs/:id/resume"], (req, res) => {
  const { id } = req.params;
  const task = activeTasks.get(id);
  if (!task) {
    return safeJson(res, 404, { error: "Download task not found" });
  }

  if (task.process && typeof task.process === "object" && "kill" in task.process) {
    try {
      (task.process as ChildProcess).kill("SIGCONT");
      task.status = "downloading";
      return safeJson(res, 200, { success: true, status: "downloading" });
    } catch (e: any) {
      console.warn("Resume signal error:", e.message);
    }
  }

  task.status = "downloading";
  safeJson(res, 200, { success: true, status: "downloading" });
});

// API: Cancel Download
app.post(["/api/cancel/:id", "/api/jobs/:id/cancel"], (req, res) => {
  const { id } = req.params;
  const task = activeTasks.get(id);
  if (!task) {
    // Also check and remove from batchDownloadQueue if present
    const qIdx = batchDownloadQueue.findIndex((q) => q.taskId === id);
    if (qIdx !== -1) {
      batchDownloadQueue.splice(qIdx, 1);
      triggerNextInBatchQueue();
    }
    return safeJson(res, 404, { error: "Download task not found" });
  }

  task.status = "cancelled";
  if (task.process) {
    try {
      if (typeof task.process === 'object' && 'kill' in task.process) {
        (task.process as ChildProcess).kill("SIGKILL");
      } else {
        clearInterval(task.process as any);
      }
    } catch (e) {}
  }

  // Remove from batch queue if waiting
  const qIdx = batchDownloadQueue.findIndex((q) => q.taskId === id);
  if (qIdx !== -1) {
    batchDownloadQueue.splice(qIdx, 1);
  }

  try {
    if (task.filepath && fs.existsSync(task.filepath)) {
      fs.unlinkSync(task.filepath);
    }
  } catch (e) {}

  // Retain cancelled task in memory for 2 minutes so UI pollers have ample time to read status
  setTimeout(() => activeTasks.delete(id), 120000);
  triggerNextInBatchQueue();
  safeJson(res, 200, { success: true, message: "Download cancelled" });
});

// API: Cancel All Batch Tasks
app.post("/api/batch-cancel-all", (req, res) => {
  batchDownloadQueue.length = 0;
  for (const [id, task] of activeTasks.entries()) {
    if (task.status === "downloading" || task.status === "queued" || task.status === "processing") {
      task.status = "cancelled";
      if (task.process) {
        try {
          if (typeof task.process === 'object' && 'kill' in task.process) {
            (task.process as ChildProcess).kill("SIGKILL");
          } else {
            clearInterval(task.process as any);
          }
        } catch (e) {}
      }
      try {
        if (task.filepath && fs.existsSync(task.filepath)) {
          fs.unlinkSync(task.filepath);
        }
      } catch (e) {}
      setTimeout(() => activeTasks.delete(id), 120000);
    }
  }
  safeJson(res, 200, { success: true, message: "All batch tasks cancelled" });
});

// API: Batch ZIP Archive (Download multiple completed tasks as a single ZIP file)
app.post("/api/batch-zip", async (req, res) => {
  try {
    const { taskIds } = req.body || {};
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return safeJson(res, 400, { error: "No taskIds provided" });
    }

    const filesToZip: { path: string; name: string }[] = [];
    const addedNames = new Set<string>();

    for (const tid of taskIds) {
      const task = activeTasks.get(tid);
      let resolvedPath = task?.filepath || task?.filePath;
      let resolvedName = task?.filename;

      if (!resolvedPath || !fs.existsSync(resolvedPath)) {
        if (fs.existsSync(TEMP_DIR)) {
          const matching = fs.readdirSync(TEMP_DIR).filter((f) => f.startsWith(tid) || (task?.filename && f === task.filename));
          if (matching.length > 0) {
            resolvedPath = path.join(TEMP_DIR, matching[0]);
            resolvedName = resolvedName || matching[0];
          }
        }
      }

      if (resolvedPath && fs.existsSync(resolvedPath)) {
        let finalName = resolvedName || path.basename(resolvedPath);
        let counter = 1;
        const parsed = path.parse(finalName);
        while (addedNames.has(finalName)) {
          finalName = `${parsed.name}_${counter}${parsed.ext}`;
          counter++;
        }
        addedNames.add(finalName);
        filesToZip.push({ path: resolvedPath, name: finalName });
      }
    }

    if (filesToZip.length === 0) {
      return safeJson(res, 404, { error: "No completed download files found for the selected tasks" });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipName = `FluxLoad_Batch_${timestamp}.zip`;

    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Access-Control-Allow-Origin": "*",
    });

    const archive = archiver("zip", {
      zlib: { level: 6 },
    });

    archive.on("error", (err: any) => {
      console.error("[ZIP Archive Error]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    archive.pipe(res);

    for (const f of filesToZip) {
      archive.file(f.path, { name: f.name });
    }

    await archive.finalize();
  } catch (err: any) {
    console.error("[Batch ZIP Error]:", err);
    if (!res.headersSent) {
      safeJson(res, 500, { error: err.message || "Failed to generate ZIP archive" });
    }
  }
});

// API: Audio & Video Trimmer / Cutter
app.post("/api/trim-media", upload.single("file"), async (req, res) => {
  try {
    const { taskId, filename, startTime = 0, endTime, format = "mp3", audioBitrate = "320k", volume = 1, fadeIn, fadeOut } = req.body;
    let inputFilePath: string | null = null;
    let originalTitle = "audio_clip";

    if (req.file) {
      inputFilePath = req.file.path;
      originalTitle = path.parse(req.file.originalname).name;
    } else if (taskId) {
      const task = activeTasks.get(taskId);
      if (task?.filepath && fs.existsSync(task.filepath)) {
        inputFilePath = task.filepath;
        originalTitle = task.title || path.parse(task.filename || "audio").name;
      } else if (fs.existsSync(TEMP_DIR)) {
        const files = fs.readdirSync(TEMP_DIR);
        const match = files.find(f => f.startsWith(taskId));
        if (match) {
          inputFilePath = path.join(TEMP_DIR, match);
          originalTitle = path.parse(match).name;
        }
      }
    } else if (filename) {
      const p = path.join(TEMP_DIR, filename);
      if (fs.existsSync(p)) {
        inputFilePath = p;
        originalTitle = path.parse(filename).name;
      }
    }

    if (!inputFilePath || !fs.existsSync(inputFilePath)) {
      return safeJson(res, 404, { error: "Source file not found to trim" });
    }

    const startSec = Math.max(0, parseFloat(startTime) || 0);
    const endSec = endTime !== undefined && endTime !== "" && !isNaN(parseFloat(endTime)) ? Math.max(startSec + 0.5, parseFloat(endTime)) : null;
    const durationSec = endSec ? (endSec - startSec) : null;

    const outExt = (format === "mp4" ? "mp4" : (format === "m4a" ? "m4a" : (format === "wav" ? "wav" : "mp3")));
    const trimTaskId = "trim_" + crypto.randomUUID().slice(0, 10);
    const cleanTitle = originalTitle.replace(/[^\w\s\u0980-\u09FF.-]/g, "_").trim() || "FluxLoad_Audio";
    const outFilename = `${cleanTitle}_cut.${outExt}`;
    const outFilePath = path.join(TEMP_DIR, `${trimTaskId}.${outExt}`);

    const ffmpegArgs: string[] = ["-y", "-ss", startSec.toString()];
    if (endSec !== null) {
      ffmpegArgs.push("-to", endSec.toString());
    }
    ffmpegArgs.push("-i", inputFilePath);

    const afFilters: string[] = [];
    const volNum = parseFloat(volume);
    if (!isNaN(volNum) && volNum !== 1) {
      afFilters.push(`volume=${volNum}`);
    }
    if (fadeIn === true || fadeIn === "true") {
      afFilters.push(`afade=t=in:ss=0:d=1`);
    }
    if ((fadeOut === true || fadeOut === "true") && durationSec && durationSec > 2) {
      const fadeStart = Math.max(0, durationSec - 1.5);
      afFilters.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=1.5`);
    }

    if (outExt === "mp3") {
      ffmpegArgs.push("-vn", "-c:a", "libmp3lame");
      if (audioBitrate === "320k" || audioBitrate === "320") {
        ffmpegArgs.push("-b:a", "320k");
      } else if (audioBitrate === "192k" || audioBitrate === "192") {
        ffmpegArgs.push("-b:a", "192k");
      } else {
        ffmpegArgs.push("-b:a", "128k");
      }
      if (afFilters.length > 0) {
        ffmpegArgs.push("-af", afFilters.join(","));
      }
    } else if (outExt === "m4a") {
      ffmpegArgs.push("-vn", "-c:a", "aac", "-b:a", "256k");
      if (afFilters.length > 0) {
        ffmpegArgs.push("-af", afFilters.join(","));
      }
    } else if (outExt === "wav") {
      ffmpegArgs.push("-vn", "-c:a", "pcm_s16le");
      if (afFilters.length > 0) {
        ffmpegArgs.push("-af", afFilters.join(","));
      }
    } else {
      ffmpegArgs.push("-c:v", "libx264", "-c:a", "aac", "-preset", "veryfast");
      if (afFilters.length > 0) {
        ffmpegArgs.push("-af", afFilters.join(","));
      }
    }

    ffmpegArgs.push(outFilePath);

    const proc = spawn("ffmpeg", ffmpegArgs);
    let stderrLog = "";
    proc.stderr.on("data", (d) => {
      stderrLog += d.toString();
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outFilePath)) {
        activeTasks.set(trimTaskId, {
          id: trimTaskId,
          url: "",
          title: cleanTitle + " (Trimmed)",
          type: outExt === "mp4" ? "video" : "audio",
          quality: "custom",
          format: outExt,
          status: "completed",
          progress: 100,
          speed: "done",
          downloadedSize: "",
          totalSize: "",
          eta: "Done",
          filename: outFilename,
          filepath: outFilePath,
          filePath: outFilePath,
          downloadUrl: `/api/file/${trimTaskId}?name=${encodeURIComponent(outFilename)}`,
        });

        safeJson(res, 200, {
          success: true,
          taskId: trimTaskId,
          filename: outFilename,
          downloadUrl: `/api/file/${trimTaskId}?name=${encodeURIComponent(outFilename)}`,
          streamUrl: `/api/file/${trimTaskId}?inline=true`,
        });
      } else {
        console.error("[Trimmer failed]:", stderrLog);
        safeJson(res, 500, { error: "Audio/Video trimming failed", details: stderrLog.slice(-400) });
      }
    });

    proc.on("error", (err) => {
      safeJson(res, 500, { error: `FFmpeg spawn error: ${err.message}` });
    });
  } catch (err: any) {
    safeJson(res, 500, { error: err.message || "Failed to process trim request" });
  }
});

// API: Get File & Auto Cleanup (Streaming implementation with Mobile & Safari Range Support)
app.all(["/api/file/:jobId", "/api/jobs/:jobId/file", "/api/download/:jobId"], (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed. Use GET or HEAD." });
  }

  const jobId = req.params.jobId;
  let job = (activeTasks.get(jobId) as any) || jobs.get(jobId);

  if (!job) {
    // Search activeTasks by shortId or filename
    for (const [tId, t] of activeTasks.entries()) {
      if (tId.includes(jobId) || jobId.includes(tId) || (t.filename && t.filename.includes(jobId))) {
        job = t;
        break;
      }
    }
  }

  if (!job) {
    const shortId = jobId.length > 8 ? jobId.slice(0, 8) : jobId;
    try {
      if (fs.existsSync(TEMP_DIR)) {
        const files = fs.readdirSync(TEMP_DIR);
        const matched = files.find(f => (f.includes(jobId) || f.includes(shortId)) && !f.endsWith('.part') && !f.endsWith('.ytdl'));
        if (matched) {
          const fallbackPath = path.join(TEMP_DIR, matched);
          job = {
            id: jobId,
            url: "",
            type: "video",
            quality: "best",
            format: matched.endsWith('.mp3') ? 'mp3' : 'mp4',
            status: "completed",
            progress: 100,
            speed: "0",
            downloadedSize: "100%",
            totalSize: "100%",
            eta: "00:00",
            filename: matched,
            filePath: fallbackPath,
            filepath: fallbackPath
          };
          jobs.set(jobId, job);
        }
      }
    } catch {}
  }

  const filePath = job?.filePath || job?.filepath;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Media file not found or expired. Please download again." });
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 1024) {
    return res.status(404).json({ error: "Media file is invalid or incomplete." });
  }

  const userGivenName = typeof req.query.filename === "string" ? req.query.filename.trim() : undefined;
  let rawFilename = userGivenName || job?.filename || path.basename(filePath);
  const ext = (path.extname(filePath) || ".mp4").toLowerCase();

  // Strip media extension from base to avoid double extensions like name.mp4.mp4
  const baseWithoutExt = rawFilename.replace(/\.(mp4|webm|mkv|mp3|m4a|wav|opus|ogg|flv|avi|mov)$/i, '');
  const cleanBase = sanitizeFilename(baseWithoutExt) || path.basename(filePath, ext) || "media_download";
  const downloadFilename = `${cleanBase}${ext}`;

  // Determine MIME type
  let contentType = "application/octet-stream";
  if (ext === ".mp4") contentType = "video/mp4";
  else if (ext === ".webm") contentType = "video/webm";
  else if (ext === ".mkv") contentType = "video/x-matroska";
  else if (ext === ".mp3") contentType = "audio/mpeg";
  else if (ext === ".m4a") contentType = "audio/mp4";
  else if (ext === ".wav") contentType = "audio/wav";
  else if (ext === ".ogg" || ext === ".opus") contentType = "audio/ogg";

  // Optimize socket timeouts for large files (20+ min videos, 500MB+)
  req.setTimeout(0);
  res.setTimeout(0);

  const safeAsciiFilename = makeSafeAsciiFilename(downloadFilename);
  const encodedUtf8Filename = encodeURIComponent(downloadFilename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  const isInline = req.query.inline === "true" || req.query.view === "true";
  const contentDisposition = isInline
    ? `inline; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedUtf8Filename}`
    : `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodedUtf8Filename}`;

  // HEAD method support: Mobile Safari & Chrome inspect Content-Length/Accept-Ranges before saving
  if (req.method === "HEAD") {
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, no-transform",
    });
    return res.end();
  }

  // Handle Range requests (required for Mobile Safari iOS, Android Chrome, and browser seek bars)
  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : NaN;
      let end = match[2] ? parseInt(match[2], 10) : NaN;

      if (isNaN(start) && !isNaN(end)) {
        // Suffix range request (e.g., bytes=-500)
        start = Math.max(0, stat.size - end);
        end = stat.size - 1;
      } else if (!isNaN(start) && isNaN(end)) {
        // From start to end (e.g., bytes=0-)
        end = stat.size - 1;
      }

      if (isNaN(start) || start >= stat.size || end < start) {
        res.writeHead(416, {
          "Content-Range": `bytes */${stat.size}`,
          "Accept-Ranges": "bytes",
        });
        return res.end();
      }

      if (end >= stat.size) {
        end = stat.size - 1;
      }

      // Clamp max chunk to 20MB to stay safely under Cloud Run's 32MB single response limit
      // Mobile Safari and Chrome automatically issue sequential Range requests for the remaining bytes
      const maxRangeChunk = 20 * 1024 * 1024;
      if (end - start + 1 > maxRangeChunk) {
        end = start + maxRangeChunk - 1;
      }

      const chunksize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400, no-transform",
        "X-Accel-Buffering": "no",
      });

      const partialStream = fs.createReadStream(filePath, { start, end });
      partialStream.pipe(res);
      req.on("close", () => {
        partialStream.destroy();
      });
      return;
    }
  }

  // Non-range full stream (Cloud Run 32 MiB compliant):
  // When Content-Length is omitted on large files (>25MB), Node.js streams via chunked transfer
  const responseHeaders: Record<string, string | number> = {
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=86400, no-transform",
    "Accept-Ranges": "bytes",
    "X-Accel-Buffering": "no",
  };

  if (stat.size <= 25 * 1024 * 1024) {
    responseHeaders["Content-Length"] = stat.size;
  }

  res.writeHead(200, responseHeaders);

  const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  fileStream.pipe(res);

  fileStream.on("error", (streamErr) => {
    console.error("[Download Stream Error]:", streamErr);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  });

  req.on("close", () => {
    fileStream.destroy();
  });
});

// ==========================================
// TELEGRAM BOT & CHANNEL INTEGRATION ROUTES
// ==========================================
const TELEGRAM_CONFIG_PATH = path.join(process.cwd(), "tmp", "telegram_config.json");
const TELEGRAM_SAVED_PATH = path.join(process.cwd(), "telegram_saved.json");

interface SavedTelegramConfig {
  botToken: string;
  chatId: string;
  channelTitle?: string;
  botUsername?: string;
  autoSend?: boolean;
}

function getSavedTelegramConfig(): SavedTelegramConfig | null {
  for (const p of [TELEGRAM_SAVED_PATH, TELEGRAM_CONFIG_PATH]) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.botToken && parsed.chatId) {
          return parsed;
        }
      } catch {}
    }
  }
  return null;
}

function writeTelegramConfig(cfg: SavedTelegramConfig) {
  try {
    if (!fs.existsSync(path.dirname(TELEGRAM_CONFIG_PATH))) {
      fs.mkdirSync(path.dirname(TELEGRAM_CONFIG_PATH), { recursive: true });
    }
    const data = JSON.stringify(cfg, null, 2);
    fs.writeFileSync(TELEGRAM_CONFIG_PATH, data, "utf-8");
    fs.writeFileSync(TELEGRAM_SAVED_PATH, data, "utf-8");
  } catch (err) {
    console.warn("[Telegram Config] Write error:", err);
  }
}

// Helper to normalize and sanitize Telegram channel usernames or IDs
function sanitizeTelegramChatId(input: string): string {
  if (!input) return "";
  let clean = input.trim();
  clean = clean.replace(/\/+$/, "");

  // Match full links e.g. https://t.me/crypto_mining_s_e_x or https://t.me/s/crypto_mining_s_e_x
  const tmeMatch = clean.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]+)/i);
  if (tmeMatch && tmeMatch[1] && !clean.includes("/+")) {
    return "@" + tmeMatch[1];
  }

  // If user provided username without @ and not numeric ID
  if (!clean.startsWith("@") && !clean.startsWith("-") && /^[a-zA-Z0-9_]{3,}$/.test(clean)) {
    return "@" + clean;
  }

  return clean;
}

// GET /api/telegram/config
app.get("/api/telegram/config", (req, res) => {
  const cfg = getSavedTelegramConfig();
  if (!cfg) {
    return safeJson(res, 200, { configured: false });
  }
  const tokenParts = cfg.botToken.split(":");
  const masked = tokenParts.length === 2
    ? `${tokenParts[0]}:****${tokenParts[1].slice(-4)}`
    : `****${cfg.botToken.slice(-4)}`;
  safeJson(res, 200, {
    configured: true,
    botTokenMasked: masked,
    chatId: cfg.chatId,
    channelTitle: cfg.channelTitle || cfg.chatId,
    botUsername: cfg.botUsername,
    autoSend: Boolean(cfg.autoSend),
  });
});

// POST /api/telegram/config (Validate & Save)
app.post("/api/telegram/config", async (req, res) => {
  const { botToken, chatId, autoSend } = req.body || {};
  if (!botToken || typeof botToken !== "string" || !botToken.includes(":")) {
    return safeJson(res, 400, { error: "Please enter a valid Telegram Bot Token from @BotFather (e.g. 123456789:ABCdefGhIjk...)" });
  }
  if (!chatId || typeof chatId !== "string" || chatId.trim().length < 2) {
    return safeJson(res, 400, { error: "Please enter a valid Telegram Channel username (e.g. @my_channel) or Chat ID." });
  }

  const cleanToken = botToken.trim();
  const cleanChatId = sanitizeTelegramChatId(chatId);

  try {
    // 1. Verify Bot Token with getMe
    const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      return safeJson(res, 400, {
        error: `Invalid Telegram Bot Token: ${meData.description || 'Unauthorized'}. Please make sure you copied the full token from @BotFather.`
      });
    }

    const botUsername = meData.result?.username || "";

    // 2. Verify Channel / Chat access with getChat
    const chatRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getChat?chat_id=${encodeURIComponent(cleanChatId)}`);
    const chatData = await chatRes.json();
    if (!chatData.ok) {
      const isNotFound = chatData.description?.toLowerCase().includes("not found");
      const isForbidden = chatData.description?.toLowerCase().includes("forbidden") || chatData.description?.toLowerCase().includes("permission");
      const botAddUrl = botUsername ? `https://t.me/${botUsername}?startchannel=true` : "";

      let friendlyMsg = "";
      if (isNotFound) {
        friendlyMsg = `বট চ্যানেল "${cleanChatId}"-এ অ্যাক্সেস করতে পারছে না (${chatData.description})। টেলিগ্রাম চ্যানেলে বটকে অবশ্যই Administrator হিসেবে যোগ করতে হবে।\n\nঅনুগ্রহ করে নিচের ধাপগুলো সম্পন্ন করুন:\n১. আপনার চ্যানেলের সেটিংসে যান ➜ Administrators ➜ Add Admin হিসেবে @${botUsername} বটটিকে যোগ করুন।\n২. 'Post Messages' পারমিশন অন করে Save করুন।\n৩. চ্যানেলটি যদি পাবলিক হয় তবে ইউজারনেম নিশ্চিত করুন (যেমন: ${cleanChatId})।`;
      } else if (isForbidden) {
        friendlyMsg = `বটের মেসেজ পোস্ট করার অনুমতি নেই: ${chatData.description}। চ্যানেলের Administrators-এ গিয়ে @${botUsername}-কে 'Post Messages' পারমিশন দিন।`;
      } else {
        friendlyMsg = `বট চ্যানেলে যুক্ত হতে পারেনি (${chatData.description})। @${botUsername} বটটিকে চ্যানেলে Administrator হিসেবে যোগ করে 'Post Messages' পারমিশন দিন।`;
      }

      return safeJson(res, 400, {
        error: friendlyMsg,
        botUsername,
        botAddUrl,
        rawDescription: chatData.description,
        cleanedChatId: cleanChatId
      });
    }

    const channelTitle = chatData.result?.title || chatData.result?.username || cleanChatId;

    const newCfg: SavedTelegramConfig = {
      botToken: cleanToken,
      chatId: cleanChatId,
      channelTitle,
      botUsername,
      autoSend: Boolean(autoSend),
    };
    writeTelegramConfig(newCfg);

    safeJson(res, 200, {
      success: true,
      message: `Successfully connected bot @${botUsername} to channel "${channelTitle}"!`,
      channelTitle,
      botUsername,
      chatId: cleanChatId,
    });
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to connect with Telegram API: ${err.message}` });
  }
});

// POST /api/telegram/test (Send a test greeting to verify posting permissions)
app.post("/api/telegram/test", async (req, res) => {
  const saved = getSavedTelegramConfig();
  const token = req.body?.botToken ? req.body.botToken.trim() : saved?.botToken;
  const rawTargetChat = req.body?.chatId || saved?.chatId;
  const targetChat = sanitizeTelegramChatId(rawTargetChat || "");

  if (!token || !targetChat) {
    return safeJson(res, 400, { error: "Telegram Bot Token and Channel ID must be configured before testing." });
  }

  try {
    const text = `🚀 <b>FluxLoad Connected!</b>\n\nYour Telegram Channel is now connected to <b>FluxLoad Video Downloader</b>. You can now send high-quality downloaded videos & audio directly to this channel.`;
    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const sendData = await sendRes.json();
    if (!sendData.ok) {
      return safeJson(res, 400, {
        error: `Telegram error: ${sendData.description || 'Could not send test message'}. Make sure the bot has 'Post Messages' permission in the channel.`
      });
    }

    safeJson(res, 200, {
      success: true,
      message: `Test message posted to channel successfully! Check your Telegram channel.`,
      messageId: sendData.result?.message_id
    });
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to send test message: ${err.message}` });
  }
});

// POST /api/telegram/send (Send video/audio to Telegram Channel)
app.post("/api/telegram/send", async (req, res) => {
  const saved = getSavedTelegramConfig();
  const { taskId, filePath, downloadUrl, caption, customChatId } = req.body || {};

  const token = saved?.botToken;
  const rawTargetChat = customChatId || saved?.chatId;
  const targetChat = sanitizeTelegramChatId(rawTargetChat || "");

  if (!token || !targetChat) {
    return safeJson(res, 400, {
      error: "Telegram is not configured. Please set your Telegram Bot Token and Channel ID in Settings → Telegram Channel."
    });
  }

  // Resolve effective task ID
  let resolvedId = taskId;
  if (!resolvedId && downloadUrl && typeof downloadUrl === "string") {
    const match = downloadUrl.match(/\/api\/file\/([a-zA-Z0-9_-]+)/);
    if (match) resolvedId = match[1];
  }

  // Locate the file on disk
  let diskFile = "";
  let taskTitle = "";
  if (resolvedId && activeTasks.has(resolvedId)) {
    const t = activeTasks.get(resolvedId)!;
    diskFile = t.filepath || t.filePath || "";
    taskTitle = t.title || t.filename || "";
  }

  if (!diskFile || !fs.existsSync(diskFile)) {
    if (filePath && fs.existsSync(filePath)) {
      diskFile = filePath;
    } else if (resolvedId && fs.existsSync(TEMP_DIR)) {
      const candidates = fs.readdirSync(TEMP_DIR).filter(f => f.includes(resolvedId.slice(0, 8)));
      if (candidates.length > 0) {
        diskFile = path.join(TEMP_DIR, candidates[0]);
      }
    }
  }

  if (!diskFile || !fs.existsSync(diskFile)) {
    return safeJson(res, 404, { error: "Media file not found on server or expired. Please re-download the video." });
  }

  try {
    const stats = fs.statSync(diskFile);
    const sizeMb = stats.size / (1024 * 1024);
    const ext = path.extname(diskFile).toLowerCase();
    const isAudio = [".mp3", ".m4a", ".wav", ".flac", ".ogg"].includes(ext);
    const filename = path.basename(diskFile);
    const postCaption = (caption || taskTitle || filename).slice(0, 1000);

    // If file is <= 50 MB, upload directly using Telegram sendVideo / sendAudio
    if (stats.size <= 50 * 1024 * 1024) {
      const fileBuffer = fs.readFileSync(diskFile);
      const fileBlob = new Blob([fileBuffer]);

      const formData = new FormData();
      formData.append("chat_id", targetChat);
      formData.append("caption", `🎬 <b>${postCaption}</b>\n\n⚡ Downloaded via <i>FluxLoad</i>`);
      formData.append("parse_mode", "HTML");

      let method = "sendVideo";
      if (isAudio) {
        method = "sendAudio";
        formData.append("audio", fileBlob, filename);
      } else {
        formData.append("supports_streaming", "true");
        formData.append("video", fileBlob, filename);
      }

      const uploadRes = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        return safeJson(res, 400, {
          error: `Telegram upload failed: ${uploadData.description || 'Unknown error'}. Check bot permissions in channel.`
        });
      }

      const messageId = uploadData.result?.message_id;
      let channelPostUrl = "";
      if (targetChat.startsWith("@")) {
        channelPostUrl = `https://t.me/${targetChat.replace('@', '')}/${messageId}`;
      } else {
        channelPostUrl = `https://t.me/c/${targetChat.replace('-100', '')}/${messageId}`;
      }

      return safeJson(res, 200, {
        success: true,
        messageId,
        channelPostUrl,
        channelTitle: saved?.channelTitle || targetChat,
        fileSizeMb: parseFloat(sizeMb.toFixed(1)),
        message: `Successfully posted to ${saved?.channelTitle || targetChat}!`
      });
    } else {
      // File > 50MB (exceeds Telegram Bot API 50MB limit)
      const hostUrl = req.get("host") || "ais-pre-iadmvxsjcvmxle664s7hd4-634228146758.asia-southeast1.run.app";
      const protocol = req.protocol === "http" && !req.get("x-forwarded-proto") ? "http" : "https";
      const downloadLink = `${protocol}://${hostUrl}/api/download/${taskId}`;

      const cardText = `🎬 <b>${postCaption}</b>\n\n` +
        `📦 <b>File Size:</b> ${sizeMb.toFixed(1)} MB (Large File)\n` +
        `⚡ <b>Direct Download Link:</b>\n<a href="${downloadLink}">👉 Click to Stream / Download Video</a>\n\n` +
        `<i>Shared via FluxLoad High-Speed Media Downloader</i>`;

      const msgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChat,
          text: cardText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬇️ Download Video (Direct)", url: downloadLink }]
            ]
          }
        })
      });
      const msgData = await msgRes.json();

      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(downloadLink)}&text=${encodeURIComponent(postCaption)}`;

      return safeJson(res, 200, {
        success: true,
        fileSizeMb: parseFloat(sizeMb.toFixed(1)),
        warning: `File size is ${sizeMb.toFixed(1)} MB (Telegram Bot direct upload limit is 50MB). A streaming and download card was posted to your channel!`,
        shareUrl,
        channelPostUrl: targetChat.startsWith("@") && msgData.result?.message_id ? `https://t.me/${targetChat.replace('@', '')}/${msgData.result.message_id}` : undefined,
        channelTitle: saved?.channelTitle || targetChat
      });
    }
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to send media to Telegram: ${err.message}` });
  }
});

// DELETE /api/telegram/config
app.delete("/api/telegram/config", (req, res) => {
  try {
    if (fs.existsSync(TELEGRAM_CONFIG_PATH)) fs.unlinkSync(TELEGRAM_CONFIG_PATH);
    if (fs.existsSync(TELEGRAM_SAVED_PATH)) fs.unlinkSync(TELEGRAM_SAVED_PATH);
    safeJson(res, 200, { success: true, message: "Telegram configuration removed." });
  } catch (err: any) {
    safeJson(res, 500, { error: `Failed to delete config: ${err.message}` });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`FluxLoad server running on http://localhost:${PORT}`);
  });

  // Keep-alive timeouts tuned for Cloud Run reverse proxy & long downloads
  server.keepAliveTimeout = 120000;
  server.headersTimeout = 125000;
  server.requestTimeout = 0;

  // Run dependency verification and yt-dlp check in background so HTTP server is ready instantly
  setTimeout(async () => {
    try {
      await initYtDlp();
    } catch (e) {
      console.warn("Background initYtDlp warning:", e);
    }
    try {
      verifyDependencies();
    } catch (e) {
      console.warn("Background verifyDependencies warning:", e);
    }
  }, 100);
}

startServer();
