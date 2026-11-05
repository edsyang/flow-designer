import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { ThemeSwitcher } from "./theme-switcher";

const HEADER_THEME_KEY = "workbench-theme";

export function pluginTheme(ctx: IPluginContext): IPluginConfig {
  return {
    name: "plugin-theme",
    dep: [],
    init() {
      ctx.skeleton.header.add({
        key: HEADER_THEME_KEY,
        area: "header",
        align: "right",
        content: ThemeSwitcher,
      });
    },
    destroy() {
      ctx.skeleton.header.remove(HEADER_THEME_KEY);
    },
  };
}
