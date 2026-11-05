import { useCallback, useSyncExternalStore } from "react";
import { getThemeSnapshot, setTheme, subscribeTheme } from "@flow-designer/model";
import type { Theme } from "@flow-designer/model";

export interface ITheme {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function readTheme(snapshot: string): Theme {
  return snapshot.slice(0, snapshot.indexOf("#")) as Theme;
}

/** Observe the active color theme and change it. */
export function useTheme(): ITheme {
  const snapshot = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot);
  const theme = readTheme(snapshot);
  const toggleTheme = useCallback(() => {
    setTheme(readTheme(getThemeSnapshot()) === "dark" ? "light" : "dark");
  }, []);
  return { theme, setTheme, toggleTheme };
}
