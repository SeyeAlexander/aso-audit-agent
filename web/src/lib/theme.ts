import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
type Resolved = Theme;

const STORAGE_KEY = "aso-theme";

function resolveStored(): Theme | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : null;
}

function systemPreference(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function currentTheme(): Resolved {
  return resolveStored() ?? systemPreference();
}

function applyTheme(theme: Resolved): void {
  document.documentElement.dataset.theme = theme;
}

const listeners = new Set<() => void>();
let snapshot: Resolved = typeof window === "undefined" ? "dark" : currentTheme();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Resolved {
  return snapshot;
}

function getServerSnapshot(): Resolved {
  return "dark";
}

export function useTheme(): {
  theme: Resolved;
  setTheme: (next: Theme) => void;
  toggle: () => void;
} {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    snapshot = currentTheme();
    applyTheme(snapshot);
    emit();
  }, []);

  const setTheme = (next: Theme): void => {
    snapshot = next;
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    emit();
  };

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark")
  };
}
