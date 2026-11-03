import type { IPlugin, IPluginManager, IPluginConfig } from "./types";
import { EventEmitter } from "eventemitter3";
import type { Logger } from "../utils";
import { getLogger, invariant } from "../utils";

export class EditorPlugin implements IPlugin {
  config: IPluginConfig;

  logger: Logger;

  private manager: IPluginManager;

  private options?: any;

  private emitter: EventEmitter;

  private _inited = false;

  private _disabled = false;

  constructor(manager: IPluginManager, config: IPluginConfig, options: any = {}) {
    this.manager = manager;
    this.config = config;
    this.options = options;
    this.emitter = new EventEmitter();
    this.logger = getLogger({ level: "warn", bizName: `designer:plugin:${config.name}` });
  }

  get name() {
    return this.config.name;
  }

  get dep() {
    if (typeof this.config.dep === "string") return [this.config.dep];
    return this.config.dep || [];
  }

  get disabled() {
    return this._disabled;
  }

  on(event: string | symbol, listener: (...args: any[]) => void): any {
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }

  emit(event: string | symbol, ...args: any[]) {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(event: string | symbol): any {
    return this.emitter.removeAllListeners(event);
  }

  isInited() {
    return this._inited;
  }

  async init(forceInit?: boolean) {
    if (this._inited && !forceInit) return;
    this.logger.log("method init called");
    try {
      await this.config.init?.call(undefined);
      this._inited = true;
    } catch (error) {
      try {
        await this.config.destroy?.call(undefined);
      } catch (cleanupError) {
        this.logger.error("Failed to clean up plugin after initialization error:", cleanupError);
      }
      throw error;
    }
  }

  async destroy() {
    if (!this._inited) return;
    this.logger.log("method destroy called");
    try {
      await this.config?.destroy?.call(undefined);
    } finally {
      this._inited = false;
    }
  }

  setDisabled(flag = true) {
    this._disabled = flag;
  }

  toProxy() {
    invariant(this._inited, "Could not call toProxy before init");
    const exports = this.config.exports?.();
    return new Proxy(this, {
      get(target, prop, receiver) {
        if ({}.hasOwnProperty.call(exports, prop)) {
          return exports?.[prop as string];
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async dispose() {
    await this.manager.delete(this.name);
  }
}
