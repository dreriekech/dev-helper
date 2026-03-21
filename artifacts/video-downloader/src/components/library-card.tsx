import { useState, useRef, useCallback } from "react";
import { Download, Trash2, Film, RefreshCw, FolderOpen, Clock, HardDrive, ExternalLink, Play, X, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes, cn } from "@/lib/utils";
import type { Translations } from "@/lib/i18n";

export interface LibraryItem {
  fileId: string;
  filename: string;
  filesize: number | null;
  title: string;
  platform: string;
  thumbnail: string | null;
  quality: string;
  url: string;
  createdAt: number;
  expiresInMinutes: number;
  streamUrl: string;
  caption?: string;
  hashtags?: string[];
  description?: string;
}

interface LibraryCardProps {
  items: LibraryItem[];
  loading: boolean;
  onRefresh: () => void;
  onSaveToDevice: (item: LibraryItem) => void;
  onRemove: (fileId: string) => void;
  onClearAll: () => void;
  t: Translations;
}

function PreviewPlayer({ streamUrl, unmuteLabel }: { streamUrl: string; unmuteLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [needsUnmute, setNeedsUnmute] = useState(false);

  const handleVideoLoaded = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.play().then(() => {
      setNeedsUnmute(true);
    }).catch(() => {
      setNeedsUnmute(true);
    });
  }, []);

  const handleUnmute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = false;
    setIsMuted(false);
    setNeedsUnmute(false);
    if (vid.paused) {
      vid.play().catch(() => {});
    }
  };

  const handleVolumeChange = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    setIsMuted(vid.muted || vid.volume === 0);
    if (!vid.muted && vid.volume > 0) {
      setNeedsUnmute(false);
    }
  }, []);

  return (
    <div className="bg-black relative group">
      <video
        ref={videoRef}
        src={streamUrl}
        controls
        preload="auto"
        playsInline
        onLoadedData={handleVideoLoaded}
        onVolumeChange={handleVolumeChange}
        className="w-full max-h-[70vh] object-contain"
        controlsList="nodownload"
      />
      {(isMuted || needsUnmute) && (
        <button
          onClick={handleUnmute}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/20 text-white text-[10px] font-bold hover:bg-white/20 transition-all z-10 animate-pulse"
        >
          <VolumeX className="w-3.5 h-3.5 text-amber-400" />
          <span>{unmuteLabel}</span>
        </button>
      )}
    </div>
  );
}

export function LibraryCard({ items, loading, onRefresh, onSaveToDevice, onRemove, onClearAll, t }: LibraryCardProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const handleRemove = async (fileId: string) => {
    setRemovingId(fileId);
    try {
      await onRemove(fileId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t.library}</h3>
            {items.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 text-[10px] font-bold">
                {items.length} {t.libraryCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-md text-white/30 hover:text-cyan-400 hover:bg-white/5 transition-all disabled:opacity-30"
              title={t.refreshLibrary}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </button>
            {items.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[10px] flex items-center gap-1 text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
              >
                <Trash2 className="w-3 h-3" />
                {t.clearLibrary}
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FolderOpen className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/30 font-medium">{t.libraryEmpty}</p>
            <p className="text-[10px] text-white/15 mt-1">{t.libraryEmptyHint}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            <AnimatePresence>
              {items.map((item, i) => (
                <motion.div
                  key={item.fileId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-3 p-3 hover:bg-white/[0.02] transition-colors group"
                >
                  <div
                    className="relative w-20 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center cursor-pointer"
                    onClick={() => setPreviewItem(item)}
                  >
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-5 h-5 text-white/10" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/60 text-[8px] font-bold uppercase text-white/70">
                      {item.platform}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col py-0.5">
                    <h4 className="font-medium text-xs text-white/80 line-clamp-1" title={item.title}>
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold">
                        {item.quality}
                      </span>
                      {item.filesize && (
                        <span className="flex items-center gap-0.5 text-[9px] text-white/30">
                          <HardDrive className="w-2.5 h-2.5" />
                          {formatBytes(item.filesize)}
                        </span>
                      )}
                      <span className={cn(
                        "flex items-center gap-0.5 text-[9px]",
                        item.expiresInMinutes <= 5 ? "text-red-400" : "text-white/25"
                      )}>
                        <Clock className="w-2.5 h-2.5" />
                        {t.expiresIn} {item.expiresInMinutes} {t.minutes}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-1.5 rounded-md text-white/15 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100"
                      title={t.preview}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-md text-white/15 hover:text-white/50 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                      title="Open source"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => onSaveToDevice(item)}
                      className="px-2.5 py-1.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
                      title={t.saveToDevice}
                    >
                      <Download className="w-3 h-3" />
                      {t.saveToDevice}
                    </button>
                    <button
                      onClick={() => handleRemove(item.fileId)}
                      disabled={removingId === item.fileId}
                      className="p-1.5 rounded-md text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                      title={t.removeFromLibrary}
                    >
                      {removingId === item.fileId ? (
                        <span className="w-3.5 h-3.5 border border-white/20 border-t-red-400 rounded-full animate-spin block" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#12121a] rounded-2xl border border-white/10 overflow-hidden max-w-2xl w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="text-xs font-semibold text-white/80 truncate">{previewItem.title}</h3>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold shrink-0">
                    {previewItem.quality}
                  </span>
                </div>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PreviewPlayer streamUrl={previewItem.streamUrl} unmuteLabel={t.unmute} />
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <div className="flex items-center gap-2 text-[10px] text-white/30">
                  <span className="uppercase font-bold">{previewItem.platform}</span>
                  {previewItem.filesize && (
                    <>
                      <span>•</span>
                      <span>{formatBytes(previewItem.filesize)}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { onSaveToDevice(previewItem); setPreviewItem(null); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  {t.saveToDevice}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
