import { useCallback, useEffect, useState } from "react";
import type { AuditResponse } from "./types";

const STORAGE_KEY = "aso-audit-history";
const MAX_ENTRIES = 5;

export interface HistoryEntry {
  appName: string;
  developer: string;
  category: string;
  iconUrl?: string;
  appStoreUrl: string;
  overallScore: number;
  agentLed: boolean;
  timestamp: number;
  /**
   * Full audit payload, cached so a "Recent audits" chip can re-open the report
   * instantly instead of re-running the workflow. Optional for backward
   * compatibility with entries saved before this field existed.
   */
  audit?: AuditResponse;
}

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or disabled storage — silently skip; history is non-essential.
  }
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<HistoryEntry>;
  return (
    typeof v.appName === "string" &&
    typeof v.appStoreUrl === "string" &&
    typeof v.overallScore === "number" &&
    typeof v.timestamp === "number"
  );
}

export function useAuditHistory(): {
  entries: HistoryEntry[];
  record: (audit: AuditResponse) => void;
  getCached: (appStoreUrl: string) => AuditResponse | undefined;
  clear: () => void;
  remove: (appStoreUrl: string) => void;
} {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(read());
  }, []);

  const record = useCallback((audit: AuditResponse): void => {
    const entry: HistoryEntry = {
      appName: audit.surfaceMetadata.appName,
      developer: audit.surfaceMetadata.developer,
      category: audit.surfaceMetadata.category,
      ...(audit.surfaceMetadata.iconUrl ? { iconUrl: audit.surfaceMetadata.iconUrl } : {}),
      appStoreUrl: audit.trackViewUrl,
      overallScore: audit.audit.overallScore,
      agentLed: audit.agentLed,
      timestamp: Date.now(),
      audit
    };
    const next = [entry, ...read().filter((e) => e.appStoreUrl !== entry.appStoreUrl)].slice(
      0,
      MAX_ENTRIES
    );
    write(next);
    setEntries(next);
  }, []);

  /** Returns the cached full audit for a URL, or undefined if not stored. */
  const getCached = useCallback((appStoreUrl: string): AuditResponse | undefined => {
    return read().find((entry) => entry.appStoreUrl === appStoreUrl)?.audit;
  }, []);

  const clear = useCallback((): void => {
    write([]);
    setEntries([]);
  }, []);

  const remove = useCallback((appStoreUrl: string): void => {
    const next = read().filter((entry) => entry.appStoreUrl !== appStoreUrl);
    write(next);
    setEntries(next);
  }, []);

  return { entries, record, getCached, clear, remove };
}

export function formatRelative(ms: number): string {
  const delta = Date.now() - ms;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
