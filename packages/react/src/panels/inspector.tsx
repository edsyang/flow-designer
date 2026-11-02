import { useRef, useEffect, useId, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { createContent } from '@flow-designer/skeleton';
import type { IArea, PaneConfig } from '@flow-designer/model';
import { useDocument, useSelection } from '../hooks';
import { mountArea } from './mount-area';
import styles from '../workbench.module.css';

interface InspectorProps {
  area: IArea;
}

export const Inspector = observer(function Inspector(props: InspectorProps) {
  const { area } = props;
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1000px)').matches);
  const doc = useDocument();
  const { keys } = useSelection();
  const selectedKey = keys.length === 1 ? keys[0] : undefined;
  const selectedNode = selectedKey ? doc.getContent().getNode(selectedKey) : null;
  const hasNodeSettings = (selectedNode?.getSettings().getItems().length ?? 0) > 0;
  useEffect(() => {
    if (selectedKey && hasNodeSettings) setCollapsed(false);
  }, [selectedKey, hasNodeSettings]);
  const contentId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

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
        {createContent(content, contentProps)}
      </div>
    );
  };

  return (
    <div className={[styles.inspector, collapsed ? styles.inspectorCollapsed : ''].filter(Boolean).join(' ')} data-fd-area="inspector" ref={containerRef} hidden={!area.getVisible()}>
      <button type="button" className={styles.inspectorToggle} aria-label={collapsed ? '展开属性' : '收起属性'} aria-expanded={!collapsed} aria-controls={contentId} title={collapsed ? '展开属性' : '收起属性'} onClick={() => { setCollapsed(!collapsed); }}>
        {collapsed ? <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16M4 12h16M4 19h16M8 2v6M16 9v6M10 16v6" /></svg> : '收起属性 ›'}
      </button>
      <div id={contentId} className={styles.inspectorContent} hidden={collapsed}>{items.map(renderItem)}</div>
    </div>
  );
});
