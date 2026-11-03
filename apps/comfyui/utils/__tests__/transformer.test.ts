import { describe, it, expect } from "vitest";
import { comfyuiTransformer } from "../src/transformer";
import type { ComfyUIWorkflow, TransformerDocumentData } from "../src/types";

const sampleWorkflow: ComfyUIWorkflow = {
  "4": {
    class_type: "CheckpointLoaderSimple",
    inputs: {
      ckpt_name: "v1-5-pruned.safetensors",
    },
    _meta: { position: { x: 0, y: 0 } },
  },
  "6": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "a beautiful landscape",
      clip: ["4", 1],
    },
    _meta: { position: { x: 300, y: 0 } },
  },
  "7": {
    class_type: "CLIPTextEncode",
    inputs: {
      text: "ugly, blurry",
      clip: ["4", 1],
    },
    _meta: { position: { x: 300, y: 200 } },
  },
  "3": {
    class_type: "KSampler",
    inputs: {
      seed: 156680208700286,
      steps: 20,
      cfg: 8,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1,
      model: ["4", 0],
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0],
    },
    _meta: { position: { x: 600, y: 100 } },
  },
  "5": {
    class_type: "EmptyLatentImage",
    inputs: {
      width: 512,
      height: 512,
      batch_size: 1,
    },
    _meta: { position: { x: 300, y: 400 } },
  },
  "8": {
    class_type: "VAEDecode",
    inputs: {
      samples: ["3", 0],
      vae: ["4", 2],
    },
    _meta: { position: { x: 900, y: 100 } },
  },
  "9": {
    class_type: "SaveImage",
    inputs: {
      filename_prefix: "ComfyUI",
      images: ["8", 0],
    },
    _meta: { position: { x: 1200, y: 100 } },
  },
};

describe("ComfyUI Transformer", () => {
  describe("transformIn", () => {
    it("converts ComfyUI JSON to DocumentData with correct element count", () => {
      const result = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      expect(result.type).toBe("comfyui");
      expect(result.version).toBe("1.0.0");
      const nodeEls = result.elements.filter((el: any) => !el.sourceRef);
      const edgeEls = result.elements.filter((el: any) => el.sourceRef);
      expect(nodeEls).toHaveLength(7);
      expect(edgeEls.length).toBeGreaterThanOrEqual(8);
    });

    it("separates value props from link references", () => {
      const result = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      const nodeEls = result.elements.filter((el: any) => !el.sourceRef);
      const ksampler = nodeEls.find((n: any) => n.typeName === "KSampler")!;
      expect(ksampler.props.steps).toBe(20);
      expect(ksampler.props.cfg).toBe(8);
      expect(ksampler.props.seed).toBe(156680208700286);
      expect(ksampler.props.model).toBeUndefined();
      expect(ksampler.props.positive).toBeUndefined();
    });

    it("creates edge elements with sourceRef/targetRef", () => {
      const result = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      const nodeEls = result.elements.filter((el: any) => !el.sourceRef);
      const edgeEls = result.elements.filter((el: any) => el.sourceRef) as any[];
      const checkpoint = nodeEls.find((n: any) => n.typeName === "CheckpointLoaderSimple")!;
      const ksampler = nodeEls.find((n: any) => n.typeName === "KSampler")!;
      const modelEdge = edgeEls.find(
        (e: any) =>
          e.sourceRef === checkpoint.id && e.targetRef === ksampler.id && e.targetPort === "model",
      );
      expect(modelEdge).toBeDefined();
      expect(modelEdge!.sourcePort).toBe("output_0");
    });

    it("preserves node positions from _meta", () => {
      const result = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      const nodeEls = result.elements.filter((el: any) => !el.sourceRef);
      const ksampler = nodeEls.find((n: any) => n.typeName === "KSampler")!;
      expect((ksampler as any).position).toEqual({ x: 600, y: 100 });
    });

    it("defaults position to {0,0} when _meta is missing", () => {
      const minimal: ComfyUIWorkflow = {
        "1": { class_type: "TestNode", inputs: { val: 42 } },
      };
      const result = comfyuiTransformer.transformIn(minimal) as TransformerDocumentData;
      const nodeEls = result.elements.filter((el: any) => !el.sourceRef);
      expect((nodeEls[0] as any).position).toEqual({ x: 0, y: 0 });
    });
  });

  describe("transformOut", () => {
    it("converts DocumentData back to ComfyUI JSON", () => {
      const docData: TransformerDocumentData = {
        type: "comfyui",
        version: "1.0.0",
        elements: [
          {
            id: "n1",
            typeName: "CheckpointLoaderSimple",
            props: { ckpt_name: "model.safetensors" },
            position: { x: 0, y: 0 },
          },
          {
            id: "n2",
            typeName: "KSampler",
            props: { steps: 20, cfg: 8 },
            position: { x: 300, y: 100 },
          },
          {
            id: "r1",
            typeName: "Edge",
            sourceRef: "n1",
            targetRef: "n2",
            sourcePort: "output_0",
            targetPort: "model",
          },
        ],
      };

      const result = comfyuiTransformer.transformOut(docData);
      expect(Object.keys(result)).toHaveLength(2);

      const node1 = result["1"];
      expect(node1.class_type).toBe("CheckpointLoaderSimple");
      expect(node1.inputs.ckpt_name).toBe("model.safetensors");

      const node2 = result["2"];
      expect(node2.class_type).toBe("KSampler");
      expect(node2.inputs.steps).toBe(20);
      expect(node2.inputs.model).toEqual(["1", 0]);
    });

    it("preserves position in _meta", () => {
      const docData: TransformerDocumentData = {
        type: "comfyui",
        version: "1.0.0",
        elements: [{ id: "n1", typeName: "SaveImage", props: {}, position: { x: 500, y: 200 } }],
      };
      const result = comfyuiTransformer.transformOut(docData);
      expect(result["1"]._meta?.position).toEqual({ x: 500, y: 200 });
    });
  });

  describe("round-trip", () => {
    it("transformIn → transformOut preserves structure", () => {
      const docData = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      const roundTripped = comfyuiTransformer.transformOut(docData);

      expect(Object.keys(roundTripped)).toHaveLength(Object.keys(sampleWorkflow).length);

      const originalByType = new Map<string, number>();
      for (const n of Object.values(sampleWorkflow)) {
        originalByType.set(n.class_type, (originalByType.get(n.class_type) ?? 0) + 1);
      }
      const rtByType = new Map<string, number>();
      for (const n of Object.values(roundTripped)) {
        rtByType.set(n.class_type, (rtByType.get(n.class_type) ?? 0) + 1);
      }
      expect(rtByType).toEqual(originalByType);

      for (const [, nodeDef] of Object.entries(roundTripped)) {
        for (const [, value] of Object.entries(nodeDef.inputs)) {
          if (Array.isArray(value)) {
            expect(value).toHaveLength(2);
            expect(typeof value[0]).toBe("string");
            expect(typeof value[1]).toBe("number");
          }
        }
      }
    });

    it("maintains correct class_type mapping after round-trip", () => {
      const docData = comfyuiTransformer.transformIn(sampleWorkflow) as TransformerDocumentData;
      const roundTripped = comfyuiTransformer.transformOut(docData);

      const originalTypes = new Set(Object.values(sampleWorkflow).map((n) => n.class_type));
      const roundTrippedTypes = new Set(Object.values(roundTripped).map((n) => n.class_type));
      expect(roundTrippedTypes).toEqual(originalTypes);
    });
  });
});
