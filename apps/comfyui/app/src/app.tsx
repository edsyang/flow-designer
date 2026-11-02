import { createRoot } from 'react-dom/client';
import { createDesigner, Workbench, contentTypesRegistry, GenericContent, signal } from '@flow-designer/engine';
import { registerComfyUINodes, getDataLinkEdgeType } from '@flow-designer/comfyui-nodes';
import { comfyuiTransformer } from '@flow-designer/comfyui-utils';
import type { Designer, IGraphManager } from '@flow-designer/engine';
import styles from './app.module.css';

registerComfyUINodes();
contentTypesRegistry.register(GenericContent);
contentTypesRegistry.registerTransformer(comfyuiTransformer);

declare global {
  interface Window {
    designer?: Designer;
  }
}

async function init() {
  const container = document.getElementById('root')!;

  const designer: Designer = await createDesigner({
    container,
    documentType: '*',
    documentVersion: '1.0.0',
  });

  signal.onceSignal('graph:ready', (graphManager: IGraphManager) => {
    const edgeType = getDataLinkEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  window.designer = designer;

  designer.engine.skeleton.header.add({
    key: 'app-title',
    area: 'header',
    align: 'left',
    content: () => <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>ComfyUI Designer</span>,
    contentProps: {},
  });

  const root = createRoot(container);
  root.render(<Workbench engine={designer.engine} className={styles.app} />);
}

init().catch(console.error);
