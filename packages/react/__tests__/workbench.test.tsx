import { bindSkeleton } from "@flow-designer/skeleton";
import { useEffect } from "react";
import { act, render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { observer } from "mobx-react-lite";
import {
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
} from "@flow-designer/model";
import { initializeI18n } from "@flow-designer/i18n";
import { Editor } from "@flow-designer/core";
import { Skeleton } from "@flow-designer/skeleton";
import { Workbench } from "../src/workbench";
import { useSelection, useSkeleton } from "../src/hooks";
import type { WorkbenchProps } from "../src/types";

await initializeI18n();

beforeAll(() => {
  if (!contentTypesRegistry.getSuitableContentType("*"))
    contentTypesRegistry.register(GenericContent);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});
afterEach(cleanup);

function fixture() {
  const editor = new Editor();
  const skeleton = new Skeleton();
  bindSkeleton(editor, skeleton);
  const doc = new Document({ id: "test", documentType: "*", documentVersion: "1.0.0" });
  editor.setDocument(doc);
  return { editor, skeleton, doc };
}

describe("workbench panels", () => {
  it("renders only actions contributed to the header area", () => {
    const engine = fixture();
    render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
    expect(screen.queryByRole("button", { name: "操作帮助" })).toBeNull();
    expect(screen.queryByRole("button", { name: "语言" })).toBeNull();
  });

  it("keeps contextual observers alive when the inspector hides so a later selection reopens it", () => {
    const engine = fixture();
    const ContextualContent = observer(function ContextualContent() {
      const { keys } = useSelection();
      const skeleton = useSkeleton();
      useEffect(() => {
        skeleton.inspector.setVisible(keys.length > 0);
      }, [keys.length, skeleton]);
      return <span>Selected {keys.join(",")}</span>;
    });
    engine.skeleton.inspector.add({
      key: "context",
      area: "inspector",
      content: ContextualContent,
    });
    const { container } = render(
      <Workbench engine={engine as unknown as WorkbenchProps["engine"]} />,
    );
    const inspector = container.querySelector('[data-fd-area="inspector"]') as HTMLElement;
    expect(inspector.hidden).toBe(true);
    act(() => engine.doc.getSelection().setKeys(["later-node"]));
    expect(inspector.hidden).toBe(false);
    expect(screen.getByText("Selected later-node")).toBeTruthy();
  });

  it("collapses and restores the node library without dropping its content", () => {
    const engine = fixture();
    engine.skeleton.sidebar.add({
      key: "library",
      area: "sidebar",
      content: () => <input aria-label="library state" defaultValue="retained" />,
    });
    const { container } = render(
      <Workbench engine={engine as unknown as WorkbenchProps["engine"]} />,
    );
    const workspace = container.querySelector('[data-fd-layout="canvasWorkspace"]');
    expect(container.querySelector('[data-fd-area="sidebar"]')?.parentElement).toBe(workspace);
    expect(container.querySelector('[data-fd-area="canvas"]')?.parentElement?.parentElement).toBe(
      workspace,
    );
    fireEvent.click(screen.getByRole("button", { name: "节点库" }));
    expect(screen.getByRole("button", { name: "展开节点库" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "展开节点库" }));
    expect((screen.getByRole("textbox", { name: "library state" }) as HTMLInputElement).value).toBe(
      "retained",
    );
  });

  it("does not render selection action popups or redundant counts", () => {
    const engine = fixture();
    render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
    expect(screen.queryByText(/个节点/)).toBeNull();
    act(() => engine.doc.getSelection().setKeys(["selected-node"]));
    expect(screen.queryByText(/项已选/)).toBeNull();
    expect(screen.queryByRole("toolbar", { name: "选中项操作" })).toBeNull();
    expect(screen.queryByRole("button", { name: "取消选择" })).toBeNull();
    expect(engine.doc.getSelection().getKeys()).toEqual(["selected-node"]);
  });

  it("uses one interaction toggle that starts in pan mode", () => {
    let mode: "select" | "pan" = "pan";
    const graph = {
      getInteractionMode: () => mode,
      setInteractionMode: vi.fn((next: "select" | "pan") => {
        mode = next;
      }),
      on: vi.fn(),
      off: vi.fn(),
    };
    const engine = fixture();
    act(() =>
      engine.editor.setGraph(graph as unknown as NonNullable<ReturnType<Editor["getGraph"]>>),
    );
    render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);

    const toggle = screen.getByRole("button", { name: "平移工具" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(
      within(screen.getByRole("group", { name: "画布交互" })).getAllByRole("button"),
    ).toHaveLength(1);
    fireEvent.click(toggle);
    expect(graph.setInteractionMode).toHaveBeenCalledWith("select");
  });

  it("opens quick add with stencil shape icons and keeps the inspector collapsed after closing", async () => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    const graph = {
      getInteractionMode: () => "pan",
      getEdgeTypeName: () => null,
      clientToLocal: vi.fn((x: number, y: number) => ({ x, y })),
      localToClient: vi.fn((x: number, y: number) => ({ x, y })),
      select: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const listeners = handlers.get(event) ?? new Set();
        listeners.add(handler);
        handlers.set(event, listeners);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.get(event)?.delete(handler);
      }),
    };
    const engine = fixture();
    prototypeRegistry.register({
      name: "Configured double-click",
      typeName: "workbench-double-click",
      view: { type: "node", shape: "fd-rect" },
      props: [{ name: "label", defaultValue: "" }],
      settings: [{ name: "label", setter: "StringSetter" }],
    });
    const configuredNode = await engine.doc
      .getContent()
      .addNode({ type: "workbench-double-click" });
    engine.skeleton.inspector.add({
      key: "settings",
      area: "inspector",
      content: () => <input aria-label="node property" />,
    });
    act(() =>
      engine.editor.setGraph(graph as unknown as NonNullable<ReturnType<Editor["getGraph"]>>),
    );
    render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
    act(() => engine.doc.getSelection().setKeys([configuredNode.getId()]));
    expect(screen.getByRole("textbox", { name: "node property" })).toBeTruthy();

    const doubleClick = () =>
      handlers.get("blank:dblclick")?.forEach((handler) => {
        handler({ e: { clientX: 100, clientY: 100 } });
      });
    act(doubleClick);
    expect(screen.getByRole("button", { name: "展开属性" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "node property" })).toBeNull();
    const dialog = screen.getByRole("dialog", { name: "添加节点" });
    expect(dialog.querySelector("input")?.className).toContain("ant-input");
    expect(dialog.querySelectorAll("[data-quick-add-option]")[0]?.className).toContain(
      "canvasQuickAddOption",
    );
    expect(
      dialog.querySelectorAll("[data-quick-add-option]")[0]?.querySelector("span")?.className,
    ).toContain("canvasQuickAddShape");
    act(() => engine.doc.getSelection().setKeys([]));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.getByRole("button", { name: "展开属性" })).toBeTruthy();
    expect(engine.doc.getSelection().getKeys()).toEqual([]);
    expect(screen.queryByRole("textbox", { name: "node property" })).toBeNull();
  });

  it("opens configured node properties on selection while retaining manual collapse for that selection", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("1000px"),
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    try {
      prototypeRegistry.register({
        name: "Configured",
        typeName: "workbench-configured",
        view: { type: "node" },
        props: [{ name: "label", defaultValue: "" }],
        settings: [{ name: "label", setter: "StringSetter" }],
      });
      const engine = fixture();
      const first = await engine.doc.getContent().addNode({ type: "workbench-configured" });
      const second = await engine.doc.getContent().addNode({ type: "workbench-configured" });
      engine.skeleton.inspector.add({
        key: "settings",
        area: "inspector",
        content: () => <input aria-label="node property" />,
      });
      render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
      expect(screen.getByRole("button", { name: "展开属性" })).toBeTruthy();
      act(() => engine.doc.getSelection().setKeys([first.getId()]));
      expect(screen.getByRole("textbox", { name: "node property" })).toBeTruthy();
      const collapse = screen.getByRole("button", { name: "收起属性" });
      expect(collapse.textContent).toBe("");
      expect(collapse.querySelector("svg")).toBeTruthy();
      fireEvent.click(collapse);
      expect(screen.queryByRole("textbox", { name: "node property" })).toBeNull();
      act(() => engine.doc.getSelection().setKeys([second.getId()]));
      expect(screen.getByRole("textbox", { name: "node property" })).toBeTruthy();
    } finally {
      matchMedia.mockRestore();
    }
  });

  it("preserves the narrow inspector collapse choice through later selections", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query.includes("1000px"),
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    try {
      const engine = fixture();
      engine.skeleton.inspector.add({
        key: "settings",
        area: "inspector",
        content: () => <input aria-label="retained property" defaultValue="retained" />,
      });
      render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
      const expand = screen.getByRole("button", { name: "展开属性" });
      expect(expand.getAttribute("aria-expanded")).toBe("false");
      const contentId = expand.getAttribute("aria-controls")!;
      expect(document.getElementById(contentId)?.hidden).toBe(true);
      act(() => engine.doc.getSelection().setKeys(["later"]));
      expect(screen.getByRole("button", { name: "展开属性" })).toBeTruthy();
      fireEvent.click(expand);
      expect(
        (screen.getByRole("textbox", { name: "retained property" }) as HTMLInputElement).value,
      ).toBe("retained");
      fireEvent.click(screen.getByRole("button", { name: "收起属性" }));
      expect(document.getElementById(contentId)?.hidden).toBe(true);
    } finally {
      matchMedia.mockRestore();
    }
  });

  it("opens the inspector for edge selections and leaves node double clicks alone", () => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    const graph = {
      getInteractionMode: () => "pan",
      getEdgeTypeName: (id: string) => (id === "edge-1" ? "sequence-flow" : null),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const listeners = handlers.get(event) ?? new Set();
        listeners.add(handler);
        handlers.set(event, listeners);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.get(event)?.delete(handler);
      }),
    };
    const engine = fixture();
    engine.skeleton.inspector.add({
      key: "settings",
      area: "inspector",
      content: () => <input aria-label="edge property" />,
    });
    act(() =>
      engine.editor.setGraph(graph as unknown as NonNullable<ReturnType<Editor["getGraph"]>>),
    );
    render(<Workbench engine={engine as unknown as WorkbenchProps["engine"]} />);
    expect(screen.getByRole("button", { name: "展开属性" })).toBeTruthy();

    act(() => engine.doc.getSelection().setKeys(["edge-1"]));
    expect(screen.getByRole("textbox", { name: "edge property" })).toBeTruthy();
    expect(graph.on).not.toHaveBeenCalledWith("node:dblclick", expect.any(Function));
    expect(graph.on).not.toHaveBeenCalledWith("edge:dblclick", expect.any(Function));
    expect(graph.off).not.toHaveBeenCalledWith("node:dblclick", expect.any(Function));
  });
});
