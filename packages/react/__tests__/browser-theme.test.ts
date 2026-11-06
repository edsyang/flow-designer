import { afterEach, describe, expect, it, vi } from "vitest";
import { getTheme, setTheme } from "@flow-designer/core";
import { acquireBrowserTheme, getInitialTheme } from "../src/browser/theme";
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
describe("page-shared browser theme ownership", () => {
  it("reads browser preference without putting storage or DOM into core", () => {
    localStorage.setItem("flow-designer:theme", "dark");
    expect(getInitialTheme()).toBe("dark");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => getInitialTheme()).not.toThrow();
  });
  it("shares one persistence subscription and leaves other owners live after cleanup", () => {
    const first = acquireBrowserTheme(),
      second = acquireBrowserTheme();
    const write = vi.spyOn(Storage.prototype, "setItem");
    setTheme(getTheme() === "dark" ? "light" : "dark");
    expect(write).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.fdTheme).toBe(getTheme());
    first();
    first();
    setTheme(getTheme() === "dark" ? "light" : "dark");
    expect(write).toHaveBeenCalledTimes(2);
    second();
    setTheme(getTheme() === "dark" ? "light" : "dark");
    expect(write).toHaveBeenCalledTimes(2);
    expect(document.documentElement.hasAttribute("data-fd-theme-switching")).toBe(false);
  });
});
