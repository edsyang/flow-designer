import { useRef, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { IArea, PaneConfig } from '@flow-designer/model';
import { createContent } from '@flow-designer/skeleton';
import type { Document } from '@flow-designer/model';
import { useEditor } from '../hooks';
import { CanvasHelp } from './canvas-help';
import { mountArea } from './mount-area';
import styles from '../workbench.module.css';

interface CanvasToolbarProps {
  doc: Document;
  area: IArea;
}

export const CanvasToolbar = observer(function CanvasToolbar(props: CanvasToolbarProps) {
  const { doc, area } = props;
  const editor = useEditor();
  const graph = editor.getGraph();
  const [mode, setMode] = useState<'select' | 'pan'>(() => graph?.getInteractionMode() ?? 'select');
  useEffect(() => {
    if (!graph) return;
    const sync = () => { setMode(graph.getInteractionMode()); };
    sync();
    graph.on('interaction:change', sync);
    return () => { graph.off('interaction:change', sync); };
  }, [graph]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    return mountArea(area, containerRef.current);
  }, [area]);

  const items = area.getItems();


  const renderItem = (item: PaneConfig) => {
    const { content, contentProps = {} } = item;
    return (
      <div key={item.key} className={styles.canvasToolbarItem} data-fd-item={item.key}>
        {createContent(content, { ...contentProps, doc })}
      </div>
    );
  };

  return (
    <>
    <div className={styles.canvasToolbar} data-fd-area="canvasToolbar" ref={containerRef}>
      {graph && <div className={styles.canvasToolbarItem} role="group" aria-label="画布交互">
        <button type="button" className={styles.modeButton} aria-label="选择工具" title="选择工具" aria-pressed={mode === 'select'} onClick={() => { graph.setInteractionMode('select'); }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="m5 3 14 10-7 1-3 7z" /></svg></button>
        <button type="button" className={styles.modeButton} aria-label="平移工具" title="平移工具" aria-pressed={mode === 'pan'} onClick={() => { graph.setInteractionMode('pan'); }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-6 6h-2c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-3l1 2Z" /></svg></button>
      </div>}
      {items.map(renderItem)}
      {graph && <div className={styles.canvasToolbarItem}><CanvasHelp /></div>}
    </div>
    </>
  );
});
