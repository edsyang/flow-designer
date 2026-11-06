import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  ConnectionValidators,
  contentTypesRegistry,
  GenericContent,
  initializeDesignerI18n,
} from "@flow-designer/engine";
import { subscribeLocale, t } from "@flow-designer/i18n";
import { erMessages } from "@flow-designer/er-nodes/i18n";
import type { Designer, GraphAdapterPort } from "@flow-designer/engine";
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

  await initializeDesignerI18n(erMessages);
  const { registerERNodes, refreshERTranslations, getRelationEdgeType } =
    await import("@flow-designer/er-nodes");

  registerERNodes();
  refreshERTranslations();

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

  designer.editor.events.onceSignal("graph:ready", (graphManager: GraphAdapterPort) => {
    const edgeType = getRelationEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  window.designer = designer;
  designer.engine.addDisposer(
    subscribeLocale(() => {
      refreshERTranslations(designer.editor.getRegistries().prototypes);
    }),
  );

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
