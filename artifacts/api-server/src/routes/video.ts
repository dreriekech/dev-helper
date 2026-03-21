import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import {
  ExtractVideoInfoBody,
  ExtractVideoInfoResponse,
  DownloadVideoBody,
  DownloadVideoResponse,
  StreamVideoParams,
} from "@workspace/api-zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "dummy",
  httpOptions: { baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
});

const router: IRouter = Router();

const APP_VERSION = "1.3.0";
const APP_CHANGELOG: Record<string, { date: string; changes_vi: string[]; changes_en: string[] }> = {
  "1.3.0": {
    date: "2026-03-21",
    changes_vi: [
      "Sửa lỗi phụ đề tràn viền trên video dọc/hẹp",
      "Font size tự co giãn theo kích thước video",
      "Tăng margin trái/phải cho phụ đề SRT & ASS",
      "Thêm tính năng Che text gốc với drawbox overlay",
      "Chọn vị trí phủ (trên/dưới/cả hai) & chiều cao %",
    ],
    changes_en: [
      "Fixed subtitle text overflow on portrait/narrow videos",
      "Dynamic font scaling based on video dimensions",
      "Increased SRT & ASS subtitle left/right margins",
      "Added Cover Original Text with drawbox overlay",
      "Choose cover position (top/bottom/both) & height %",
    ],
  },
  "1.2.0": {
    date: "2026-03-21",
    changes_vi: [
      "Tích hợp Vbee AI Voice cho giọng nói tiếng Việt tự nhiên",
      "8 giọng nói Vbee (Bắc/Nam, Nam/Nữ)",
      "Cải thiện trình xem trước video với hỗ trợ âm thanh",
      "Hệ thống cập nhật phiên bản mới",
    ],
    changes_en: [
      "Integrated Vbee AI Voice for natural Vietnamese voices",
      "8 Vbee voices (North/South, Male/Female)",
      "Improved video preview player with audio support",
      "New version update system",
    ],
  },
  "1.1.0": {
    date: "2026-03-20",
    changes_vi: [
      "Voice AI với ElevenLabs TTS",
      "AI viết lại caption với GPT-4o-mini",
      "Phụ đề highlight từ khóa",
      "8+ tính năng chống phát hiện Reup",
    ],
    changes_en: [
      "Voice AI with ElevenLabs TTS",
      "AI caption rewrite with GPT-4o-mini",
      "Keyword highlight subtitles",
      "8+ anti-detection Reup features",
    ],
  },
  "1.0.0": {
    date: "2026-03-19",
    changes_vi: ["Phiên bản đầu tiên - Tải video không watermark"],
    changes_en: ["Initial release - Watermark-free video download"],
  },
};

router.get("/video/version", (_req, res): void => {
  res.json({
    version: APP_VERSION,
    changelog: APP_CHANGELOG,
  });
});

const VALID_KEYS = (process.env.VALID_API_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);

function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey || !VALID_KEYS.includes(apiKey)) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }
  next();
}

router.post("/video/validate-key", (req, res): void => {
  const { apiKey } = req.body || {};
  if (!apiKey || !VALID_KEYS.includes(apiKey)) {
    res.status(401).json({ valid: false, error: "Invalid API key" });
    return;
  }
  res.json({ valid: true });
});

const DOWNLOAD_DIR = path.join(os.tmpdir(), "video-downloads");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

interface DownloadEntry {
  filepath: string;
  filename: string;
  filesize: number | null;
  title: string;
  platform: string;
  thumbnail: string | null;
  quality: string;
  url: string;
  createdAt: number;
  caption?: string;
  hashtags?: string[];
  description?: string;
}

const activeDownloads = new Map<string, DownloadEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [fileId, info] of activeDownloads.entries()) {
    try {
      const stat = fs.statSync(info.filepath);
      if (now - stat.mtimeMs > 30 * 60 * 1000) {
        fs.unlinkSync(info.filepath);
        activeDownloads.delete(fileId);
      }
    } catch {
      activeDownloads.delete(fileId);
    }
  }
}, 5 * 60 * 1000);

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("douyin.com")) return "douyin";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.watch") || u.includes("fb.com")) return "facebook";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("dailymotion.com")) return "dailymotion";
  if (u.includes("bilibili.com")) return "bilibili";
  if (u.includes("pinterest.com") || u.includes("pin.it")) return "pinterest";
  if (u.includes("reddit.com")) return "reddit";
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("snapchat.com")) return "snapchat";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("threads.net")) return "threads";
  return "other";
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { timeout: 120000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

router.post("/video/extract", validateApiKey, async (req, res): Promise<void> => {
  const parsed = ExtractVideoInfoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url } = parsed.data;
  const platform = detectPlatform(url);

  try {
    const jsonStr = await runYtDlp([
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--no-playlist",
      url,
    ]);

    const info = JSON.parse(jsonStr);

    const rawFormats = (info.formats || []);

    const videoFormats = rawFormats
      .filter((f: any) => f.vcodec !== "none" && f.vcodec !== null)
      .map((f: any) => ({
        height: f.height || 0,
        formatId: f.format_id || "unknown",
        filesize: f.filesize || f.filesize_approx || null,
        hasAudio: f.acodec !== "none" && f.acodec !== null,
      }));

    const qualityPresets: Array<{ height: number; label: string; formatSelector: string }> = [
      { height: 2160, label: "4K (2160p)", formatSelector: "bestvideo[height<=2160]+bestaudio/best[height<=2160]/best" },
      { height: 1440, label: "1440p", formatSelector: "bestvideo[height<=1440]+bestaudio/best[height<=1440]/best" },
      { height: 1080, label: "1080p (Full HD)", formatSelector: "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best" },
      { height: 720, label: "720p (HD)", formatSelector: "bestvideo[height<=720]+bestaudio/best[height<=720]/best" },
      { height: 480, label: "480p (SD)", formatSelector: "bestvideo[height<=480]+bestaudio/best[height<=480]/best" },
      { height: 360, label: "360p", formatSelector: "bestvideo[height<=360]+bestaudio/best[height<=360]/best" },
    ];

    const maxHeight = Math.max(...videoFormats.map((f: any) => f.height), 0);

    const availableFormats = qualityPresets
      .filter((p) => p.height <= maxHeight || maxHeight === 0)
      .map((p) => ({
        formatId: p.formatSelector,
        quality: p.label,
        extension: "mp4",
        filesize: null,
        hasAudio: true,
        hasVideo: true,
        resolution: `${Math.round(p.height * 16 / 9)}x${p.height}`,
      }));

    if (availableFormats.length === 0) {
      availableFormats.push({
        formatId: "bestvideo+bestaudio/best",
        quality: "Best Available",
        extension: "mp4",
        filesize: null,
        hasAudio: true,
        hasVideo: true,
        resolution: null,
      });
    }

    availableFormats.push({
      formatId: "bestaudio",
      quality: "Audio Only (MP3)",
      extension: "mp3",
      filesize: null,
      hasAudio: true,
      hasVideo: false,
      resolution: null,
    });

    const result = ExtractVideoInfoResponse.parse({
      title: info.title || "Untitled",
      thumbnail: info.thumbnail || null,
      duration: info.duration || null,
      platform,
      uploader: info.uploader || info.channel || null,
      formats: availableFormats,
    });

    res.json(result);
  } catch (err: any) {
    req.log.error({ err, url }, "Failed to extract video info");
    res.status(500).json({ error: err.message || "Failed to extract video info" });
  }
});

