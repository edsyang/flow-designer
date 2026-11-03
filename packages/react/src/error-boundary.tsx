import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Button } from "antd";
import { t } from "@flow-designer/model";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FlowDesigner] Uncaught error:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24, color: "#cf1322", fontSize: 14 }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{t("common.error.render")}</p>
          <p style={{ margin: "8px 0 0", color: "#595959" }}>{this.state.error.message}</p>
          <Button onClick={this.handleRetry} size="small" style={{ marginTop: 12 }}>
            {t("common.error.retry")}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
