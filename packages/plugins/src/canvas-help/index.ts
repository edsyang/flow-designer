import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { CanvasHelp } from "./canvas-help";

const HEADER_HELP_KEY = "workbench-help";

export function pluginCanvasHelp(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  return {
    name: "plugin-canvas-help",
    dep: [],
    init() {
      skeleton.header.add({
        key: HEADER_HELP_KEY,
        area: "header",
        align: "right",
        content: CanvasHelp,
      });
    },
    destroy() {
      skeleton.header.remove(HEADER_HELP_KEY);
    },
  };
}
