import { FlowDesignerContext } from './context';
import type { FlowDesignerProviderProps } from './types';

export function FlowDesignerProvider(props: FlowDesignerProviderProps) {
  const { engine, children } = props;
  return (
    <FlowDesignerContext.Provider value={engine}>
      {children}
    </FlowDesignerContext.Provider>
  );
}
