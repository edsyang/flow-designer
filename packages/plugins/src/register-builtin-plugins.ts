import type { GraphOptions } from "@flow-designer/graph";
import type { IPluginManager, PluginCreator } from "@flow-designer/core";

import { pluginX6Graph } from "./x6-graph";
import { pluginZoom } from "./zoom";
import { pluginUndoRedo } from "./undo-redo";
import { pluginCopyPaste } from "./copy-paste";
import { pluginDelete } from "./delete";
import { pluginStencilPanel } from "./stencil-panel";
import { pluginSelectionPanel } from "./selection-panel";
import { pluginDebugLoader } from "./debug-loader";
import { pluginSchemaViewer } from "./schema-viewer";
import { pluginCanvasHelp } from "./canvas-help";
import { pluginLanguageSwitcher } from "./language-switcher";
import { pluginTheme } from "./theme";

const BUILTIN_PLUGINS: Array<{ name: string; creator: PluginCreator }> = [
  { name: "plugin-x6-graph", creator: pluginX6Graph },
  { name: "plugin-zoom", creator: pluginZoom },
  { name: "plugin-undo-redo", creator: pluginUndoRedo },
  { name: "plugin-copy-paste", creator: pluginCopyPaste },
  { name: "plugin-delete", creator: pluginDelete },
  { name: "plugin-stencil-panel", creator: pluginStencilPanel },
  { name: "plugin-selection-panel", creator: pluginSelectionPanel },
  { name: "plugin-debug-loader", creator: pluginDebugLoader },
  { name: "plugin-schema-viewer", creator: pluginSchemaViewer },
  { name: "plugin-canvas-help", creator: pluginCanvasHelp },
  { name: "plugin-language-switcher", creator: pluginLanguageSwitcher },
  { name: "plugin-theme", creator: pluginTheme },
];

export async function registerBuiltinPlugins(
  pluginManager: IPluginManager,
  disableList?: string[],
  graphOptions?: GraphOptions,
): Promise<void> {
  const disabled = new Set(disableList);
  for (const { name, creator } of BUILTIN_PLUGINS) {
    if (!disabled.has(name)) {
      const options = name === "plugin-x6-graph" ? graphOptions : undefined;
      await pluginManager.register(creator, options);
    }
  }
}
