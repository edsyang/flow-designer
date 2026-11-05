export type Theme = "light" | "dark";

const STORAGE_KEY = "flow-designer:theme";
const THEME_ATTRIBUTE = "data-fd-theme";
const SWITCHING_ATTRIBUTE = "data-fd-theme-switching";
const SWITCHING_WINDOW_MS = 240;
const listeners = new Set<() => void>();

let currentTheme: Theme | null = null;
let themeVersion = 0;
let switchingTimer: ReturnType<typeof setTimeout> | null = null;

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Theme to use before the user makes an explicit choice. */
export function getInitialTheme(): Theme {
  return readStoredTheme() ?? (prefersDark() ? "dark" : "light");
}

export function getTheme(): Theme {
  return (currentTheme ??= getInitialTheme());
}

/** Snapshot for `useSyncExternalStore`; changes on every theme mutation. */
export function getThemeSnapshot(): string {
  return `${getTheme()}#${String(themeVersion)}`;
}

/** Reflect the theme on the document root so tokens and native controls follow it. */
export function applyTheme(theme: Theme = getTheme()): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;
}

/**
 * Freeze transitions while the palette flips so the switch reads as one change
 * instead of a half-finished cross-fade between the two colour schemes.
 */
function beginThemeSwitch(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(SWITCHING_ATTRIBUTE, "");
  if (switchingTimer !== null) clearTimeout(switchingTimer);
  switchingTimer = setTimeout(() => {
    switchingTimer = null;
    document.documentElement.removeAttribute(SWITCHING_ATTRIBUTE);
  }, SWITCHING_WINDOW_MS);
}

export function setTheme(theme: Theme): void {
  const next: Theme = theme === "dark" ? "dark" : "light";
  if (getTheme() === next) return;
  currentTheme = next;
  beginThemeSwitch();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.warn("Failed to persist the color theme:", error);
    }
  }
  applyTheme(next);
  themeVersion += 1;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.warn("Color theme listener failed:", error);
    }
  }
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
