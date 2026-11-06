import { describe, expect, it } from "vitest";
import { createRegistrySet } from "@flow-designer/model";
import { UiContributionRegistry } from "../../../../packages/skeleton/src/ui-contributions";
const domain = createRegistrySet();
const prototypeRegistry = domain.prototypes;
const registry = { prototypes: prototypeRegistry, ui: new UiContributionRegistry() };
import { setLocale, t } from "@flow-designer/i18n";
import { COMFYUI_TYPE_NAMES } from "../src/constants";
import { refreshComfyUITranslations, registerComfyUINodes } from "../src";

const NODE_TYPES = Object.values(COMFYUI_TYPE_NAMES);

function registeredTypes(): string[] {
  return prototypeRegistry.getRegistry().map((prototype) => prototype.getTypeName());
}

// This suite owns its domain and UI registrations.
describe("ComfyUI node registration", () => {
  it("a translation refresh does not register nodes", () => {
    refreshComfyUITranslations(registry);

    expect(registeredTypes()).toHaveLength(0);
  });

  it("registerComfyUINodes registers every ComfyUI node type", () => {
    registerComfyUINodes(registry);

    expect(registeredTypes().sort()).toEqual([...NODE_TYPES].sort());
    for (const typeName of NODE_TYPES) {
      expect(prototypeRegistry.getPrototypeByType(typeName)).not.toBeNull();
    }
  });

  it("is idempotent and does not duplicate registry entries", () => {
    registerComfyUINodes(registry);
    registerComfyUINodes(registry);

    expect(registeredTypes()).toHaveLength(NODE_TYPES.length);
  });

  it("updates already-registered prototypes when the locale changes", async () => {
    registerComfyUINodes(registry);
    await setLocale("en-US");
    refreshComfyUITranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(COMFYUI_TYPE_NAMES.KSAMPLER)?.getName()).toBe(
      t("comfyui.node.sampler"),
    );

    await setLocale("zh-CN");
    refreshComfyUITranslations(registry);
    expect(prototypeRegistry.getPrototypeByType(COMFYUI_TYPE_NAMES.KSAMPLER)?.getName()).toBe(
      t("comfyui.node.sampler"),
    );
  });
});
