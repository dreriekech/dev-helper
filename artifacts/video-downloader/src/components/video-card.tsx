import { useState } from "react";
import { Download, Loader2, Video, Volume2, HardDrive, Clock, Youtube, Facebook, Instagram, Twitter, Music, PlaySquare } from "lucide-react";
import { motion } from "framer-motion";
import { formatDuration, formatBytes, cn } from "@/lib/utils";
import type { VideoInfo, VideoFormat } from "@workspace/api-client-react";
import type { Translations } from "@/lib/i18n";

interface VideoCardProps {
  info: VideoInfo;
  url: string;
  onDownload: (format: VideoFormat) => Promise<void>;
  t: Translations;
}

const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
  const normalized = platform.toLowerCase();
  if (normalized.includes("youtube")) return <Youtube className={className} />;
  if (normalized.includes("facebook")) return <Facebook className={className} />;
  if (normalized.includes("instagram")) return <Instagram className={className} />;
  if (normalized.includes("twitter") || normalized.includes("x")) return <Twitter className={className} />;
  if (normalized.includes("tiktok") || normalized.includes("douyin")) return <Music className={className} />;
  return <PlaySquare className={className} />;
};

export function VideoCard({ info, url, onDownload, t }: VideoCardProps) {
  const [downloadingFormatId, setDownloadingFormatId] = useState<string | null>(null);

  const handleDownloadClick = async (format: VideoFormat) => {
    if (downloadingFormatId) return;
    setDownloadingFormatId(format.formatId);
    try {
      await onDownload(format);
    } finally {
      setDownloadingFormatId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-64 shrink-0 relative bg-black/40">
          <div className="aspect-video sm:aspect-auto sm:h-full relative">
            {info.thumbnail ? (
              <img src={info.thumbnail} alt={info.title} className="w-full h-full object-cover opacity-90" />
            ) : (
              <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-white/5">
                <Video className="w-10 h-10 text-white/10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 backdrop-blur text-[10px] font-bold uppercase">
                <PlatformIcon platform={info.platform} className="w-3 h-3" />
                {info.platform}
              </span>
              {info.duration && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 backdrop-blur text-[10px] font-bold">
                  <Clock className="w-3 h-3" />
                  {formatDuration(info.duration)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4">
          <h2 className="font-bold text-sm leading-snug line-clamp-2 mb-1">{info.title}</h2>
          {info.uploader && (
            <p className="text-xs text-white/40 mb-3">{info.uploader}</p>
          )}

          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-white/60">{t.availableFormats}</span>
          </div>

          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {info.formats.map((format) => (
              <div
                key={format.formatId}
                className="group flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-white/90 whitespace-nowrap">
                    {format.quality}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-white/5 text-white/40">
                    {format.extension}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={cn("flex items-center gap-0.5", format.hasVideo ? "text-cyan-400/70" : "text-white/15")}>
                      <Video className="w-3 h-3" /> {t.videoLabel}
                    </span>
                    <span className={cn("flex items-center gap-0.5", format.hasAudio ? "text-violet-400/70" : "text-white/15")}>
                      <Volume2 className="w-3 h-3" /> {t.audioLabel}
                    </span>
                  </div>
                  {format.filesize && (
                    <span className="text-[10px] text-white/30">{formatBytes(format.filesize)}</span>
                  )}
                </div>

                <button
                  onClick={() => handleDownloadClick(format)}
                  disabled={!!downloadingFormatId}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shrink-0",
                    downloadingFormatId === format.formatId
                      ? "bg-cyan-500 text-white cursor-wait"
                      : downloadingFormatId
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-400 text-white/60"
                  )}
                >
                  {downloadingFormatId === format.formatId ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t.preparing}
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      {t.download}
                    </>
                  )}
                </button>
              </div>
            ))}
            {info.formats.length === 0 && (
              <div className="text-center py-6 text-xs text-white/30">
                {t.noFormats}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
