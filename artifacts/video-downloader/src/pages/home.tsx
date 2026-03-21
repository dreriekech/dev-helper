import { useState } from "react";
import { Link, Search, ArrowRight, Video, AlertCircle, Youtube, Facebook, Instagram, Twitter, Music, PlaySquare, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExtractVideoInfo, useDownloadVideo, type VideoFormat } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { HistoryCard } from "@/components/history-card";
import { useRecentDownloads } from "@/hooks/use-recent-downloads";
import { cn } from "@/lib/utils";

export default function Home() {
  const [url, setUrl] = useState("");
  const { downloads, addDownload, clearHistory } = useRecentDownloads();
  
  const extractMutation = useExtractVideoInfo();
  const downloadMutation = useDownloadVideo();

  const handleExtract = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    extractMutation.mutate({ data: { url: url.trim() } });
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
      
      // Trigger actual download via streamUrl
      const a = document.createElement("a");
      a.href = res.streamUrl;
      a.download = res.filename || "video-download";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Save to history
      addDownload({
        id: res.fileId || crypto.randomUUID(),
        title: extractMutation.data.title,
        platform: extractMutation.data.platform,
        thumbnail: extractMutation.data.thumbnail || null,
        quality: format.quality,
        url: url.trim()
      });
      
    } catch (error) {
      console.error("Download failed:", error);
      // In a real app we'd use a toast here
      alert("Failed to start download. Please try again.");
    }
  };

  return (
    <div className="min-h-screen relative pb-24">
      {/* Background Image & Overlay */}
      <div className="fixed inset-0 z-[-2]">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Abstract tech background" 
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-primary/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      </div>

      <main className="container mx-auto px-4 pt-16 md:pt-24 flex flex-col items-center relative z-10">
        
        {/* Header / Hero */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl w-full mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-white/10 mb-6 text-sm font-medium text-white/80">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Supports 10+ Platforms Watermark-Free
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight text-white mb-6">
            Download Any Video <br className="hidden md:block" />
            <span className="text-gradient">Without Limits</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            Paste a link from YouTube, TikTok, Instagram, Twitter, or Facebook. 
            Get high-quality, watermark-free downloads instantly.
          </p>
        </motion.div>

        {/* Search Input */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-3xl mx-auto"
        >
          <form 
            onSubmit={handleExtract}
            className="relative animated-gradient-border rounded-2xl md:rounded-full bg-card shadow-2xl"
          >
            <div className="flex flex-col md:flex-row items-center p-2 rounded-2xl md:rounded-full bg-card overflow-hidden">
              <div className="flex items-center flex-1 px-4 py-3 md:py-0 w-full text-white">
                <Search className="w-6 h-6 text-muted-foreground shrink-0 mr-3" />
                <input 
                  type="url" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste video URL here..." 
                  className="w-full bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground/60 font-medium"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={extractMutation.isPending || !url.trim()}
                className="w-full md:w-auto mt-2 md:mt-0 px-8 py-4 bg-white text-black hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl md:rounded-full font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 shrink-0 group shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
              >
                {extractMutation.isPending ? (
                  <>
                    <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Extracting
                  </>
                ) : (
                  <>
                    Extract
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Supported Platforms quick list */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 opacity-60">
            {[
              { icon: Youtube, name: "YouTube" },
              { icon: Music, name: "TikTok" },
              { icon: Instagram, name: "Instagram" },
              { icon: Facebook, name: "Facebook" },
              { icon: Twitter, name: "X/Twitter" },
              { icon: PlaySquare, name: "Douyin" },
            ].map((Platform, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm font-medium hover:opacity-100 transition-opacity cursor-default">
                <Platform.icon className="w-4 h-4" />
                {Platform.name}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Error State */}
        <AnimatePresence>
          {extractMutation.isError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-3xl mt-6 overflow-hidden"
            >
              <div className="bg-destructive/10 border border-destructive/30 text-destructive-foreground p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-destructive" />
                <div>
                  <h4 className="font-semibold text-destructive">Extraction Failed</h4>
                  <p className="text-sm opacity-80 mt-1">
                    {(extractMutation.error as any)?.response?.data?.error || extractMutation.error.message || "Could not process this URL. Please check if the link is correct and accessible."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Area */}
        <AnimatePresence mode="wait">
          {extractMutation.isSuccess && extractMutation.data && (
            <VideoCard 
              key={extractMutation.data.title}
              info={extractMutation.data} 
              url={url} 
              onDownload={handleDownload} 
            />
          )}
        </AnimatePresence>

        {/* History Area */}
        <HistoryCard downloads={downloads} onClear={clearHistory} />
        
      </main>
    </div>
  );
}
