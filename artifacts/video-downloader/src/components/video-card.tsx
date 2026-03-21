import { useState } from "react";
import { Download, Loader2, Video, Volume2, HardDrive, Share2, Youtube, Facebook, Instagram, Twitter, Music, PlaySquare, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { formatDuration, formatBytes, cn } from "@/lib/utils";
import type { VideoInfo, VideoFormat } from "@workspace/api-client-react";

interface VideoCardProps {
  info: VideoInfo;
  url: string;
  onDownload: (format: VideoFormat) => Promise<void>;
}

const PlatformIcon = ({ platform, className }: { platform: string, className?: string }) => {
  const normalized = platform.toLowerCase();
  if (normalized.includes('youtube')) return <Youtube className={className} />;
  if (normalized.includes('facebook')) return <Facebook className={className} />;
  if (normalized.includes('instagram')) return <Instagram className={className} />;
  if (normalized.includes('twitter') || normalized.includes('x')) return <Twitter className={className} />;
  if (normalized.includes('tiktok') || normalized.includes('douyin')) return <Music className={className} />;
  return <PlaySquare className={className} />;
};

export function VideoCard({ info, url, onDownload }: VideoCardProps) {
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

  // Sort formats: video with audio first, then best quality
  const sortedFormats = [...info.formats].sort((a, b) => {
    if (a.hasAudio && a.hasVideo && (!b.hasAudio || !b.hasVideo)) return -1;
    if ((!a.hasAudio || !a.hasVideo) && b.hasAudio && b.hasVideo) return 1;
    return 0; // fallback to API ordering
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto glass-panel rounded-3xl overflow-hidden mt-8 flex flex-col md:flex-row"
    >
      {/* Sidebar Info */}
      <div className="w-full md:w-2/5 relative bg-black/40">
        <div className="aspect-video md:aspect-auto md:h-full relative">
          {info.thumbnail ? (
            <img 
              src={info.thumbnail} 
              alt={info.title} 
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-secondary">
              <Video className="w-16 h-16 text-muted-foreground opacity-30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute bottom-0 left-0 w-full p-6 text-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider">
                <PlatformIcon platform={info.platform} className="w-3.5 h-3.5" />
                {info.platform}
              </span>
              {info.duration ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(info.duration)}
                </span>
              ) : null}
            </div>
            
            <h2 className="font-display font-bold text-xl md:text-2xl leading-tight line-clamp-3 shadow-black">
              {info.title}
            </h2>
            
            {info.uploader && (
              <p className="text-sm text-gray-300 mt-2 font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-xs">
                  {info.uploader.charAt(0).toUpperCase()}
                </span>
                {info.uploader}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Formats */}
      <div className="w-full md:w-3/5 p-6 bg-card/40 flex flex-col">
        <h3 className="text-lg font-display font-semibold mb-4 text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          Available Formats
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[400px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {sortedFormats.map((format) => (
            <div 
              key={format.formatId}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/30 border border-white/5 hover:bg-secondary/60 hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white tracking-tight">
                    {format.quality || "Standard"}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white/70 tracking-wider">
                    {format.extension}
                  </span>
                  {format.resolution && (
                    <span className="text-xs text-muted-foreground font-medium">
                      {format.resolution}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 font-medium">
                  <span className={cn("flex items-center gap-1", format.hasVideo ? "text-cyan-400/80" : "opacity-40")}>
                    <Video className="w-3.5 h-3.5" /> Video
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={cn("flex items-center gap-1", format.hasAudio ? "text-violet-400/80" : "opacity-40")}>
                    <Volume2 className="w-3.5 h-3.5" /> Audio
                  </span>
                  {format.filesize && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="text-white/60">{format.filesize ? formatBytes(format.filesize) : "Size Unknown"}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDownloadClick(format)}
                disabled={!!downloadingFormatId}
                className={cn(
                  "relative overflow-hidden px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shrink-0 w-full sm:w-auto",
                  downloadingFormatId === format.formatId 
                    ? "bg-primary text-white shadow-lg shadow-primary/25 cursor-wait"
                    : downloadingFormatId 
                      ? "bg-white/5 text-white/40 cursor-not-allowed" 
                      : "bg-white/10 hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/20 text-white"
                )}
              >
                {downloadingFormatId === format.formatId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
                    Download
                  </>
                )}
              </button>
            </div>
          ))}
          {info.formats.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No downloadable formats found for this video.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
