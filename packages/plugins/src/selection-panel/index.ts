import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { SettingsRenderer } from "./settings-renderer";

export function pluginSelectionPanel(ctx: IPluginContext): IPluginConfig {
  return {
    name: "plugin-selection-panel",
    dep: ["plugin-x6-graph"],
    init() {
      ctx.skeleton.inspector.add({
        key: "selection-panel",
        area: "inspector",
        content: SettingsRenderer,
      });
    },
    destroy() {
      ctx.skeleton.inspector.remove("selection-panel");
    },
  };
}
