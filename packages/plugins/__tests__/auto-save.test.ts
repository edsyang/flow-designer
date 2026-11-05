import { afterEach, describe, expect, it, vi } from "vitest";
import type { IPluginContext } from "@flow-designer/core";
import { pluginAutoSave, type AutoSaveExports } from "../src/auto-save";

function createSnapshotDatabase(initial: Record<string, unknown> = {}) {
  const records = new Map(Object.entries(initial));
  const puts = vi.fn();
  const deletes = vi.fn();
  const close = vi.fn();
  const transaction = () => {
    const tx = {
      objectStore: () => ({
        put: (value: unknown, key: string) => {
          records.set(key, value);
          puts(value, key);
        },
        get: (key: string) => ({ result: records.get(key) }),
        delete: (key: string) => {
          records.delete(key);
          deletes(key);
        },
      }),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null as Error | null,
    };
    queueMicrotask(() => {
      tx.oncomplete?.();
    });
    return tx;
  };
  const db = { transaction, close };
  vi.stubGlobal("indexedDB", {
    open: () => {
      const request = {
        result: db,
        onsuccess: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => {
        request.onsuccess?.();
      });
      return request;
    },
  });
  return { records, puts, deletes, close };
}

const snapshot = { id: "main", documentType: "*", documentVersion: "1.0.0", props: {}, nodes: [] };

function createContext(load: (value: unknown) => void) {
  return {
    editor: { getDocument: () => ({ load }) },
    logger: { error: vi.fn(), info: vi.fn() },
  } as unknown as IPluginContext;
}

function exportsOf(config: ReturnType<typeof pluginAutoSave>): AutoSaveExports {
  return config.exports?.() as AutoSaveExports;
}

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

  it("restores the stored snapshot into the open document", async () => {
    const database = createSnapshotDatabase({ current: snapshot });
    const load = vi.fn();
    const config = pluginAutoSave(createContext(load));

    await expect(exportsOf(config).restore()).resolves.toBe(true);

    expect(load).toHaveBeenCalledWith(snapshot);
    expect(database.close).toHaveBeenCalled();
  });

  it("leaves the document untouched when no snapshot was stored", async () => {
    createSnapshotDatabase();
    const load = vi.fn();
    const config = pluginAutoSave(createContext(load));

    await expect(exportsOf(config).restore()).resolves.toBe(false);

    expect(load).not.toHaveBeenCalled();
  });

  it("clears the stored snapshot so a later restore has nothing to apply", async () => {
    const database = createSnapshotDatabase({ current: snapshot });
    const load = vi.fn();
    const config = pluginAutoSave(createContext(load));
    const exports = exportsOf(config);

    await exports.clear();

    expect(database.deletes).toHaveBeenCalledWith("current");
    expect(database.records.has("current")).toBe(false);
    await expect(exports.restore()).resolves.toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
});