router.post("/video/download", validateApiKey, async (req, res): Promise<void> => {
  const parsed = DownloadVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, formatId, quality } = parsed.data;
  const fileId = randomUUID();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${fileId}.%(ext)s`);

  try {
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--no-part",
      "-o", outputTemplate,
    ];

    const isAudioOnly = formatId === "bestaudio";

    if (formatId) {
      args.push("-f", formatId);
    } else if (quality === "low") {
      args.push("-f", "worst[ext=mp4]/worst");
    } else if (quality === "medium") {
      args.push("-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best");
    } else {
      args.push("-f", "bestvideo+bestaudio/best");
    }

    if (isAudioOnly) {
      args.push("--extract-audio", "--audio-format", "mp3");
    } else {
      args.push("--merge-output-format", "mp4");
    }

    args.push(url);

    await runYtDlp(args);

    const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.startsWith(fileId));
    if (files.length === 0) {
      res.status(500).json({ error: "Download completed but file not found" });
      return;
    }

    const downloadedFile = files[0];
    const filepath = path.join(DOWNLOAD_DIR, downloadedFile);

    if (!isAudioOnly && downloadedFile.endsWith(".mp4")) {
      await ensureCompatibleAudio(filepath);
    }

    const stat = fs.statSync(filepath);

    let jsonStr: string;
    try {
      jsonStr = await runYtDlp([
        "--dump-json",
        "--no-download",
        "--no-warnings",
        "--no-playlist",
        url,
      ]);
    } catch {
      jsonStr = "{}";
    }

    let title = "video";
    try {
      const info = JSON.parse(jsonStr);
      title = (info.title || "video").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    } catch {
      // ignore
    }

    const ext = path.extname(downloadedFile) || ".mp4";
    const filename = `${title}${ext}`;

    let videoTitle = title;
    let videoPlatform = detectPlatform(url);
    let videoThumbnail: string | null = null;
    let videoCaption = "";
    let videoHashtags: string[] = [];
    let videoDescription = "";

    try {
      const infoObj = JSON.parse(jsonStr);
      videoTitle = infoObj.title || title;
      videoThumbnail = infoObj.thumbnail || null;
      videoDescription = infoObj.description || "";
      videoCaption = infoObj.title || "";
      const descText = `${infoObj.title || ""} ${infoObj.description || ""}`;
      const tagMatches = descText.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g);
      if (tagMatches) {
        videoHashtags = [...new Set(tagMatches)].slice(0, 30);
      }
      if (infoObj.tags && Array.isArray(infoObj.tags)) {
        const extraTags = infoObj.tags.map((t: string) => `#${t.replace(/^#/, "")}`);
        videoHashtags = [...new Set([...videoHashtags, ...extraTags])].slice(0, 30);
      }
    } catch {}

    activeDownloads.set(fileId, {
      filepath,
      filename,
      filesize: stat.size,
      title: videoTitle,
      platform: videoPlatform,
      thumbnail: videoThumbnail,
      quality: quality || "Best",
      url,
      createdAt: Date.now(),
      caption: videoCaption,
      hashtags: videoHashtags,
      description: videoDescription,
    });

    const result = DownloadVideoResponse.parse({
      fileId,
      filename,
      filesize: stat.size,
      streamUrl: `/api/video/stream/${fileId}`,
    });

    res.json(result);
  } catch (err: any) {
    req.log.error({ err, url }, "Failed to download video");
    const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) => f.startsWith(fileId));
    for (const f of files) {
      try { fs.unlinkSync(path.join(DOWNLOAD_DIR, f)); } catch {}
    }
    res.status(500).json({ error: err.message || "Failed to download video" });
  }
});

router.get("/video/stream/:fileId", async (req, res): Promise<void> => {
  const params = StreamVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { fileId } = params.data;
  const download = activeDownloads.get(fileId);

  if (!download || !fs.existsSync(download.filepath)) {
    res.status(404).json({ error: "File not found or expired" });
    return;
  }

  const stat = fs.statSync(download.filepath);
  const fileSize = stat.size;
  const ext = path.extname(download.filepath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo", ".mov": "video/quicktime",
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
    ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    });
    fs.createReadStream(download.filepath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=300",
    });
    fs.createReadStream(download.filepath).pipe(res);
  }
});

router.get("/video/library", validateApiKey, (_req, res): void => {
  const items = [];
  const now = Date.now();
  for (const [fileId, entry] of activeDownloads.entries()) {
    if (!fs.existsSync(entry.filepath)) {
      activeDownloads.delete(fileId);
      continue;
    }
    const expiresInMs = Math.max(0, 30 * 60 * 1000 - (now - entry.createdAt));
    items.push({
      fileId,
      filename: entry.filename,
      filesize: entry.filesize,
      title: entry.title,
      platform: entry.platform,
      thumbnail: entry.thumbnail,
      quality: entry.quality,
      url: entry.url,
      createdAt: entry.createdAt,
      expiresInMinutes: Math.ceil(expiresInMs / 60000),
      streamUrl: `/api/video/stream/${fileId}`,
      caption: entry.caption || "",
      hashtags: entry.hashtags || [],
      description: entry.description || "",
    });
  }
  items.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ items });
});

router.delete("/video/library/:fileId", validateApiKey, (req, res): void => {
  const { fileId } = req.params;
  const entry = activeDownloads.get(fileId);
  if (!entry) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  try {
    if (fs.existsSync(entry.filepath)) {
      fs.unlinkSync(entry.filepath);
    }
  } catch {}
  activeDownloads.delete(fileId);
  res.json({ success: true });
});

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { timeout: 300000 });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `ffmpeg exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

function runFfprobe(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", args, { timeout: 30000 });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `ffprobe exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

async function ensureCompatibleAudio(filepath: string): Promise<string> {
  try {
    const probeOut = await runFfprobe([
      "-v", "quiet", "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,profile",
      "-of", "csv=p=0", filepath,
    ]);

    if (!probeOut.trim()) return filepath;

    const parts = probeOut.trim().split(",");
    const codec = parts[0]?.trim();
    const profile = parts[1]?.trim() || "";

    const needsRecode = codec === "aac" && (profile === "HE-AAC" || profile === "HE-AACv2");

    if (!needsRecode) return filepath;

    console.log(`Re-encoding HE-AAC to AAC-LC for browser compatibility: ${filepath}`);
    const ext = path.extname(filepath);
    const fixedPath = filepath.replace(ext, `_fixed${ext}`);

    await runFfmpeg([
      "-y", "-i", filepath,
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      "-movflags", "+faststart",
      fixedPath,
    ]);

    fs.unlinkSync(filepath);
    fs.renameSync(fixedPath, filepath);
    console.log(`Audio re-encoded successfully: ${filepath}`);
    return filepath;
  } catch (err: any) {
    console.error("Audio re-encode failed (keeping original):", err.message);
    return filepath;
  }
}

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeColor(color: unknown): string {
  if (typeof color !== "string") return "black";
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  if (/^[a-zA-Z]+$/.test(color)) return color;
  return "black";
}

async function getVideoWidth(filepath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width",
      "-of", "csv=p=0",
      filepath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const w = parseInt(out.trim(), 10);
      resolve(isNaN(w) ? 1920 : w);
    });
    proc.on("error", () => resolve(1920));
  });
}

async function getVideoHeight(filepath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=height",
      "-of", "csv=p=0",
      filepath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const h = parseInt(out.trim(), 10);
      resolve(isNaN(h) ? 1080 : h);
    });
    proc.on("error", () => resolve(1080));
  });
}

function formatAssTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  let cs = Math.floor((seconds % 1) * 100);
  if (cs > 99) cs = 99;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function generateTikTokAss(
  srtContent: string,
  fontSize: number,
  videoWidth: number,
  videoHeight: number,
  coverOptions?: { position: string; heightPercent: number }
): string {
  const marginL = Math.round(videoWidth * 0.04);
  const marginR = Math.round(videoWidth * 0.04);

  let marginV: number;
  if (coverOptions && (coverOptions.position === "bottom" || coverOptions.position === "both")) {
    const barHeight = Math.round(videoHeight * coverOptions.heightPercent);
    if (fontSize > barHeight * 0.8) {
      fontSize = Math.round(barHeight * 0.6);
    }
    marginV = Math.max(5, Math.round((barHeight - fontSize) / 2));
  } else {
    marginV = Math.max(10, Math.round(videoHeight * 0.03));
  }

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,${Math.round(fontSize)},&H00FFFFFF,&HFF000000,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,1,2,2,${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const blocks = srtContent.trim().replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const text = lines.slice(2).join(" ");

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const startSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
    const endSec = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
    const duration = endSec - startSec;

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const wordIntervalCs = words.length > 1 ? Math.max(1, Math.round((duration / (words.length - 1)) * 100)) : 0;

    let karaokeText = "";
    for (let i = 0; i < words.length; i++) {
      const kCs = i === 0 ? 0 : wordIntervalCs;
      karaokeText += `{\\k${kCs}}${words[i]}`;
      if (i < words.length - 1) karaokeText += " ";
    }

    const startTime = formatAssTimestamp(startSec);
    const endTime = formatAssTimestamp(endSec);
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${karaokeText}\n`;
  }

  return ass;
}

async function getVideoDuration(filepath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      filepath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const d = parseFloat(out.trim());
      resolve(isNaN(d) ? 60 : d);
    });
    proc.on("error", () => resolve(60));
  });
}

async function generateAmbientMusic(outputPath: string, duration: number): Promise<void> {
  const dur = Math.ceil(duration) + 1;
  const args = [
    "-y",
    "-f", "lavfi",
    "-i", `anoisesrc=d=${dur}:c=pink:a=0.5,bandpass=f=300:width_type=h:w=200,aecho=0.8:0.7:40|60:0.3|0.2,volume=0.6`,
    "-f", "lavfi",
    "-i", `sine=f=220:d=${dur},volume=0.25,aecho=0.8:0.9:100:0.3`,
    "-f", "lavfi",
    "-i", `sine=f=330:d=${dur},volume=0.15,tremolo=f=0.5:d=0.4`,
    "-filter_complex", `[0][1][2]amix=inputs=3:duration=first:dropout_transition=2:normalize=0,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, dur - 3)}:d=3,volume=1.5`,
    "-c:a", "aac", "-b:a", "128k", "-ac", "2",
    outputPath,
  ];
  await runFfmpeg(args);
}

function extractTextFromSrt(srtContent: string): { text: string; segments: { start: number; end: number; text: string }[] } {
  const blocks = srtContent.trim().replace(/\r\n/g, "\n").split(/\n\n+/);
  const segments: { start: number; end: number; text: string }[] = [];
  const allText: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const textContent = lines.slice(2).join(" ").trim();
    if (!textContent) continue;

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const toSec = (h: string, m: string, s: string, ms: string) =>
      parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;

    segments.push({
      start: toSec(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]),
      end: toSec(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]),
      text: textContent,
    });
    allText.push(textContent);
  }

  return { text: allText.join(". "), segments };
}

router.post("/video/reup", validateApiKey, async (req, res): Promise<void> => {
  const { fileId, options } = req.body || {};

  if (!fileId || !options || typeof options !== "object") {
    res.status(400).json({ error: "Missing fileId or options" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source || !fs.existsSync(source.filepath)) {
    res.status(404).json({ error: "Source file not found in library" });
    return;
  }

  const ext = path.extname(source.filepath).toLowerCase() || ".mp4";
  const isAudioOnly = [".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac"].includes(ext);

  const newFileId = randomUUID();
  const outputExt = isAudioOnly ? ext : ".mp4";
  const outputPath = path.join(DOWNLOAD_DIR, `${newFileId}${outputExt}`);

  try {
    const videoWidth = isAudioOnly ? 1920 : await getVideoWidth(source.filepath);
    const videoHeight = isAudioOnly ? 1080 : await getVideoHeight(source.filepath);

    let sourceHasAudio = true;
    try {
      const audioProbe = await runFfprobe(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", source.filepath]);
      sourceHasAudio = audioProbe.trim().length > 0;
    } catch { sourceHasAudio = false; }

    const videoFilters: string[] = [];
    const audioFilters: string[] = [];

    if (!isAudioOnly) {
      if (options.removeWatermark === true) {
        videoFilters.push("delogo=x=10:y=10:w=150:h=50:show=0");
      }
      if (options.removeWatermarkArea && typeof options.removeWatermarkArea === "object") {
        const wx = clamp(options.removeWatermarkArea.x, 0, 3840, 0);
        const wy = clamp(options.removeWatermarkArea.y, 0, 2160, 0);
        const ww = clamp(options.removeWatermarkArea.w, 10, 500, 110);
        const wh = clamp(options.removeWatermarkArea.h, 10, 200, 40);
        videoFilters.push(`delogo=x=${Math.round(wx)}:y=${Math.round(wy)}:w=${Math.round(ww)}:h=${Math.round(wh)}:show=0`);
      }

      if (options.cropVertical === true) {
        videoFilters.push("crop=ih*9/16:ih");
      }

      if (options.mirror === true) {
        videoFilters.push("hflip");
      }

      if (options.flipVertical === true) {
        videoFilters.push("vflip");
      }

      const rotate = clamp(options.rotate, -180, 180, 0);
      if (rotate !== 0) {
        const angle = (rotate * Math.PI) / 180;
        videoFilters.push(`rotate=${angle.toFixed(6)}:c=black:ow=rotw(${angle.toFixed(6)}):oh=roth(${angle.toFixed(6)})`);
      }

      const zoom = clamp(options.zoom, 1, 2, 1);
      if (zoom > 1) {
        videoFilters.push(`crop=iw/${zoom.toFixed(4)}:ih/${zoom.toFixed(4)},scale=iw*${zoom.toFixed(4)}:ih*${zoom.toFixed(4)}`);
      }

      const brightness = clamp(options.brightness, -1, 1, 0);
      const contrast = clamp(options.contrast, 0.5, 2, 1);
      const saturation = clamp(options.saturation, 0, 3, 1);
      if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
        videoFilters.push(`eq=brightness=${brightness.toFixed(4)}:contrast=${contrast.toFixed(4)}:saturation=${saturation.toFixed(4)}`);
      }

      const border = clamp(options.border, 0, 100, 0);
      if (border > 0) {
        const color = sanitizeColor(options.borderColor);
        videoFilters.push(`pad=iw+${border * 2}:ih+${border * 2}:${border}:${border}:${color}`);
      }

      if (options.colorShift && typeof options.colorShift === "object") {
        const r = clamp(options.colorShift.r, -1, 1, 0);
        const g = clamp(options.colorShift.g, -1, 1, 0);
        const b = clamp(options.colorShift.b, -1, 1, 0);
        if (r !== 0 || g !== 0 || b !== 0) {
          videoFilters.push(`colorbalance=rs=${r.toFixed(4)}:gs=${g.toFixed(4)}:bs=${b.toFixed(4)}`);
        }
      }

      const noise = clamp(options.noise, 0, 100, 0);
      if (noise > 0) {
        videoFilters.push(`noise=alls=${Math.round(noise)}:allf=t`);
      }

      const sharpen = clamp(options.sharpen, 0, 2, 0);
      if (sharpen > 0) {
        videoFilters.push(`unsharp=5:5:${sharpen.toFixed(2)}:5:5:${sharpen.toFixed(2)}`);
      }

      if (options.colorGrading && typeof options.colorGrading === "object") {
        const gamma = clamp(options.colorGrading.gamma, 0.5, 2, 1);
        const gammaR = clamp(options.colorGrading.gammaR, 0.5, 2, 1);
        const gammaG = clamp(options.colorGrading.gammaG, 0.5, 2, 1);
        const gammaB = clamp(options.colorGrading.gammaB, 0.5, 2, 1);
        if (gamma !== 1 || gammaR !== 1 || gammaG !== 1 || gammaB !== 1) {
          videoFilters.push(`eq=gamma=${gamma.toFixed(4)}:gamma_r=${gammaR.toFixed(4)}:gamma_g=${gammaG.toFixed(4)}:gamma_b=${gammaB.toFixed(4)}`);
        }
      }
    }

    const speed = clamp(options.speed, 0.5, 2, 1);
    if (speed !== 1) {
      if (!isAudioOnly) {
        videoFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
      }
      audioFilters.push(`atempo=${speed.toFixed(4)}`);
    }

    const audioPitch = clamp(options.audioPitch, 0.5, 2, 1);
    if (audioPitch !== 1) {
      audioFilters.push(`asetrate=44100*${audioPitch.toFixed(4)},aresample=44100`);
    }

    if (options.stripAudio === true && !isAudioOnly) {
    }

    if (!isAudioOnly && options.coverOriginalText === true) {
      const coverH = clamp(options.coverTextHeight, 5, 30, 15) / 100;
      const coverPos = options.coverTextPosition || "bottom";
      if (coverPos === "bottom" || coverPos === "both") {
        videoFilters.push(`drawbox=x=0:y=ih*(1-${coverH}):w=iw:h=ih*${coverH}:color=black@0.92:t=fill`);
      }
      if (coverPos === "top" || coverPos === "both") {
        videoFilters.push(`drawbox=x=0:y=0:w=iw:h=ih*${coverH}:color=black@0.92:t=fill`);
      }
    }

    if (!isAudioOnly && options.subtitleText && typeof options.subtitleText === "string") {
      const text = options.subtitleText.replace(/'/g, "'\\''").replace(/:/g, "\\:").replace(/\\/g, "\\\\");
      const fontSize = clamp(options.subtitleFontSize, 8, 48, 10);
      const fontColor = sanitizeColor(options.subtitleColor || "white");
      const yPos = options.subtitlePosition === "top" ? "30" : options.subtitlePosition === "center" ? "(h-text_h)/2" : "h-text_h-30";
      const textStyle = typeof options.subtitleStyle === "string" ? options.subtitleStyle : "classic";

      const drawStyleMap: Record<string, string> = {
        classic: `:fontcolor=${fontColor}:borderw=2:bordercolor=black${options.subtitleBg ? ":box=1:boxcolor=black@0.5:boxborderw=8" : ""}`,
        outline: `:fontcolor=${fontColor}:borderw=4:bordercolor=black`,
        highlight: `:fontcolor=black:box=1:boxcolor=yellow@0.9:boxborderw=10:borderw=0`,
        shadow: `:fontcolor=${fontColor}:borderw=1:bordercolor=black:shadowcolor=black@0.8:shadowx=3:shadowy=3`,
        neon: `:fontcolor=cyan:borderw=2:bordercolor=blue`,
        retro: `:fontcolor=yellow:borderw=3:bordercolor=black:shadowcolor=orange@0.8:shadowx=2:shadowy=2`,
      };
      const styleStr = drawStyleMap[textStyle] || drawStyleMap.classic;
      const dynamicFontSize = `'if(gt(${Math.round(fontSize)}\\,w/25)\\,w/25\\,${Math.round(fontSize)})'`;
      const drawTextFilter = `drawtext=text='${text}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=${dynamicFontSize}:x=(w-text_w)/2:y=${yPos}${styleStr}`;
      videoFilters.push(drawTextFilter);
    }

    const subtitleTempFiles: string[] = [];

    if (!isAudioOnly && options.srtContent && typeof options.srtContent === "string") {
      const srtPath = path.join(DOWNLOAD_DIR, `${newFileId}.srt`);
      const baseFontSize = clamp(options.subtitleFontSize, 8, 48, 10);
      const widthScale = Math.min(1, videoWidth / 1080);
      const scaledFontSize = Math.max(8, Math.round(baseFontSize * widthScale));
      const marginL = Math.max(10, Math.round(80 * widthScale));
      const marginR = Math.max(10, Math.round(80 * widthScale));
      const marginV = Math.max(15, Math.round(30 * widthScale));

      const subtitleStyle = typeof options.subtitleStyle === "string" ? options.subtitleStyle : "classic";

      if (options.highlightKeywords && Array.isArray(options.highlightKeywords) && options.highlightKeywords.length > 0) {
        const assContent = srtToAssWithHighlights(options.srtContent, options.highlightKeywords, options.subtitleStyle || "classic", scaledFontSize);
        const assPath = path.join(DOWNLOAD_DIR, `${newFileId}.ass`);
        fs.writeFileSync(assPath, assContent, "utf-8");
        subtitleTempFiles.push(assPath);
        const escapedAssPath = assPath.replace(/:/g, "\\:").replace(/\\/g, "/");
        videoFilters.push(`ass=${escapedAssPath}`);
      } else if (subtitleStyle === "tiktok") {
        const tiktokFontSize = Math.round(videoWidth * 0.04 * (baseFontSize / 14));
        const coverOpts = options.coverOriginalText === true
          ? { position: options.coverTextPosition || "bottom", heightPercent: clamp(options.coverTextHeight, 5, 30, 15) / 100 }
          : undefined;
        const assContent = generateTikTokAss(options.srtContent, tiktokFontSize, videoWidth, videoHeight, coverOpts);
        const assPath = path.join(DOWNLOAD_DIR, `${newFileId}_karaoke.ass`);
        fs.writeFileSync(assPath, assContent, "utf-8");
        subtitleTempFiles.push(assPath);
        const escapedAssPath = assPath.replace(/:/g, "\\:").replace(/\\/g, "/");
        videoFilters.push(`ass=${escapedAssPath}`);
      } else {
        fs.writeFileSync(srtPath, options.srtContent, "utf-8");
        subtitleTempFiles.push(srtPath);
        const escapedSrtPath = srtPath.replace(/:/g, "\\:").replace(/\\/g, "/");
        const styleMap: Record<string, string> = {
          classic: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,BackColour=&H80000000,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
          outline: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=4,Shadow=0,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
          highlight: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H00000000,OutlineColour=&H0000D7FF,Outline=0,Shadow=0,BackColour=&H0000D7FF,BorderStyle=4,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
          shadow: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=1,Shadow=4,BackColour=&HCC000000,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
          neon: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H00FFFF00,OutlineColour=&H00FF8800,Outline=2,Shadow=0,BackColour=&H00000000,BorderStyle=1,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
          retro: `FontSize=${scaledFontSize},FontName=DejaVu Sans,Bold=1,PrimaryColour=&H0000D7FF,OutlineColour=&H00000000,Outline=3,Shadow=2,BackColour=&H000060FF,Alignment=2,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},WrapStyle=0`,
        };
        const forceStyle = styleMap[subtitleStyle] || styleMap.classic;
        videoFilters.push(`subtitles=${escapedSrtPath}:force_style='${forceStyle}'`);
      }
    }

    if (!isAudioOnly && videoFilters.length > 0) {
      videoFilters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
    }

    let ttsAudioPath: string | null = null;
    let bgMusicPath: string | null = null;
    let voiceRequested = false;
    const tempFiles: string[] = [];

    if (!isAudioOnly && options.voiceFromSubtitles === true && options.srtContent && typeof options.srtContent === "string") {
      const { text } = extractTextFromSrt(options.srtContent);
      if (text.trim()) {
        voiceRequested = true;
        try {
          const ttsBody: Record<string, string> = { text, lang: options.voiceLang || "vi" };
          if (options.voiceId) ttsBody.voiceId = options.voiceId;
          if (options.voiceProvider) ttsBody.provider = options.voiceProvider;

          const useVbee = ttsBody.provider === "vbee" || (ttsBody.provider !== "elevenlabs" && ttsBody.lang !== "en");
          let audioBuffer: Buffer | null = null;

          if (useVbee && VBEE_API_KEY && VBEE_APP_ID) {
            const selectedVoice = ttsBody.voiceId || "hn_female_ngochuyen_full_48k-fhg";
            try {
              audioBuffer = await vbeeTts(text, selectedVoice);
            } catch (err: any) {
              console.error("Vbee TTS for subtitles failed:", err.message);
            }
          }

          if (!audioBuffer && ELEVENLABS_API_KEY) {
            const defaultVoiceEn = "JBFqnCBsd6RMkjVDRZzb";
            const defaultVoiceVi = "XB0fDUnXU5powFXDhCwa";
            const isVbeeVoice = ttsBody.voiceId && VBEE_VOICES.some((v) => v.voiceId === ttsBody.voiceId);
            const selVoice = isVbeeVoice ? (ttsBody.lang === "en" ? defaultVoiceEn : defaultVoiceVi) : (ttsBody.voiceId || (ttsBody.lang === "en" ? defaultVoiceEn : defaultVoiceVi));
            const langCode = ttsBody.lang === "en" ? "en" : "vi";

            console.log("ElevenLabs TTS fallback:", { voice: selVoice, lang: langCode, textLen: text.length });
            const ttsRes = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${selVoice}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
              body: JSON.stringify({
                text: text.substring(0, 5000),
                model_id: "eleven_multilingual_v2",
                language_code: langCode,
                voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
              }),
            });
            if (ttsRes.ok) {
              audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
            } else {
              console.error("ElevenLabs TTS failed:", ttsRes.status, await ttsRes.text().catch(() => ""));
            }
          }

          if (audioBuffer && audioBuffer.length > 1000) {
            ttsAudioPath = path.join(DOWNLOAD_DIR, `${newFileId}_voice.mp3`);
            fs.writeFileSync(ttsAudioPath, audioBuffer);
            tempFiles.push(ttsAudioPath);
          } else if (audioBuffer) {
            console.warn("TTS audio buffer too small, likely invalid:", audioBuffer.length, "bytes");
          }
        } catch (err: any) {
          console.error("Voice from subtitles failed:", err.message);
        }
      }
    }

    if (options.stripAudio === true && !isAudioOnly && options.addBgMusic !== false) {
      try {
        const duration = await getVideoDuration(source.filepath);
        bgMusicPath = path.join(DOWNLOAD_DIR, `${newFileId}_bgm.m4a`);
        await generateAmbientMusic(bgMusicPath, duration);
        tempFiles.push(bgMusicPath);
      } catch (err: any) {
        console.error("Background music generation failed:", err.message);
      }
    }

    const hasVoice = ttsAudioPath && fs.existsSync(ttsAudioPath);
    const hasBgMusic = bgMusicPath && fs.existsSync(bgMusicPath);

    const args = ["-y", "-i", source.filepath];

    if (hasVoice) args.push("-i", ttsAudioPath!);
    if (hasBgMusic) args.push("-i", bgMusicPath!);

    if (videoFilters.length > 0) {
      args.push("-vf", videoFilters.join(","));
    }
    const voiceIdx = hasVoice ? 1 : -1;
    const bgmIdx = hasVoice && hasBgMusic ? 2 : hasBgMusic ? 1 : -1;

    const voiceFailedFallback = options.stripAudio === true && voiceRequested && !hasVoice;
    if (voiceFailedFallback) {
      console.warn("Voice was requested but TTS failed — keeping original audio as fallback instead of stripping");
    }

    const effectiveStripAudio = options.stripAudio === true && !voiceFailedFallback;
    const origAudioChain = sourceHasAudio && audioFilters.length > 0 ? `[0:a]${audioFilters.join(",")},` : sourceHasAudio ? "[0:a]" : "";
    const useFilterComplex = hasVoice || hasBgMusic || (voiceFailedFallback && hasBgMusic);

    if (!useFilterComplex && audioFilters.length > 0 && sourceHasAudio) {
      args.push("-af", audioFilters.join(","));
    }

    if (effectiveStripAudio && !isAudioOnly && !hasVoice && !hasBgMusic) {
      args.push("-an");
    } else if (effectiveStripAudio && !isAudioOnly) {
      if (hasVoice && hasBgMusic) {
        args.push("-filter_complex", `[${voiceIdx}:a]volume=1.0[voice];[${bgmIdx}:a]volume=0.3[bgm];[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=3:normalize=0[aout]`);
        args.push("-map", "0:v", "-map", "[aout]");
      } else if (hasVoice) {
        args.push("-map", "0:v", "-map", `${voiceIdx}:a`);
      } else if (hasBgMusic) {
        if (sourceHasAudio) {
          args.push("-filter_complex", `${origAudioChain}volume=0.15[orig];[${bgmIdx}:a]volume=0.5[bgm];[orig][bgm]amix=inputs=2:duration=longest:dropout_transition=3:normalize=0[aout]`);
        } else {
          args.push("-filter_complex", `[${bgmIdx}:a]volume=0.5[aout]`);
        }
        args.push("-map", "0:v", "-map", "[aout]");
      }
    } else if (hasVoice) {
      if (hasBgMusic && sourceHasAudio) {
        args.push("-filter_complex", `${origAudioChain}volume=0.3[orig];[${voiceIdx}:a]volume=1.0[voice];[${bgmIdx}:a]volume=0.25[bgm];[orig][voice][bgm]amix=inputs=3:duration=longest:dropout_transition=3:normalize=0[aout]`);
        args.push("-map", "0:v", "-map", "[aout]");
      } else if (hasBgMusic) {
        args.push("-filter_complex", `[${voiceIdx}:a]volume=1.0[voice];[${bgmIdx}:a]volume=0.25[bgm];[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=3:normalize=0[aout]`);
        args.push("-map", "0:v", "-map", "[aout]");
      } else if (sourceHasAudio) {
        args.push("-filter_complex", `${origAudioChain}volume=0.3[orig];[${voiceIdx}:a]volume=1.0[voice];[orig][voice]amix=inputs=2:duration=longest:dropout_transition=3:normalize=0[aout]`);
        args.push("-map", "0:v", "-map", "[aout]");
      } else {
        args.push("-map", "0:v", "-map", `${voiceIdx}:a`);
      }
    } else if (voiceFailedFallback && hasBgMusic && sourceHasAudio) {
      args.push("-filter_complex", `${origAudioChain}volume=0.7[orig];[${bgmIdx}:a]volume=0.3[bgm];[orig][bgm]amix=inputs=2:duration=longest:dropout_transition=3:normalize=0[aout]`);
      args.push("-map", "0:v", "-map", "[aout]");
    } else if (voiceFailedFallback && hasBgMusic) {
      args.push("-map", "0:v", "-map", `${bgmIdx}:a`);
    } else if (!sourceHasAudio && !hasVoice && !hasBgMusic) {
      args.push("-an");
    }

    if (!isAudioOnly) {
      args.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "0");
      const crf = clamp(options.crf, 18, 28, 23);
      args.push("-crf", String(Math.round(crf)));

      if (options.randomBitrate === true) {
        const randCrf = 18 + Math.floor(Math.random() * 8);
        args[args.indexOf("-crf") + 1] = String(randCrf);
        const randBitrate = 800 + Math.floor(Math.random() * 3200);
        args.push("-maxrate", `${randBitrate}k`, "-bufsize", `${randBitrate * 2}k`);
      }
    }
    if (!hasVoice && !hasBgMusic && options.stripAudio !== true) {
      args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2");
    } else if (hasVoice || hasBgMusic) {
      args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2");
    }
    args.push("-movflags", "+faststart", outputPath);

    console.log("REUP ffmpeg command:", args.join(" "));
    await runFfmpeg(args);

    try {
      const probeCheck = await runFfprobe(["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,codec_name,sample_rate", "-of", "csv=p=0", outputPath]);
      console.log("REUP output audio check:", probeCheck.trim());
    } catch {}

    for (const f of [...tempFiles, ...subtitleTempFiles]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }

    if (!fs.existsSync(outputPath)) {
      res.status(500).json({ error: "Processing completed but output file not found" });
      return;
    }

    const stat = fs.statSync(outputPath);
    const reupTitle = `[Reup] ${source.title}`;
    const reupFilename = `reup_${source.filename}`;

    activeDownloads.set(newFileId, {
      filepath: outputPath,
      filename: reupFilename,
      filesize: stat.size,
      title: reupTitle,
      platform: source.platform,
      thumbnail: source.thumbnail,
      quality: source.quality,
      url: source.url,
      createdAt: Date.now(),
    });

    res.json({
      fileId: newFileId,
      filename: reupFilename,
      filesize: stat.size,
      title: reupTitle,
      streamUrl: `/api/video/stream/${newFileId}`,
    });
  } catch (err: any) {
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
    for (const f of subtitleTempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
    res.status(500).json({ error: err.message || "Failed to process video" });
  }
});

