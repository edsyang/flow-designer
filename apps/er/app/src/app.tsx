import { createRoot } from 'react-dom/client';
import { createDesigner, Workbench, ConnectionValidators, contentTypesRegistry, GenericContent, signal } from '@flow-designer/engine';
import { registerERNodes, getRelationEdgeType } from '@flow-designer/er-nodes';
import type { Designer, IGraphManager } from '@flow-designer/engine';
import styles from './app.module.css';

registerERNodes();
contentTypesRegistry.register(GenericContent);

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
    graphOptions: {
      connecting: {
        connectionValidator: ConnectionValidators.allowAll,
      },
    },
  });

  signal.onceSignal('graph:ready', (graphManager: IGraphManager) => {
    const edgeType = getRelationEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  window.designer = designer;

  designer.engine.skeleton.header.add({
    key: 'app-title',
    area: 'header',
    align: 'left',
    content: () => <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>ER Designer</span>,
    contentProps: {},
  });

  const root = createRoot(container);
  root.render(<Workbench engine={designer.engine} className={styles.app} />);
}

init().catch(console.error);
