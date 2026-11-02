import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import { Button } from 'antd';
import { MinusOutlined, PlusOutlined, ExpandOutlined } from '@ant-design/icons';
import styles from './zoom-control.module.css';

interface ZoomControlProps {
  getZoom: () => number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomTo: (factor: number) => void;
  onResetZoom: () => void;
  subscribe?: (cb: () => void) => () => void;
}

export function ZoomControl({ getZoom, onZoomIn, onZoomOut, onZoomTo, onResetZoom, subscribe }: ZoomControlProps) {
  const [zoom, setZoom] = useState(() => getZoom());
  const syncZoom = useCallback(() => { setZoom(getZoom()); }, [getZoom]);
  useEffect(() => { syncZoom(); return subscribe?.(syncZoom); }, [subscribe, syncZoom]);
  const percentage = Math.round(zoom * 100);
  return <div className={styles.control} role="group" aria-label="画布缩放">
    <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => { onZoomOut(); syncZoom(); }} title="缩小" aria-label="缩小" />
    <input className={styles.slider} type="range" style={{ '--zoom-fill':`${String(Math.min(100, Math.max(0, (percentage - 1) / 299 * 100)))}%` } as CSSProperties} min={1} max={300} step={1} value={percentage} aria-label="缩放比例" aria-valuetext={`${String(percentage)}%`} onChange={(event) => { onZoomTo(Number(event.target.value) / 100); syncZoom(); }} />
    <output className={styles.value} aria-label="当前缩放">{percentage}%</output>
    <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => { onZoomIn(); syncZoom(); }} title="放大" aria-label="放大" />
    <span className={styles.divider} />
    <Button type="text" size="small" icon={<ExpandOutlined />} onClick={() => { onResetZoom(); syncZoom(); }} title="适应画布" aria-label="适应画布" />
  </div>;
}
