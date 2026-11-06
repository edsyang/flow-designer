import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  contentTypesRegistry,
  GenericContent,
  initializeDesignerI18n,
} from "@flow-designer/engine";
import { subscribeLocale, t } from "@flow-designer/i18n";
import { comfyuiMessages } from "@flow-designer/comfyui-nodes/i18n";
import { comfyuiTransformer } from "@flow-designer/comfyui-utils";
import type { Designer, GraphAdapterPort } from "@flow-designer/engine";
import styles from "./app.module.less";

contentTypesRegistry.register(GenericContent);
contentTypesRegistry.registerTransformer(comfyuiTransformer);

declare global {
  interface Window {
    designer?: Designer;
  }
}

async function init() {
  const container = document.getElementById("root");

  if (!container) throw new Error("Root element #root not found");

  await initializeDesignerI18n(comfyuiMessages);

  const { comfyuiNodeDefinitions, refreshComfyUITranslations, getDataLinkEdgeType } =
    await import("@flow-designer/comfyui-nodes");

  const designer: Designer = await createDesigner({
    container,
    nodeDefinitions: comfyuiNodeDefinitions,
    documentType: "*",
    documentVersion: "1.0.0",
    localeMessages: comfyuiMessages,
  });

  designer.editor.events.onceSignal("graph:ready", (graphManager: GraphAdapterPort) => {
    const edgeType = getDataLinkEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  window.designer = designer;
  designer.engine.addDisposer(
    subscribeLocale(() => {
      refreshComfyUITranslations(designer.engine.definitions);
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
        {t("comfyui.app.header")}
      </span>
    ),
    contentProps: {},
  });

  const root = createRoot(container);

  root.render(
    <Workbench
      engine={designer.engine}
      className={styles.app}
      documentTitleKey="comfyui.app.title"
    />,
  );
}

init().catch(console.error);
