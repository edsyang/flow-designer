import type { ISkeleton, GraphOptions, ContentTransformer, IGraphManager, SettingConfig } from '@flow-designer/model';
import type { PluginCreator, Editor, IPluginManager } from '@flow-designer/core';
import type { Engine } from './engine';
import type { Document } from '@flow-designer/model';

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
}

export interface Designer {
  engine: Engine;
  editor: Editor;
  document: Document;
  graph: IGraphManager | null;
  plugins: IPluginManager;
  destroy(): Promise<void>;
}
