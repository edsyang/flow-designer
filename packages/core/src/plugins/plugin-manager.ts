import type { RegisterOptions, IPluginManager, IPlugin, PluginCreator } from "./types";
import { PluginContext } from "./plugin-context";
import type { Editor } from "../editor";
import { EditorPlugin } from "./plugin";
import { invariant, getLogger } from "../utils";
import sequencify from "./sequencify";

const logger = getLogger({ level: "warn", bizName: "editor:pluginManager" });

export class PluginManager implements IPluginManager {
  private plugins: IPlugin[] = [];

  private pluginsMap: Map<string, IPlugin> = new Map();

  private editor: Editor;

  constructor(editor: Editor) {
    this.editor = editor;
  }

  private _getLowCodePluginContext() {
    return new PluginContext(this.editor, this);
  }

  async register(
    pluginConfigCreator: PluginCreator,
    pluginOptions?: any,
    options?: RegisterOptions,
  ): Promise<void> {
    const ctx = this._getLowCodePluginContext();
    const config = pluginConfigCreator(ctx, pluginOptions);
    invariant(config.name, `${config.name} required`, config);
    ctx.setLogger(config);
    const plugin = new EditorPlugin(this, config, pluginOptions);

    if (this.has(plugin.name)) {
      await this.delete(plugin.name);
    }

    if (options?.autoInit) {
      await plugin.init();
    }

    this.plugins.push(plugin);
    this.pluginsMap.set(plugin.name, plugin);
    logger.log("plugin registered with config:", config, ", options:", pluginOptions);
  }

  get(pluginName: string): IPlugin | undefined {
    return this.pluginsMap.get(pluginName);
  }

  getAll(): IPlugin[] {
    return this.plugins.slice();
  }

  has(pluginName: string): boolean {
    return this.pluginsMap.has(pluginName);
  }

  async delete(pluginName: string): Promise<boolean> {
    const idx = this.plugins.findIndex((plugin) => plugin.name === pluginName);
    if (idx === -1) return false;
    const plugin = this.plugins[idx];
    try {
      if (plugin) {
        await plugin.destroy();
      }
    } finally {
      this.plugins.splice(idx, 1);
      this.pluginsMap.delete(pluginName);
    }
    return true;
  }

  async init() {
    const pluginNames: string[] = [];
    const pluginObj: { [name: string]: IPlugin } = {};
    this.plugins.forEach((plugin) => {
      pluginNames.push(plugin.name);
      pluginObj[plugin.name] = plugin;
    });
    const { missingTasks, sequence } = sequencify(pluginObj, pluginNames);
    invariant(!missingTasks.length, "plugin dependency missing", missingTasks);
    logger.log("load plugin sequence:", sequence);

    const initialized: IPlugin[] = [];
    for (const pluginName of sequence) {
      const plugin = this.pluginsMap.get(pluginName)!;
      try {
        await plugin.init();
        initialized.push(plugin);
      } catch (error) {
        logger.error(
          `Failed to initialize plugin "${pluginName}"; stopping plugin initialization.`,
          error,
        );
        for (const initializedPlugin of initialized.reverse()) {
          try {
            await initializedPlugin.destroy();
          } catch (cleanupError) {
            logger.error(
              `Failed to clean up plugin "${initializedPlugin.name}" after initialization failure.`,
              cleanupError,
            );
          }
        }
        throw error;
      }
    }
  }

  async destroy() {
    let firstError: unknown;
    let hasError = false;
    for (const plugin of [...this.plugins].reverse()) {
      try {
        await plugin.destroy();
      } catch (error) {
        if (!hasError) {
          firstError = error;
          hasError = true;
        }
        logger.error(`Failed to destroy plugin "${plugin.name}".`, error);
      }
    }
    if (hasError) {
      throw firstError;
    }
  }

  get size() {
    return this.pluginsMap.size;
  }

  toProxy() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (target.pluginsMap.has(prop as string)) {
          if (target.pluginsMap.get(prop as string)!.disabled) {
            return undefined;
          }
          return target.pluginsMap.get(prop as string)?.toProxy();
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  setDisabled(pluginName: string, flag = true) {
    logger.warn(`plugin:${pluginName} has been set disable:${flag}`);
    this.pluginsMap.get(pluginName)?.setDisabled(flag);
  }

  async dispose() {
    try {
      await this.destroy();
    } finally {
      this.plugins = [];
      this.pluginsMap.clear();
    }
  }
}