function srtToAssWithHighlights(srtContent: string, keywords: string[], style: string, fontSize: number): string {
  const styleMap: Record<string, { primary: string; outline: string; back: string; outlineW: number; shadow: number }> = {
    classic: { primary: "&H00FFFFFF", outline: "&H00000000", back: "&H80000000", outlineW: 2, shadow: 1 },
    outline: { primary: "&H00FFFFFF", outline: "&H00000000", back: "&H00000000", outlineW: 4, shadow: 0 },
    highlight: { primary: "&H00000000", outline: "&H0000D7FF", back: "&H0000D7FF", outlineW: 0, shadow: 0 },
    shadow: { primary: "&H00FFFFFF", outline: "&H00000000", back: "&HCC000000", outlineW: 1, shadow: 4 },
    neon: { primary: "&H00FFFF00", outline: "&H00FF8800", back: "&H00000000", outlineW: 2, shadow: 0 },
    retro: { primary: "&H0000D7FF", outline: "&H00000000", back: "&H000060FF", outlineW: 3, shadow: 2 },
  };
  const s = styleMap[style] || styleMap.classic;

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,${Math.round(fontSize)},${s.primary},&H000000FF,${s.outline},${s.back},1,0,0,0,100,100,0,0,1,${s.outlineW},${s.shadow},2,80,80,30,1
Style: Highlight,DejaVu Sans,${Math.round(fontSize)},&H0000D7FF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,80,80,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const blocks = srtContent.trim().replace(/\r\n/g, "\n").split(/\n\n+/);
  const lowerKeywords = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const textContent = lines.slice(2).join(" ");

    const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timeMatch) continue;

    const toAssTime = (h: string, m: string, sec: string, ms: string) =>
      `${parseInt(h)}:${m}:${sec}.${ms.substring(0, 2)}`;

    const start = toAssTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end = toAssTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

    let assText = textContent;
    for (const kw of lowerKeywords) {
      const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      assText = assText.replace(regex, `{\\c&H0000D7FF&\\b1}$1{\\c${s.primary}&\\b1}`);
    }

    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${assText}\n`;
  }

  return ass;
}

router.post("/video/ai-rewrite", validateApiKey, async (req, res): Promise<void> => {
  const { fileId, platform, lang } = req.body || {};

  if (!fileId) {
    res.status(400).json({ error: "Missing fileId" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const targetLang = lang === "en" ? "English" : "Vietnamese";
  const platformName = platform || "TikTok";

  try {
    const chatRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a viral social media content creator specializing in ${platformName}. Generate engaging content in ${targetLang}. Return JSON only with this format:
{
  "caption": "new engaging caption (max 200 chars)",
  "hashtags": ["#tag1", "#tag2", ...up to 15 tags],
  "hook": "attention-grabbing hook for first 3 seconds (max 50 chars)",
  "cta": "call-to-action text (max 30 chars)"
}`
        },
        {
          role: "user",
          content: `Original video title: "${source.title}"
Original caption: "${source.caption || source.title}"
Platform: ${source.platform}
Original hashtags: ${(source.hashtags || []).join(" ")}
Description: ${(source.description || "").substring(0, 500)}

Rewrite this content for ${platformName} to make it unique and viral. Create completely new caption and hashtags that convey similar meaning but use different wording. Make it engaging and platform-optimized.`
        }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = chatRes.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    res.json({
      caption: parsed.caption || "",
      hashtags: parsed.hashtags || [],
      hook: parsed.hook || "",
      cta: parsed.cta || "",
      originalCaption: source.caption || source.title,
      originalHashtags: source.hashtags || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "AI rewrite failed" });
  }
});

