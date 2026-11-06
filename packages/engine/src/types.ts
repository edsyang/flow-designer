import type { GraphOptions, GraphAdapterPort } from "@flow-designer/graph";
import type { ContentTransformer, SettingConfig } from "@flow-designer/model";
import type { Locale, Messages } from "@flow-designer/i18n";
import type { PluginCreator, Editor, IPluginManager } from "@flow-designer/core";
import type { Engine } from "./engine";
import type { Document } from "@flow-designer/model";

export interface DesignerOptions {
  container?: HTMLElement;
  documentType: string;
  documentVersion: string;
  graphOptions?: GraphOptions;
  plugins?: PluginCreator[];
  disableBuiltinPlugins?: string[];
  disableBuiltinSetters?: boolean;
  autoSave?: boolean | { interval?: number };
  unsavedPrompt?: boolean;
  transformers?: ContentTransformer[];
  docSettings?: Array<SettingConfig<Document>>;
  localeMessages?: Partial<Record<Locale, Messages>>;
}

export interface Designer {
  engine: Engine;
  editor: Editor;
  document: Document;
  graph: GraphAdapterPort | null;
  plugins: IPluginManager;
  destroy(): Promise<void>;
}
