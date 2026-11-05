import { useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import type { IArea, PaneConfig } from "@flow-designer/model";
import { createContent } from "@flow-designer/skeleton";
import type { Document } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import { mountArea } from "./mount-area";
import styles from "../workbench.module.less";

interface HeaderProps {
  doc: Document;
  area: IArea;
  locale: Locale;
}

export const Header = observer(function Header(props: HeaderProps) {
  const { doc, area, locale } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    return mountArea(area, containerRef.current);
  }, [area]);

  const items = area.getItems();
  const left: PaneConfig[] = [];
  const center: PaneConfig[] = [];
  const right: PaneConfig[] = [];

  [...items]
    .sort((a, b) => {
      const index1 = (a as any).config?.index || 0;
      const index2 = (b as any).config?.index || 0;
      return index1 === index2 ? 0 : index1 > index2 ? 1 : -1;
    })
    .forEach((item) => {
      if (item.align === "center") {
        center.push(item);
      } else if (item.align === "left") {
        left.push(item);
      } else {
        right.push(item);
      }
    });

  const renderItem = (item: PaneConfig) => {
    const { content, contentProps = {} } = item;
    return (
      <div key={item.key} data-fd-item={item.key}>
        {createContent(content, { ...contentProps, doc, locale })}
      </div>
    );
  };

  return (
    <div className={styles.header} data-fd-area="header" lang={locale} ref={containerRef}>
      <div className={styles.headerSection}>{left.map(renderItem)}</div>
      <div className={styles.headerSection}>{center.map(renderItem)}</div>
      <div className={styles.headerSection}>{right.map(renderItem)}</div>
    </div>
  );
});
