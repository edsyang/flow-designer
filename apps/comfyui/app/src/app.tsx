import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  contentTypesRegistry,
  GenericContent,
  initializeI18n,
  signal,
  subscribeLocale,
  t,
} from "@flow-designer/engine";
import { comfyuiMessages } from "@flow-designer/comfyui-nodes/i18n";
import { comfyuiTransformer } from "@flow-designer/comfyui-utils";
import type { Designer, IGraphManager } from "@flow-designer/engine";
import styles from "./app.module.css";

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

  await initializeI18n(comfyuiMessages);

  const { registerComfyUINodes, refreshComfyUITranslations, getDataLinkEdgeType } =
    await import("@flow-designer/comfyui-nodes");
  refreshComfyUITranslations();
  registerComfyUINodes();
  subscribeLocale(() => {
    refreshComfyUITranslations();
  });

  const designer: Designer = await createDesigner({
    container,
    documentType: "*",
    documentVersion: "1.0.0",
    localeMessages: comfyuiMessages,
  });

  signal.onceSignal("graph:ready", (graphManager: IGraphManager) => {
    const edgeType = getDataLinkEdgeType();
    graphManager.registerEdgeType(edgeType.name, edgeType.config);
  });

  window.designer = designer;

  designer.engine.skeleton.header.add({
    key: "app-title",
    area: "header",
    align: "left",
    content: () => (
      <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>
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
