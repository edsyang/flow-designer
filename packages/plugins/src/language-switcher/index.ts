import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { LanguageSwitcher } from "./language-switcher";

const HEADER_LANGUAGE_KEY = "workbench-language";

export function pluginLanguageSwitcher(ctx: IPluginContext): IPluginConfig {
  return {
    name: "plugin-language-switcher",
    dep: [],
    init() {
      ctx.skeleton.header.add({
        key: HEADER_LANGUAGE_KEY,
        area: "header",
        align: "right",
        content: LanguageSwitcher,
      });
    },
    destroy() {
      ctx.skeleton.header.remove(HEADER_LANGUAGE_KEY);
    },
  };
}
