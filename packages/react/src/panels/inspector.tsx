import type { IArea, PaneConfig } from "@flow-designer/skeleton";
import { useRef, useEffect, useId, useState } from "react";
import { observer } from "mobx-react-lite";
import { createContent } from "@flow-designer/skeleton";

import { t } from "@flow-designer/i18n";
import type { Locale } from "@flow-designer/i18n";
import { useDocument, useEditor, useSelection } from "../hooks";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.less";

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
  const hasSelectedEdge = Boolean(selectedKey && graph?.getEdgeTypeName(selectedKey));
  const docHasSettings = doc.getSettings().getItems().length > 0;
  const contentId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedKey) {
      // Nothing selected: fall back to the collapsed strip so the canvas keeps
      // the space, unless the document itself is what the panel describes.
      if (!docHasSettings) setCollapsed(true);
      return;
    }
    if (hasNodeSettings || hasSelectedEdge) {
      setCollapsed(false);
    }
  }, [selectedKey, hasNodeSettings, hasSelectedEdge, docHasSettings]);
  useEffect(() => {
    if (!graph) return;
    // Only a double click on empty canvas collapses the inspector: clicking a
    // node or an edge is reserved for selection, and double clicking them must
    // not hide the panel the user is reading.
    const collapse = () => {
      setCollapsed(true);
    };
    const expandForBlank = () => {
      if (docHasSettings) setCollapsed(true);
    };
    return graph.subscribeEvents((event) => {
      if (event.type === "blank-double-clicked") collapse();
      if (event.type === "blank-clicked") expandForBlank();
    });
  }, [graph, docHasSettings]);
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
