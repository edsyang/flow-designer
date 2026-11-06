import type { Setting } from "@flow-designer/model";

export interface ChangeableConfig<T> {
  name: string;
  listen?: (setting: Setting<T>, callback: () => void) => () => void;
  compute(setting: Setting<T>): unknown;
}

export default class Changeable<T> {
  private computed: unknown;

  constructor(
    private setting: Setting<T>,
    private config: ChangeableConfig<T>,
  ) {
    this.compute();
  }

  getName(): string {
    return this.config.name;
  }

  listen(fn: (computed: unknown) => void): () => void {
    this.compute();
    if (!this.config.listen) {
      return () => {
        return;
      };
    }
    return this.config.listen(this.setting, () => {
      this.compute();
      fn(this.computed);
    });
  }

  getComputed(): unknown {
    return this.computed;
  }

  private compute(): void {
    this.computed = this.config.compute(this.setting);
  }
}
