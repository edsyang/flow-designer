import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { SettingsRenderer } from "./settings-renderer";

export function pluginSelectionPanel(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  return {
    name: "plugin-selection-panel",
    dep: ["plugin-x6-graph"],
    init() {
      skeleton.inspector.add({
        key: "selection-panel",
        area: "inspector",
        content: SettingsRenderer,
      });
    },
    destroy() {
      skeleton.inspector.remove("selection-panel");
    },
  };
}
