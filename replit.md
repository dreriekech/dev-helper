# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Video Downloader web application that supports downloading videos from YouTube, TikTok, Instagram, Facebook, Twitter/X, Douyin, and more without watermarks.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Video download engine**: yt-dlp (system dependency)
- **Frontend**: React + Vite + TailwindCSS + Framer Motion
- **System dependencies**: yt-dlp, ffmpeg

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (video download backend)
│   └── video-downloader/   # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Authentication

- API key authentication required for extract/download endpoints
- Valid keys stored in `VALID_API_KEYS` environment variable (comma-separated)
- Frontend sends key via `x-api-key` header (injected by custom-fetch `setApiKey()`)
- Key stored in `localStorage` under `vd_api_key`
- Key screen shown on first visit; user can change key via logout button in header

## Video Download API

### Endpoints
- `POST /api/video/validate-key` — Validate an API key (no auth required)
- `POST /api/video/extract` — Extract video metadata and available formats from a URL (requires API key)
- `POST /api/video/download` — Download a video with specified quality, stores in library (requires API key)
- `GET /api/video/stream/:fileId` — Stream a downloaded video file (uses temporary UUID, no key needed)
- `GET /api/video/library` — List all downloaded files in the library with metadata (requires API key)
- `DELETE /api/video/library/:fileId` — Remove a specific file from the library (requires API key)
- `DELETE /api/video/library` — Clear all files from the library (requires API key)

### Supported Platforms
YouTube, TikTok, Douyin, Instagram, Facebook, Twitter/X, Vimeo, Dailymotion, Bilibili, Pinterest, Reddit, Twitch, Snapchat, LinkedIn, Threads

### Quality Presets
- 4K (2160p), 1440p, 1080p Full HD, 720p HD, 480p SD, 360p
- Audio Only (MP3)

### Library Feature
- Downloaded videos are stored in a server-side library before user saves to device
- Library shows video title, platform, quality, file size, and expiration time
- Each file auto-expires after 30 minutes (server cleanup interval)
- Users can save individual files to device, remove files, or clear entire library
- Library auto-refreshes every 60 seconds on the frontend

### Reup Tools (Smart 1-Click)
- `POST /api/video/reup` — Process a library video with ffmpeg transformations to make it unique for re-uploading (requires API key)
- `POST /api/video/ai-rewrite` — AI-powered caption/hashtag rewriter using GPT-4o-mini (requires API key)
- `POST /api/video/detect-scenes` — Scene detection using ffprobe scene change analysis (requires API key)
- `POST /api/video/tts` — Text-to-speech using Vbee (Vietnamese) or ElevenLabs (English) (requires API key, returns audio/mpeg). Body: `{ text, voiceId?, lang?, provider? }`
- `GET /api/video/tts/voices` — List available voices from Vbee + ElevenLabs (requires API key). Query: `?lang=vi|en|all`
- **Smart Reup mode**: User selects video + target platform → tool auto-generates randomized transforms within safe ranges → each reup creates a unique video
- **5 target platforms**: TikTok, Facebook, YouTube Shorts, Instagram Reels, Twitter/X — each with platform-specific transform algorithms
- **8 anti-detection features**:
  1. **Watermark removal** — ffmpeg delogo filter to remove platform watermarks
  2. **Smart 9:16 crop** — `crop=ih*9/16:ih` for vertical format (Reels/Shorts)
  3. **Sharpen** — `unsharp` filter for visual uniqueness
  4. **Color grading** — gamma/gammaR/gammaG/gammaB randomization via `eq` filter
  5. **Random bitrate + CRF** — randomized CRF (18-25) and maxrate/bufsize to alter encoding fingerprint
  6. **Strip audio** — `-an` flag to remove original audio and avoid audio fingerprint detection
  7. **Metadata capture + AI rewrite** — yt-dlp captures caption/hashtags/description; GPT-4o-mini rewrites caption + generates hashtags + hook + CTA per platform
  8. **Keyword highlight subtitles** — SRT→ASS conversion with yellow keyword highlighting; CRLF-safe parser
  9. **Voice AI (Vbee + ElevenLabs)** — reads AI-rewritten caption/hook/CTA aloud; Vbee for Vietnamese voices (8 voices: Bắc/Nam accents), ElevenLabs as fallback for English; voice dropdown grouped by provider
- **Randomized transforms per platform** (ranges vary): mirror, speed (0.97-1.05x), zoom (1.01-1.05x), brightness, contrast, saturation, border, noise, audio pitch
- **"Reshuffle" button**: regenerate random transforms before processing
- **Auto Subtitle toggle**: when ON, automatically transcribes + translates + burns subtitles during reup
- **Scene detection**: analyzes video for scene changes using ffprobe `select=gt(scene,0.3)`
- **TikTok Karaoke Subtitles**: ASS-based karaoke effect using `\k` tags — words appear one by one from left to right (typewriter effect), white text with shadow, centered vertically (alignment 4), font size = 4% of video width; generated from SRT with even word timing distribution
- **Advanced Settings** (collapsible): manual text overlay, subtitle style presets (7 styles including TikTok karaoke), manual transcription
- All numeric inputs are clamped to safe ranges; color strings are sanitized
- Audio-only files skip video filters; output uses appropriate codec
- Processed video is saved back to library with `[Reup]` prefix in title

