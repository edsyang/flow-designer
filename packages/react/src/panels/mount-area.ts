import type { IArea } from "@flow-designer/skeleton";

import { getLogger } from "@flow-designer/core";
const logger = getLogger({ level: "error", bizName: "workbench:mount" });

/** Own resources acquired by area contributions for this mounted surface. */
export function mountArea(area: IArea, container: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const dispose = () => {
    const errors: unknown[] = [];
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw errors[0];
  };
  try {
    for (const callback of area.getDidMountCallbacks()) {
      const cleanup: unknown = callback(container);
      if (typeof cleanup === "function") cleanups.push(cleanup as () => void);
    }
  } catch (error) {
    try {
      dispose();
    } catch (cleanupError) {
      logger.error("Mount rollback failed:", cleanupError);
    }
    throw error;
  }
  return dispose;
}
