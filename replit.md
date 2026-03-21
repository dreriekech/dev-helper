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
- `POST /api/video/download` — Download a video with specified quality, returns stream URL (requires API key)
- `GET /api/video/stream/:fileId` — Stream a downloaded video file (uses temporary UUID, no key needed)

### Supported Platforms
YouTube, TikTok, Douyin, Instagram, Facebook, Twitter/X, Vimeo, Dailymotion, Bilibili, Pinterest, Reddit, Twitch, Snapchat, LinkedIn, Threads

### Quality Presets
- 4K (2160p), 1440p, 1080p Full HD, 720p HD, 480p SD, 360p
- Audio Only (MP3)

### Backend Logic
- Uses `yt-dlp` as a subprocess for video extraction and downloading
- Uses `ffmpeg` for video/audio merging and format conversion
- Files stored temporarily in system temp directory, auto-cleaned after 30 minutes
- Files deleted after streaming (with 60s grace period)

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
