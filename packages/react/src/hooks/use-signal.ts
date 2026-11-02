import { useEffect } from 'react';
import { signal } from '@flow-designer/model';

export type SignalHandler = (...args: any[]) => void;

export function useSignal(signalName: string, handler: SignalHandler): void {
  useEffect(() => {
    return signal.onSignal(signalName, handler);
  }, [signalName, handler]);
}
