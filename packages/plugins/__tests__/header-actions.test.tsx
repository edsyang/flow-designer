import { bindSkeleton } from "@flow-designer/skeleton";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Document, GenericContent, contentTypesRegistry } from "@flow-designer/model";
import { setLocale } from "@flow-designer/i18n";
import { Editor } from "@flow-designer/core";
import type { GraphApplicationEvent, IPluginContext } from "@flow-designer/core";
import { Skeleton } from "@flow-designer/skeleton";
import { Workbench } from "@flow-designer/react";
import type { WorkbenchProps } from "@flow-designer/react";
import { pluginCanvasHelp } from "../src/canvas-help";
import { pluginLanguageSwitcher } from "../src/language-switcher";

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
  const ctx = { editor } as IPluginContext;
  const help = pluginCanvasHelp(ctx);
  const language = pluginLanguageSwitcher(ctx);
  help.init?.();
  language.init?.();
  return {
    editor,
    skeleton,
    engine: { editor, skeleton } as unknown as WorkbenchProps["engine"],
    destroyPlugins: () => {
      help.destroy?.();
      language.destroy?.();
    },
  };
}

describe("plugin header actions", () => {
  it("cleans the acquired skeleton even after its editor is rebound", () => {
    const editor = new Editor();
    const original = new Skeleton(),
      replacement = new Skeleton();
    const release = bindSkeleton(editor, original);
    const plugin = pluginLanguageSwitcher({ editor } as IPluginContext);
    plugin.init?.();
    release();
    const releaseReplacement = bindSkeleton(editor, replacement);
    replacement.header.add({ key: "workbench-language", area: "header", content: "replacement" });
    plugin.destroy?.();
    expect(original.header.getItems()).toEqual([]);
    expect(replacement.header.getItems()).toHaveLength(1);
    releaseReplacement();
  });
  it("switches the workbench language through the independently registered language plugin", async () => {
    const engine = fixture();
    await setLocale("zh-CN");
    const { unmount } = render(<Workbench engine={engine.engine} />);

    fireEvent.click(screen.getByRole("button", { name: "语言" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "英语" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Language" })).toBeTruthy();
      expect(document.documentElement.lang).toBe("en-US");
    });

    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Simplified Chinese" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "语言" })).toBeTruthy();
      expect(document.documentElement.lang).toBe("zh-CN");
    });

    unmount();
    engine.destroyPlugins();
  });

  it("shows help only after graph readiness and restores focus after dismissal", async () => {
    const engine = fixture();
    const { unmount } = render(<Workbench engine={engine.engine} />);
    expect(screen.queryByRole("button", { name: "操作帮助" })).toBeNull();
    const listeners = new Set<(event: GraphApplicationEvent) => void>();
    act(() => {
      engine.editor.setGraph({
        getInteractionMode: () => "select",
        subscribeEvents: (listener: (event: GraphApplicationEvent) => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      } as unknown as NonNullable<ReturnType<Editor["getGraph"]>>);
    });
    const help = await screen.findByRole("button", { name: "操作帮助" });
    help.focus();
    fireEvent.click(help);

    const dialog = screen.getByRole("dialog", { name: "画布操作帮助" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.textContent).toContain("Space");
    fireEvent.keyDown(dialog, { key: "Escape", keyCode: 27 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(help));
    expect(listeners.size).toBeGreaterThan(0);

    unmount();
    expect(listeners.size).toBe(0);
    engine.destroyPlugins();
  });
});
