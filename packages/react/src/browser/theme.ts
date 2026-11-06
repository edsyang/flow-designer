import { getTheme, setTheme, subscribeTheme } from "@flow-designer/core";
import type { Theme } from "@flow-designer/core";
const STORAGE_KEY = "flow-designer:theme";
let owners = 0;
let initialized = false;
let unsubscribe: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* Storage is optional. */
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
export function applyTheme(theme: Theme = getTheme()): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-fd-theme", theme);
  document.documentElement.style.colorScheme = theme;
}
/** One browser side-effect owner shared by all designers on this page. */
export function acquireBrowserTheme(): () => void {
  if (typeof window === "undefined") return () => {};
  if (owners++ === 0) {
    if (!initialized) {
      initialized = true;
      setTheme(getInitialTheme());
    }
    applyTheme();
    unsubscribe = subscribeTheme(() => {
      applyTheme();
      document.documentElement.setAttribute("data-fd-theme-switching", "");
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        document.documentElement.removeAttribute("data-fd-theme-switching");
      }, 240);
      try {
        window.localStorage.setItem(STORAGE_KEY, getTheme());
      } catch (error) {
        console.warn("Failed to persist the color theme:", error);
      }
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--owners > 0) return;
    unsubscribe?.();
    unsubscribe = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    document.documentElement.removeAttribute("data-fd-theme-switching");
  };
}
