import { useRef, useEffect, useId, useState } from "react";
import { observer } from "mobx-react-lite";
import { createContent } from "@flow-designer/skeleton";
import type { IArea, PaneConfig } from "@flow-designer/model";
import { t } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import { useDocument, useEditor, useSelection } from "../hooks";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.css";

interface InspectorProps {
  area: IArea;
  locale: Locale;
}

export const Inspector = observer(function Inspector(props: InspectorProps) {
  const { area, locale } = props;
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1000px)").matches,
  );
  const graph = useEditor().getGraph();
  const doc = useDocument();
  const { keys } = useSelection();
  const selectedKey = keys.length === 1 ? keys[0] : undefined;
  const selectedNode = selectedKey ? doc.getContent().getNode(selectedKey) : null;
  const hasNodeSettings = (selectedNode?.getSettings().getItems().length ?? 0) > 0;
  const contentId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey && hasNodeSettings) {
      setCollapsed(false);
    }
  }, [selectedKey, hasNodeSettings]);
  useEffect(() => {
    if (!graph) return;
    const collapse = () => {
      setCollapsed(true);
    };
    graph.on("node:dblclick", collapse);
    graph.on("edge:dblclick", collapse);
    graph.on("blank:dblclick", collapse);
    return () => {
      graph.off("blank:dblclick", collapse);
      graph.off("node:dblclick", collapse);
      graph.off("edge:dblclick", collapse);
    };
  }, [graph]);
  useEffect(() => {
    if (!containerRef.current) return;
    return mountArea(area, containerRef.current);
  }, [area]);

  const items = area.getItems();
  if (!items.length) return null;

  const renderItem = (item: PaneConfig) => {
    const { content, contentProps = {} } = item;
    return (
      <div key={item.key} data-fd-item={item.key}>
        {createContent(content, { ...contentProps, locale })}
      </div>
    );
  };

  return (
    <div
      className={[styles.inspector, collapsed ? styles.inspectorCollapsed : ""]
        .filter(Boolean)
        .join(" ")}
      data-fd-area="inspector"
      lang={locale}
      ref={containerRef}
      hidden={!area.getVisible()}
    >
      <button
        type="button"
        className={styles.inspectorToggle}
        aria-label={collapsed ? t("workbench.inspector.expand") : t("workbench.inspector.collapse")}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        title={collapsed ? t("workbench.inspector.expand") : t("workbench.inspector.collapse")}
        onClick={() => {
          setCollapsed(!collapsed);
        }}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {collapsed ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
        </svg>
      </button>
      <div id={contentId} className={styles.inspectorContent} hidden={collapsed}>
        {items.map(renderItem)}
      </div>
    </div>
  );
});
