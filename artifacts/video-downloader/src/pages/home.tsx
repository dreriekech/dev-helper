import { useState, useEffect, useCallback, useRef } from "react";
import { Download, Search, Video, AlertCircle, Youtube, Facebook, Instagram, Twitter, Music, PlaySquare, Globe, Zap, Shield, MonitorPlay, Clipboard, X, Key, LogOut, Infinity, FolderOpen, Wand2, ArrowUpCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExtractVideoInfo, useDownloadVideo, setApiKey, type VideoFormat } from "@workspace/api-client-react";
import { VideoCard } from "@/components/video-card";
import { HistoryCard } from "@/components/history-card";
import { LibraryCard, type LibraryItem } from "@/components/library-card";
import { ReupTools } from "@/components/reup-tools";
import { useRecentDownloads } from "@/hooks/use-recent-downloads";
import { useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KEY_STORAGE = "vd_api_key";
const VERSION_STORAGE = "haxmax_version";
const LOCAL_VERSION = "1.3.0";
type Tab = "download" | "library" | "reup";

interface VersionInfo {
  version: string;
  changelog: Record<string, { date: string; changes_vi: string[]; changes_en: string[] }>;
}

function isNewerVersion(server: string, local: string): boolean {
  const s = server.split(".").map(Number);
  const l = local.split(".").map(Number);
  for (let i = 0; i < Math.max(s.length, l.length); i++) {
    const sv = s[i] || 0;
    const lv = l[i] || 0;
    if (sv > lv) return true;
    if (sv < lv) return false;
  }
  return false;
}

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

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
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
  );
}

