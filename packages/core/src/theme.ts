/** Page-shared preference state. Browser reflection and persistence are adapters. */
export type Theme = "light" | "dark";
let currentTheme: Theme = "light";
let version = 0;
const listeners = new Set<() => void>();
export function getTheme(): Theme {
  return currentTheme;
}
export function getThemeSnapshot(): string {
  return `${currentTheme}#${String(version)}`;
}
export function setTheme(theme: Theme): void {
  const next = theme === "dark" ? "dark" : "light";
  if (next === currentTheme) return;
  currentTheme = next;
  version += 1;
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
