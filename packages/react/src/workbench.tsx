import { useEffect, useMemo, useSyncExternalStore } from "react";
import { observer } from "mobx-react-lite";
import { ConfigProvider, App, theme as antdTheme } from "antd";
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
import {
  applyTheme,
  getLocaleSnapshot,
  getThemeSnapshot,
  subscribeLocale,
  subscribeTheme,
  t,
} from "@flow-designer/model";
import type { Locale, Theme } from "@flow-designer/model";
import type { WorkbenchProps } from "./types";
import styles from "./workbench.module.less";
import "./design-tokens.less";

function readLocale(snapshot: string): Locale {
  return snapshot.slice(0, snapshot.indexOf("#")) as Locale;
}

function readTheme(snapshot: string): Theme {
  return snapshot.slice(0, snapshot.indexOf("#")) as Theme;
}

function buildTheme(dark: boolean) {
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: dark ? "#5f95ff" : "#006aff",
      borderRadius: 8,
      fontSize: 13,
      colorBorder: dark ? "#2b3547" : "#e4e8ef",
      colorBgContainer: dark ? "#161b26" : "#ffffff",
    },
    components: {
      Button: { controlHeight: 32 },
      Input: { controlHeight: 32 },
      Select: { controlHeight: 32 },
      InputNumber: { controlHeight: 32 },
    },
  };
}

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
  const locale = readLocale(
    useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot),
  );
  const theme = readTheme(useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeSnapshot));
  const { engine, className, documentTitleKey } = props;
  const { editor, skeleton } = engine;
  const doc = editor.getDocument();
  const themeConfig = useMemo(() => buildTheme(theme === "dark"), [theme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const rootClass = className ? `${styles.workbench} ${className}` : styles.workbench;

  return (
    <FlowDesignerProvider engine={engine}>
      <ConfigProvider theme={themeConfig} locale={locale === "zh-CN" ? zhCN : enUS}>
        <App>
          <MessageBridge />
          <LocaleBridge locale={locale} documentTitleKey={documentTitleKey} />
          <ErrorBoundary>
            <div className={rootClass} data-fd-area="workbench" data-fd-theme={theme}>
              {skeleton.header.getVisible() && (
                <Header doc={doc} area={skeleton.header} locale={locale} />
              )}
              <div className={styles.editorContent}>
                <div className={styles.canvasWorkspace} data-fd-layout="canvasWorkspace">
                  {skeleton.sidebar.getVisible() && (
                    <Sidebar area={skeleton.sidebar} locale={locale} />
                  )}
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
