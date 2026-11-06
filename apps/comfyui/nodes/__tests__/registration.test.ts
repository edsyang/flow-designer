import { describe, expect, it } from "vitest";
import { prototypeRegistry } from "@flow-designer/model";
import { setLocale, t } from "@flow-designer/i18n";
import { COMFYUI_TYPE_NAMES } from "../src/constants";
import { refreshComfyUITranslations, registerComfyUINodes } from "../src";

const NODE_TYPES = Object.values(COMFYUI_TYPE_NAMES);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// The registry is a process-wide singleton and this file runs in its own module
// graph, so these tests can assert the "not registered yet" state directly.
describe("ComfyUI node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshComfyUITranslations();

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerComfyUINodes registers every ComfyUI node type", () => {
    registerComfyUINodes();

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerComfyUINodes();
    registerComfyUINodes();

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerComfyUINodes();
    await setLocale("en-US");
    refreshComfyUITranslations();
    expect(prototypeRegistry.getPrototypeByType(COMFYUI_TYPE_NAMES.KSAMPLER)?.getName()).toBe(
      t("comfyui.node.sampler"),
    );

    await setLocale("zh-CN");
    refreshComfyUITranslations();
    expect(prototypeRegistry.getPrototypeByType(COMFYUI_TYPE_NAMES.KSAMPLER)?.getName()).toBe(
      t("comfyui.node.sampler"),
    );
  });
});
