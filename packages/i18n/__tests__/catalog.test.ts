import { describe, expect, it, vi } from "vitest";
import { coreMessages, createI18n } from "../src/index";

const builtins = {
  "common.action.undo": ["撤销", "Undo"],
  "workbench.canvas.label": ["流程画布", "Flow canvas"],
  "workbench.language.label": ["语言", "Language"],
  "setter.json.invalid": ["JSON 格式无效", "Invalid JSON"],
};

describe("built-in framework catalogs", () => {
  it("keeps the public catalog immutable with matching bilingual keys and placeholders", () => {
    expect(Object.isFrozen(coreMessages)).toBe(true);
    expect(Object.isFrozen(coreMessages["zh-CN"])).toBe(true);
    expect(Object.isFrozen(coreMessages["en-US"])).toBe(true);
    const keys = Object.keys(coreMessages["zh-CN"]).sort();
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(coreMessages["en-US"]).sort()).toEqual(keys);
    const placeholders = (value: string) =>
      Array.from(value.matchAll(/{{\s*([^}\s]+)\s*}}/g), (match) => match[1]).sort();
    for (const key of keys) {
      const chinese = coreMessages["zh-CN"][key]!;
      const english = coreMessages["en-US"][key]!;
      expect(chinese.trim()).not.toBe("");
      expect(english.trim()).not.toBe("");
      expect(placeholders(chinese), key).toEqual(placeholders(english));
    }
  });

  it("keeps raw i18next resource writes local to their instance", async () => {
    const first = createI18n();
    await first.initializeI18n({}, "en-US");
    first.i18n.addResourceBundle(
      "en-US",
      "translation",
      { "common.action.undo": "Raw override" },
      true,
      true,
    );
    const second = createI18n();
    await second.initializeI18n({}, "en-US");
    expect(first.t("common.action.undo")).toBe("Raw override");
    expect(second.t("common.action.undo")).toBe("Undo");
    expect(coreMessages["en-US"]["common.action.undo"]).toBe("Undo");
  });

  it("initializes every domain without engine or UI package registration", async () => {
    const service = createI18n();
    await service.initializeI18n();
    for (const [key, values] of Object.entries(builtins)) expect(service.t(key)).toBe(values[0]);
    expect(service.t("workbench.connection.routeUnavailable")).toContain("无法");
    await service.setLocale("en-US");
    for (const [key, values] of Object.entries(builtins)) expect(service.t(key)).toBe(values[1]);
    expect(service.t("workbench.connection.routeUnavailable")).toContain("No route");
  });

  it("keeps application override precedence across initialization and independent instances", async () => {
    const first = createI18n();
    const second = createI18n();
    first.registerMessages({ "en-US": { "common.action.undo": "Application undo" } });
    const initializing = first.initializeI18n(
      {
        "en-US": { "workbench.canvas.label": "Application canvas", "app.title": "Application" },
      },
      "en-US",
    );
    first.addMessages("en-US", { "common.action.undo": "Latest undo" });
    await initializing;
    await second.initializeI18n({}, "en-US");
    expect(first.t("common.action.undo")).toBe("Latest undo");
    expect(first.t("workbench.canvas.label")).toBe("Application canvas");
    expect(first.t("app.title")).toBe("Application");
    expect(first.t("setter.json.invalid")).toBe("Invalid JSON");
    expect(second.t("common.action.undo")).toBe("Undo");
    const listener = vi.fn();
    const stop = first.subscribeLocale(listener);
    first.addMessages("en-US", { "common.action.undo": "Late undo" });
    expect(listener).toHaveBeenCalledOnce();
    expect(first.t("common.action.undo")).toBe("Late undo");
    await first.initializeI18n();
    expect(first.t("common.action.undo")).toBe("Late undo");
    expect(first.getLocale()).toBe("en-US");
    stop();
  });
});
