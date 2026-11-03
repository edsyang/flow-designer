import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { CanvasHelp } from "./canvas-help";

const HEADER_HELP_KEY = "workbench-help";

export function pluginCanvasHelp(ctx: IPluginContext): IPluginConfig {
  return {
    name: "plugin-canvas-help",
    dep: [],
    init() {
      ctx.skeleton.header.add({
        key: HEADER_HELP_KEY,
        area: "header",
        align: "right",
        content: CanvasHelp,
      });
    },
    destroy() {
      ctx.skeleton.header.remove(HEADER_HELP_KEY);
    },
  };
}
