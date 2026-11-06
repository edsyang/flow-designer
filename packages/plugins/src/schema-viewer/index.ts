import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { SchemaViewerButton } from "./schema-viewer-button";

export function pluginSchemaViewer(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  return {
    name: "plugin-schema-viewer",
    dep: [],
    init() {
      skeleton.header.add({
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
      skeleton.header.remove("schema-viewer");
    },
  };
}
