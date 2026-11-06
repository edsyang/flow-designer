import { getSkeleton } from "@flow-designer/skeleton";
import type { IPluginConfig, IPluginContext } from "@flow-designer/core";
import { UndoRedoButtons } from "./undo-redo-buttons";

export function pluginUndoRedo(ctx: IPluginContext): IPluginConfig {
  const skeleton = getSkeleton(ctx.editor);
  const shortcutDisposers: Array<() => void> = [];
  function getTimeline() {
    return ctx.editor.getDocument().getTimeline();
  }

  function undo() {
    getTimeline().back();
    ctx.graph?.centerContent();
  }

  function redo() {
    getTimeline().forward();
    ctx.graph?.centerContent();
  }

  return {
    name: "plugin-undo-redo",
    dep: ["plugin-x6-graph"],
    init() {
      shortcutDisposers.push(ctx.commands.register("undo", undo));
      shortcutDisposers.push(ctx.commands.register("redo", redo));

      shortcutDisposers.push(
        ctx.shortcuts.bind("mod+z", (e) => {
          e.preventDefault();
          undo();
        }),
      );
      shortcutDisposers.push(
        ctx.shortcuts.bind("mod+shift+z", (e) => {
          e.preventDefault();
          redo();
        }),
      );
      shortcutDisposers.push(
        ctx.shortcuts.bind("mod+y", (e) => {
          e.preventDefault();
          redo();
        }),
      );

      skeleton.canvasToolbar.add({
        key: "undo-redo",
        area: "canvasToolbar",
        content: UndoRedoButtons,
        contentProps: { getTimeline },
      });
    },
    destroy() {
      shortcutDisposers.splice(0).forEach((dispose) => {
        dispose();
      });
      skeleton.canvasToolbar.remove("undo-redo");
    },
  };
}
