import type { ComponentType, ReactNode } from "react";
import { Component } from "react";
import { subscribeLocale, t } from "@flow-designer/model";

interface NodeErrorBoundaryProps {
  nodeName: string;
  children: ReactNode;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
}

export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  override state: NodeErrorBoundaryState = { hasError: false };
  private unsubscribeLocale: (() => void) | null = null;

  override componentDidMount() {
    this.unsubscribeLocale = subscribeLocale(() => { this.forceUpdate(); });
  }

  override componentWillUnmount() {
    this.unsubscribeLocale?.();
  }

  static getDerivedStateFromError(): NodeErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`[flow-designer] node "${this.props.nodeName}" render error:`, error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 4, color: "#f5222d", fontSize: 12, border: "1px dashed #f5222d" }}>
          {t("common.error.node", { name: this.props.nodeName })}
        </div>
      );
    }
    return this.props.children;
  }
}

export function wrapWithErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  nodeName: string,
): ComponentType<P> {
  return function ErrorBoundaryWrapped(props: P) {
    return (
      <NodeErrorBoundary nodeName={nodeName}>
        <WrappedComponent {...props} />
      </NodeErrorBoundary>
    );
  };
}
