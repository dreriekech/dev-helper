import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import {
  ExtractVideoInfoBody,
  ExtractVideoInfoResponse,
  DownloadVideoBody,
  DownloadVideoResponse,
  StreamVideoParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
      { height: 2160, label: "4K (2160p)", formatSelector: "bestvideo[height<=2160]+bestaudio/best[height<=2160]" },
      { height: 1440, label: "1440p", formatSelector: "bestvideo[height<=1440]+bestaudio/best[height<=1440]" },
      { height: 1080, label: "1080p (Full HD)", formatSelector: "bestvideo[height<=1080]+bestaudio/best[height<=1080]" },
      { height: 720, label: "720p (HD)", formatSelector: "bestvideo[height<=720]+bestaudio/best[height<=720]" },
      { height: 480, label: "480p (SD)", formatSelector: "bestvideo[height<=480]+bestaudio/best[height<=480]" },
      { height: 360, label: "360p", formatSelector: "bestvideo[height<=360]+bestaudio/best[height<=360]" },
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

    try {
      const infoObj = JSON.parse(jsonStr);
      videoTitle = infoObj.title || title;
      videoThumbnail = infoObj.thumbnail || null;
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

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${download.filename}"`);
  res.setHeader("Content-Length", stat.size);

  const stream = fs.createReadStream(download.filepath);
  stream.pipe(res);
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

export default router;
