import { observer } from 'mobx-react-lite';
import { ConfigProvider, App } from 'antd';
import { FlowDesignerProvider } from './provider';
import { ErrorBoundary } from './error-boundary';
import { Header } from './panels/header';
import { CanvasToolbar } from './panels/canvas-toolbar';
import { Sidebar } from './panels/sidebar';
import { Inspector } from './panels/inspector';
import { Canvas } from './panels/canvas';
import { setMessageApi } from './message-holder';
import type { WorkbenchProps } from './types';
import './design-tokens.css';
import styles from './workbench.module.css';

const antdTheme = {
  token: {
    colorPrimary: '#4d7cfe',
    borderRadius: 8,
    fontSize: 13,
    colorBorder: '#e4e8ef',
    colorBgContainer: '#ffffff',
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

export const Workbench = observer(function Workbench(props: WorkbenchProps) {
  const { engine, className } = props;
  const { editor, skeleton } = engine;
  const doc = editor.getDocument();

  const rootClass = className ? `${styles.workbench} ${className}` : styles.workbench;

  return (
    <FlowDesignerProvider engine={engine}>
      <ConfigProvider theme={antdTheme}>
        <App>
          <MessageBridge />
          <ErrorBoundary>
          <div className={rootClass} data-fd-area="workbench">
            {skeleton.header.getVisible() && (
              <Header doc={doc} area={skeleton.header} />
            )}
            <div className={styles.editorContent}>
              {skeleton.sidebar.getVisible() && (
                <Sidebar area={skeleton.sidebar} />
              )}
              <div className={styles.canvasWorkspace}>
                <div className={styles.canvasArea}>
                  {skeleton.canvas.getVisible() && (
                    <Canvas area={skeleton.canvas} />
                  )}
                  {skeleton.canvasToolbar.getVisible() && (
                    <CanvasToolbar doc={doc} area={skeleton.canvasToolbar} />
                  )}
                  <Inspector area={skeleton.inspector} />
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
