import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import OpenAI from "openai";
import {
  ExtractVideoInfoBody,
  ExtractVideoInfoResponse,
  DownloadVideoBody,
  DownloadVideoResponse,
  StreamVideoParams,
} from "@workspace/api-zod";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

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
    const videoFilters: string[] = [];
    const audioFilters: string[] = [];

    if (!isAudioOnly) {
      if (options.removeWatermark === true) {
        videoFilters.push("delogo=x=iw-120:y=10:w=110:h=40:show=0");
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

    if (!isAudioOnly && options.subtitleText && typeof options.subtitleText === "string") {
      const text = options.subtitleText.replace(/'/g, "'\\''").replace(/:/g, "\\:").replace(/\\/g, "\\\\");
      const fontSize = clamp(options.subtitleFontSize, 8, 48, 14);
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
      const drawTextFilter = `drawtext=text='${text}':fontsize=${Math.round(fontSize)}:x=(w-text_w)/2:y=${yPos}${styleStr}`;
      videoFilters.push(drawTextFilter);
    }

    if (!isAudioOnly && options.srtContent && typeof options.srtContent === "string") {
      const srtPath = path.join(DOWNLOAD_DIR, `${newFileId}.srt`);

      if (options.highlightKeywords && Array.isArray(options.highlightKeywords) && options.highlightKeywords.length > 0) {
        const assContent = srtToAssWithHighlights(options.srtContent, options.highlightKeywords, options.subtitleStyle || "classic", clamp(options.subtitleFontSize, 8, 48, 14));
        const assPath = path.join(DOWNLOAD_DIR, `${newFileId}.ass`);
        fs.writeFileSync(assPath, assContent, "utf-8");
        const escapedAssPath = assPath.replace(/:/g, "\\:").replace(/\\/g, "/");
        videoFilters.push(`ass=${escapedAssPath}`);
      } else {
        fs.writeFileSync(srtPath, options.srtContent, "utf-8");
        const fontSize = clamp(options.subtitleFontSize, 8, 48, 14);
        const escapedSrtPath = srtPath.replace(/:/g, "\\:").replace(/\\/g, "/");

        const subtitleStyle = typeof options.subtitleStyle === "string" ? options.subtitleStyle : "classic";
        const styleMap: Record<string, string> = {
          classic: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,BackColour=&H80000000,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
          outline: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=4,Shadow=0,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
          highlight: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H00000000,OutlineColour=&H0000D7FF,Outline=0,Shadow=0,BackColour=&H0000D7FF,BorderStyle=4,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
          shadow: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=1,Shadow=4,BackColour=&HCC000000,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
          neon: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H00FFFF00,OutlineColour=&H00FF8800,Outline=2,Shadow=0,BackColour=&H00000000,BorderStyle=1,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
          retro: `FontSize=${Math.round(fontSize)},FontName=Arial,Bold=1,PrimaryColour=&H0000D7FF,OutlineColour=&H00000000,Outline=3,Shadow=2,BackColour=&H000060FF,Alignment=2,MarginV=25,MarginL=20,MarginR=20,WrapStyle=2`,
        };
        const forceStyle = styleMap[subtitleStyle] || styleMap.classic;
        videoFilters.push(`subtitles=${escapedSrtPath}:force_style='${forceStyle}'`);
      }
    }

    if (!isAudioOnly && videoFilters.length > 0) {
      videoFilters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");
    }

    const args = ["-y", "-i", source.filepath];

    if (videoFilters.length > 0) {
      args.push("-vf", videoFilters.join(","));
    }
    if (audioFilters.length > 0) {
      args.push("-af", audioFilters.join(","));
    }

    if (options.stripAudio === true && !isAudioOnly) {
      args.push("-an");
    }

    if (!isAudioOnly) {
      args.push("-c:v", "libx264", "-preset", "ultrafast", "-threads", "0", "-movflags", "+faststart");
      const crf = clamp(options.crf, 18, 28, 23);
      args.push("-crf", String(Math.round(crf)));

      if (options.randomBitrate === true) {
        const randCrf = 18 + Math.floor(Math.random() * 8);
        args[args.indexOf("-crf") + 1] = String(randCrf);
        const randBitrate = 800 + Math.floor(Math.random() * 3200);
        args.push("-maxrate", `${randBitrate}k`, "-bufsize", `${randBitrate * 2}k`);
      }
    }
    if (options.stripAudio !== true) {
      args.push("-c:a", "aac", "-b:a", "128k");
    }
    args.push(outputPath);

    await runFfmpeg(args);

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
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${Math.round(fontSize)},${s.primary},&H000000FF,${s.outline},${s.back},1,0,0,0,100,100,0,0,1,${s.outlineW},${s.shadow},2,20,20,25,1
Style: Highlight,Arial,${Math.round(fontSize)},&H0000D7FF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,20,20,25,1

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

router.post("/video/tts", validateApiKey, async (req, res): Promise<void> => {
  const { text, voiceId, lang } = req.body || {};

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty text" });
    return;
  }

  if (!ELEVENLABS_API_KEY) {
    res.status(500).json({ error: "ElevenLabs API key not configured" });
    return;
  }

  const defaultVoiceVi = "pFZP5JQG7iQjIQuC4Bku";
  const defaultVoiceEn = "JBFqnCBsd6RMkjVDRZzb";
  const selectedVoice = voiceId || (lang === "en" ? defaultVoiceEn : defaultVoiceVi);

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
      res.status(ttsRes.status).json({ error: `ElevenLabs error: ${errText}` });
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

router.get("/video/tts/voices", validateApiKey, async (_req, res): Promise<void> => {
  if (!ELEVENLABS_API_KEY) {
    res.status(500).json({ error: "ElevenLabs API key not configured" });
    return;
  }

  try {
    const voicesRes = await fetch(`${ELEVENLABS_BASE}/voices`, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!voicesRes.ok) {
      res.status(voicesRes.status).json({ error: "Failed to fetch voices" });
      return;
    }

    const data = await voicesRes.json() as { voices: Array<{ voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }> };
    const voices = (data.voices || []).map((v: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string }) => ({
      voiceId: v.voice_id,
      name: v.name,
      accent: v.labels?.accent || "",
      gender: v.labels?.gender || "",
      previewUrl: v.preview_url || "",
    }));

    res.json({ voices });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch voices" });
  }
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

async function sonioxCreateTranscription(fileId: string): Promise<string> {
  const resp = await fetch(`${SONIOX_BASE}/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SONIOX_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, model: "stt-async-preview" }),
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
  const segments: Array<{ start: number; end: number; text: string }> = [];
  let currentWords: string[] = [];
  let segStart = 0;
  let segEnd = 0;

  for (const token of tokens) {
    if (currentWords.length === 0) {
      segStart = token.start_ms / 1000;
    }
    currentWords.push(token.text);
    segEnd = token.end_ms / 1000;

    const joined = currentWords.join("");
    const endsWithPunctuation = /[.!?。！？]$/.test(joined.trim());
    const wordCount = joined.trim().split(/\s+/).length;

    if (endsWithPunctuation || wordCount >= 12) {
      segments.push({ start: segStart, end: segEnd, text: joined.trim() });
      currentWords = [];
    }
  }

  if (currentWords.length > 0) {
    segments.push({ start: segStart, end: segEnd, text: currentWords.join("").trim() });
  }

  return segments;
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
    const transcriptionId = await sonioxCreateTranscription(sonioxFileId);
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

export default router;
