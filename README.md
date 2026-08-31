# FluxLoad

**Free • Private • No Ads • Open Source Local Video & Audio Downloader**

FluxLoad is a fast, secure, and private video downloader web application that runs entirely on your own PC or local server. It uses `yt-dlp` and `FFmpeg` under the hood with zero advertisements, zero tracking, zero login required, and no artificial download limits.

---

## Features

1. **URL Input & Instant Analysis**: Paste any supported video URL to fetch metadata (thumbnail, title, duration, available qualities & formats).
2. **Video & Audio Downloads**: Download video in MP4/WebM or audio-only in MP3/M4A.
3. **Quality Selector**: Choose from 360p, 480p, 720p, 1080p (when available), or best quality.
4. **Real-time Progress Tracker**: Live progress bar, download speed, downloaded size, and estimated time remaining (ETA).
5. **Cancel Support**: Instantly cancel ongoing downloads.
6. **Automatic Cleanup**: Temporary files are automatically deleted after successful delivery to your browser.
7. **100% Private**: No cloud storage, no tracking, no subscriptions, no ads.

---

## Step-by-Step Installation Guide

To run FluxLoad locally on your machine, follow these steps:

### 1. Install Node.js
Ensure you have **Node.js** (v18 or higher) installed on your system.
Verify installation:
```bash
node -v
npm -v
```

### 2. Install yt-dlp
FluxLoad relies on `yt-dlp` for robust media extraction.
- **macOS (via Homebrew)**:
  ```bash
  brew install yt-dlp
  ```
- **Windows (via winget or pip)**:
  ```bash
  winget install yt-dlp.yt-dlp
  # or python3 -m pip install --upgrade yt-dlp
  ```
- **Linux (Debian/Ubuntu)**:
  ```bash
  sudo wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```
Verify installation:
```bash
yt-dlp --version
```

### 3. Install FFmpeg
FFmpeg is required for merging video/audio streams and converting audio formats (MP3/M4A).
- **macOS**:
  ```bash
  brew install ffmpeg
  ```
- **Windows**:
  Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to your system PATH.
- **Linux**:
  ```bash
  sudo apt update && sudo apt install ffmpeg -y
  ```
Verify installation:
```bash
ffmpeg -version
```

### 4. Install npm Dependencies
Clone or download this repository, then install project dependencies:
```bash
cd fluxload
npm install
```

### 5. Starting the Backend & Frontend
FluxLoad runs as a unified full-stack application (Express backend + Vite frontend):
```bash
npm run dev
```

### 6. Opening the Website at Localhost
Open your web browser and navigate to:
```url
http://localhost:3000
```

---

## Supported Platforms

FluxLoad supports all video and audio platforms officially supported by `yt-dlp` (YouTube, Vimeo, SoundCloud, TikTok, Twitter/X, and hundreds more). It does not bypass login, DRM, paywalls, or access controls.
