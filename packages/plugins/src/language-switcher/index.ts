import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { LanguageSwitcher } from "./language-switcher";

const HEADER_LANGUAGE_KEY = "workbench-language";

export function pluginLanguageSwitcher(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  return {
    name: "plugin-language-switcher",
    dep: [],
    init() {
      skeleton.header.add({
        key: HEADER_LANGUAGE_KEY,
        area: "header",
        align: "right",
        content: LanguageSwitcher,
      });
    },
    destroy() {
      skeleton.header.remove(HEADER_LANGUAGE_KEY);
    },
  };
}
