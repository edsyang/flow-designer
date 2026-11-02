import { describe, it, expect, vi } from 'vitest';
import Signal from '../src/signals';

describe('Signal', () => {
  it('sendSignal triggers onSignal listener', () => {
    const s = new Signal();
    const fn = vi.fn();
    s.onSignal('test', fn);
    s.sendSignal('test', 'a', 'b');
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });

  it('onSignal returns unsubscribe function', () => {
    const s = new Signal();
    const fn = vi.fn();
    const unsub = s.onSignal('test', fn);
    unsub();
    s.sendSignal('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('onceSignal fires only once', () => {
    const s = new Signal();
    const fn = vi.fn();
    s.onceSignal('test', fn);
    s.sendSignal('test', 1);
    s.sendSignal('test', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('onceSignal returns unsubscribe that prevents firing', () => {
    const s = new Signal();
    const fn = vi.fn();
    const unsub = s.onceSignal('test', fn);
    unsub();
    s.sendSignal('test');
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple listeners on same signal', () => {
    const s = new Signal();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    s.onSignal('evt', fn1);
    s.onSignal('evt', fn2);
    s.sendSignal('evt', 42);
    expect(fn1).toHaveBeenCalledWith(42);
    expect(fn2).toHaveBeenCalledWith(42);
  });

  it('different signals are independent', () => {
    const s = new Signal();
    const fnA = vi.fn();
    const fnB = vi.fn();
    s.onSignal('a', fnA);
    s.onSignal('b', fnB);
    s.sendSignal('a');
    expect(fnA).toHaveBeenCalled();
    expect(fnB).not.toHaveBeenCalled();
  });
});
