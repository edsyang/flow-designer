import type { IPluginContext, IPluginManager, IPluginConfig } from "./types";
import type { GraphPort } from "../graph-contracts";
import type { Editor } from "../editor";
import type { Logger } from "../utils";
import { getLogger } from "../utils";

export class PluginContext implements IPluginContext {
  logger!: Logger;
  editor: Editor;
  plugins: IPluginManager;

  options: Record<string, unknown>;

  constructor(editor: Editor, plugins: IPluginManager) {
    this.editor = editor;
    this.plugins = plugins;

    this.options = {};
  }

  get container(): HTMLElement | null {
    return this.editor.getContainer();
  }

  get graph(): GraphPort | null {
    return this.editor.getGraph();
  }

  setLogger(config: IPluginConfig): void {
    this.logger = getLogger({ level: "log", bizName: `editor:plugin:${config.name}` });
  }
}
