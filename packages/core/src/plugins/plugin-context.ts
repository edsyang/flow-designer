import type { IPluginContext, IPluginManager, IPluginConfig } from "./types";
import type { IGraphManager, ISkeleton } from "@flow-designer/model";
import type { Editor } from "../editor";
import type { Logger } from "../utils";
import { getLogger } from "../utils";

export class PluginContext implements IPluginContext {
  logger!: Logger;
  editor: Editor;
  skeleton: ISkeleton;
  plugins: IPluginManager;

  options: Record<string, unknown>;

  constructor(editor: Editor, plugins: IPluginManager) {
    this.editor = editor;
    this.skeleton = editor.getSkeleton();
    this.plugins = plugins;

    this.options = {};
  }

  get container(): HTMLElement | null {
    return this.editor.getContainer();
  }

  get graph(): IGraphManager | null {
    return this.editor.getGraph();
  }

  setLogger(config: IPluginConfig): void {
    this.logger = getLogger({ level: "log", bizName: `editor:plugin:${config.name}` });
  }
}
