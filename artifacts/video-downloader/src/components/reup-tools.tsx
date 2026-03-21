import { useState, useCallback } from "react";
import { Wand2, FlipHorizontal, FlipVertical, Gauge, ZoomIn, Sun, Contrast, Palette, Square, Music, Sparkles, RotateCcw, CheckCircle, AlertCircle, Film, ChevronDown, Type, Languages, Mic, ArrowRight, Zap, Settings2, ChevronRight, Shuffle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LibraryItem } from "@/components/library-card";
import type { Translations } from "@/lib/i18n";
import { cn, formatBytes } from "@/lib/utils";

type SubtitleStyle = "classic" | "outline" | "highlight" | "shadow" | "neon" | "retro";

interface ReupOptions {
  mirror: boolean;
  flipVertical: boolean;
  speed: number;
  zoom: number;
  brightness: number;
  contrast: number;
  saturation: number;
  border: number;
  borderColor: string;
  audioPitch: number;
  noise: number;
  subtitleText: string;
  subtitleFontSize: number;
  subtitleColor: string;
  subtitleBg: boolean;
  subtitlePosition: "top" | "center" | "bottom";
  subtitleStyle: SubtitleStyle;
  srtContent: string;
}

const subtitleStylePresets: { id: SubtitleStyle; label: string; labelEn: string; preview: string; desc: string; descEn: string }[] = [
  { id: "classic", label: "Cơ bản", labelEn: "Classic", preview: "Aa", desc: "Trắng + viền đen", descEn: "White + black outline" },
  { id: "outline", label: "Viền đậm", labelEn: "Bold Outline", preview: "Aa", desc: "Viền dày nổi bật", descEn: "Thick outline" },
  { id: "highlight", label: "Nổi bật", labelEn: "Highlight", preview: "Aa", desc: "Nền vàng chữ đen", descEn: "Yellow bg black text" },
  { id: "shadow", label: "Bóng đổ", labelEn: "Shadow", preview: "Aa", desc: "Đổ bóng mạnh", descEn: "Heavy drop shadow" },
  { id: "neon", label: "Neon", labelEn: "Neon", preview: "Aa", desc: "Phát sáng neon", descEn: "Neon glow" },
  { id: "retro", label: "Retro", labelEn: "Retro", preview: "Aa", desc: "Kiểu hoạt hình", descEn: "Cartoon style" },
];

const defaultOptions: ReupOptions = {
  mirror: false,
  flipVertical: false,
  speed: 1,
  zoom: 1,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  border: 0,
  borderColor: "black",
  audioPitch: 1,
  noise: 0,
  subtitleText: "",
  subtitleFontSize: 14,
  subtitleColor: "white",
  subtitleBg: true,
  subtitlePosition: "bottom",
  subtitleStyle: "classic",
  srtContent: "",
};

type Platform = "tiktok" | "facebook" | "youtube" | "instagram" | "twitter";

const rand = (min: number, max: number, decimals = 2) => {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
};

const randBool = () => Math.random() > 0.5;

const platformColors: Record<Platform, { bg: string; border: string; text: string; icon: string }> = {
  tiktok: { bg: "bg-[#ff0050]/10", border: "border-[#ff0050]/30", text: "text-[#ff0050]", icon: "🎵" },
  facebook: { bg: "bg-[#1877f2]/10", border: "border-[#1877f2]/30", text: "text-[#1877f2]", icon: "📘" },
  youtube: { bg: "bg-[#ff0000]/10", border: "border-[#ff0000]/30", text: "text-[#ff0000]", icon: "▶️" },
  instagram: { bg: "bg-[#e4405f]/10", border: "border-[#e4405f]/30", text: "text-[#e4405f]", icon: "📷" },
  twitter: { bg: "bg-[#1da1f2]/10", border: "border-[#1da1f2]/30", text: "text-[#1da1f2]", icon: "𝕏" },
};

