import { useMemo, useCallback, useState } from "react";
import { t } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import styles from "./stencil-container.module.css";

interface NodeItem {
  type: string;
  name: string;
  icon: string;
  shape: string;
}

interface NodeGroup {
  name: string;
  title: string;
  items: NodeItem[];
}

interface StencilContainerProps {
  getNodeGroups: () => NodeGroup[];
  startDrag: (nodeType: string, event: MouseEvent) => void;
  locale: Locale;
}

function getShapeClass(shape: string): string {
  if (shape.includes("diamond")) return styles.shapeDiamond!;
  if (shape.includes("rect-event")) return styles.shapeRectEvent!;
  if (shape.includes("circle")) return styles.shapeCircle!;
  return styles.shapeRect!;
}

function getShapeColor(shape: string): string {
  if (shape.includes("diamond")) return "#faad14";
  if (shape.includes("circle-end") || shape.includes("circleEnd")) return "#ff4d4f";
  if (shape.includes("rect-event")) return "#fa8c16";
  if (shape.includes("circle")) return "#52c41a";
  return "#4d7cfe";
}

export function StencilContainer({ getNodeGroups, startDrag, locale }: StencilContainerProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => getNodeGroups(), [getNodeGroups, locale]);

  const handleMouseDown = useCallback(
    (nodeType: string, e: React.MouseEvent) => {
      startDrag(nodeType, e.nativeEvent);
    },
    [startDrag],
  );

  return (
    <div className={styles.container} lang={locale}>
      <input
        className={styles.search}
        aria-label={t("workbench.sidebar.search")}
        placeholder={t("workbench.sidebar.searchPlaceholder")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {groups
        .filter((group) =>
          group.items.some((item) =>
            `${item.name} ${item.type}`
              .toLocaleLowerCase()
              .includes(query.trim().toLocaleLowerCase()),
          ),
        )
        .map((group) => (
          <div key={group.name} className={styles.group}>
            <div className={styles.groupTitle}>{group.title}</div>
            <div className={styles.groupItems}>
              {group.items
                .filter((item) =>
                  `${item.name} ${item.type}`
                    .toLocaleLowerCase()
                    .includes(query.trim().toLocaleLowerCase()),
                )
                .map((item) => (
                  <div
                    key={item.type}
                    className={styles.item}
                    onMouseDown={(e) => {
                      handleMouseDown(item.type, e);
                    }}
                  >
                    <span
                      className={[styles.shapeIcon, getShapeClass(item.shape)]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ borderColor: getShapeColor(item.shape) }}
                    />
                    <span className={styles.itemLabel}>{item.name}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}