### Auto Subtitles (Transcription + Translation)
- `POST /api/video/transcribe` — Extract speech from video audio, transcribe, and optionally translate (requires API key)
- Uses **Soniox API** (`stt-async-preview` model) for speech-to-text with word-level timestamps
- Workflow: extract audio (ffmpeg) → upload to Soniox → create transcription → poll until complete → get tokens with timestamps → group tokens into subtitle segments → translate with GPT if needed → generate SRT
- Token grouping: tokens are grouped into segments by punctuation or max 12 words per segment
- Translation: uses OpenAI gpt-4o-mini to translate each segment while preserving timestamps
- Returns: originalText, detectedLang, translatedText, srtContent, segments with start/end timestamps
- Environment: requires `SONIOX_API_KEY` env var
- Frontend allows generating subtitles and then burning them into the video via the reup process

### Library Preview
- Video preview modal in library — click thumbnail or play button to open full video player
- Modal shows video title, quality badge, platform info, file size
- Smart autoplay with audio: starts muted (browser policy), auto-unmutes if allowed, shows "Unmute" button overlay if not
- Native video controls + save-to-device button within preview modal

### Version Update System
- `GET /api/video/version` — Returns current server version + full changelog (no auth required)
- Frontend checks version on load and every 5 minutes
- If server version > client `LOCAL_VERSION` constant, shows animated update banner below header
- Banner shows changelog in current language (VN/EN), "Update now" (reload) and "Dismiss" buttons
- Dismissed version saved to localStorage to avoid repeat prompts
- Version badge (`v1.3.0`) shown in header next to Haxmax logo
- To release a new version: update `APP_VERSION` + `APP_CHANGELOG` in `video.ts`, update `LOCAL_VERSION` in `home.tsx`

### Subtitle Text Overflow Fix (v1.3.0)
- **Dynamic font scaling for drawtext**: uses ffmpeg expression `if(gt(fontSize,w/25),w/25,fontSize)` to cap font size relative to video width
- **Responsive SRT/ASS font sizing**: uses `ffprobe` to detect video width, scales font/margins proportionally (`widthScale = min(1, videoWidth / 1080)`)
- **Wider margins**: SRT MarginL/R scaled from 80px base; ASS uses 120px in PlayRes 1920 space
- **Cover Original Text overlay**: `drawbox` filter covers existing burned-in text before rendering new subtitles
  - Options: position (top/bottom/both), height (5-30% of video)
  - Applied before subtitle filters in the ffmpeg filter chain
  - Frontend toggle: "Che text gốc trên video" with position buttons + height slider

### AI Video Analysis (Gemini)
- `POST /api/video/analyze` — Analyze video content using Gemini 2.5 Flash (requires API key)
- Body: `{ fileId, lang }` — lang can be "vi" or "en"
- Sends video to Gemini with inline data (base64); compresses to 480p/10fps/60s if >7MB
- Returns: analysis text covering content, scenes, audio, quality, audience, hashtags
- Uses Replit AI Integrations (no separate API key needed): `AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`

### AI Review Script Generation (GPT-4o)
- `POST /api/video/generate-review` — Generate professional review/voiceover script (requires API key)
- Body: `{ fileId, analysis?, transcript?, lang, style, platform }`
- 5 style options: natural, professional, funny, enthusiastic, honest
- 5 platform targets: TikTok, YouTube, Facebook, Instagram, Twitter/X
- Returns: script, suggestedTitle, suggestedDescription, suggestedHashtags
- Uses GPT-4o for script generation + GPT-4o-mini for title/description metadata
- Uses user's own OpenAI API key (Pro plan): `OPENAI_API_KEY` env secret

### Backend Logic
- Uses `yt-dlp` as a subprocess for video extraction and downloading
- Uses `ffmpeg` for video/audio merging, format conversion, and reup processing
- Files stored temporarily in system temp directory, auto-cleaned after 30 minutes
- `activeDownloads` Map stores metadata (title, platform, thumbnail, quality, timestamps)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with video download routes.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/video.ts` — video extract, download, and stream endpoints
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/video-downloader` (`@workspace/video-downloader`)

React + Vite frontend for the video downloader.

- Single-page app with URL input, video info extraction, format selection, and download
- Dark mode theme with gradient accents
- Download history stored in localStorage
- Uses `@workspace/api-client-react` for type-safe API calls

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from OpenAPI spec.
