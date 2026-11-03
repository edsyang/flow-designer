import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { commandRegistry } from "@flow-designer/core";
import { utils, prototypeRegistry } from "@flow-designer/model";
import type { ContentNode, GenericRelation } from "@flow-designer/model";

export function pluginDelete(ctx: IPluginContext): IPluginConfig {
  const cleanups: Array<() => void> = [];
  async function deleteSelected() {
    const graph = ctx.graph;
    if (!graph) return;
    const selectedIds = graph.getSelection();
    if (!selectedIds.length) return;
    const content = ctx.editor.getDocument().getContent();
    await ctx.editor.getDocument().transaction("Delete selection", async () => {
      for (const id of selectedIds) {
        const node = content.getNode(id);
        if (node) {
          const typeName = typeof node.getTypeName === "function" ? node.getTypeName() : undefined;
          if (typeName) {
            const proto = prototypeRegistry.getPrototypeByType(typeName);
            if (proto?.getView().deletable === false) continue;
          }
          await content.removeNode(id);
        } else {
          const nodes = content.getNodes() as Array<ContentNode<GenericRelation>>;
          for (const n of nodes) {
            const relation = n.getRelation();
            if (
              relation &&
              typeof relation.getEdgeById === "function" &&
              relation.getEdgeById(id)
            ) {
              relation.removeEdgeById(id);
              break;
            }
          }
          graph.removeCell(id);
        }
      }
    });
    if (typeof graph.select === "function") graph.select([]);
  }

  return {
    name: "plugin-delete",
    dep: ["plugin-x6-graph"],
    init() {
      commandRegistry.register("delete", deleteSelected);

      for (const key of ["backspace", "del"]) {
        cleanups.push(
          utils.hotkey.bindScoped(
            key,
            (e) => {
              e.preventDefault();
              void deleteSelected().catch((error) => {
                ctx.logger.error("Delete failed:", error);
              });
            },
            () => ctx.container,
          ),
        );
      }
    },
    destroy() {
      cleanups.splice(0).forEach((cleanup) => {
        cleanup();
      });
      commandRegistry.unregister("delete");
    },
  };
}
