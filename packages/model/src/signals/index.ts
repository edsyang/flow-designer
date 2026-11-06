import { EventEmitter } from "eventemitter3";

export type signalFn = (...args: any[]) => void;
export type destroyFn = () => void;

export default class Signal extends EventEmitter {
  sendSignal(signal: string, ...args: any[]): void {
    this.emit(signal, ...args);
  }

  onSignal(signal: string, fn: signalFn): destroyFn {
    const listener = fn.bind(this);
    this.on(signal, listener);
    return () => {
      this.removeListener(signal, listener);
    };
  }

  onceSignal(signal: string, fn: signalFn): destroyFn {
    const listener = fn.bind(this);
    this.once(signal, listener);
    return () => {
      this.removeListener(signal, listener);
    };
  }
}

export const signal = new Signal();
