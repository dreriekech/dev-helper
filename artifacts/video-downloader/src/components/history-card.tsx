import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { ExternalLink, Film, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { RecentDownload } from "@/hooks/use-recent-downloads";
import type { Translations } from "@/lib/i18n";

interface HistoryCardProps {
  downloads: RecentDownload[];
  onClear: () => void;
  t: Translations;
}

export function HistoryCard({ downloads, onClear, t }: HistoryCardProps) {
  if (downloads.length === 0) return null;

  const isVi = t.toolTitle === "Video Downloader Tool" && t.extractBtn === "Phân tích";

  return (
    <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t.recentDownloads}</h3>
        <button
          onClick={onClear}
          className="text-[10px] flex items-center gap-1.5 text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
        >
          <Trash2 className="w-3 h-3" />
          {t.clearHistory}
        </button>
      </div>

      <div className="space-y-1.5">
        {downloads.map((item, i) => (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            key={item.id + item.timestamp}
            className="flex gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
          >
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <Film className="w-5 h-5 text-white/10" />
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <a href={item.url} target="_blank" rel="noreferrer" className="p-1 bg-black/60 rounded text-white hover:scale-110 transition-transform">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex flex-col flex-1 min-w-0 py-0.5">
              <h4 className="font-medium text-xs text-white/80 line-clamp-1" title={item.title}>
                {item.title}
              </h4>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold text-white/40 uppercase">
                  {item.platform}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[9px] font-bold">
                  {item.quality}
                </span>
              </div>
              <p className="text-[10px] text-white/20 mt-auto">
                {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: isVi ? vi : enUS })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
