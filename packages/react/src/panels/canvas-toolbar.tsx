import { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import type { IArea, PaneConfig } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import { createContent } from "@flow-designer/skeleton";
import type { Document } from "@flow-designer/model";
import type { Locale } from "@flow-designer/i18n";
import { useEditor } from "../hooks";
import { useToolbarCenter } from "./toolbar-position";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.less";

interface CanvasToolbarProps {
  doc: Document;
  area: IArea;
  locale: Locale;
}

export const CanvasToolbar = observer(function CanvasToolbar(props: CanvasToolbarProps) {
  const { doc, area, locale } = props;
  const editor = useEditor();
  const graph = editor.getGraph();
  const [mode, setMode] = useState<"select" | "pan">(() => graph?.getInteractionMode() ?? "pan");
  useEffect(() => {
    if (!graph) return;
    const sync = () => {
      setMode(graph.getInteractionMode());
    };
    sync();
    graph.on("interaction:change", sync);
    return () => {
      graph.off("interaction:change", sync);
    };
  }, [graph]);
  const containerRef = useRef<HTMLDivElement>(null);
  const center = useToolbarCenter(containerRef);

  useEffect(() => {
    if (!containerRef.current) return;
    return mountArea(area, containerRef.current);
  }, [area]);

  const items = area.getItems();

  const renderItem = (item: PaneConfig) => {
    const { content, contentProps = {} } = item;
    return (
      <div key={item.key} className={styles.canvasToolbarItem} data-fd-item={item.key}>
        {createContent(content, { ...contentProps, doc, locale })}
      </div>
    );
  };

  return (
    <>
      <div
        className={styles.canvasToolbar}
        data-fd-area="canvasToolbar"
        style={center === null ? undefined : { left: center }}
        lang={locale}
        ref={containerRef}
      >
        {graph && (
          <div
            className={styles.canvasToolbarItem}
            role="group"
            aria-label={t("workbench.canvas.interaction")}
          >
            <button
              type="button"
              className={styles.modeButton}
              aria-label={t(
                mode === "pan" ? "workbench.canvas.panTool" : "workbench.canvas.selectTool",
              )}
              title={t(mode === "pan" ? "workbench.canvas.panTool" : "workbench.canvas.selectTool")}
              aria-pressed={mode === "pan"}
              onClick={() => {
                graph.setInteractionMode(mode === "pan" ? "select" : "pan");
              }}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {mode === "pan" ? (
                  <path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-6 6h-2c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-3l1 2Z" />
                ) : (
                  <path d="m5 3 14 10-7 1-3 7z" />
                )}
              </svg>
            </button>
          </div>
        )}
        {items.map(renderItem)}
      </div>
    </>
  );
});
