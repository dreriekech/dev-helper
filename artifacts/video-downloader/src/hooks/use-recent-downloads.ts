import { useState, useEffect } from "react";

export interface RecentDownload {
  id: string;
  title: string;
  platform: string;
  thumbnail: string | null;
  quality: string;
  timestamp: number;
  url: string;
}

const STORAGE_KEY = "vd_recent_downloads";
const MAX_HISTORY = 10;

export function useRecentDownloads() {
  const [downloads, setDownloads] = useState<RecentDownload[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDownloads(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  const addDownload = (download: Omit<RecentDownload, "timestamp">) => {
    setDownloads((prev) => {
      // Remove if it already exists to put it at the top
      const filtered = prev.filter((d) => d.id !== download.id);
      const updated = [
        { ...download, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save history", e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setDownloads([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { downloads, addDownload, clearHistory };
}
