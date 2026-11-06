import { afterEach, expect, it, vi } from "vitest";
import { getTheme, getThemeSnapshot, setTheme, subscribeTheme } from "../src/theme";
afterEach(() => setTheme("light"));
it("exposes page-shared theme state without browser effects", () => {
  const initial = getThemeSnapshot();
  const listener = vi.fn();
  const stop = subscribeTheme(listener);
  setTheme("dark");
  expect(getTheme()).toBe("dark");
  expect(getThemeSnapshot()).not.toBe(initial);
  expect(listener).toHaveBeenCalledOnce();
  setTheme("dark");
  expect(listener).toHaveBeenCalledOnce();
  stop();
  stop();
  setTheme("light");
  expect(listener).toHaveBeenCalledOnce();
});
