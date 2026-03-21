import { formatDistanceToNow } from "date-fns";
import { Download, ExternalLink, Film, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { RecentDownload } from "@/hooks/use-recent-downloads";

interface HistoryCardProps {
  downloads: RecentDownload[];
  onClear: () => void;
}

export function HistoryCard({ downloads, onClear }: HistoryCardProps) {
  if (downloads.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-12 w-full max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-display font-semibold text-white">Recent Downloads</h3>
        <button
          onClick={onClear}
          className="text-sm flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" />
          Clear History
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {downloads.map((item, i) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={item.id + item.timestamp}
            className="flex gap-4 p-4 rounded-2xl bg-secondary/50 border border-white/5 hover:bg-secondary transition-colors group"
          >
            <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-background shrink-0 flex items-center justify-center">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <Film className="w-8 h-8 text-muted-foreground opacity-50" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <a href={item.url} target="_blank" rel="noreferrer" className="p-2 bg-black/60 rounded-full text-white hover:scale-110 transition-transform">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            
            <div className="flex flex-col flex-1 min-w-0 py-1">
              <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-snug mb-1" title={item.title}>
                {item.title}
              </h4>
              <div className="flex items-center gap-2 mt-auto">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-medium text-white capitalize">
                  {item.platform}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary text-[10px] font-medium">
                  {item.quality}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatDistanceToNow(item.timestamp, { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