router.post("/video/detect-scenes", validateApiKey, async (req, res): Promise<void> => {
  const { fileId } = req.body || {};

  if (!fileId) {
    res.status(400).json({ error: "Missing fileId" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source || !fs.existsSync(source.filepath)) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  try {
    const stderr = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v", "quiet",
        "-show_entries", "frame=pts_time",
        "-of", "csv=p=0",
        "-f", "lavfi",
        `movie=${source.filepath.replace(/'/g, "'\\''")},select=gt(scene\\,0.3)`,
      ], { timeout: 60000 });
      let output = "";
      proc.stdout.on("data", (d: Buffer) => { output += d.toString(); });
      proc.stderr.on("data", (d: Buffer) => { output += d.toString(); });
      proc.on("close", () => resolve(output));
      proc.on("error", (e) => reject(e));
    });

    const timestamps = stderr.split("\n")
      .map((l) => parseFloat(l.trim()))
      .filter((n) => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);

    res.json({
      sceneCount: timestamps.length + 1,
      sceneChanges: timestamps.map((t) => Number(t.toFixed(2))),
    });
  } catch (err: any) {
    res.json({ sceneCount: 1, sceneChanges: [] });
  }
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const VBEE_API_KEY = process.env.VBEE_API_KEY || "";
const VBEE_APP_ID = process.env.VBEE_APP_ID || "";
const VBEE_BASE = "https://api.vbee.vn/api/v1";

