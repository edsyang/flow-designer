import type { ComponentType, ReactNode } from 'react';
import { Component } from 'react';

interface NodeErrorBoundaryProps {
  nodeName: string;
  children: ReactNode;
}

interface NodeErrorBoundaryState {
  hasError: boolean;
}

export class NodeErrorBoundary extends Component<NodeErrorBoundaryProps, NodeErrorBoundaryState> {
  override state: NodeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): NodeErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`[flow-designer] node "${this.props.nodeName}" render error:`, error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 4, color: '#f5222d', fontSize: 12, border: '1px dashed #f5222d' }}>
          {this.props.nodeName} 渲染异常
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
