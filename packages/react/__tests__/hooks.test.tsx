import { describe, it, expect, vi, beforeAll } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { Document, GenericContent, contentTypesRegistry, signal } from "@flow-designer/model";
import { Editor } from "@flow-designer/core";
import { Skeleton } from "@flow-designer/skeleton";
import { FlowDesignerProvider } from "../src/provider";
import { useEditor } from "../src/hooks/use-editor";
import { useDocument } from "../src/hooks/use-document";
import { useSelection } from "../src/hooks/use-selection";
import { useNode } from "../src/hooks/use-node";
import { useNodeProps } from "../src/hooks/use-node-props";
import { useGraphView } from "../src/hooks/use-graph-view";
import { useSkeleton } from "../src/hooks/use-skeleton";
import { usePlugins } from "../src/hooks/use-plugins";
import { useGraph } from "../src/hooks/use-graph";
import { useSignal } from "../src/hooks/use-signal";

beforeAll(() => {
  if (!contentTypesRegistry.getSuitableContentType("*")) {
    contentTypesRegistry.register(GenericContent as any);
  }
});

function createTestEngine() {
  const editor = new Editor();
  const skeleton = new Skeleton();
  editor.setSkeleton(skeleton);

  const doc = new Document({
    id: "test",
    documentType: "*",
    documentVersion: "1.0.0",
  });
  editor.setDocument(doc);

  return { editor, skeleton };
}

function createWrapper(engine: any) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(FlowDesignerProvider, { engine }, children);
  };
}

describe("useEditor", () => {
  it("returns the editor from engine", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useEditor(), { wrapper: createWrapper(engine) });
    expect(result.current).toBe(engine.editor);
  });

  it("throws without provider", () => {
    expect(() => {
      renderHook(() => useEditor());
    }).toThrow("useFlowDesigner must be used within a FlowDesignerProvider");
  });
});

describe("useDocument", () => {
  it("returns document from editor", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useDocument(), { wrapper: createWrapper(engine) });
    expect(result.current).toBe(engine.editor.getDocument());
  });
});

describe("useGraphView", () => {
  it("returns zoom and editable values", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useGraphView(), { wrapper: createWrapper(engine) });
    expect(result.current.zoom).toBe(1);
    expect(result.current.editable).toBe(true);
  });

  it("provides setZoom and setEditable functions", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useGraphView(), { wrapper: createWrapper(engine) });
    expect(typeof result.current.setZoom).toBe("function");
    expect(typeof result.current.setEditable).toBe("function");
  });
});

describe("useSkeleton", () => {
  it("returns skeleton from engine", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useSkeleton(), { wrapper: createWrapper(engine) });
    expect(result.current).toBe(engine.skeleton);
  });
});

describe("useGraph", () => {
  it("returns null when graph not initialized", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useGraph(), { wrapper: createWrapper(engine) });
    expect(result.current).toBeNull();
  });
});

describe("useSelection", () => {
  it("returns empty keys initially", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useSelection(), { wrapper: createWrapper(engine) });
    expect(result.current.keys).toEqual([]);
  });

  it("provides setKeys and clear functions", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useSelection(), { wrapper: createWrapper(engine) });
    expect(typeof result.current.setKeys).toBe("function");
    expect(typeof result.current.clear).toBe("function");
  });
});

describe("useNode", () => {
  it("returns null for non-existent node", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useNode("unknown"), { wrapper: createWrapper(engine) });
    expect(result.current).toBeNull();
  });
});

describe("useNodeProps", () => {
  it("returns null for non-existent node", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => useNodeProps("unknown"), {
      wrapper: createWrapper(engine),
    });
    expect(result.current).toBeNull();
  });
});

describe("usePlugins", () => {
  it("returns undefined when no plugin manager set", () => {
    const engine = createTestEngine();
    const { result } = renderHook(() => usePlugins(), { wrapper: createWrapper(engine) });
    expect(result.current).toBeUndefined();
  });
});

describe("useSignal", () => {
  it("registers and cleans up signal handler", () => {
    const handler = vi.fn();
    const engine = createTestEngine();
    const { unmount } = renderHook(() => useSignal("test-signal", handler), {
      wrapper: createWrapper(engine),
    });

    signal.sendSignal("test-signal", "arg1");
    expect(handler).toHaveBeenCalledWith("arg1");

    unmount();
    handler.mockClear();
    signal.sendSignal("test-signal", "arg2");
    expect(handler).not.toHaveBeenCalled();
  });
});
