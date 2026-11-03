import { describe, it, expect } from "vitest";
import { prototypeRegistry, setLocale } from "@flow-designer/model";
import { refreshComfyUITranslations, registerComfyUINodes } from "../src";
import { checkpointLoaderDef } from "../src/checkpoint-loader";
import { ksamplerDef } from "../src/ksampler";
import { clipTextEncodeDef } from "../src/clip-text-encode";
import { vaeDecodeDef } from "../src/vae-decode";
import { saveImageDef } from "../src/save-image";
import { COMFYUI_TYPE_NAMES, DATA_TYPE_COLORS, DATA_TYPES } from "../src/constants";

const allDefs = [checkpointLoaderDef, ksamplerDef, clipTextEncodeDef, vaeDecodeDef, saveImageDef];

describe("ComfyUI node definitions", () => {
  it("all 5 definitions have required fields", () => {
    for (const def of allDefs) {
      expect(def.meta).toBeDefined();
      expect(def.meta.name).toBeTruthy();
      expect(def.meta.typeName).toBeTruthy();
      expect(def.meta.category).toBeTruthy();
      expect(def.view).toBeDefined();
      expect(def.view.type).toBe("node");
      expect(def.view.shape).toBe("fd-rect");
      expect(def.schema).toBeDefined();
      expect(def.editor).toBeDefined();
    }
  });

  it("refreshes registered labels and settings when the locale changes", async () => {
    registerComfyUINodes();
    await setLocale("en-US");
    refreshComfyUITranslations();

    expect(checkpointLoaderDef.meta.name).toBe("Checkpoint Loader");
    expect(checkpointLoaderDef.meta.categoryTitle).toBe("Loaders");
    expect(checkpointLoaderDef.view.ports?.[0]?.label).toBe("Model");
    expect(checkpointLoaderDef.editor[0]?.description).toBe("Checkpoint");
    expect(prototypeRegistry.getPrototypeByType("CheckpointLoaderSimple")?.getName()).toBe(
      "Checkpoint Loader",
    );

    await setLocale("zh-CN");
    refreshComfyUITranslations();
  });

  it("CheckpointLoaderSimple has 0 inputs and 3 typed outputs (MODEL/CLIP/VAE)", () => {
    expect(checkpointLoaderDef.meta.typeName).toBe(COMFYUI_TYPE_NAMES.CHECKPOINT_LOADER);
    expect(checkpointLoaderDef.view.defaultSize).toEqual({ width: 260, height: 100 });
    const ports = checkpointLoaderDef.view.ports!;
    expect(ports.filter((p) => p.group === "in")).toHaveLength(0);
    const outs = ports.filter((p) => p.group === "out");
    expect(outs).toHaveLength(3);
    expect(outs.map((p) => p.dataType)).toEqual(["MODEL", "CLIP", "VAE"]);
    expect(outs.every((p) => p.position === "right")).toBe(true);
  });

  it("KSampler has 4 typed inputs and 1 typed output", () => {
    expect(ksamplerDef.meta.typeName).toBe(COMFYUI_TYPE_NAMES.KSAMPLER);
    const ports = ksamplerDef.view.ports!;
    const ins = ports.filter((p) => p.group === "in");
    const outs = ports.filter((p) => p.group === "out");
    expect(ins).toHaveLength(4);
    expect(outs).toHaveLength(1);
    expect(ins.map((p) => p.dataType)).toEqual(["MODEL", "CONDITIONING", "CONDITIONING", "LATENT"]);
    expect(outs[0].dataType).toBe("LATENT");
    expect(ins.every((p) => p.position === "left")).toBe(true);
    expect(outs.every((p) => p.position === "right")).toBe(true);
  });

  it("CLIPTextEncode has 1 CLIP input and 1 CONDITIONING output", () => {
    expect(clipTextEncodeDef.meta.typeName).toBe(COMFYUI_TYPE_NAMES.CLIP_TEXT_ENCODE);
    const ports = clipTextEncodeDef.view.ports!;
    expect(ports).toHaveLength(2);
    expect(ports[0]).toMatchObject({ group: "in", dataType: "CLIP", position: "left" });
    expect(ports[1]).toMatchObject({ group: "out", dataType: "CONDITIONING", position: "right" });
  });

  it("VAEDecode has 2 inputs (LATENT/VAE) and 1 IMAGE output", () => {
    expect(vaeDecodeDef.meta.typeName).toBe(COMFYUI_TYPE_NAMES.VAE_DECODE);
    const ports = vaeDecodeDef.view.ports!;
    const ins = ports.filter((p) => p.group === "in");
    const outs = ports.filter((p) => p.group === "out");
    expect(ins).toHaveLength(2);
    expect(ins.map((p) => p.dataType)).toEqual(["LATENT", "VAE"]);
    expect(outs).toHaveLength(1);
    expect(outs[0].dataType).toBe("IMAGE");
  });

  it("SaveImage has 1 IMAGE input and 0 outputs", () => {
    expect(saveImageDef.meta.typeName).toBe(COMFYUI_TYPE_NAMES.SAVE_IMAGE);
    const ports = saveImageDef.view.ports!;
    expect(ports.filter((p) => p.group === "in")).toHaveLength(1);
    expect(ports[0]).toMatchObject({ group: "in", dataType: "IMAGE", position: "left" });
    expect(ports.filter((p) => p.group === "out")).toHaveLength(0);
  });

  it("all ports have correct dataType colors", () => {
    for (const def of allDefs) {
      for (const port of def.view.ports || []) {
        if (port.dataType) {
          expect(port.color).toBe(DATA_TYPE_COLORS[port.dataType]);
        }
      }
    }
  });

  it("all type names are unique", () => {
    const typeNames = allDefs.map((d) => d.meta.typeName);
    expect(new Set(typeNames).size).toBe(typeNames.length);
  });

  it("all 6 data types have defined colors", () => {
    const types = Object.values(DATA_TYPES);
    expect(types).toHaveLength(6);
    for (const t of types) {
      expect(DATA_TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("KSampler has expected schema props", () => {
    const schemaNames = ksamplerDef.schema.map((s) => s.name);
    expect(schemaNames).toContain("seed");
    expect(schemaNames).toContain("steps");
    expect(schemaNames).toContain("cfg");
    expect(schemaNames).toContain("sampler_name");
    expect(schemaNames).toContain("scheduler");
    expect(schemaNames).toContain("denoise");
    const steps = ksamplerDef.schema.find((s) => s.name === "steps")!;
    expect(steps.type).toBe("number");
    expect(steps.defaultValue).toBe(20);
  });
});
