export class CleanupError extends Error {
  readonly errors: readonly unknown[];
  constructor(errors: readonly unknown[]) {
    super(`Failed to clean up ${String(errors.length)} resource(s)`);
    this.name = "CleanupError";
    this.errors = [...errors];
  }
}
export type ResourceDisposer = () => void | Promise<void>;
/** Reverse-order ownership; every registered resource is attempted despite cleanup failure. */
export class DisposableScope {
  private tasks: Array<() => Promise<void>> = [];
  private destruction: Promise<void> | null = null;
  private closed = false;
  add(disposer: ResourceDisposer): () => Promise<void> {
    if (this.closed) throw new Error("Disposable scope has been closed");
    let release: Promise<void> | null = null;
    const dispose = () => {
      release ??= Promise.resolve().then(disposer);
      return release;
    };
    this.tasks.push(dispose);
    return dispose;
  }
  dispose(): Promise<void> {
    if (!this.destruction) {
      this.closed = true;
      const tasks = this.tasks.splice(0).reverse();
      this.destruction = (async () => {
        const errors: unknown[] = [];
        for (const task of tasks) {
          try {
            await task();
          } catch (error) {
            if (error instanceof CleanupError) errors.push(...error.errors);
            else errors.push(error);
          }
        }
        if (errors.length) throw new CleanupError(errors);
      })();
    }
    return this.destruction;
  }
}
