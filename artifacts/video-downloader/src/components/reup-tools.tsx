import { useState } from "react";
import { Wand2, FlipHorizontal, FlipVertical, Gauge, ZoomIn, Sun, Contrast, Palette, Square, Music, Sparkles, RotateCcw, CheckCircle, AlertCircle, Film, ChevronDown, Type, Languages, Mic, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LibraryItem } from "@/components/library-card";
import type { Translations } from "@/lib/i18n";
import { cn, formatBytes } from "@/lib/utils";

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
  srtContent: string;
}

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
  srtContent: "",
};

const tiktokPreset: Partial<ReupOptions> = {
  mirror: true,
  speed: 1.05,
  zoom: 1.03,
  audioPitch: 1.02,
};

const facebookPreset: Partial<ReupOptions> = {
  mirror: true,
  brightness: 0.05,
  saturation: 1.15,
  border: 2,
  borderColor: "black",
};

type Preset = "tiktok" | "facebook" | "custom";

interface ReupToolsProps {
  libraryItems: LibraryItem[];
  apiKey: string;
  onProcessed: () => void;
  t: Translations;
}

export function ReupTools({ libraryItems, apiKey, onProcessed, t }: ReupToolsProps) {
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [options, setOptions] = useState<ReupOptions>({ ...defaultOptions, ...tiktokPreset });
  const [preset, setPreset] = useState<Preset>("tiktok");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [targetLang, setTargetLang] = useState<string>("vi");
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<{
    originalText: string;
    detectedLang: string;
    translatedText: string;
    srtContent: string;
  } | null>(null);

  const selectedItem = libraryItems.find((i) => i.fileId === selectedFileId);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "tiktok") {
      setOptions((prev) => ({ ...prev, ...defaultOptions, ...tiktokPreset, subtitleText: prev.subtitleText, srtContent: prev.srtContent }));
    } else if (p === "facebook") {
      setOptions((prev) => ({ ...prev, ...defaultOptions, ...facebookPreset, subtitleText: prev.subtitleText, srtContent: prev.srtContent }));
    } else {
      setOptions((prev) => ({ ...defaultOptions, subtitleText: prev.subtitleText, srtContent: prev.srtContent }));
    }
  };

  const updateOption = <K extends keyof ReupOptions>(key: K, value: ReupOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    if (!["subtitleText", "subtitleFontSize", "subtitleColor", "subtitleBg", "subtitlePosition", "srtContent"].includes(key)) {
      setPreset("custom");
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFileId || transcribing) return;
    setTranscribing(true);
    setTranscribeResult(null);

    try {
      const res = await fetch("/api/video/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
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

  const handleProcess = async () => {
    if (!selectedFileId || processing) return;
    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/video/reup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ fileId: selectedFileId, options }),
      });

      if (res.ok) {
        setResult({ success: true, message: t.reupSuccess });
        onProcessed();
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

  const hasChanges = options.mirror || options.flipVertical || options.speed !== 1 || options.zoom !== 1 ||
    options.brightness !== 0 || options.contrast !== 1 || options.saturation !== 1 || options.border > 0 ||
    options.audioPitch !== 1 || options.noise > 0 || options.subtitleText.trim() !== "" || options.srtContent.trim() !== "";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="mb-2">
        <p className="text-xs text-white/40">{t.reupDesc}</p>
      </div>

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
                      onClick={() => { setSelectedFileId(item.fileId); setShowDropdown(false); setResult(null); setTranscribeResult(null); }}
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
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">{t.reupPresetTitle}</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => applyPreset("tiktok")}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border transition-all",
                  preset === "tiktok"
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                    : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/5 hover:text-white/70"
                )}
              >
                <Music className="w-4 h-4" />
                <span className="text-[11px] font-bold">{t.reupPresetTiktok}</span>
              </button>
              <button
                onClick={() => applyPreset("facebook")}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border transition-all",
                  preset === "facebook"
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                    : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/5 hover:text-white/70"
                )}
              >
                <Square className="w-4 h-4" />
                <span className="text-[11px] font-bold">{t.reupPresetFacebook}</span>
              </button>
              <button
                onClick={() => applyPreset("custom")}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border transition-all",
                  preset === "custom"
                    ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                    : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/5 hover:text-white/70"
                )}
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-[11px] font-bold">{t.reupPresetCustom}</span>
              </button>
            </div>
            <p className="text-[10px] text-white/25 mt-2 text-center">
              {preset === "tiktok" ? t.reupTiktokHint : preset === "facebook" ? t.reupFacebookHint : ""}
            </p>
          </div>

          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t.reupTransformations}</h3>
              <button
                onClick={() => { setOptions({ ...defaultOptions }); setPreset("custom"); setTranscribeResult(null); }}
                className="text-[10px] flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {t.reupReset}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.mirror}
                    onChange={(e) => updateOption("mirror", e.target.checked)}
                    className="rounded border-white/20 bg-transparent accent-cyan-500"
                  />
                  <FlipHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-medium text-white/70">{t.reupMirror}</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={options.flipVertical}
                    onChange={(e) => updateOption("flipVertical", e.target.checked)}
                    className="rounded border-white/20 bg-transparent accent-cyan-500"
                  />
                  <FlipVertical className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-medium text-white/70">{t.reupFlipV}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SliderControl
                  icon={<Gauge className="w-3.5 h-3.5 text-amber-400" />}
                  label={t.reupSpeed}
                  value={options.speed}
                  min={0.8}
                  max={1.2}
                  step={0.01}
                  defaultValue={1}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={(v) => updateOption("speed", v)}
                />
                <SliderControl
                  icon={<ZoomIn className="w-3.5 h-3.5 text-emerald-400" />}
                  label={t.reupZoom}
                  value={options.zoom}
                  min={1}
                  max={1.15}
                  step={0.01}
                  defaultValue={1}
                  format={(v) => `${v.toFixed(2)}x`}
                  onChange={(v) => updateOption("zoom", v)}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">{t.reupVideoEffects}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SliderControl
                    icon={<Sun className="w-3.5 h-3.5 text-yellow-400" />}
                    label={t.reupBrightness}
                    value={options.brightness}
                    min={-0.2}
                    max={0.2}
                    step={0.01}
                    defaultValue={0}
                    format={(v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2))}
                    onChange={(v) => updateOption("brightness", v)}
                  />
                  <SliderControl
                    icon={<Contrast className="w-3.5 h-3.5 text-orange-400" />}
                    label={t.reupContrast}
                    value={options.contrast}
                    min={0.8}
                    max={1.3}
                    step={0.01}
                    defaultValue={1}
                    format={(v) => v.toFixed(2)}
                    onChange={(v) => updateOption("contrast", v)}
                  />
                  <SliderControl
                    icon={<Palette className="w-3.5 h-3.5 text-pink-400" />}
                    label={t.reupSaturation}
                    value={options.saturation}
                    min={0.7}
                    max={1.5}
                    step={0.01}
                    defaultValue={1}
                    format={(v) => v.toFixed(2)}
                    onChange={(v) => updateOption("saturation", v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Square className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs font-medium text-white/60">{t.reupBorder}</span>
                    <span className="text-[10px] text-white/30 ml-auto">{options.border}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={options.border}
                    onChange={(e) => updateOption("border", Number(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-sky-400"
                  />
                  {options.border > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30">{t.reupBorderColor}:</span>
                      <div className="flex gap-1">
                        {["black", "white", "#1a1a2e", "#16213e", "#0f3460"].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateOption("borderColor", c)}
                            className={cn(
                              "w-5 h-5 rounded border-2 transition-all",
                              options.borderColor === c ? "border-cyan-400 scale-110" : "border-white/10"
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <SliderControl
                  icon={<Sparkles className="w-3.5 h-3.5 text-violet-400" />}
                  label={t.reupNoise}
                  value={options.noise}
                  min={0}
                  max={15}
                  step={1}
                  defaultValue={0}
                  format={(v) => `${v}`}
                  onChange={(v) => updateOption("noise", v)}
                />
              </div>

              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">{t.reupAudioEffects}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SliderControl
                    icon={<Music className="w-3.5 h-3.5 text-rose-400" />}
                    label={t.reupAudioPitch}
                    value={options.audioPitch}
                    min={0.9}
                    max={1.1}
                    step={0.01}
                    defaultValue={1}
                    format={(v) => `${v.toFixed(2)}x`}
                    onChange={(v) => updateOption("audioPitch", v)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Type className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t.reupTextOverlay}</h3>
            </div>

            <div className="space-y-3">
              <textarea
                value={options.subtitleText}
                onChange={(e) => updateOption("subtitleText", e.target.value)}
                placeholder={t.reupTextPlaceholder}
                className="w-full bg-[#0a0a10] rounded-lg border border-white/10 focus:border-amber-500/40 transition-colors px-3 py-2 text-xs placeholder:text-white/20 font-medium outline-none resize-none h-16"
              />

              {(options.subtitleText.trim() || options.srtContent.trim()) && (
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
              )}
            </div>
          </div>

          <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Languages className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t.reupAutoSub}</h3>
            </div>
            <p className="text-[10px] text-white/25 mb-3">{t.reupAutoSubDesc}</p>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
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
              onClick={handleTranscribe}
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
                  className="mt-3 space-y-2"
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
            onClick={handleProcess}
            disabled={!selectedFileId || processing || !hasChanges}
            className="w-full px-5 py-3 bg-gradient-to-r from-violet-500 to-pink-600 hover:from-violet-400 hover:to-pink-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t.reupProcessing}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                {t.reupProcess}
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
