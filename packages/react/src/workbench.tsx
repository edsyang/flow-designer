import { useEffect, useSyncExternalStore } from "react";
import { observer } from "mobx-react-lite";
import { ConfigProvider, App } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { FlowDesignerProvider } from "./provider";
import { ErrorBoundary } from "./error-boundary";
import { Header } from "./panels/header";
import { CanvasToolbar } from "./panels/canvas-toolbar";
import { Sidebar } from "./panels/sidebar";
import { Inspector } from "./panels/inspector";
import { Canvas } from "./panels/canvas";
import { setMessageApi } from "./message-holder";
import { getLocale, subscribeLocale, t } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import type { WorkbenchProps } from "./types";
import styles from "./workbench.module.css";
import "./design-tokens.css";

const antdTheme = {
  token: {
    colorPrimary: "#4d7cfe",
    borderRadius: 8,
    fontSize: 13,
    colorBorder: "#e4e8ef",
    colorBgContainer: "#ffffff",
  },
  components: {
    Button: { controlHeight: 32 },
    Input: { controlHeight: 32 },
    Select: { controlHeight: 32 },
    InputNumber: { controlHeight: 32 },
  },
};

function MessageBridge() {
  const { message } = App.useApp();
  setMessageApi(message);
  return null;
}

function LocaleBridge({ locale, documentTitleKey }: { locale: Locale; documentTitleKey?: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;

    if (documentTitleKey) {
      document.title = t(documentTitleKey);
    }
  }, [locale, documentTitleKey]);
  return null;
}

export const Workbench = observer(function Workbench(props: WorkbenchProps) {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  const { engine, className, documentTitleKey } = props;
  const { editor, skeleton } = engine;
  const doc = editor.getDocument();

  const rootClass = className ? `${styles.workbench} ${className}` : styles.workbench;

  return (
    <FlowDesignerProvider engine={engine}>
      <ConfigProvider theme={antdTheme} locale={locale === "zh-CN" ? zhCN : enUS}>
        <App>
          <MessageBridge />
          <LocaleBridge locale={locale} documentTitleKey={documentTitleKey} />
          <ErrorBoundary>
            <div className={rootClass} data-fd-area="workbench">
              {skeleton.header.getVisible() && (
                <Header doc={doc} area={skeleton.header} locale={locale} />
              )}
              <div className={styles.editorContent}>
                {skeleton.sidebar.getVisible() && (
                  <Sidebar area={skeleton.sidebar} locale={locale} />
                )}
                <div className={styles.canvasWorkspace}>
                  <div className={styles.canvasArea}>
                    {skeleton.canvas.getVisible() && <Canvas area={skeleton.canvas} />}
                    {skeleton.canvasToolbar.getVisible() && (
                      <CanvasToolbar doc={doc} area={skeleton.canvasToolbar} locale={locale} />
                    )}
                    <Inspector area={skeleton.inspector} locale={locale} />
                  </div>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </App>
      </ConfigProvider>
    </FlowDesignerProvider>
  );
});
