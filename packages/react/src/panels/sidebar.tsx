import { useRef, useEffect, useState, useId } from "react";
import { observer } from "mobx-react-lite";
import { createContent } from "@flow-designer/skeleton";
import type { IArea, PaneConfig } from "@flow-designer/model";
import { t } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.css";

interface SidebarProps {
  area: IArea;
  locale: Locale;
}

export const Sidebar = observer(function Sidebar(props: SidebarProps) {
  const { area, locale } = props;
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );
  const contentId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    return mountArea(area, containerRef.current);
  }, [area]);

  const renderItem = (item: PaneConfig) => {
    const { content, contentProps = {} } = item;

    return (
      <div
        key={item.key}
        data-fd-item={item.key}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {createContent(content, { ...contentProps, locale })}
      </div>
    );
  };

  return (
    <div
      className={[styles.sidebar, collapsed ? styles.sidebarCollapsed : ""]
        .filter(Boolean)
        .join(" ")}
      data-fd-area="sidebar"
      lang={locale}
      ref={containerRef}
    >
      <button
        type="button"
        className={styles.sidebarToggle}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        aria-label={collapsed ? t("workbench.sidebar.expand") : t("workbench.sidebar.collapse")}
        onClick={() => {
          setCollapsed(!collapsed);
        }}
      >
        {collapsed ? "›" : t("workbench.sidebar.collapse")}
        <span aria-hidden="true">{collapsed ? "" : "‹"}</span>
      </button>
      <div id={contentId} className={styles.sidebarBody} hidden={collapsed}>
        {area.getItems().map(renderItem)}
      </div>
    </div>
  );
});
