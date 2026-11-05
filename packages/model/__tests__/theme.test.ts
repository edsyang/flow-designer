import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getInitialTheme,
  getTheme,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
} from "../src/theme";

const initialTheme = getTheme();

afterEach(() => {
  setTheme(initialTheme);
});

describe("color theme", () => {
  it("defaults to the light theme outside a browser", () => {
    expect(getInitialTheme()).toBe("light");
  });

  it("switches theme, notifies subscribers and updates the snapshot", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    const before = getThemeSnapshot();

    setTheme("dark");

    expect(getTheme()).toBe("dark");
    expect(getThemeSnapshot()).not.toBe(before);
    expect(getThemeSnapshot().startsWith("dark#")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not notify when the theme is unchanged", () => {
    setTheme("light");
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setTheme("light");

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);
    unsubscribe();

    setTheme("dark");

    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores attribute writes outside a document", () => {
    expect(() => applyTheme("dark")).not.toThrow();
  });
});
