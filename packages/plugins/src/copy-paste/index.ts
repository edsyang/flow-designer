import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { t } from "@flow-designer/i18n";
import type { ContentNode } from "@flow-designer/model";

export function pluginCopyPaste(ctx: IPluginContext): IPluginConfig {
  const prototypeRegistry = ctx.editor.getRegistries().prototypes;
  const cleanups: Array<() => void> = [];
  let clipboard: Array<{
    type: string;
    props: Record<string, unknown>;
    pos: { x: number; y: number };
  }> = [];
  function copy() {
    const graph = ctx.graph;
    if (!graph) return;
    const ids = graph.getSelection();
    if (!ids.length) return;
    const content = ctx.editor.getDocument().getContent();
    const nodes: ContentNode[] = [];
    const blockedNames: string[] = [];
    for (const id of ids) {
      const node = content.getNode(id);
      if (!node) {
        blockedNames.push(t("common.edge"));
        continue;
      }
      const prototype = prototypeRegistry.getPrototypeByType(node.getTypeName());
      if (prototype?.getView().copyable === false) {
        blockedNames.push(prototype.getName());
      } else {
        nodes.push(node);
      }
    }
    if (blockedNames.length) {
      ctx.notifications.notify({
        level: "warning",
        message: t("plugin.copy.unsupported", {
          names: [...new Set(blockedNames)].join("、"),
        }),
      });
    }
    if (!nodes.length) return;
    clipboard = nodes.map((node) => ({
      type: node.getTypeName(),
      props: node.getProps().getData() as Record<string, unknown>,
      pos: node.getPosition(),
    }));
    const names = [
      ...new Set(
        nodes.map(
          (node) =>
            prototypeRegistry.getPrototypeByType(node.getTypeName())?.getName() ??
            node.getTypeName(),
        ),
      ),
    ];
    ctx.notifications.notify({
      level: "success",
      message: t("plugin.copy.success", { names: names.join("、") }),
    });
  }

  async function paste() {
    if (!ctx.graph) return;
    if (clipboard.length) {
      const doc = ctx.editor.getDocument();
      const ids: string[] = [];
      await doc.transaction("Paste nodes", async () => {
        for (const item of clipboard) {
          const props = structuredClone(item.props);
          const node = await doc.getContent().addNode({
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
      cleanups.push(ctx.commands.register("copy", copy));
      cleanups.push(ctx.commands.register("paste", paste));

      cleanups.push(
        ctx.shortcuts.bind("mod+c", (e) => {
          e.preventDefault();
          copy();
        }),
      );
      cleanups.push(
        ctx.shortcuts.bind("mod+v", (e) => {
          e.preventDefault();
          void paste().catch((error: unknown) => {
            ctx.logger.error("Paste failed:", error);
          });
        }),
      );
    },
    destroy() {
      cleanups.splice(0).forEach((cleanup) => {
        cleanup();
      });
    },
  };
}
