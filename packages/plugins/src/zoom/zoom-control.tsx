import { useState, useCallback, useEffect, type CSSProperties } from "react";
import { Button } from "antd";
import { t } from "@flow-designer/i18n";
import { MinusOutlined, PlusOutlined, ExpandOutlined } from "@ant-design/icons";
import styles from "./zoom-control.module.less";

interface ZoomControlProps {
  getZoom: () => number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (factor: number) => void;
  onResetZoom: () => void;
  subscribe?: (cb: () => void) => () => void;
}

export function ZoomControl({
  getZoom,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onResetZoom,
  subscribe,
}: ZoomControlProps) {
  const [zoom, setZoom] = useState(() => getZoom());
  const syncZoom = useCallback(() => {
    setZoom(getZoom());
  }, [getZoom]);
  useEffect(() => {
    syncZoom();
    return subscribe?.(syncZoom);
  }, [subscribe, syncZoom]);
  const percentage = Math.round(zoom * 100);
  return (
    <div className={styles.control} role="group" aria-label={t("plugin.zoom.group")}>
      <Button
        type="text"
        size="small"
        icon={<MinusOutlined />}
        onClick={() => {
          onZoomOut();
          syncZoom();
        }}
        title={t("plugin.zoom.out")}
        aria-label={t("plugin.zoom.out")}
      />
      <input
        className={styles.slider}
        type="range"
        style={
          {
            "--zoom-fill": `${String(Math.min(100, Math.max(0, ((percentage - 1) / 299) * 100)))}%`,
          } as CSSProperties
        }
        min={1}
        max={300}
        step={1}
        value={percentage}
        aria-label={t("plugin.zoom.ratio")}
        aria-valuetext={`${String(percentage)}%`}
        onChange={(event) => {
          onZoomTo(Number(event.target.value) / 100);
          syncZoom();
        }}
      />
      <output className={styles.value} aria-label={t("plugin.zoom.current")}>
        {percentage}%
      </output>
      <Button
        type="text"
        size="small"
        icon={<PlusOutlined />}
        onClick={() => {
          onZoomIn();
          syncZoom();
        }}
        title={t("plugin.zoom.in")}
        aria-label={t("plugin.zoom.in")}
      />
      <span className={styles.divider} />
      <Button
        type="text"
        size="small"
        icon={<ExpandOutlined />}
        onClick={() => {
          onResetZoom();
          syncZoom();
        }}
        title={t("plugin.zoom.fit")}
        aria-label={t("plugin.zoom.fit")}
      />
    </div>
  );
}
