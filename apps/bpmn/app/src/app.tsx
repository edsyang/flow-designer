import { createRoot } from 'react-dom/client';
import { createDesigner, Workbench, signal } from '@flow-designer/engine';
import { registerProcessContentType } from '@flow-designer/bpmn-model';
import {
  registerBpmnNodes,
  getSequenceFlowEdgeType,
  getProcessGlobalSettings,
  isValidBpmnConnection,
} from '@flow-designer/bpmn-nodes';
import type { Designer, IGraphManager } from '@flow-designer/engine';
import styles from './app.module.css';

declare global {
  interface Window {
    designer?: Designer;
  }
}

registerProcessContentType();
registerBpmnNodes();

async function init() {
  const container = document.getElementById('root')!;

  const designer: Designer = await createDesigner({
    container,
    documentType: 'process',
    documentVersion: '1.0.0',
    docSettings: getProcessGlobalSettings(),
    graphOptions: {
      connecting: {
        connectionValidator: isValidBpmnConnection,
      },
    },
  });

  window.designer = designer;

  designer.engine.skeleton.header.add({
    key: 'app-title',
    area: 'header',
    align: 'left',
    content: () => <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>BPMN Designer</span>,
    contentProps: {},
  });

  signal.onceSignal('graph:ready', (graphManager: IGraphManager) => {
    const edgeType = getSequenceFlowEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  const content = designer.document.getContent();
  const timeline = designer.document.getTimeline();
  timeline.pause();
  await content.addNode({
    type: 'StartEvent',
    props: { name: '开始', __position: { x: 200, y: 200 } },
  });
  await content.addNode({
    type: 'EndEvent',
    props: { name: '结束', __position: { x: 600, y: 200 } },
  });
  timeline.resume();
  timeline.reset();

  const root = createRoot(container);
  root.render(<Workbench engine={designer.engine} className={styles.app} />);
}

init().catch(console.error);