const VBEE_VOICES = [
  { voiceId: "hn_female_ngochuyen_full_48k-fhg", name: "Ngọc Huyền", gender: "Nữ", accent: "Bắc", lang: "vi" },
  { voiceId: "hn_male_manhdung_dial_48k-fhg", name: "Mạnh Dũng", gender: "Nam", accent: "Bắc", lang: "vi" },
  { voiceId: "sg_female_thaotrinh_full_48k-fhg", name: "Thảo Trinh", gender: "Nữ", accent: "Nam", lang: "vi" },
  { voiceId: "sg_male_minhhoang_dial_48k-fhg", name: "Minh Hoàng", gender: "Nam", accent: "Nam", lang: "vi" },
  { voiceId: "hn_female_thutrang_dial_48k-fhg", name: "Thu Trang", gender: "Nữ", accent: "Bắc", lang: "vi" },
  { voiceId: "hn_male_phucson_dial_48k-fhg", name: "Phúc Sơn", gender: "Nam", accent: "Bắc", lang: "vi" },
  { voiceId: "sg_female_lantrinh_full_48k-fhg", name: "Lan Trinh", gender: "Nữ", accent: "Nam", lang: "vi" },
  { voiceId: "hn_female_maianh_news_48k-fhg", name: "Mai Anh (Tin tức)", gender: "Nữ", accent: "Bắc", lang: "vi" },
];

const VBEE_ALLOWED_HOSTS = ["vbee.vn", "api.vbee.vn", "storage.vbee.vn", "cdn.vbee.vn", "s3.amazonaws.com", "s3-ap-southeast-1.amazonaws.com"];

function isAllowedAudioUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchSafeAudio(url: string): Promise<Buffer> {
  if (!isAllowedAudioUrl(url)) throw new Error(`Blocked audio download from untrusted host: ${new URL(url).hostname}`);
  const audioRes = await fetch(url);
  if (!audioRes.ok) throw new Error("Failed to download Vbee audio");
  return Buffer.from(await audioRes.arrayBuffer());
}

async function vbeeTts(text: string, voiceId: string): Promise<Buffer> {
  const reqBody = {
    app_id: VBEE_APP_ID,
    input_text: text.substring(0, 5000),
    voice_code: voiceId,
    audio_type: "mp3",
    bitrate: 128,
    speed_rate: 1.0,
  };
  console.log("Vbee TTS request:", { url: `${VBEE_BASE}/tts`, voiceId, textLen: text.length });

  const createRes = await fetch(`${VBEE_BASE}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VBEE_API_KEY}`,
    },
    body: JSON.stringify(reqBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("Vbee TTS HTTP error:", createRes.status, errText);
    throw new Error(`Vbee TTS request failed: ${createRes.status} ${errText}`);
  }

  const rawText = await createRes.text();
  console.log("Vbee TTS raw response:", rawText.substring(0, 500));
  let data: any;
  try { data = JSON.parse(rawText); } catch { throw new Error(`Vbee returned non-JSON: ${rawText.substring(0, 200)}`); }

  const audioUrl = data.audio_link || data.audio_url || data.result_url || data.download_url;

  if (audioUrl) {
    console.log("Vbee TTS audio URL found immediately:", audioUrl);
    return fetchSafeAudio(audioUrl);
  }

  const reqId = data.request_id || data.id;
  if (reqId) {
    console.log("Vbee TTS polling request_id:", reqId);
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`${VBEE_BASE}/tts/${reqId}`, {
        headers: { Authorization: `Bearer ${VBEE_API_KEY}` },
      });
      if (pollRes.ok) {
        const pollRaw = await pollRes.text();
        console.log(`Vbee poll ${i}:`, pollRaw.substring(0, 300));
        let pollData: any;
        try { pollData = JSON.parse(pollRaw); } catch { continue; }
        const pollAudioUrl = pollData.audio_link || pollData.audio_url || pollData.result_url || pollData.download_url;
        if (pollAudioUrl) return fetchSafeAudio(pollAudioUrl);
        if (pollData.status === "FAILED" || pollData.status === "ERROR") {
          throw new Error("Vbee TTS processing failed");
        }
      }
    }
    throw new Error("Vbee TTS timed out after 60s");
  }

  throw new Error(`Vbee returned no audio URL or request ID. Response keys: ${Object.keys(data).join(", ")}`);
}

