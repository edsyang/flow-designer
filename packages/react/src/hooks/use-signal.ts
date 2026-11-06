import { useEffect } from "react";
import { useEditor } from "./use-editor";

export type SignalHandler = (...args: any[]) => void;

export function useSignal(signalName: string, handler: SignalHandler): void {
  const editor = useEditor();
  useEffect(() => {
    const offEditor = editor.events.onSignal(signalName, handler);
    const offDocument = editor.getDocument().getSignals().onSignal(signalName, handler);
    return () => {
      offDocument();
      offEditor();
    };
  }, [editor, signalName, handler]);
}
