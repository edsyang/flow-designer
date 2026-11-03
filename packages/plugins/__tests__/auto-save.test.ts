import { afterEach, describe, expect, it, vi } from "vitest";
import type { IPluginContext } from "@flow-designer/core";
import { pluginAutoSave } from "../src/auto-save";

describe("pluginAutoSave", () => {
  it("waits for transaction completion, prevents overlap, and reports aborts", async () => {
    vi.useFakeTimers();
    const put = vi.fn();
    const close = vi.fn();
    const transaction = {
      objectStore: () => ({ put }),
      oncomplete: null,
      onerror: null,
      onabort: null,
      error: new Error("aborted"),
    };
    const db = { transaction: () => transaction, close };
    vi.stubGlobal("indexedDB", {
      open: () => {
        const request = { result: db, onsuccess: null as (() => void) | null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    });
    const data = { id: "document", documentType: "*", documentVersion: "1", elements: [] };
    const logger = { error: vi.fn() };
    const context = {
      editor: { getDocument: () => ({ getData: () => data }) },
      logger,
    } as unknown as IPluginContext;
    const config = pluginAutoSave(context, { interval: 10 });
    config.init?.();
    await vi.advanceTimersByTimeAsync(30);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(data, "current");
    (transaction.onabort as unknown as () => void)();
    await vi.advanceTimersByTimeAsync(0);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to save document to IndexedDB:",
      transaction.error,
    );
    expect(close).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(put).toHaveBeenCalledTimes(2);
    (transaction.oncomplete as unknown as () => void)();
    config.destroy?.();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("logs IndexedDB failures instead of silently ignoring them", async () => {
    vi.useFakeTimers();
    const logger = { error: vi.fn() };
    const content = { getData: vi.fn(() => ({ nodes: [] })) };
    const editor = { getDocument: vi.fn(() => ({ getData: content.getData })) };
    const context = { editor, logger } as unknown as IPluginContext;
    const failure = new Error("IndexedDB unavailable");
    const open = vi.fn(() => {
      throw failure;
    });
    vi.stubGlobal("indexedDB", { open });
    const config = pluginAutoSave(context, { interval: 10 });

    config.init?.();
    await vi.advanceTimersByTimeAsync(10);

    expect(logger.error).toHaveBeenCalledWith("Failed to save document to IndexedDB:", failure);
    config.destroy?.();
  });
});
