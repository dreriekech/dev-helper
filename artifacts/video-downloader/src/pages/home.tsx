import { useState } from "react";
import { Download, Search, Video, AlertCircle, Youtube, Facebook, Instagram, Twitter, Music, PlaySquare, Globe, Zap, Shield, MonitorPlay, ChevronDown, Clipboard, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExtractVideoInfo, useDownloadVideo, type VideoFormat } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { HistoryCard } from "@/components/history-card";
import { useRecentDownloads } from "@/hooks/use-recent-downloads";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const platforms = [
  { icon: Youtube, name: "YouTube", color: "text-red-500" },
  { icon: Music, name: "TikTok", color: "text-cyan-400" },
  { icon: Instagram, name: "Instagram", color: "text-pink-500" },
  { icon: Facebook, name: "Facebook", color: "text-blue-500" },
  { icon: Twitter, name: "X/Twitter", color: "text-white" },
  { icon: PlaySquare, name: "Douyin", color: "text-violet-400" },
  { icon: MonitorPlay, name: "Vimeo", color: "text-sky-400" },
  { icon: Video, name: "Bilibili", color: "text-cyan-300" },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const { downloads, addDownload, clearHistory } = useRecentDownloads();
  const { lang, setLang, t } = useLang();

  const extractMutation = useExtractVideoInfo();
  const downloadMutation = useDownloadVideo();

  const handleExtract = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    extractMutation.mutate({ data: { url: url.trim() } });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch {}
  };

  const handleDownload = async (format: VideoFormat) => {
    if (!extractMutation.data) return;

    try {
      const res = await downloadMutation.mutateAsync({
        data: {
          url: url.trim(),
          formatId: format.formatId,
          quality: format.quality
        }
      });

      const a = document.createElement("a");
      a.href = res.streamUrl;
      a.download = res.filename || "video-download";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addDownload({
        id: res.fileId || crypto.randomUUID(),
        title: extractMutation.data.title,
        platform: extractMutation.data.platform,
        thumbnail: extractMutation.data.thumbnail || null,
        quality: format.quality,
        url: url.trim()
      });

    } catch {
      alert(t.downloadFailed);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/5 bg-[#0e0e16]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">VidTool</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">v1.0</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs">
              <div className={cn("flex items-center gap-1", extractMutation.isPending ? "text-amber-400" : "text-emerald-400")}>
                <span className="relative flex h-1.5 w-1.5">
                  {extractMutation.isPending && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                  <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", extractMutation.isPending ? "bg-amber-400" : "bg-emerald-400")} />
                </span>
                <span className="font-medium">{extractMutation.isPending ? t.statusProcessing : t.statusReady}</span>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="flex items-center bg-white/5 rounded-md border border-white/10 overflow-hidden">
              <button
                onClick={() => setLang("vi")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold transition-all",
                  lang === "vi" ? "bg-cyan-500/20 text-cyan-400" : "text-white/40 hover:text-white/70"
                )}
              >
                VN
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button
                onClick={() => setLang("en")}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold transition-all",
                  lang === "en" ? "bg-cyan-500/20 text-cyan-400" : "text-white/40 hover:text-white/70"
                )}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold">{t.toolTitle}</h2>
              </div>
              <p className="text-xs text-white/40 mb-4">{t.pasteHint}</p>

              <form onSubmit={handleExtract} className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-[#0a0a10] rounded-lg border border-white/10 focus-within:border-cyan-500/40 transition-colors px-3">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    className="flex-1 bg-transparent border-none outline-none text-sm py-2.5 placeholder:text-white/20 font-medium"
                    required
                  />
                  {url ? (
                    <button type="button" onClick={() => { setUrl(""); extractMutation.reset(); }} className="text-white/30 hover:text-white/60 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={handlePaste} className="text-white/30 hover:text-cyan-400 transition-colors" title="Paste">
                      <Clipboard className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={extractMutation.isPending || !url.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-all flex items-center gap-2 shrink-0"
                >
                  {extractMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t.extractingBtn}
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      {t.extractBtn}
                    </>
                  )}
                </button>
              </form>
            </div>

            <AnimatePresence>
              {extractMutation.isError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-red-500/5 border border-red-500/20 p-3 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <div>
                      <h4 className="font-semibold text-sm text-red-400">{t.extractionFailed}</h4>
                      <p className="text-xs text-white/50 mt-1">
                        {(extractMutation.error as any)?.response?.data?.error || extractMutation.error.message || t.errorGeneric}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {extractMutation.isSuccess && extractMutation.data && (
                <VideoCard
                  key={extractMutation.data.title}
                  info={extractMutation.data}
                  url={url}
                  onDownload={handleDownload}
                  t={t}
                />
              )}
            </AnimatePresence>

            <HistoryCard downloads={downloads} onClear={clearHistory} t={t} />
          </div>

          <div className="space-y-4 lg:block hidden">
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{t.supportedPlatforms}</h3>
              <div className="space-y-1.5">
                {platforms.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                    <p.icon className={cn("w-4 h-4", p.color)} />
                    <span className="text-sm font-medium text-white/70">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Features</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white/80">{t.watermarkFree}</p>
                    <p className="text-xs text-white/30 mt-0.5">TikTok, Douyin, Instagram</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white/80">{t.fast}</p>
                    <p className="text-xs text-white/30 mt-0.5">4K, 1080p, 720p</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white/80">{t.multiPlatform}</p>
                    <p className="text-xs text-white/30 mt-0.5">10+ {t.platforms.toLowerCase()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
