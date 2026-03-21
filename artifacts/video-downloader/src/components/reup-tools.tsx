import { useState } from "react";
import { Wand2, FlipHorizontal, FlipVertical, Gauge, ZoomIn, Sun, Contrast, Palette, Square, Music, Sparkles, RotateCcw, CheckCircle, AlertCircle, Film, ChevronDown } from "lucide-react";
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

  const selectedItem = libraryItems.find((i) => i.fileId === selectedFileId);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "tiktok") {
      setOptions({ ...defaultOptions, ...tiktokPreset });
    } else if (p === "facebook") {
      setOptions({ ...defaultOptions, ...facebookPreset });
    } else {
      setOptions({ ...defaultOptions });
    }
  };

  const updateOption = <K extends keyof ReupOptions>(key: K, value: ReupOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setPreset("custom");
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

  const hasChanges = JSON.stringify(options) !== JSON.stringify(defaultOptions);

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
                      onClick={() => { setSelectedFileId(item.fileId); setShowDropdown(false); setResult(null); }}
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
                onClick={() => { setOptions({ ...defaultOptions }); setPreset("custom"); }}
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
