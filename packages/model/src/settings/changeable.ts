import Setting from './setting';

export interface ChangeableConfig<T> {
  name: string;
  listen?: (setting: Setting<T>, callback: () => void) => () => void;
  compute(setting: Setting<T>): any;
}

export default class Changeable<T> {
  private computed: any;

  constructor(private setting: Setting<T>, private config: ChangeableConfig<T>) {
  }

  getName(): string {
    return this.config.name;
  }

  listen(fn: (computed: any) => void): () => void {
    this.compute();
    if (!this.config.listen) {
      return () => { return; };
    }
    return this.config.listen(this.setting, () => {
      this.compute();
      fn(this.computed);
    });
  }

  getComputed(): any {
    return this.computed;
  }

  private compute(): void {
    this.computed = this.config.compute(this.setting);
    return this.computed;
  }
}
