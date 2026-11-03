import { EventEmitter } from "eventemitter3";

export type signalFn = (...args: any[]) => void;
export type destroyFn = () => void;

export default class Signal extends EventEmitter {
  sendSignal(signal: string, ...args: any[]): void {
    this.emit(signal, ...args);
  }

  onSignal(signal: string, fn: signalFn): destroyFn {
    this.on(signal, fn);
    return () => {
      this.removeListener(signal, fn);
    };
  }

  onceSignal(signal: string, fn: signalFn): destroyFn {
    this.once(signal, fn);
    return () => {
      this.removeListener(signal, fn);
    };
  }
}

export const signal = new Signal();
