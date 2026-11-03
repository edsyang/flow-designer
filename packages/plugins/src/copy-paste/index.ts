import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { commandRegistry } from "@flow-designer/core";
import { prototypeRegistry, t, utils } from "@flow-designer/model";
import type { ContentNode, GenericRelation } from "@flow-designer/model";
import { getMessageApi } from "@flow-designer/react";

export function pluginCopyPaste(ctx: IPluginContext): IPluginConfig {
  const cleanups: Array<() => void> = [];
  let clipboard: Array<{
    type: string;
    props: Record<string, unknown>;
    pos: { x: number; y: number };
  }> = [];
  function isCopyable(cell: any): boolean {
    if (typeof cell.isEdge === "function" && cell.isEdge()) return false;
    if (typeof cell.isNode !== "function" || !cell.isNode()) return true;
    const nodeId = cell.id;
    const content = ctx.editor.getDocument().getContent();
    const contentNode = content.getNode(nodeId) as ContentNode<GenericRelation> | null;
    if (!contentNode) return true;
    const typeName = contentNode.getTypeName();
    const proto = prototypeRegistry.getPrototypeByType(typeName);
    if (!proto) return true;
    return proto.getView().copyable !== false;
  }

  function getNodeDisplayName(cell: any): string | null {
    if (typeof cell.isEdge === "function" && cell.isEdge()) return t("common.edge");
    if (typeof cell.isNode !== "function" || !cell.isNode()) return null;
    const content = ctx.editor.getDocument().getContent();
    const contentNode = content.getNode(cell.id) as ContentNode<GenericRelation> | null;
    if (!contentNode) return null;
    const typeName = contentNode.getTypeName();
    const proto = prototypeRegistry.getPrototypeByType(typeName);
    return proto?.getName() ?? typeName;
  }

  function copy() {
    const graph = ctx.graph?.getX6Graph() as any;
    if (!graph) return;
    const cells = graph.getSelectedCells?.();
    if (!cells?.length) return;
    const copyableCells = cells.filter(isCopyable);
    if (copyableCells.length < cells.length) {
      const blocked = cells.filter((c: any) => !isCopyable(c));
      const names = [...new Set(blocked.map(getNodeDisplayName).filter(Boolean))];
      getMessageApi()?.warning(t("plugin.copy.unsupported", { names: names.join("、") }));
    }
    if (copyableCells.length) {
      clipboard = copyableCells.flatMap((cell: any) => {
        const node = ctx.editor.getDocument().getContent().getNode(cell.id);
        return node
          ? [
              {
                type: node.getTypeName(),
                props: node.getProps().getData(),
                pos: node.getPosition(),
              },
            ]
          : [];
      });
      const savedContentNodes = new Map<string, unknown>();
      for (const cell of copyableCells) {
        if (cell.isNode?.()) {
          const data = cell.getData?.() ?? {};
          if (data.contentNode) {
            savedContentNodes.set(cell.id, data.contentNode);
            cell.setData({ ...data, contentNode: null }, { overwrite: true, silent: true });
          }
        }
      }
      try {
        graph.copy(copyableCells);
      } finally {
        for (const [id, cn] of savedContentNodes) {
          const c = graph.getCellById(id);
          if (c) c.setData({ ...c.getData(), contentNode: cn }, { overwrite: true, silent: true });
        }
      }
      const names = [...new Set(copyableCells.map(getNodeDisplayName).filter(Boolean))];
      getMessageApi()?.success(t("plugin.copy.success", { names: names.join("、") }));
    }
  }

  async function paste() {
    const graph = ctx.graph?.getX6Graph() as any;
    if (!graph) return;
    if (clipboard.length) {
      const doc = ctx.editor.getDocument();
      const ids: string[] = [];
      await doc.transaction("Paste nodes", async () => {
        for (const item of clipboard) {
          const props = structuredClone(item.props);
          const node = await doc
            .getContent()
            .addNode({
              type: item.type,
              props: { ...props, __position: { x: item.pos.x + 30, y: item.pos.y + 30 } },
            });
          if (node) ids.push(node.getId());
        }
      });
      ctx.graph?.select(ids);
      return;
    }
  }

  return {
    name: "plugin-copy-paste",
    dep: ["plugin-x6-graph"],
    init() {
      commandRegistry.register("copy", copy);
      commandRegistry.register("paste", paste);

      cleanups.push(
        utils.hotkey.bindScoped(
          "mod+c",
          (e) => {
            e.preventDefault();
            copy();
          },
          () => ctx.container,
        ),
      );
      cleanups.push(
        utils.hotkey.bindScoped(
          "mod+v",
          (e) => {
            e.preventDefault();
            void paste().catch((error) => { ctx.logger.error("Paste failed:", error); });
          },
          () => ctx.container,
        ),
      );
    },
    destroy() {
      cleanups.splice(0).forEach((cleanup) => { cleanup(); });
      commandRegistry.unregister("copy");
      commandRegistry.unregister("paste");
    },
  };
}