function generateSmartOptions(platform: Platform): ReupOptions {
  const base: ReupOptions = { ...defaultOptions };

  switch (platform) {
    case "tiktok":
      base.mirror = randBool();
      base.speed = rand(0.97, 1.05);
      base.zoom = rand(1.01, 1.04);
      base.audioPitch = rand(0.98, 1.03);
      base.noise = Math.floor(rand(1, 4, 0));
      base.brightness = rand(-0.03, 0.05);
      base.saturation = rand(0.95, 1.1);
      break;
    case "facebook":
      base.mirror = randBool();
      base.brightness = rand(0.02, 0.08);
      base.contrast = rand(1.02, 1.1);
      base.saturation = rand(1.05, 1.2);
      base.border = Math.floor(rand(1, 3, 0));
      base.borderColor = ["black", "#1a1a2e", "#16213e"][Math.floor(Math.random() * 3)];
      base.noise = Math.floor(rand(1, 3, 0));
      base.speed = rand(0.99, 1.02);
      break;
    case "youtube":
      base.speed = rand(0.98, 1.03);
      base.zoom = rand(1.01, 1.03);
      base.brightness = rand(0.01, 0.05);
      base.contrast = rand(1.01, 1.05);
      base.noise = Math.floor(rand(1, 3, 0));
      base.audioPitch = rand(0.99, 1.02);
      base.mirror = randBool();
      break;
    case "instagram":
      base.mirror = randBool();
      base.zoom = rand(1.02, 1.05);
      base.saturation = rand(1.05, 1.15);
      base.audioPitch = rand(0.98, 1.03);
      base.noise = Math.floor(rand(1, 3, 0));
      base.brightness = rand(0.01, 0.06);
      base.contrast = rand(1.02, 1.08);
      break;
    case "twitter":
      base.speed = rand(0.98, 1.03);
      base.brightness = rand(0.01, 0.04);
      base.noise = Math.floor(rand(1, 3, 0));
      base.audioPitch = rand(0.99, 1.02);
      base.contrast = rand(1.01, 1.04);
      break;
  }

  return base;
}

interface ReupToolsProps {
  libraryItems: LibraryItem[];
  apiKey: string;
  onProcessed: () => void;
  t: Translations;
  lang: "vi" | "en";
}

