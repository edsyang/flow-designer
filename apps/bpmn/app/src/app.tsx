import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  initializeI18n,
  signal,
  subscribeLocale,
  t,
} from "@flow-designer/engine";
import { registerProcessContentType } from "@flow-designer/bpmn-model";
import { bpmnMessages } from "@flow-designer/bpmn-nodes/i18n";
import type { Designer, IGraphManager } from "@flow-designer/engine";
import styles from "./app.module.css";

declare global {
  interface Window {
    designer?: Designer;
  }
}

registerProcessContentType();

async function init() {
  const container = document.getElementById("root");

  if (!container) throw new Error("Root element #root not found");

  await initializeI18n(bpmnMessages);
  const {
    registerBpmnNodes,
    refreshBpmnTranslations,
    getSequenceFlowEdgeType,
    getProcessGlobalSettings,
    isValidBpmnConnection,
  } = await import("@flow-designer/bpmn-nodes");
  refreshBpmnTranslations();
  registerBpmnNodes();

  let designer: Designer | null = null;
  subscribeLocale(() => {
    const changedDefaults = refreshBpmnTranslations();
    const defaultsByType = new Map(changedDefaults.map((change) => [change.typeName, change]));
    for (const node of designer?.document.getContent().getNodes() ?? []) {
      const change = defaultsByType.get(node.getTypeName());
      const name = node.getProps().getProp("name")?.getData();
      if (change && name === change.previous) {
        node.getProps().getProp("name")?.setData(change.next);
      }
    }
  });

  designer = await createDesigner({
    container,
    documentType: "process",
    documentVersion: "1.0.0",
    docSettings: getProcessGlobalSettings(),
    localeMessages: bpmnMessages,
    graphOptions: {
      connecting: {
        connectionValidator: isValidBpmnConnection,
      },
    },
  });

  window.designer = designer;

  designer.engine.skeleton.header.add({
    key: "app-title",
    area: "header",
    align: "left",
    content: () => (
      <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>
        {t("bpmn.app.header")}
      </span>
    ),
    contentProps: {},
  });

  signal.onceSignal("graph:ready", (graphManager: IGraphManager) => {
    const edgeType = getSequenceFlowEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  const content = designer.document.getContent();
  const timeline = designer.document.getTimeline();
  timeline.pause();
  await content.addNode({
    type: "StartEvent",
    props: { __position: { x: 200, y: 200 } },
  });
  await content.addNode({
    type: "EndEvent",
    props: { __position: { x: 600, y: 200 } },
  });
  timeline.resume();
  timeline.reset();

  const root = createRoot(container);
  root.render(
    <Workbench engine={designer.engine} className={styles.app} documentTitleKey="bpmn.app.title" />,
  );
}

init().catch(console.error);
