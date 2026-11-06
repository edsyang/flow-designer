import { describe, expect, it, vi } from "vitest";
import { createI18n } from "../src/index";
const messages = { "zh-CN": { greeting: "你好" }, "en-US": { greeting: "Hello" } };
describe("isolated translation service", () => {
  it("merges resources before and after init without resetting a selected language", async () => {
    const service = createI18n();
    expect(service.t("absent")).toBe("absent");
    service.registerMessages(messages);
    await service.initializeI18n({}, "en-US");
    expect(service.t("greeting")).toBe("Hello");
    const before = service.getLocaleSnapshot();
    service.addMessages("en-US", { greeting: "Welcome" });
    expect(service.t("greeting")).toBe("Welcome");
    expect(service.getLocaleSnapshot()).not.toBe(before);
    await service.initializeI18n({ "zh-CN": { extra: "补充" } }, "zh-CN");
    expect(service.getLocale()).toBe("en-US");
    await service.setLocale("zh-CN");
    expect(service.t("extra")).toBe("补充");
  });
  it("keeps latest registrations while the initialization promise is pending", async () => {
    const service = createI18n();
    const initializing = service.initializeI18n(messages);
    service.registerMessages({ "zh-CN": { greeting: "最新" } });
    await initializing;
    expect(service.t("greeting")).toBe("最新");
  });
  it("keeps instances separate and releases all owned subscription callbacks", async () => {
    const first = createI18n();
    const second = createI18n();
    await Promise.all([first.initializeI18n(messages), second.initializeI18n(messages)]);
    const callback = vi.fn();
    const unsubscribe = first.subscribeLocale(callback);
    first.registerMessages({ "zh-CN": { greeting: "新值" } });
    await first.setLocale("en-US");
    expect(callback).toHaveBeenCalledTimes(2);
    expect(second.getLocale()).toBe("zh-CN");
    expect(second.t("greeting")).toBe("你好");
    unsubscribe();
    unsubscribe();
    await first.setLocale("zh-CN");
    first.registerMessages({ "zh-CN": { greeting: "后来" } });
    expect(callback).toHaveBeenCalledTimes(2);
  });
  it("exposes init errors and supports retry without losing registered messages", async () => {
    const service = createI18n();
    const error = new Error("backend unavailable");
    const spy = vi.spyOn(service.i18n, "init").mockRejectedValueOnce(error);
    await expect(service.initializeI18n(messages)).rejects.toBe(error);
    spy.mockRestore();
    await service.initializeI18n({}, "en-US");
    expect(service.t("greeting")).toBe("Hello");
  });
  it("propagates language change rejection without reporting a new locale", async () => {
    const service = createI18n();
    await service.initializeI18n(messages);
    const error = new Error("language unavailable");
    vi.spyOn(service.i18n, "changeLanguage").mockRejectedValueOnce(error);
    await expect(service.setLocale("en-US")).rejects.toBe(error);
    expect(service.getLocale()).toBe("zh-CN");
  });
  it("observes raw native resource additions/removals and cleans pre-init subscribers", async () => {
    const service = createI18n();
    const callback = vi.fn();
    const unsubscribe = service.subscribeLocale(callback);
    await service.initializeI18n(messages);
    callback.mockClear();
    const snapshot = service.getLocaleSnapshot();
    service.i18n.addResourceBundle("zh-CN", "translation", { native: "原生" }, true, true);
    expect(service.t("native")).toBe("原生");
    expect(service.getLocaleSnapshot()).not.toBe(snapshot);
    service.i18n.removeResourceBundle("zh-CN", "translation");
    expect(callback).toHaveBeenCalledTimes(2);
    unsubscribe();
    service.i18n.addResourceBundle("zh-CN", "translation", { native: "后来" }, true, true);
    expect(callback).toHaveBeenCalledTimes(2);
  });
  it("can dispose a subscription before initialization", async () => {
    const service = createI18n();
    const callback = vi.fn();
    service.subscribeLocale(callback)();
    await service.initializeI18n(messages);
    await service.setLocale("en-US");
    expect(callback).not.toHaveBeenCalled();
  });
  it("accepts setLocale before initialization", async () => {
    const service = createI18n();
    service.registerMessages(messages);
    await service.setLocale("en-US");
    expect(service.t("greeting")).toBe("Hello");
  });
});
