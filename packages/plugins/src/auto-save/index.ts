import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import type { DocumentData } from "@flow-designer/model";

const DEFAULT_INTERVAL = 30_000;
const DB_NAME = "flow-designer";
const STORE_NAME = "auto-save";
const RECORD_KEY = "current";

export interface AutoSaveExports {
  /**
   * Load the stored snapshot into the open document.
   * Resolves `false` (and leaves the document untouched) when nothing was saved.
   */
  restore(): Promise<boolean>;
  /** Delete the stored snapshot. */
  clear(): Promise<void>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function saveToIndexedDB(data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(data, RECORD_KEY);
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Autosave aborted"));
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

async function loadFromIndexedDB(): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Autosave read aborted"));
    };
    tx.oncomplete = () => {
      db.close();
      resolve(request.result ?? null);
    };
  });
}

async function deleteFromIndexedDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Autosave delete aborted"));
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export function pluginAutoSave(
  ctx: IPluginContext,
  options?: { interval?: number },
): IPluginConfig {
  let timer: ReturnType<typeof setInterval> | null = null;
  let saving = false;

  return {
    name: "plugin-auto-save",
    dep: [],
    init() {
      const interval = options?.interval ?? DEFAULT_INTERVAL;
      timer = setInterval(() => {
        if (saving) return;
        saving = true;
        void (async () => {
          try {
            const doc = ctx.editor.getDocument();
            const data = doc.getData();
            await saveToIndexedDB(data);
          } catch (error) {
            ctx.logger.error("Failed to save document to IndexedDB:", error);
          } finally {
            saving = false;
          }
        })();
      }, interval);
    },
    destroy() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    exports(): AutoSaveExports {
      return {
        async restore(): Promise<boolean> {
          const data = (await loadFromIndexedDB()) as DocumentData | null;
          if (!data) return false;
          ctx.editor.getDocument().load(data);
          ctx.logger.info("Restored the document from the IndexedDB autosave snapshot.");
          return true;
        },
        async clear(): Promise<void> {
          await deleteFromIndexedDB();
        },
      };
    },
  };
}
