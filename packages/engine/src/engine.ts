import { defaultRegistries } from "@flow-designer/model";
import type { NodeDefinitionBundle } from "@flow-designer/skeleton";
import type { RegistrySet } from "@flow-designer/model";
import type { ResourceDisposer } from "@flow-designer/core";
import { Editor, PluginManager, DisposableScope, CleanupError } from "@flow-designer/core";
import { Skeleton, bindSkeleton } from "@flow-designer/skeleton";

export class Engine {
  readonly editor: Editor;
  readonly skeleton: Skeleton;
  readonly plugins: PluginManager;
  private destruction: Promise<void> | null = null;
  readonly registries: RegistrySet;
  private resources = new DisposableScope();

  constructor(registries?: RegistrySet) {
    this.registries = registries ?? defaultRegistries.fork();
    if (!registries)
      this.addDisposer(() => {
        this.registries.dispose();
      });
    this.editor = new Editor({ registries: this.registries });
    this.addDisposer(() => {
      this.editor.dispose();
    });
    this.skeleton = new Skeleton();
    this.addDisposer(() => {
      this.skeleton.ui.dispose();
    });
    this.addDisposer(bindSkeleton(this.editor, this.skeleton));
    this.plugins = new PluginManager(this.editor);
    this.editor.setPlugins(this.plugins);
  }

  get definitions() {
    return { prototypes: this.registries.prototypes, ui: this.skeleton.ui };
  }

  registerNodeDefinition(bundle: NodeDefinitionBundle): () => void {
    const release = this.skeleton.ui.register(bundle, this.registries.prototypes);
    this.addDisposer(release);
    return release;
  }

  addDisposer(dispose: ResourceDisposer): () => Promise<void> {
    return this.resources.add(dispose);
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
      if (error instanceof CleanupError) errors.push(...error.errors);
      else errors.push(error);
    }
    try {
      if (this.editor.hasDocument()) this.editor.getDocument().destroy();
    } catch (error) {
      if (error instanceof CleanupError) errors.push(...error.errors);
      else errors.push(error);
    }
    this.editor.setGraph(null);
    this.editor.setContainer(null);
    try {
      await this.resources.dispose();
    } catch (error) {
      if (error instanceof CleanupError) errors.push(...error.errors);
      else errors.push(error);
    }
    if (errors.length) throw new CleanupError(errors);
  }
}