router.post("/video/tts", validateApiKey, async (req, res): Promise<void> => {
  const { text, voiceId, lang, provider } = req.body || {};

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty text" });
    return;
  }

  const useVbee = provider === "vbee" || (provider !== "elevenlabs" && lang !== "en");

  if (useVbee && VBEE_API_KEY && VBEE_APP_ID) {
    const selectedVoice = voiceId || "hn_female_ngochuyen_full_48k-fhg";
    try {
      const audioBuffer = await vbeeTts(text, selectedVoice);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
      return;
    } catch (err: any) {
      console.error("Vbee TTS failed, attempting ElevenLabs fallback:", err.message);
      if (!ELEVENLABS_API_KEY) {
        res.status(500).json({ error: err.message || "Vbee TTS failed" });
        return;
      }
    }
  }

  if (!ELEVENLABS_API_KEY) {
    res.status(500).json({ error: "No TTS service configured" });
    return;
  }

  const defaultVoiceEn = "JBFqnCBsd6RMkjVDRZzb";
  const defaultVoiceVi = "XB0fDUnXU5powFXDhCwa";
  const isVbeeVoice = voiceId && VBEE_VOICES.some((v) => v.voiceId === voiceId);
  const selectedVoice = isVbeeVoice ? (lang === "en" ? defaultVoiceEn : defaultVoiceVi) : (voiceId || (lang === "en" ? defaultVoiceEn : defaultVoiceVi));
  const langCode = lang === "en" ? "en" : "vi";

  try {
    const ttsRes = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${selectedVoice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text.substring(0, 2000),
        model_id: "eleven_multilingual_v2",
        language_code: langCode,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      res.status(ttsRes.status).json({ error: `TTS error: ${errText.substring(0, 200)}` });
      return;
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.send(audioBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "TTS failed" });
  }
});

router.get("/video/tts/voices", validateApiKey, async (req, res): Promise<void> => {
  const lang = (req.query.lang as string) || "all";
  const voices: { voiceId: string; name: string; gender: string; accent?: string; provider: string; lang: string }[] = [];

  if (VBEE_API_KEY && VBEE_APP_ID) {
    for (const v of VBEE_VOICES) {
      if (lang === "all" || lang === "vi") {
        voices.push({ ...v, provider: "vbee" });
      }
    }
  }

  if (ELEVENLABS_API_KEY && (lang === "all" || lang === "en")) {
    try {
      const voicesRes = await fetch(`${ELEVENLABS_BASE}/voices`, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      });
      if (voicesRes.ok) {
        const data = await voicesRes.json() as { voices: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> };
        for (const v of (data.voices || []).slice(0, 20)) {
          voices.push({
            voiceId: v.voice_id,
            name: v.name,
            gender: v.labels?.gender || "",
            accent: v.labels?.accent || "",
            provider: "elevenlabs",
            lang: "en",
          });
        }
      }
    } catch {}
  }

  res.json({ voices });
});

const SONIOX_API_KEY = process.env.SONIOX_API_KEY || "";
const SONIOX_BASE = "https://api.soniox.com/v1";

async function sonioxUploadFile(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const blob = new Blob([fileBuffer], { type: "audio/mpeg" });
  const form = new FormData();
  form.append("file", blob, fileName);

  const resp = await fetch(`${SONIOX_BASE}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
    body: form,
  });
  if (!resp.ok) throw new Error(`Soniox upload failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json() as any;
  return data.id;
}

async function sonioxCreateTranscription(fileId: string, language?: string): Promise<string> {
  const body: Record<string, any> = { file_id: fileId, model: "stt-async-preview" };
  if (language) {
    body.language_hints = [language];
  }
  const resp = await fetch(`${SONIOX_BASE}/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Soniox create transcription failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json() as any;
  return data.id;
}

async function sonioxPollTranscription(transcriptionId: string, maxWaitMs = 120000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const resp = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}`, {
      headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
    });
    if (!resp.ok) throw new Error(`Soniox poll failed: ${resp.status}`);
    const data = await resp.json() as any;
    if (data.status === "completed") return "completed";
    if (data.status === "error" || data.status === "failed") throw new Error(`Soniox transcription failed: ${data.error || data.status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Soniox transcription timed out");
}

async function sonioxGetTranscript(transcriptionId: string): Promise<{ tokens: Array<{ text: string; start_ms: number; end_ms: number }> }> {
  const resp = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}/transcript`, {
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}` },
  });
  if (!resp.ok) throw new Error(`Soniox get transcript failed: ${resp.status}`);
  return resp.json() as any;
}

function tokensToSegments(tokens: Array<{ text: string; start_ms: number; end_ms: number }>): Array<{ start: number; end: number; text: string }> {
  const MAX_CHARS = 25;
  const MAX_WORDS = 6;

  const words: Array<{ text: string; start_ms: number; end_ms: number }> = [];
  let buf = "";
  let bufStart = 0;
  let bufEnd = 0;
  for (const t of tokens) {
    const txt = t.text.replace(/\s+/g, " ");
    if (!buf) { bufStart = t.start_ms; }
    buf += txt;
    bufEnd = t.end_ms;
    if (buf.endsWith(" ") || /[.!?,;:。！？，；]$/.test(buf.trim())) {
      if (buf.trim()) words.push({ text: buf.trim(), start_ms: bufStart, end_ms: bufEnd });
      buf = "";
    }
  }
  if (buf.trim()) words.push({ text: buf.trim(), start_ms: bufStart, end_ms: bufEnd });

  const segments: Array<{ start: number; end: number; text: string }> = [];
  let segWords: string[] = [];
  let segStart = 0;
  let segEnd = 0;

  for (const w of words) {
    if (segWords.length === 0) segStart = w.start_ms / 1000;
    segWords.push(w.text);
    segEnd = w.end_ms / 1000;

    const joined = segWords.join(" ");
    const endsWithPunc = /[.!?。！？]$/.test(joined);
    const endsWithComma = /[,;，；:]$/.test(joined);

    if (endsWithPunc || joined.length >= MAX_CHARS || segWords.length >= MAX_WORDS || endsWithComma) {
      segments.push({ start: segStart, end: segEnd, text: joined });
      segWords = [];
    }
  }

  if (segWords.length > 0) {
    segments.push({ start: segStart, end: segEnd, text: segWords.join(" ") });
  }

  return smartSplitLongSegments(segments);
}

function smartSplitLongSegments(segments: Array<{ start: number; end: number; text: string }>): Array<{ start: number; end: number; text: string }> {
  const MAX_DISPLAY_CHARS = 30;
  const result: Array<{ start: number; end: number; text: string }> = [];

  for (const seg of segments) {
    if (seg.text.length <= MAX_DISPLAY_CHARS) {
      result.push(seg);
      continue;
    }

    const words = seg.text.split(/\s+/);
    const duration = seg.end - seg.start;
    const totalChars = seg.text.length;
    let line: string[] = [];
    let lineStart = seg.start;
    let charsUsed = 0;

    for (let i = 0; i < words.length; i++) {
      line.push(words[i]);
      const lineText = line.join(" ");

      const isLast = i === words.length - 1;
      const tooLong = lineText.length >= MAX_DISPLAY_CHARS;

      if (tooLong || isLast) {
        const lineEnd = lineStart + (lineText.length / totalChars) * duration;
        result.push({ start: lineStart, end: Math.min(lineEnd, seg.end), text: lineText });
        charsUsed += lineText.length;
        lineStart = lineEnd;
        line = [];
      }
    }
  }

  return result;
}

router.post("/video/transcribe", validateApiKey, async (req, res): Promise<void> => {
  const { fileId, targetLang } = req.body || {};

  if (!fileId) {
    res.status(400).json({ error: "Missing fileId" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source || !fs.existsSync(source.filepath)) {
    res.status(404).json({ error: "Source file not found" });
    return;
  }

  if (!SONIOX_API_KEY) {
    res.status(500).json({ error: "SONIOX_API_KEY not configured" });
    return;
  }

  const audioPath = path.join(DOWNLOAD_DIR, `${randomUUID()}.mp3`);

  try {
    await runFfmpeg(["-y", "-i", source.filepath, "-vn", "-acodec", "libmp3lame", "-b:a", "128k", "-ar", "16000", "-ac", "1", audioPath]);

    const sonioxFileId = await sonioxUploadFile(audioPath);
    const langHint = targetLang === "en" ? "en" : "vi";
    const transcriptionId = await sonioxCreateTranscription(sonioxFileId, langHint);
    await sonioxPollTranscription(transcriptionId);
    const transcript = await sonioxGetTranscript(transcriptionId);

    const segments = tokensToSegments(transcript.tokens || []);
    const originalText = segments.map((s) => s.text).join(" ");

    const formatSrtTime = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      const ms = Math.round((s % 1) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };

    let finalSegments = segments;
    let translatedText = "";

    if (targetLang && segments.length > 0) {
      const langNames: Record<string, string> = { vi: "Vietnamese", en: "English" };
      const targetName = langNames[targetLang] || targetLang;

      const segTexts = segments.map((s, i) => `[${i}] ${s.text}`).join("\n");
      const chatRes = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate each numbered line to ${targetName}. Keep the [number] prefix exactly. Return ONLY the translated lines, one per line. Keep translations natural and concise for video subtitles.`
          },
          { role: "user", content: segTexts }
        ],
        temperature: 0.3,
      });

      const translated = chatRes.choices[0]?.message?.content || "";
      const lines = translated.split("\n").filter(Boolean);

      finalSegments = segments.map((seg, i) => {
        const line = lines.find((l) => l.startsWith(`[${i}]`));
        const cleanText = line ? line.replace(/^\[\d+\]\s*/, "").trim() : seg.text;
        return { start: seg.start, end: seg.end, text: cleanText };
      });

      translatedText = finalSegments.map((s) => s.text).join(" ");
    }

    let srtContent = "";
    finalSegments.forEach((seg, i) => {
      srtContent += `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}\n\n`;
    });

    try { fs.unlinkSync(audioPath); } catch {}

    res.json({
      originalText,
      detectedLang: "auto",
      translatedText: translatedText || originalText,
      srtContent,
      segments: finalSegments,
    });
  } catch (err: any) {
    try { fs.unlinkSync(audioPath); } catch {}
    res.status(500).json({ error: err.message || "Transcription failed" });
  }
});

