import type { CommandRegistry } from "../command";
import type { NotificationCenter } from "../notifications";
import type { ShortcutPort } from "../shortcuts";
import type { RegistrySet, Signal } from "@flow-designer/model";
import type { GraphPort } from "../graph-contracts";
import type { Editor } from "../editor";
import type { Logger } from "../utils";

export interface IPluginContext {
  readonly commands: CommandRegistry;
  readonly notifications: NotificationCenter;
  readonly shortcuts: ShortcutPort;
  readonly registries: RegistrySet;
  readonly events: Signal;
  editor: Editor;
  plugins: IPluginManager;
  graph: GraphPort | null;
  container: HTMLElement | null;
  options: Record<string, unknown>;
  logger: Logger;
}

export interface IPluginManagerCore {
  register(pluginConfigCreator: PluginCreator, pluginOptions?: any, options?: any): Promise<void>;
  get(pluginName: string): IPlugin | undefined;
  getAll(): IPlugin[];
  has(pluginName: string): boolean;
  delete(pluginName: string): Promise<boolean>;
  setDisabled(pluginName: string, flag: boolean): void;
  dispose(): Promise<void>;
}

interface IPluginManagerPluginAccessor {
  [pluginName: string]: IPlugin | any;
}

export type IPluginManager = IPluginManagerCore & IPluginManagerPluginAccessor;

export interface RegisterOptions {
  autoInit?: boolean;
}

export interface IPluginConfig {
  name: string;
  dep?: string[];
  init?(): void | Promise<void>;
  destroy?(): void | Promise<void>;
  exports?(): any;
}

export type PluginCreator = (ctx: IPluginContext, pluginOptions?: any) => IPluginConfig;

export interface IPluginCore {
  name: string;
  dep: string[];
  disabled: boolean;
  config: IPluginConfig;
  on(event: string | symbol, listener: (...args: any[]) => void): any;
  emit(event: string | symbol, ...args: any[]): boolean;
  removeAllListeners(event?: string | symbol): this;
  init(forceInit?: boolean): Promise<void>;
  isInited(): boolean;
  destroy(): Promise<void>;
  toProxy(): any;
  setDisabled(flag: boolean): void;
}

interface IPluginExportsAccessor {
  [propName: string]: any;
}

export type IPlugin = IPluginCore & IPluginExportsAccessor;
