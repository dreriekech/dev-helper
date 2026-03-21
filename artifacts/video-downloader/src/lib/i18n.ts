import { useState, useEffect, createContext, useContext } from "react";

export type Lang = "vi" | "en";

const translations = {
  vi: {
    toolTitle: "Video Downloader Tool",
    toolDesc: "Tải video không dính watermark từ các nền tảng phổ biến",
    inputPlaceholder: "Dán link video vào đây...",
    extractBtn: "Phân tích",
    extractingBtn: "Đang phân tích...",
    supportedPlatforms: "Nền tảng hỗ trợ",
    extractionFailed: "Phân tích thất bại",
    errorGeneric: "Không thể xử lý URL này. Vui lòng kiểm tra lại link.",
    availableFormats: "Định dạng có sẵn",
    download: "Tải xuống",
    preparing: "Đang chuẩn bị...",
    videoLabel: "Video",
    audioLabel: "Âm thanh",
    sizeUnknown: "Không rõ kích thước",
    recentDownloads: "Lịch sử tải xuống",
    clearHistory: "Xóa lịch sử",
    noFormats: "Không tìm thấy định dạng nào cho video này.",
    downloadFailed: "Tải xuống thất bại. Vui lòng thử lại.",
    language: "Ngôn ngữ",
    platforms: "Nền tảng",
    quality: "Chất lượng",
    watermarkFree: "Không watermark",
    fast: "Tốc độ cao",
    multiPlatform: "Đa nền tảng",
    pasteHint: "Hỗ trợ YouTube, TikTok, Instagram, Facebook, Twitter/X, Douyin...",
    statusReady: "Sẵn sàng",
    statusProcessing: "Đang xử lý",
    keyTitle: "Nhập Key truy cập",
    keyDesc: "Vui lòng nhập API Key để sử dụng công cụ",
    keyPlaceholder: "Nhập API Key...",
    keySubmit: "Xác nhận",
    keyValidating: "Đang xác thực...",
    keyInvalid: "Key không hợp lệ. Vui lòng kiểm tra lại.",
    keyLogout: "Đổi Key",
    keyUnlimited: "Không giới hạn",
    tabDownload: "Download Vid",
    tabLibrary: "Thư viện",
    library: "Thư viện",
    libraryDesc: "Video đã tải, sẵn sàng lưu về máy",
    libraryEmpty: "Chưa có video nào trong thư viện",
    libraryEmptyHint: "Tải video để thêm vào đây",
    saveToDevice: "Lưu về máy",
    removeFromLibrary: "Xóa khỏi thư viện",
    clearLibrary: "Xóa tất cả",
    libraryCount: "video",
    refreshLibrary: "Làm mới",
    expiresIn: "Hết hạn sau",
    minutes: "phút",
  },
  en: {
    toolTitle: "Video Downloader Tool",
    toolDesc: "Download watermark-free videos from popular platforms",
    inputPlaceholder: "Paste video URL here...",
    extractBtn: "Extract",
    extractingBtn: "Extracting...",
    supportedPlatforms: "Supported Platforms",
    extractionFailed: "Extraction Failed",
    errorGeneric: "Could not process this URL. Please check if the link is correct.",
    availableFormats: "Available Formats",
    download: "Download",
    preparing: "Preparing...",
    videoLabel: "Video",
    audioLabel: "Audio",
    sizeUnknown: "Size Unknown",
    recentDownloads: "Recent Downloads",
    clearHistory: "Clear History",
    noFormats: "No downloadable formats found for this video.",
    downloadFailed: "Download failed. Please try again.",
    language: "Language",
    platforms: "Platforms",
    quality: "Quality",
    watermarkFree: "No Watermark",
    fast: "Fast Speed",
    multiPlatform: "Multi-platform",
    pasteHint: "Supports YouTube, TikTok, Instagram, Facebook, Twitter/X, Douyin...",
    statusReady: "Ready",
    statusProcessing: "Processing",
    keyTitle: "Enter Access Key",
    keyDesc: "Please enter your API Key to use the tool",
    keyPlaceholder: "Enter API Key...",
    keySubmit: "Confirm",
    keyValidating: "Validating...",
    keyInvalid: "Invalid key. Please check and try again.",
    keyLogout: "Change Key",
    keyUnlimited: "Unlimited",
    tabDownload: "Download Vid",
    tabLibrary: "Library",
    library: "Library",
    libraryDesc: "Downloaded videos, ready to save to your device",
    libraryEmpty: "No videos in library yet",
    libraryEmptyHint: "Download a video to add it here",
    saveToDevice: "Save to device",
    removeFromLibrary: "Remove",
    clearLibrary: "Clear all",
    libraryCount: "videos",
    refreshLibrary: "Refresh",
    expiresIn: "Expires in",
    minutes: "min",
  },
} as const;

export type Translations = typeof translations.vi;

const LANG_KEY = "vd_lang";

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === "vi" || stored === "en") return stored;
    } catch {}
    return "vi";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };

  const t = translations[lang];

  return { lang, setLang, t };
}

export type UseLangReturn = ReturnType<typeof useLang>;
