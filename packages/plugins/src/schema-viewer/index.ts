import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { SchemaViewerButton } from "./schema-viewer-button";

export function pluginSchemaViewer(ctx: IPluginContext): IPluginConfig {
  return {
    name: "plugin-schema-viewer",
    dep: [],
    init() {
      ctx.skeleton.header.add({
        key: "schema-viewer",
        area: "header",
        align: "right",
        content: SchemaViewerButton,
        contentProps: {
          getSchema: () => {
            const doc = ctx.editor.getDocument();
            const content = doc.getData();
            return content;
          },
        },
      });
    },
    destroy() {
      ctx.skeleton.header.remove("schema-viewer");
    },
  };
}
