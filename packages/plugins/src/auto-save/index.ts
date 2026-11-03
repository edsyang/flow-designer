import type { IPluginConfig, IPluginContext } from "@flow-designer/core";

const DEFAULT_INTERVAL = 30_000;
const DB_NAME = "flow-designer";
const STORE_NAME = "auto-save";
const RECORD_KEY = "current";

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
  };
}
