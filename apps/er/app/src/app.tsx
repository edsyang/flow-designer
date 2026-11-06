import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  ConnectionValidators,
  contentTypesRegistry,
  GenericContent,
  initializeI18n,
  signal,
  subscribeLocale,
  t,
} from "@flow-designer/engine";
import { erMessages } from "@flow-designer/er-nodes/i18n";
import type { Designer, IGraphManager } from "@flow-designer/engine";
import styles from "./app.module.less";

contentTypesRegistry.register(GenericContent);

declare global {
  interface Window {
    designer?: Designer;
  }
}

async function init() {
  const container = document.getElementById("root");

  if (!container) throw new Error("Root element #root not found");

  await initializeI18n(erMessages);
  const { registerERNodes, refreshERTranslations, getRelationEdgeType } =
    await import("@flow-designer/er-nodes");

  registerERNodes();
  refreshERTranslations();
  subscribeLocale(() => {
    refreshERTranslations();
  });

  const designer: Designer = await createDesigner({
    container,
    documentType: "*",
    documentVersion: "1.0.0",
    localeMessages: erMessages,
    graphOptions: {
      connecting: {
        connectionValidator: ConnectionValidators.allowAll,
      },
    },
  });

  signal.onceSignal("graph:ready", (graphManager: IGraphManager) => {
    const edgeType = getRelationEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
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
        {t("er.app.header")}
      </span>
    ),
    contentProps: {},
  });

  const root = createRoot(container);
  root.render(
    <Workbench engine={designer.engine} className={styles.app} documentTitleKey="er.app.title" />,
  );
}

init().catch(console.error);