function KeyScreen({ onAuth, lang, setLang, t }: {
  onAuth: (key: string) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: ReturnType<typeof useLang>["t"];
}) {
  const [keyInput, setKeyInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;

    setValidating(true);
    setError("");

    try {
      const res = await fetch("/api/video/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyInput.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          onAuth(keyInput.trim());
          return;
        }
      }
      setError(t.keyInvalid);
    } catch {
      setError(t.keyInvalid);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/5 bg-[#0e0e16]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Haxmax</span>
          </div>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-[#12121a] rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-600/20 border border-white/10 flex items-center justify-center">
                <Key className="w-6 h-6 text-cyan-400" />
              </div>
            </div>

            <h2 className="text-base font-bold text-center mb-1">{t.keyTitle}</h2>
            <p className="text-xs text-white/40 text-center mb-5">{t.keyDesc}</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); setError(""); }}
                placeholder={t.keyPlaceholder}
                className="w-full bg-[#0a0a10] rounded-lg border border-white/10 focus:border-cyan-500/40 transition-colors px-3 py-2.5 text-sm placeholder:text-white/20 font-mono outline-none"
                autoFocus
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={validating || !keyInput.trim()}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {validating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t.keyValidating}
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    {t.keySubmit}
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function useLibrary(apiKey: string | null) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLibrary = useCallback(async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await fetch("/api/video/library", {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchLibrary();
    const interval = setInterval(fetchLibrary, 60000);
    return () => clearInterval(interval);
  }, [fetchLibrary]);

  const removeItem = useCallback(async (fileId: string) => {
    if (!apiKey) return;
    try {
      await fetch(`/api/video/library/${fileId}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      setItems((prev) => prev.filter((i) => i.fileId !== fileId));
    } catch {}
  }, [apiKey]);

  const clearAll = useCallback(async () => {
    if (!apiKey) return;
    try {
      await fetch("/api/video/library", {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      setItems([]);
    } catch {}
  }, [apiKey]);

  return { items, loading, refresh: fetchLibrary, removeItem, clearAll };
}

export default function Home() {
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>("download");
  const [url, setUrl] = useState("");
  const { downloads, addDownload, clearHistory } = useRecentDownloads();
  const { lang, setLang, t } = useLang();
  const library = useLibrary(apiKeyValue);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try { return localStorage.getItem(VERSION_STORAGE + "_dismissed"); } catch { return null; }
  });

  useEffect(() => {
    if (apiKeyValue) {
      setApiKey(apiKeyValue);
    }
  }, [apiKeyValue]);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch("/api/video/version");
        if (res.ok) {
          const data: VersionInfo = await res.json();
          setVersionInfo(data);
          if (isNewerVersion(data.version, LOCAL_VERSION) && data.version !== dismissedVersion) {
            setShowUpdate(true);
          }
          try { localStorage.setItem(VERSION_STORAGE, LOCAL_VERSION); } catch {}
        }
      } catch {}
    };
    checkVersion();
    const interval = setInterval(checkVersion, 300000);
    return () => clearInterval(interval);
  }, [dismissedVersion]);

  const extractMutation = useExtractVideoInfo();
  const downloadMutation = useDownloadVideo();

  const handleAuth = (key: string) => {
    setApiKeyValue(key);
    setApiKey(key);
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {}
  };

  const handleLogout = () => {
    setApiKeyValue(null);
    setApiKey(null);
    try {
      localStorage.removeItem(KEY_STORAGE);
    } catch {}
  };

  if (!apiKeyValue) {
    return <KeyScreen onAuth={handleAuth} lang={lang} setLang={setLang} t={t} />;
  }

  const handleExtract = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    extractMutation.mutate({ data: { url: url.trim() } });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
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

      addDownload({
        id: res.fileId || crypto.randomUUID(),
        title: extractMutation.data.title,
        platform: extractMutation.data.platform,
        thumbnail: extractMutation.data.thumbnail || null,
        quality: format.quality,
        url: url.trim()
      });

      library.refresh();
    } catch {
      alert(t.downloadFailed);
    }
  };

  const handleSaveToDevice = (item: LibraryItem) => {
    const a = document.createElement("a");
    a.href = item.streamUrl;
    a.download = item.filename || "video-download";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const maskedKey = apiKeyValue.slice(0, 3) + "•".repeat(Math.max(0, apiKeyValue.length - 7)) + apiKeyValue.slice(-4);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-white/5 bg-[#0e0e16]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Haxmax</span>
            <span className="text-[9px] font-mono text-white/20 bg-white/5 px-1.5 py-0.5 rounded">v{LOCAL_VERSION}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={cn("flex items-center gap-1", extractMutation.isPending ? "text-amber-400" : "text-emerald-400")}>
                <span className="relative flex h-1.5 w-1.5">
                  {extractMutation.isPending && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                  <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", extractMutation.isPending ? "bg-amber-400" : "bg-emerald-400")} />
                </span>
                <span className="font-medium">{extractMutation.isPending ? t.statusProcessing : t.statusReady}</span>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs">
              <Key className="w-3 h-3 text-cyan-400" />
              <span className="text-white/40 font-mono text-[10px]">{maskedKey}</span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                <Infinity className="w-2.5 h-2.5" />
                {t.keyUnlimited}
              </div>
              <button onClick={handleLogout} className="ml-1 text-white/20 hover:text-red-400 transition-colors" title={t.keyLogout}>
                <LogOut className="w-3 h-3" />
              </button>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showUpdate && versionInfo && versionInfo.version !== LOCAL_VERSION && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 border-b border-cyan-500/20">
              <div className="max-w-6xl mx-auto px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-cyan-400">{t.updateAvailable}</span>
                    <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">v{LOCAL_VERSION} → v{versionInfo.version}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/50 mb-1 font-semibold">{t.updateChangelog}:</div>
                    <ul className="space-y-0.5">
                      {(lang === "vi" ? versionInfo.changelog[versionInfo.version]?.changes_vi : versionInfo.changelog[versionInfo.version]?.changes_en)?.map((c, i) => (
                        <li key={i} className="text-[10px] text-white/60 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-cyan-400/50 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => window.location.reload()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/20 transition-all"
                    >
                      <ArrowUpCircle className="w-3 h-3" />
                      {t.updateNow}
                    </button>
                    <button
                      onClick={() => {
                        setShowUpdate(false);
                        setDismissedVersion(versionInfo.version);
                        try { localStorage.setItem(VERSION_STORAGE + "_dismissed", versionInfo.version); } catch {}
                      }}
                      className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="border-b border-white/5 bg-[#0c0c14]/60">
        <div className="max-w-6xl mx-auto px-4 flex">
          <button
            onClick={() => setActiveTab("download")}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
              activeTab === "download" ? "text-cyan-400" : "text-white/40 hover:text-white/70"
            )}
          >
            <Download className="w-4 h-4" />
            {t.tabDownload}
            {activeTab === "download" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-violet-600"
              />
            )}
          </button>
          <button
            onClick={() => { setActiveTab("library"); library.refresh(); }}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
              activeTab === "library" ? "text-violet-400" : "text-white/40 hover:text-white/70"
            )}
          >
            <FolderOpen className="w-4 h-4" />
            {t.tabLibrary}
            {library.items.length > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold min-w-[18px] text-center",
                activeTab === "library"
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-white/10 text-white/40"
              )}>
                {library.items.length}
              </span>
            )}
            {activeTab === "library" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-pink-600"
              />
            )}
          </button>
          <button
            onClick={() => { setActiveTab("reup"); library.refresh(); }}
            className={cn(
              "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
              activeTab === "reup" ? "text-pink-400" : "text-white/40 hover:text-white/70"
            )}
          >
            <Wand2 className="w-4 h-4" />
            {t.tabReup}
            {activeTab === "reup" && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-amber-500"
              />
            )}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
          <div style={{ display: activeTab === "download" ? "block" : "none" }}>
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
          </div>
          <div style={{ display: activeTab === "library" ? "block" : "none" }}>
              <div className="max-w-3xl mx-auto">
                <div className="mb-4">
                  <p className="text-xs text-white/40">{t.libraryDesc}</p>
                </div>
                <LibraryCard
                  items={library.items}
                  loading={library.loading}
                  onRefresh={library.refresh}
                  onSaveToDevice={handleSaveToDevice}
                  onRemove={library.removeItem}
                  onClearAll={library.clearAll}
                  t={t}
                />
              </div>
          </div>
          <div style={{ display: activeTab === "reup" ? "block" : "none" }}>
              <ReupTools
                libraryItems={library.items}
                apiKey={apiKeyValue}
                onProcessed={library.refresh}
                t={t}
                lang={lang}
              />
          </div>
      </main>
    </div>
  );
}
