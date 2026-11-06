import { createRoot } from "react-dom/client";
import { createDesigner, Workbench, initializeDesignerI18n, signal } from "@flow-designer/engine";
import { subscribeLocale, t } from "@flow-designer/i18n";
import { registerProcessContentType } from "@flow-designer/bpmn-model";
import { bpmnMessages } from "@flow-designer/bpmn-nodes/i18n";
import type { Designer, IGraphManager } from "@flow-designer/engine";
import styles from "./app.module.less";

declare global {
  interface Window {
    designer?: Designer;
  }
}

registerProcessContentType();

async function init() {
  const container = document.getElementById("root");

  if (!container) throw new Error("Root element #root not found");

  await initializeDesignerI18n(bpmnMessages);

  const {
    registerBpmnNodes,
    refreshBpmnTranslations,
    getSequenceFlowEdgeType,
    getProcessGlobalSettings,
    isValidBpmnConnection,
  } = await import("@flow-designer/bpmn-nodes");

  registerBpmnNodes();
  refreshBpmnTranslations();

  subscribeLocale(() => {
    refreshBpmnTranslations();
  });

  const designer: Designer = await createDesigner({
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
      <span
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "var(--fd-text-primary)",
          cursor: "pointer",
        }}
      >
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
    props: { __position: { x: 560, y: 120 } },
  });
  await content.addNode({
    type: "EndEvent",
    props: { __position: { x: 560, y: 520 } },
  });
  timeline.resume();
  timeline.reset();

  const root = createRoot(container);
  root.render(
    <Workbench engine={designer.engine} className={styles.app} documentTitleKey="bpmn.app.title" />,
  );
}

init().catch(console.error);
