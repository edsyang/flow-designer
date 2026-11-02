import { createContext, useContext } from 'react';
import type { EngineShape } from './types';

export const FlowDesignerContext = createContext<EngineShape | null>(null);

export function useFlowDesigner(): EngineShape {
  const engine = useContext(FlowDesignerContext);
  if (!engine) {
    throw new Error('useFlowDesigner must be used within a FlowDesignerProvider');
  }
  return engine;
}