export function ReupTools({ libraryItems, apiKey, onProcessed, t, lang }: ReupToolsProps) {
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [options, setOptions] = useState<ReupOptions>({ ...defaultOptions });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoSubtitle, setAutoSubtitle] = useState(false);
  const [targetLang, setTargetLang] = useState<string>("vi");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<{
    originalText: string;
    detectedLang: string;
    translatedText: string;
    srtContent: string;
  } | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<ReupOptions | null>(null);

  const selectedItem = libraryItems.find((i) => i.fileId === selectedFileId);

  const platformNames: Record<Platform, string> = {
    tiktok: "TikTok",
    facebook: "Facebook",
    youtube: "YouTube Shorts",
    instagram: "Instagram Reels",
    twitter: "Twitter/X",
  };

  const platformDescs: Record<Platform, { vi: string; en: string }> = {
    tiktok: { vi: "Chống hash audio + video fingerprint", en: "Anti audio hash + video fingerprint" },
    facebook: { vi: "Chống nhận diện hình ảnh tương tự", en: "Anti visual similarity detection" },
    youtube: { vi: "Chống Content ID + visual match", en: "Anti Content ID + visual match" },
    instagram: { vi: "Chống trùng lặp nội dung Reels", en: "Anti Reels duplicate detection" },
    twitter: { vi: "Biến đổi nhẹ, giữ chất lượng", en: "Light transforms, preserve quality" },
  };

  const generatePreview = useCallback((p: Platform) => {
    const opts = generateSmartOptions(p);
    setGeneratedPreview(opts);
    return opts;
  }, []);

  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    generatePreview(p);
    setResult(null);
  };

  const handleShuffle = () => {
    generatePreview(platform);
  };

  const updateOption = <K extends keyof ReupOptions>(key: K, value: ReupOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSmartReup = async () => {
    if (!selectedFileId || processing) return;
    setProcessing(true);
    setResult(null);

    try {
      const smartOpts = generatedPreview || generateSmartOptions(platform);

      if (autoSubtitle) {
        const transcribeRes = await fetch("/api/video/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ fileId: selectedFileId, targetLang }),
        });

        if (transcribeRes.ok) {
          const data = await transcribeRes.json();
          smartOpts.srtContent = data.srtContent;
          setTranscribeResult(data);
        }
      }

      if (showAdvanced) {
        Object.assign(smartOpts, {
          subtitleText: options.subtitleText,
          subtitleFontSize: options.subtitleFontSize,
          subtitleColor: options.subtitleColor,
          subtitleBg: options.subtitleBg,
          subtitlePosition: options.subtitlePosition,
          subtitleStyle: options.subtitleStyle,
        });
        if (!autoSubtitle && options.srtContent) {
          smartOpts.srtContent = options.srtContent;
        }
      }

      const res = await fetch("/api/video/reup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ fileId: selectedFileId, options: smartOpts }),
      });

      if (res.ok) {
        setResult({ success: true, message: lang === "vi" ? "Reup thành công! Video đã thêm vào thư viện." : "Reup successful! Video added to library." });
        onProcessed();
        generatePreview(platform);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupFailed });
      }
    } catch {
      setResult({ success: false, message: t.reupFailed });
    } finally {
      setProcessing(false);
    }
  };

  const handleManualTranscribe = async () => {
    if (!selectedFileId || transcribing) return;
    setTranscribing(true);
    setTranscribeResult(null);

    try {
      const res = await fetch("/api/video/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ fileId: selectedFileId, targetLang }),
      });

      if (res.ok) {
        const data = await res.json();
        setTranscribeResult(data);
        setOptions((prev) => ({ ...prev, srtContent: data.srtContent }));
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupFailed });
      }
    } catch {
      setResult({ success: false, message: t.reupFailed });
    } finally {
      setTranscribing(false);
    }
  };

  const formatChange = (label: string, val: string) => (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/50">
      <span className="text-white/30">{label}</span> {val}
    </span>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{t.reupSelectVideo}</h3>

        {libraryItems.length === 0 ? (
          <div className="text-center py-6">
            <Film className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/30">{t.reupNoVideos}</p>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#0a0a10] border border-white/10 hover:border-white/20 transition-colors text-left"
            >
              {selectedItem ? (
                <>
                  <div className="w-12 h-8 rounded overflow-hidden bg-white/5 shrink-0">
                    {selectedItem.thumbnail ? (
                      <img src={selectedItem.thumbnail} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-3 h-3 text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{selectedItem.title}</p>
                    <p className="text-[10px] text-white/30">{selectedItem.platform} • {selectedItem.quality} {selectedItem.filesize ? `• ${formatBytes(selectedItem.filesize)}` : ""}</p>
                  </div>
                </>
              ) : (
                <span className="text-xs text-white/30 flex-1">{t.reupSelectVideo}...</span>
              )}
              <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform shrink-0", showDropdown && "rotate-180")} />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute z-20 top-full mt-1 left-0 right-0 bg-[#15151f] border border-white/10 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  {libraryItems.map((item) => (
                    <button
                      key={item.fileId}
                      onClick={() => { setSelectedFileId(item.fileId); setShowDropdown(false); setResult(null); setTranscribeResult(null); generatePreview(platform); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left",
                        item.fileId === selectedFileId && "bg-cyan-500/10"
                      )}
                    >
                      <div className="w-10 h-7 rounded overflow-hidden bg-white/5 shrink-0">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-3 h-3 text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/70 truncate">{item.title}</p>
                        <p className="text-[10px] text-white/30">{item.quality}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {libraryItems.length > 0 && (
        <>
          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
              {lang === "vi" ? "Nền tảng đích" : "Target Platform"}
            </h3>
            <div className="grid grid-cols-5 gap-1.5">
              {(["tiktok", "facebook", "youtube", "instagram", "twitter"] as Platform[]).map((p) => {
                const c = platformColors[p];
                const active = platform === p;
                return (
                  <button
                    key={p}
                    onClick={() => handlePlatformChange(p)}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all",
                      active
                        ? `${c.bg} ${c.border} ${c.text}`
                        : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5 hover:text-white/60"
                    )}
                  >
                    <span className="text-lg leading-none">{c.icon}</span>
                    <span className="text-[9px] font-bold leading-tight text-center">{platformNames[p]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-white/25 mt-2 text-center">
              {platformDescs[platform][lang]}
            </p>
          </div>

          {generatedPreview && selectedFileId && (
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {lang === "vi" ? "Biến đổi tự động" : "Auto Transforms"}
                </h3>
                <button
                  onClick={handleShuffle}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/50 hover:text-white/70 transition-all"
                >
                  <Shuffle className="w-3 h-3" />
                  {lang === "vi" ? "Ngẫu nhiên lại" : "Reshuffle"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {generatedPreview.mirror && formatChange(lang === "vi" ? "Lật" : "Mirror", "↔")}
                {generatedPreview.speed !== 1 && formatChange(lang === "vi" ? "Tốc độ" : "Speed", `${generatedPreview.speed}x`)}
                {generatedPreview.zoom > 1 && formatChange(lang === "vi" ? "Zoom" : "Zoom", `${generatedPreview.zoom}x`)}
                {generatedPreview.brightness !== 0 && formatChange(lang === "vi" ? "Sáng" : "Bright", `${generatedPreview.brightness > 0 ? "+" : ""}${generatedPreview.brightness}`)}
                {generatedPreview.contrast !== 1 && formatChange(lang === "vi" ? "Tương phản" : "Contrast", `${generatedPreview.contrast}`)}
                {generatedPreview.saturation !== 1 && formatChange(lang === "vi" ? "Bão hòa" : "Sat", `${generatedPreview.saturation}`)}
                {generatedPreview.border > 0 && formatChange(lang === "vi" ? "Viền" : "Border", `${generatedPreview.border}px`)}
                {generatedPreview.noise > 0 && formatChange(lang === "vi" ? "Nhiễu" : "Noise", `${generatedPreview.noise}`)}
                {generatedPreview.audioPitch !== 1 && formatChange(lang === "vi" ? "Pitch" : "Pitch", `${generatedPreview.audioPitch}x`)}
              </div>
              <p className="text-[9px] text-white/20 mt-2">
                {lang === "vi" ? "Mỗi lần reup tạo ra video khác nhau — không bao giờ trùng hash" : "Each reup creates a unique video — never the same hash"}
              </p>
            </div>
          )}

          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setAutoSubtitle(!autoSubtitle)}
                  className={cn(
                    "w-8 h-4.5 rounded-full transition-all relative cursor-pointer",
                    autoSubtitle ? "bg-emerald-500" : "bg-white/10"
                  )}
                  style={{ width: 32, height: 18 }}
                >
                  <div
                    className={cn(
                      "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all",
                      autoSubtitle ? "left-[16px]" : "left-[2px]"
                    )}
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white/70">{t.reupAutoSub}</span>
                  <p className="text-[9px] text-white/30">{t.reupAutoSubDesc}</p>
                </div>
              </label>
              {autoSubtitle && (
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-[#0a0a10] rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/70 font-medium outline-none cursor-pointer"
                >
                  <option value="vi">{t.reupSubLangVi}</option>
                  <option value="en">{t.reupSubLangEn}</option>
                  <option value="">{t.reupSubLangNone}</option>
                </select>
              )}
            </div>
          </div>

          <div className="bg-[#12121a] rounded-xl border border-white/5 overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-white/30" />
                <span className="text-xs font-semibold text-white/40">
                  {lang === "vi" ? "Tùy chỉnh nâng cao" : "Advanced Settings"}
                </span>
              </div>
              <ChevronRight className={cn("w-4 h-4 text-white/20 transition-transform", showAdvanced && "rotate-90")} />
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                    <div className="space-y-3">
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{t.reupTextOverlay}</p>
                      <textarea
                        value={options.subtitleText}
                        onChange={(e) => updateOption("subtitleText", e.target.value)}
                        placeholder={t.reupTextPlaceholder}
                        className="w-full bg-[#0a0a10] rounded-lg border border-white/10 focus:border-amber-500/40 transition-colors px-3 py-2 text-xs placeholder:text-white/20 font-medium outline-none resize-none h-16"
                      />

                      {(options.subtitleText.trim() || options.srtContent.trim()) && (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-white/30 uppercase tracking-wider">{lang === "vi" ? "Kiểu chữ" : "Text Style"}</span>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                              {subtitleStylePresets.map((style) => {
                                const stylePreviewMap: Record<SubtitleStyle, React.CSSProperties> = {
                                  classic: { color: "#fff", textShadow: "1px 1px 2px #000, -1px -1px 2px #000", fontWeight: 700 },
                                  outline: { color: "#fff", WebkitTextStroke: "2px #000", fontWeight: 900 },
                                  highlight: { color: "#000", backgroundColor: "#FFD700", padding: "1px 4px", borderRadius: 2, fontWeight: 800 },
                                  shadow: { color: "#fff", textShadow: "3px 3px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)", fontWeight: 700 },
                                  neon: { color: "#00ffff", textShadow: "0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #0088ff", fontWeight: 700 },
                                  retro: { color: "#FFD700", WebkitTextStroke: "1.5px #000", textShadow: "2px 2px 0 #FF6B00", fontWeight: 900 },
                                };
                                return (
                                  <button
                                    key={style.id}
                                    onClick={() => updateOption("subtitleStyle", style.id)}
                                    className={cn(
                                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                                      options.subtitleStyle === style.id
                                        ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20"
                                        : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                                    )}
                                  >
                                    <span className="text-base leading-none" style={stylePreviewMap[style.id]}>{style.preview}</span>
                                    <span className="text-[9px] font-bold text-white/60">{lang === "vi" ? style.label : style.labelEn}</span>
                                    <span className="text-[8px] text-white/25">{lang === "vi" ? style.desc : style.descEn}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <span className="text-[10px] text-white/30">{t.reupTextPosition}</span>
                              <div className="flex gap-1">
                                {(["top", "center", "bottom"] as const).map((pos) => (
                                  <button
                                    key={pos}
                                    onClick={() => updateOption("subtitlePosition", pos)}
                                    className={cn(
                                      "px-2 py-1 rounded text-[10px] font-bold transition-all",
                                      options.subtitlePosition === pos
                                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                        : "bg-white/[0.02] text-white/40 border border-white/5 hover:bg-white/5"
                                    )}
                                  >
                                    {pos === "top" ? t.reupTextPositionTop : pos === "center" ? t.reupTextPositionCenter : t.reupTextPositionBottom}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-white/30">{t.reupTextSize}</span>
                              <input
                                type="range"
                                min={8}
                                max={48}
                                step={1}
                                value={options.subtitleFontSize}
                                onChange={(e) => updateOption("subtitleFontSize", Number(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-400"
                              />
                              <span className="text-[10px] text-white/30 font-mono">{options.subtitleFontSize}px</span>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-white/30">{t.reupTextColor}</span>
                              <div className="flex gap-1">
                                {["white", "yellow", "#00ff88", "#ff6b6b", "#4ecdc4"].map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => updateOption("subtitleColor", c)}
                                    className={cn(
                                      "w-5 h-5 rounded border-2 transition-all",
                                      options.subtitleColor === c ? "border-amber-400 scale-110" : "border-white/10"
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] text-white/30">{t.reupTextBg}</span>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={options.subtitleBg}
                                  onChange={(e) => updateOption("subtitleBg", e.target.checked)}
                                  className="rounded border-white/20 bg-transparent accent-amber-500"
                                />
                                <span className="text-[10px] text-white/50">ON</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Languages className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{lang === "vi" ? "Tạo phụ đề thủ công" : "Manual Subtitle"}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-[#0a0a10] rounded-lg border border-white/10 px-3 py-2">
                          <Mic className="w-3.5 h-3.5 text-white/30" />
                          <span className="text-[10px] text-white/40">{t.reupSubLangSource}:</span>
                          <span className="text-[10px] text-white/60 font-medium">{t.reupSubLangAuto}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-white/20" />
                        <select
                          value={targetLang}
                          onChange={(e) => setTargetLang(e.target.value)}
                          className="bg-[#0a0a10] rounded-lg border border-white/10 px-3 py-2 text-[10px] text-white/70 font-medium outline-none cursor-pointer"
                        >
                          <option value="vi">{t.reupSubLangVi}</option>
                          <option value="en">{t.reupSubLangEn}</option>
                          <option value="">{t.reupSubLangNone}</option>
                        </select>
                      </div>
                      <button
                        onClick={handleManualTranscribe}
                        disabled={!selectedFileId || transcribing}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        {transcribing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                            {t.reupTranscribing}
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            {t.reupTranscribeBtn}
                          </>
                        )}
                      </button>

                      <AnimatePresence>
                        {transcribeResult && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-[10px] text-emerald-400 font-bold">{t.reupTranscribeDone}</span>
                              <span className="text-[10px] text-white/30">
                                ({t.reupSubLangSource}: {transcribeResult.detectedLang})
                              </span>
                            </div>
                            <div className="bg-[#0a0a10] rounded-lg border border-white/10 p-3 max-h-32 overflow-y-auto">
                              <p className="text-[10px] text-white/50 leading-relaxed whitespace-pre-wrap">
                                {transcribeResult.translatedText || transcribeResult.originalText}
                              </p>
                            </div>
                            <p className="text-[9px] text-white/20">
                              SRT ({transcribeResult.srtContent.split("\n\n").filter(Boolean).length} segments)
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium",
                  result.success
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/5 border-red-500/20 text-red-400"
                )}
              >
                {result.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {result.message}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSmartReup}
            disabled={!selectedFileId || processing}
            className="w-full px-5 py-3.5 bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-400 hover:to-pink-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
          >
            {processing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {transcribing ? t.reupTranscribing : t.reupProcessing}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {lang === "vi" ? `Reup cho ${platformNames[platform]}` : `Reup for ${platformNames[platform]}`}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function SliderControl({ icon, label, value, min, max, step, defaultValue, format, onChange }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const isChanged = Math.abs(value - defaultValue) > step / 2;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium text-white/60">{label}</span>
        <span className={cn("text-[10px] ml-auto font-mono", isChanged ? "text-cyan-400" : "text-white/30")}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400"
      />
    </div>
  );
}
