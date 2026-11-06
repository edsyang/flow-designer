import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocale, setLocale, t } from "@flow-designer/i18n";
import { getInitialLocale, initializeDesignerI18n, persistLocalePreference } from "../src/i18n";

afterEach(async () => {
  vi.restoreAllMocks();
  await setLocale("zh-CN");
  localStorage.clear();
});

describe("designer locale composition", () => {
  it("registers framework messages before scenario overrides and preserves existing locale", async () => {
    await initializeDesignerI18n();
    await setLocale("en-US");
    await initializeDesignerI18n({ "en-US": { "workbench.canvas.label": "Custom canvas" } });
    expect(getLocale()).toBe("en-US");
    expect(t("workbench.canvas.label")).toBe("Custom canvas");
    expect(t("workbench.connection.routeUnavailable")).toContain("No route");
    expect(t("setter.json.invalid")).toBe("Invalid JSON");
  });

  it("reads browser preference with a safe fallback", () => {
    localStorage.setItem("flow-designer:locale", "en-US");
    expect(getInitialLocale()).toBe("en-US");
    localStorage.setItem("flow-designer:locale", "invalid");
    expect(getInitialLocale()).toBe("zh-CN");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getInitialLocale()).toBe("zh-CN");
  });

  it("persists only while its owner is alive and does not leak after cleanup", async () => {
    await initializeDesignerI18n();
    const stop = persistLocalePreference();
    try {
      await setLocale("en-US");
      expect(localStorage.getItem("flow-designer:locale")).toBe("en-US");
    } finally {
      stop();
    }
    await setLocale("zh-CN");
    expect(localStorage.getItem("flow-designer:locale")).toBe("en-US");
  });

  it("keeps switching available when storage is blocked", async () => {
    await initializeDesignerI18n();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const stop = persistLocalePreference();
    try {
      await setLocale("en-US");
      expect(getLocale()).toBe("en-US");
      expect(warning).toHaveBeenCalledOnce();
    } finally {
      stop();
    }
  });
});
