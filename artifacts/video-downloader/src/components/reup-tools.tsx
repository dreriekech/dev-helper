import { useState, useCallback, useRef } from "react";
import { Wand2, FlipHorizontal, FlipVertical, Gauge, ZoomIn, Sun, Contrast, Palette, Square, Music, Sparkles, RotateCcw, CheckCircle, AlertCircle, Film, ChevronDown, Type, Languages, Mic, ArrowRight, Zap, Settings2, ChevronRight, Shuffle, Scissors, Eye, Volume2, VolumeX, Hash, Crop, Copy, Layers, Shield, ScanSearch, Play, Square as StopIcon, AudioLines } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LibraryItem } from "@/components/library-card";
import type { Translations } from "@/lib/i18n";
import { cn, formatBytes } from "@/lib/utils";

type SubtitleStyle = "classic" | "outline" | "highlight" | "shadow" | "neon" | "retro" | "tiktok";

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
  removeWatermark: boolean;
  cropVertical: boolean;
  sharpen: number;
  stripAudio: boolean;
  randomBitrate: boolean;
  crf: number;
  colorGrading: { gamma: number; gammaR: number; gammaG: number; gammaB: number } | null;
  highlightKeywords: string[];
  coverOriginalText: boolean;
  coverTextPosition: "bottom" | "top" | "both";
  coverTextHeight: number;
}