router.delete("/video/library", validateApiKey, (_req, res): void => {
  for (const [fileId, entry] of activeDownloads.entries()) {
    try {
      if (fs.existsSync(entry.filepath)) {
        fs.unlinkSync(entry.filepath);
      }
    } catch {}
    activeDownloads.delete(fileId);
  }
  res.json({ success: true });
});

router.post("/video/analyze", validateApiKey, async (req, res): Promise<void> => {
  const { fileId, lang } = req.body || {};

  if (!fileId) {
    res.status(400).json({ error: "Missing fileId" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source || !fs.existsSync(source.filepath)) {
    res.status(404).json({ error: "Source file not found" });
    return;
  }

  const tempFiles: string[] = [];
  try {
    const stat = fs.statSync(source.filepath);
    const MAX_SIZE = 7 * 1024 * 1024;
    let videoPath = source.filepath;

    if (stat.size > MAX_SIZE) {
      const compressedPath = path.join(DOWNLOAD_DIR, `${randomUUID()}_compressed.mp4`);
      await runFfmpeg(["-y", "-i", source.filepath, "-vf", "scale=480:-2", "-r", "10", "-t", "60", "-b:v", "200k", "-an", compressedPath]);
      videoPath = compressedPath;
      tempFiles.push(compressedPath);
    }

    const videoBuffer = fs.readFileSync(videoPath);
    const base64Video = videoBuffer.toString("base64");

    const isVi = lang !== "en";
    const prompt = isVi
      ? `Hãy phân tích chi tiết video này. Mô tả:
1. Nội dung chính của video (đang làm gì, sản phẩm gì, chủ đề gì)
2. Các cảnh quay chính và chuyển cảnh
3. Âm thanh/lời nói trong video (nếu có)
4. Đánh giá chất lượng video (ánh sáng, góc quay, bố cục)
5. Đối tượng khán giả phù hợp
6. Hashtag đề xuất (10 hashtag phổ biến)
Trả lời bằng tiếng Việt, chi tiết và chuyên nghiệp.`
      : `Analyze this video in detail. Describe:
1. Main content (what's happening, products, topic)
2. Key scenes and transitions
3. Audio/speech content (if any)
4. Video quality assessment (lighting, angles, composition)
5. Target audience
6. Suggested hashtags (10 popular hashtags)
Respond in English, detailed and professional.`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "video/mp4", data: base64Video } },
          { text: prompt },
        ],
      }],
    });

    const analysis = response.text || "";
    res.json({ success: true, analysis, title: source.title });
  } catch (err: any) {
    console.error("Video analysis failed:", err.message);
    res.status(500).json({ error: "Video analysis failed" });
  } finally {
    for (const f of tempFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }
});

router.post("/video/generate-review", validateApiKey, async (req, res): Promise<void> => {
  const { fileId, analysis, transcript, lang, style, platform } = req.body || {};

  if (!fileId) {
    res.status(400).json({ error: "Missing fileId" });
    return;
  }

  const source = activeDownloads.get(fileId);
  if (!source) {
    res.status(404).json({ error: "Source file not found" });
    return;
  }

  const isVi = lang !== "en";
  const platformName = platform || "TikTok";
  const reviewStyle = style || "natural";

  const styleGuides: Record<string, string> = isVi ? {
    natural: "Giọng văn tự nhiên, gần gũi như đang kể chuyện cho bạn bè nghe",
    professional: "Giọng văn chuyên nghiệp, đánh giá khách quan như một chuyên gia",
    funny: "Giọng văn hài hước, dí dỏm, có những câu gây cười tự nhiên",
    enthusiastic: "Giọng văn nhiệt tình, hào hứng, khiến người xem muốn thử ngay",
    honest: "Giọng văn thật thà, thẳng thắn, nêu cả ưu và nhược điểm",
  } : {
    natural: "Natural, conversational tone like talking to a friend",
    professional: "Professional, objective assessment like an expert",
    funny: "Humorous, witty with natural comedy",
    enthusiastic: "Enthusiastic, exciting, makes viewers want to try immediately",
    honest: "Honest, straightforward, mentioning both pros and cons",
  };

  const styleGuide = styleGuides[reviewStyle] || styleGuides.natural;

  const systemPrompt = isVi
    ? `Bạn là một content creator chuyên nghiệp trên ${platformName}. Nhiệm vụ: viết kịch bản review/voiceover cho video.

PHONG CÁCH: ${styleGuide}

QUY TẮC:
- Viết kịch bản voiceover (người đọc sẽ đọc lên video)
- Mỗi đoạn tương ứng 3-5 giây video
- Tổng kịch bản 30-60 giây (phù hợp ${platformName})
- Dùng ngôn ngữ ${platformName} (gen Z nếu TikTok, chuyên nghiệp nếu YouTube)
- KHÔNG dùng emoji trong kịch bản
- Viết tự nhiên, không robot
- Thêm hook mở đầu hấp dẫn
- Kết thúc bằng call-to-action

FORMAT: Trả về kịch bản dạng:
[HOOK] Câu mở đầu gây chú ý
[BODY] Nội dung review chi tiết
[CTA] Lời kêu gọi hành động`
    : `You are a professional ${platformName} content creator. Task: write a review/voiceover script for this video.

STYLE: ${styleGuide}

RULES:
- Write voiceover script (to be read over the video)
- Each section = 3-5 seconds of video
- Total script 30-60 seconds (suitable for ${platformName})
- Use ${platformName} language style
- NO emojis in script
- Natural, not robotic
- Add a catchy opening hook
- End with call-to-action

FORMAT: Return script as:
[HOOK] Attention-grabbing opener
[BODY] Detailed review content
[CTA] Call to action`;

  let contextInfo = `Video title: ${source.title}\n`;
  if (analysis) contextInfo += `Video analysis:\n${analysis}\n`;
  if (transcript) contextInfo += `Video transcript:\n${transcript}\n`;

  try {
    const chatRes = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: contextInfo + (isVi ? "\nHãy viết kịch bản review cho video này:" : "\nWrite a review script for this video:") },
      ],
      temperature: 0.8,
    });

    const script = chatRes.choices[0]?.message?.content || "";

    const titleRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: isVi
            ? `Viết tiêu đề video ${platformName} hấp dẫn (tối đa 100 ký tự) và mô tả ngắn (tối đa 200 ký tự) dựa trên kịch bản review. Trả về JSON: {"title": "...", "description": "...", "hashtags": ["tag1", "tag2", ...]}`
            : `Write a catchy ${platformName} video title (max 100 chars) and short description (max 200 chars) based on the review script. Return JSON: {"title": "...", "description": "...", "hashtags": ["tag1", "tag2", ...]}`,
        },
        { role: "user", content: script },
      ],
      temperature: 0.7,
    });

    let metadata: { title?: string; description?: string; hashtags?: string[] } = {};
    try {
      const raw = titleRes.choices[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) metadata = JSON.parse(jsonMatch[0]);
    } catch {}

    res.json({
      success: true,
      script,
      suggestedTitle: metadata.title || "",
      suggestedDescription: metadata.description || "",
      suggestedHashtags: metadata.hashtags || [],
    });
  } catch (err: any) {
    console.error("Generate review failed:", err.message);
    res.status(500).json({ error: "Review generation failed" });
  }
});

export default router;
