import { Editor, PluginManager } from "@flow-designer/core";
import { Skeleton, bindSkeleton } from "@flow-designer/skeleton";

export class Engine {
  readonly editor: Editor;
  readonly skeleton: Skeleton;
  readonly plugins: PluginManager;
  private destruction: Promise<void> | null = null;
  private disposers: Array<() => void> = [];

  constructor() {
    this.editor = new Editor();
    this.skeleton = new Skeleton();
    this.addDisposer(bindSkeleton(this.editor, this.skeleton));
    this.plugins = new PluginManager(this.editor);
    this.editor.setPlugins(this.plugins);
  }

  addDisposer(dispose: () => void): void {
    this.disposers.push(dispose);
  }

  destroy(): Promise<void> {
    this.destruction ??= this.disposeResources();
    return this.destruction;
  }

  private async disposeResources(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.plugins.dispose();
    } catch (error) {
      errors.push(error);
    }
    this.editor.setGraph(null);
    this.editor.setContainer(null);
    try {
      this.editor.getDocument().destroy();
    } catch (error) {
      errors.push(error);
    }
    for (const dispose of this.disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw errors[0];
  }
}