const subtitleStylePresets: { id: SubtitleStyle; label: string; labelEn: string; preview: string; desc: string; descEn: string }[] = [
  { id: "classic", label: "Cơ bản", labelEn: "Classic", preview: "Aa", desc: "Trắng + viền đen", descEn: "White + black outline" },
  { id: "outline", label: "Viền đậm", labelEn: "Bold Outline", preview: "Aa", desc: "Viền dày nổi bật", descEn: "Thick outline" },
  { id: "highlight", label: "Nổi bật", labelEn: "Highlight", preview: "Aa", desc: "Nền vàng chữ đen", descEn: "Yellow bg black text" },
  { id: "shadow", label: "Bóng đổ", labelEn: "Shadow", preview: "Aa", desc: "Đổ bóng mạnh", descEn: "Heavy drop shadow" },
  { id: "neon", label: "Neon", labelEn: "Neon", preview: "Aa", desc: "Phát sáng neon", descEn: "Neon glow" },
  { id: "retro", label: "Retro", labelEn: "Retro", preview: "Aa", desc: "Kiểu hoạt hình", descEn: "Cartoon style" },
  { id: "tiktok", label: "TikTok", labelEn: "TikTok", preview: "Aa", desc: "Chữ chạy karaoke", descEn: "Karaoke word-by-word" },
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
  removeWatermark: false,
  cropVertical: false,
  sharpen: 0,
  stripAudio: false,
  randomBitrate: false,
  crf: 23,
  colorGrading: null,
  highlightKeywords: [],
  coverOriginalText: false,
  coverTextPosition: "bottom",
  coverTextHeight: 15,
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
  base.removeWatermark = true;
  base.randomBitrate = true;
  base.sharpen = rand(0.1, 0.5);
  base.colorGrading = {
    gamma: rand(0.97, 1.04),
    gammaR: rand(0.98, 1.03),
    gammaG: rand(0.98, 1.03),
    gammaB: rand(0.98, 1.03),
  };

  switch (platform) {
    case "tiktok":
      base.mirror = randBool();
      base.speed = rand(0.97, 1.05);
      base.zoom = rand(1.01, 1.04);
      base.audioPitch = rand(0.98, 1.03);
      base.noise = Math.floor(rand(1, 4, 0));
      base.brightness = rand(-0.03, 0.05);
      base.saturation = rand(0.95, 1.1);
      base.cropVertical = true;
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
      base.cropVertical = true;
      break;
    case "instagram":
      base.mirror = randBool();
      base.zoom = rand(1.02, 1.05);
      base.saturation = rand(1.05, 1.15);
      base.audioPitch = rand(0.98, 1.03);
      base.noise = Math.floor(rand(1, 3, 0));
      base.brightness = rand(0.01, 0.06);
      base.contrast = rand(1.02, 1.08);
      base.cropVertical = true;
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

interface AiRewriteResult {
  caption: string;
  hashtags: string[];
  hook: string;
  cta: string;
  originalCaption: string;
  originalHashtags: string[];
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
  const [aiRewriting, setAiRewriting] = useState(false);
  const [aiResult, setAiResult] = useState<AiRewriteResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [detectingScenes, setDetectingScenes] = useState(false);
  const [sceneResult, setSceneResult] = useState<{ sceneCount: number; sceneChanges: number[] } | null>(null);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [ttsGenerating, setTtsGenerating] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [voices, setVoices] = useState<{ voiceId: string; name: string; gender: string; accent?: string; provider: string; lang: string }[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [voiceFromSubtitles, setVoiceFromSubtitles] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [reviewGenerating, setReviewGenerating] = useState(false);
  const [reviewResult, setReviewResult] = useState<{
    script: string;
    suggestedTitle: string;
    suggestedDescription: string;
    suggestedHashtags: string[];
  } | null>(null);
  const [reviewStyle, setReviewStyle] = useState<string>("natural");
  const [reviewPlatform, setReviewPlatform] = useState<string>("TikTok");

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

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setTtsPlaying(false);
  }, []);

  const fetchVoices = useCallback(async () => {
    if (voicesLoaded) return;
    try {
      const res = await fetch("/api/video/tts/voices", {
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
        setVoicesLoaded(true);
      }
    } catch {}
  }, [apiKey, voicesLoaded]);

  const handleTts = async (text: string, label: string) => {
    if (ttsGenerating || !text.trim()) return;

    cleanupAudio();
    setTtsGenerating(label);

    try {
      const body: Record<string, string> = { text, lang };
      if (selectedVoice) {
        body.voiceId = selectedVoice;
        const voiceInfo = voices.find((v) => v.voiceId === selectedVoice);
        if (voiceInfo) body.provider = voiceInfo.provider;
      }

      const res = await fetch("/api/video/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupVoiceError });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      setTtsPlaying(true);

      audio.onended = () => { cleanupAudio(); };
      audio.onerror = () => { cleanupAudio(); };

      await audio.play().catch(() => { cleanupAudio(); });
    } catch {
      cleanupAudio();
      setResult({ success: false, message: t.reupVoiceError });
    } finally {
      setTtsGenerating(null);
    }
  };

  const stopTts = () => { cleanupAudio(); };

  const handleAiRewrite = async () => {
    if (!selectedFileId || aiRewriting) return;
    setAiRewriting(true);
    setAiResult(null);

    try {
      const res = await fetch("/api/video/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ fileId: selectedFileId, platform: platformNames[platform], lang }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResult(data);
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupFailed });
      }
    } catch {
      setResult({ success: false, message: t.reupFailed });
    } finally {
      setAiRewriting(false);
    }
  };

  const handleDetectScenes = async () => {
    if (!selectedFileId || detectingScenes) return;
    setDetectingScenes(true);
    setSceneResult(null);

    try {
      const res = await fetch("/api/video/detect-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ fileId: selectedFileId }),
      });

      if (res.ok) {
        setSceneResult(await res.json());
      }
    } catch {} finally {
      setDetectingScenes(false);
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!selectedFileId || analyzing) return;
    setAnalyzing(true);
    setAnalysisResult("");

    try {
      const res = await fetch("/api/video/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ fileId: selectedFileId, lang }),
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data.analysis || "");
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupFailed });
      }
    } catch {
      setResult({ success: false, message: t.reupFailed });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateReview = async () => {
    if (!selectedFileId || reviewGenerating) return;
    setReviewGenerating(true);
    setReviewResult(null);

    try {
      const res = await fetch("/api/video/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          fileId: selectedFileId,
          analysis: analysisResult || undefined,
          transcript: transcribeResult?.originalText || undefined,
          lang,
          style: reviewStyle,
          platform: reviewPlatform,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReviewResult({
          script: data.script || "",
          suggestedTitle: data.suggestedTitle || "",
          suggestedDescription: data.suggestedDescription || "",
          suggestedHashtags: data.suggestedHashtags || [],
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ success: false, message: data.error || t.reupFailed });
      }
    } catch {
      setResult({ success: false, message: t.reupFailed });
    } finally {
      setReviewGenerating(false);
    }
  };

  const handleSmartReup = async () => {
    if (!selectedFileId || processing) return;
    setProcessing(true);
    setResult(null);

    try {
      const smartOpts = generatedPreview ? { ...generatedPreview } : generateSmartOptions(platform);

      if (autoSubtitle) {
        setTranscribing(true);
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
        setTranscribing(false);
      }

      if (keywordsInput.trim()) {
        smartOpts.highlightKeywords = keywordsInput.split(",").map((k) => k.trim()).filter(Boolean);
      }

      smartOpts.stripAudio = options.stripAudio;

      if (options.coverOriginalText) {
        smartOpts.coverOriginalText = true;
        smartOpts.coverTextPosition = options.coverTextPosition;
        smartOpts.coverTextHeight = options.coverTextHeight;
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

      if (voiceFromSubtitles && smartOpts.srtContent) {
        smartOpts.voiceFromSubtitles = true;
        smartOpts.voiceLang = lang;
        if (selectedVoice) {
          smartOpts.voiceId = selectedVoice;
          const voiceInfo = voices.find((v) => v.voiceId === selectedVoice);
          if (voiceInfo) smartOpts.voiceProvider = voiceInfo.provider;
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
      setTranscribing(false);
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
                      onClick={() => { setSelectedFileId(item.fileId); setShowDropdown(false); setResult(null); setTranscribeResult(null); setAiResult(null); setSceneResult(null); setAnalysisResult(""); setReviewResult(null); generatePreview(platform); }}
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

      {selectedItem && (selectedItem.caption || (selectedItem.hashtags && selectedItem.hashtags.length > 0)) && (
        <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
          <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {t.reupMetadata}
          </h3>
          {selectedItem.caption && (
            <div className="mb-2">
              <span className="text-[9px] text-white/30 uppercase">{t.reupOriginalCaption}</span>
              <p className="text-[11px] text-white/60 mt-0.5 line-clamp-2">{selectedItem.caption}</p>
            </div>
          )}
          {selectedItem.hashtags && selectedItem.hashtags.length > 0 && (
            <div>
              <span className="text-[9px] text-white/30 uppercase">{t.reupOriginalHashtags}</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedItem.hashtags.slice(0, 15).map((tag, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  {t.reupAntiDetection}
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
                {generatedPreview.removeWatermark && formatChange(t.reupRemoveWatermark, "✓")}
                {generatedPreview.cropVertical && formatChange(t.reupSmartCrop, "9:16")}
                {generatedPreview.mirror && formatChange(lang === "vi" ? "Lật" : "Mirror", "↔")}
                {generatedPreview.speed !== 1 && formatChange(lang === "vi" ? "Tốc độ" : "Speed", `${generatedPreview.speed}x`)}
                {generatedPreview.zoom > 1 && formatChange("Zoom", `${generatedPreview.zoom}x`)}
                {generatedPreview.brightness !== 0 && formatChange(lang === "vi" ? "Sáng" : "Bright", `${generatedPreview.brightness > 0 ? "+" : ""}${generatedPreview.brightness}`)}
                {generatedPreview.contrast !== 1 && formatChange(lang === "vi" ? "Tương phản" : "Contrast", `${generatedPreview.contrast}`)}
                {generatedPreview.saturation !== 1 && formatChange(lang === "vi" ? "Bão hòa" : "Sat", `${generatedPreview.saturation}`)}
                {generatedPreview.border > 0 && formatChange(lang === "vi" ? "Viền" : "Border", `${generatedPreview.border}px`)}
                {generatedPreview.noise > 0 && formatChange(lang === "vi" ? "Nhiễu" : "Noise", `${generatedPreview.noise}`)}
                {generatedPreview.audioPitch !== 1 && formatChange("Pitch", `${generatedPreview.audioPitch}x`)}
                {generatedPreview.sharpen > 0 && formatChange(t.reupSharpen, `${generatedPreview.sharpen}`)}
                {generatedPreview.randomBitrate && formatChange("Bitrate", "Random")}
                {generatedPreview.colorGrading && formatChange(t.reupColorGrading, "✓")}
              </div>
              <p className="text-[9px] text-white/20 mt-2">
                {lang === "vi" ? "Mỗi lần reup tạo video khác nhau — watermark gốc tự động bị xóa" : "Each reup creates a unique video — original watermark auto-removed"}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setAutoSubtitle(!autoSubtitle)}>
                  <ToggleSwitch on={autoSubtitle} />
                  <div>
                    <span className="text-[11px] font-semibold text-white/70">{t.reupAutoSub}</span>
                    <p className="text-[8px] text-white/30">{t.reupAutoSubDesc}</p>
                  </div>
                </label>
              </div>
              {autoSubtitle && (
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="mt-2 w-full bg-[#0a0a10] rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/70 outline-none cursor-pointer"
                >
                  <option value="vi">{t.reupSubLangVi}</option>
                  <option value="en">{t.reupSubLangEn}</option>
                  <option value="">{t.reupSubLangNone}</option>
                </select>
              )}
            </div>

            <div className="bg-[#12121a] rounded-xl border border-white/5 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => updateOption("stripAudio", !options.stripAudio)}>
                <ToggleSwitch on={options.stripAudio} />
                <div>
                  <span className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
                    {options.stripAudio ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3 text-white/40" />}
                    {t.reupStripAudio}
                  </span>
                  <p className="text-[8px] text-white/30">{t.reupStripAudioDesc}</p>
                </div>
              </label>
              {options.stripAudio && (
                <div className="flex items-center gap-2 pl-8">
                  <Music className="w-3 h-3 text-green-400" />
                  <span className="text-[9px] text-green-400/70">{lang === "vi" ? "Tự động thêm nhạc nền ambient (không bản quyền)" : "Auto-adds ambient background music (royalty-free)"}</span>
                </div>
              )}
            </div>

            <div className="bg-[#12121a] rounded-xl border border-white/5 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer" onClick={() => updateOption("coverOriginalText", !options.coverOriginalText)}>
                <ToggleSwitch on={options.coverOriginalText} />
                <div>
                  <span className="text-[11px] font-semibold text-white/70 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-orange-400" />
                    {lang === "vi" ? "Che text gốc trên video" : "Cover original text"}
                  </span>
                  <p className="text-[8px] text-white/30">{lang === "vi" ? "Tạo lớp phủ che text có sẵn trên video rồi đè text mới lên" : "Add overlay to cover existing text on video before adding new text"}</p>
                </div>
              </label>
              {options.coverOriginalText && (
                <div className="flex items-center gap-3 pl-8">
                  <div className="space-y-1">
                    <span className="text-[9px] text-white/30">{lang === "vi" ? "Vị trí" : "Position"}</span>
                    <div className="flex gap-1">
                      {(["bottom", "top", "both"] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => updateOption("coverTextPosition", pos)}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-bold transition-all",
                            options.coverTextPosition === pos
                              ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                              : "bg-white/[0.02] text-white/40 border border-white/5 hover:bg-white/5"
                          )}
                        >
                          {pos === "bottom" ? (lang === "vi" ? "Dưới" : "Bottom") : pos === "top" ? (lang === "vi" ? "Trên" : "Top") : (lang === "vi" ? "Cả hai" : "Both")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1 flex-1">
                    <span className="text-[9px] text-white/30">{lang === "vi" ? "Chiều cao phủ" : "Cover height"}: {options.coverTextHeight}%</span>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={1}
                      value={options.coverTextHeight}
                      onChange={(e) => updateOption("coverTextHeight", Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedFileId && (
            <>
            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                {t.reupAiRewrite}
              </h3>
              <p className="text-[9px] text-white/30">{t.reupAiRewriteDesc}</p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiRewrite}
                  disabled={aiRewriting}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {aiRewriting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
                      {t.reupAiRewriting}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      {t.reupAiRewrite}
                    </>
                  )}
                </button>

                <button
                  onClick={handleDetectScenes}
                  disabled={detectingScenes}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {detectingScenes ? (
                    <>
                      <span className="w-3 h-3 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                      {t.reupSceneDetecting}
                    </>
                  ) : (
                    <>
                      <ScanSearch className="w-3 h-3" />
                      {t.reupSceneDetect}
                    </>
                  )}
                </button>
              </div>

              {sceneResult && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Eye className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400 font-bold">{sceneResult.sceneCount} {t.reupScenes}</span>
                  {sceneResult.sceneChanges.length > 0 && (
                    <span className="text-white/30">
                      ({sceneResult.sceneChanges.slice(0, 8).map((t) => `${t}s`).join(", ")}{sceneResult.sceneChanges.length > 8 ? "..." : ""})
                    </span>
                  )}
                </div>
              )}

              <AnimatePresence>
                {aiResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 bg-[#0a0a10] rounded-lg border border-white/10 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-[10px] text-violet-400 font-bold">{t.reupAiRewriteDone}</span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/30 uppercase">Caption</span>
                          <button onClick={() => copyToClipboard(aiResult.caption, "caption")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                            <Copy className="w-2.5 h-2.5" />
                            {copiedField === "caption" ? t.reupCopied : t.reupCopyCaption}
                          </button>
                        </div>
                        <p className="text-[11px] text-white/70 leading-relaxed">{aiResult.caption}</p>
                      </div>

                      {aiResult.hook && (
                        <div>
                          <span className="text-[9px] text-white/30 uppercase">{t.reupHook}</span>
                          <p className="text-[11px] text-amber-400/80 font-medium mt-0.5">{aiResult.hook}</p>
                        </div>
                      )}

                      {aiResult.cta && (
                        <div>
                          <span className="text-[9px] text-white/30 uppercase">{t.reupCta}</span>
                          <p className="text-[11px] text-emerald-400/80 font-medium mt-0.5">{aiResult.cta}</p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/30 uppercase">Hashtags</span>
                          <button onClick={() => copyToClipboard(aiResult.hashtags.join(" "), "hashtags")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                            <Copy className="w-2.5 h-2.5" />
                            {copiedField === "hashtags" ? t.reupCopied : t.reupCopyHashtags}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {aiResult.hashtags.map((tag, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400/80">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {aiResult && (
                <div className="bg-[#0a0a10] rounded-lg border border-cyan-500/10 p-3 space-y-2">
                  <p className="text-[9px] text-white/30">{lang === "vi" ? "Caption gợi ý - sao chép để đăng lên nền tảng:" : "Suggested caption - copy to post on platform:"}</p>
                </div>
              )}

              <div className="bg-[#0a0a10] rounded-lg border border-cyan-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AudioLines className="w-3.5 h-3.5" />
                    {lang === "vi" ? "Giọng đọc AI (từ phụ đề)" : "Voice AI (from subtitles)"}
                  </h4>
                  <div className="flex items-center gap-2">
                    {ttsPlaying && (
                      <button
                        onClick={stopTts}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-all"
                      >
                        <StopIcon className="w-2.5 h-2.5" />
                        {t.reupVoiceStop}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[8px] text-white/30">{lang === "vi" ? "Tạo giọng đọc AI từ nội dung phụ đề và ghép vào video khi Reup" : "Generate AI voice from subtitle content and embed into video during Reup"}</p>
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => { setVoiceFromSubtitles(!voiceFromSubtitles); fetchVoices(); }}>
                  <ToggleSwitch on={voiceFromSubtitles} />
                  <span className="text-[11px] font-semibold text-white/70">{lang === "vi" ? "Ghép giọng đọc vào video" : "Embed voice into video"}</span>
                </label>
                {voiceFromSubtitles && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedVoice}
                        onFocus={fetchVoices}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="flex-1 bg-[#12121a] rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/60 outline-none cursor-pointer"
                      >
                        <option value="">{t.reupVoiceSelect} ({lang === "vi" ? "Mặc định" : "Default"})</option>
                        {voices.filter((v) => v.provider === "vbee").length > 0 && (
                          <optgroup label="Vbee (Tieng Viet)">
                            {voices.filter((v) => v.provider === "vbee").map((v) => (
                              <option key={v.voiceId} value={v.voiceId}>
                                {v.name} ({v.gender}{v.accent ? ` - ${v.accent}` : ""})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {voices.filter((v) => v.provider === "elevenlabs").length > 0 && (
                          <optgroup label="ElevenLabs (English)">
                            {voices.filter((v) => v.provider === "elevenlabs").map((v) => (
                              <option key={v.voiceId} value={v.voiceId}>
                                {v.name} {v.gender ? `(${v.gender})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    {(transcribeResult?.srtContent || options.srtContent) && (
                      <button
                        onClick={() => handleTts(transcribeResult?.srtContent?.replace(/\d+\n[\d:,\s->]+\n/g, " ") || options.srtContent.replace(/\d+\n[\d:,\s->]+\n/g, " "), "preview")}
                        disabled={!!ttsGenerating}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {ttsGenerating === "preview" ? (
                          <span className="w-2.5 h-2.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        ) : (
                          <Play className="w-2.5 h-2.5" />
                        )}
                        {ttsGenerating === "preview" ? (lang === "vi" ? "Dang tao..." : "Generating...") : (lang === "vi" ? "Nghe thu giong doc" : "Preview voice")}
                      </button>
                    )}
                    {!transcribeResult?.srtContent && !options.srtContent && (
                      <p className="text-[8px] text-amber-400/50">{lang === "vi" ? "Can co phu de truoc (bat Auto Subtitle hoac nhap SRT thu cong)" : "Need subtitles first (enable Auto Subtitle or enter SRT manually)"}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <ScanSearch className="w-3.5 h-3.5 text-emerald-400" />
                {t.reupAnalyze}
              </h3>
              <p className="text-[9px] text-white/30">{t.reupAnalyzeDesc}</p>

              <button
                onClick={handleAnalyzeVideo}
                disabled={analyzing}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {analyzing ? (
                  <>
                    <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    {t.reupAnalyzing}
                  </>
                ) : (
                  <>
                    <ScanSearch className="w-3 h-3" />
                    {t.reupAnalyzeBtn}
                  </>
                )}
              </button>

              <AnimatePresence>
                {analysisResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0a0a10] rounded-lg border border-emerald-500/10 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-bold">{t.reupAnalyzeDone}</span>
                      </div>
                      <button onClick={() => copyToClipboard(analysisResult, "analysis")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                        <Copy className="w-2.5 h-2.5" />
                        {copiedField === "analysis" ? t.reupCopied : "Copy"}
                      </button>
                    </div>
                    <div className="text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto scrollbar-thin">{analysisResult}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-[#12121a] rounded-xl border border-white/5 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                {t.reupReviewScript}
              </h3>
              <p className="text-[9px] text-white/30">{t.reupReviewScriptDesc}</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/30 uppercase mb-1 block">{t.reupReviewStyle}</label>
                  <select
                    value={reviewStyle}
                    onChange={(e) => setReviewStyle(e.target.value)}
                    className="w-full bg-[#0a0a10] rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/60 outline-none cursor-pointer"
                  >
                    <option value="natural">{t.reupStyleNatural}</option>
                    <option value="professional">{t.reupStyleProfessional}</option>
                    <option value="funny">{t.reupStyleFunny}</option>
                    <option value="enthusiastic">{t.reupStyleEnthusiastic}</option>
                    <option value="honest">{t.reupStyleHonest}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-white/30 uppercase mb-1 block">{t.reupReviewPlatform}</label>
                  <select
                    value={reviewPlatform}
                    onChange={(e) => setReviewPlatform(e.target.value)}
                    className="w-full bg-[#0a0a10] rounded-lg border border-white/10 px-2 py-1.5 text-[10px] text-white/60 outline-none cursor-pointer"
                  >
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Twitter">Twitter/X</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateReview}
                disabled={reviewGenerating}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 border border-pink-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {reviewGenerating ? (
                  <>
                    <span className="w-3 h-3 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                    {t.reupGeneratingReview}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    {t.reupReviewBtn}
                  </>
                )}
              </button>

              <AnimatePresence>
                {reviewResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0a0a10] rounded-lg border border-pink-500/10 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle className="w-3 h-3 text-pink-400" />
                      <span className="text-[10px] text-pink-400 font-bold">{t.reupReviewDone}</span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-white/30 uppercase">{t.reupReviewResult}</span>
                        <button onClick={() => copyToClipboard(reviewResult.script, "script")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                          <Copy className="w-2.5 h-2.5" />
                          {copiedField === "script" ? t.reupCopied : t.reupCopyScript}
                        </button>
                      </div>
                      <div className="text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">{reviewResult.script}</div>
                    </div>

                    {reviewResult.suggestedTitle && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/30 uppercase">{t.reupSuggestedTitle}</span>
                          <button onClick={() => copyToClipboard(reviewResult.suggestedTitle, "reviewTitle")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                            <Copy className="w-2.5 h-2.5" />
                            {copiedField === "reviewTitle" ? t.reupCopied : t.reupCopyTitle}
                          </button>
                        </div>
                        <p className="text-[11px] text-amber-400/80 font-medium">{reviewResult.suggestedTitle}</p>
                      </div>
                    )}

                    {reviewResult.suggestedDescription && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/30 uppercase">{t.reupSuggestedDesc}</span>
                          <button onClick={() => copyToClipboard(reviewResult.suggestedDescription, "reviewDesc")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                            <Copy className="w-2.5 h-2.5" />
                            {copiedField === "reviewDesc" ? t.reupCopied : t.reupCopyDescription}
                          </button>
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed">{reviewResult.suggestedDescription}</p>
                      </div>
                    )}

                    {reviewResult.suggestedHashtags.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-white/30 uppercase">{t.reupSuggestedTags}</span>
                          <button onClick={() => copyToClipboard(reviewResult.suggestedHashtags.join(" "), "reviewTags")} className="text-[9px] text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5">
                            <Copy className="w-2.5 h-2.5" />
                            {copiedField === "reviewTags" ? t.reupCopied : t.reupCopyHashtags}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {reviewResult.suggestedHashtags.map((tag, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400/80">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
          )}

          <div className="bg-[#12121a] rounded-xl border border-white/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-white/50">{t.reupHighlightKeywords}</span>
            </div>
            <input
              type="text"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder={t.reupHighlightKeywordsPlaceholder}
              className="w-full bg-[#0a0a10] rounded-lg border border-white/10 focus:border-amber-500/40 transition-colors px-3 py-2 text-[11px] placeholder:text-white/20 text-white/70 outline-none"
            />
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
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                              {subtitleStylePresets.map((style) => {
                                const stylePreviewMap: Record<SubtitleStyle, React.CSSProperties> = {
                                  classic: { color: "#fff", textShadow: "1px 1px 2px #000, -1px -1px 2px #000", fontWeight: 700 },
                                  outline: { color: "#fff", WebkitTextStroke: "2px #000", fontWeight: 900 },
                                  highlight: { color: "#000", backgroundColor: "#FFD700", padding: "1px 4px", borderRadius: 2, fontWeight: 800 },
                                  shadow: { color: "#fff", textShadow: "3px 3px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.5)", fontWeight: 700 },
                                  neon: { color: "#00ffff", textShadow: "0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #0088ff", fontWeight: 700 },
                                  retro: { color: "#FFD700", WebkitTextStroke: "1.5px #000", textShadow: "2px 2px 0 #FF6B00", fontWeight: 900 },
                                  tiktok: { color: "#fff", textShadow: "1px 1px 3px rgba(0,0,0,0.9)", fontWeight: 700, letterSpacing: "0.5px" },
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

function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div
      className={cn("rounded-full transition-all relative cursor-pointer shrink-0", on ? "bg-emerald-500" : "bg-white/10")}
      style={{ width: 32, height: 18 }}
    >
      <div
        className={cn("absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all", on ? "left-[16px]" : "left-[2px]")}
      />
    </div>
  );
}
