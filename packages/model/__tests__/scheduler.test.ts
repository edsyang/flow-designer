import { describe, expect, it, vi } from 'vitest';
import Props from '../src/props';
import { nextTick } from '../src/utils/scheduler';

describe('dirty task scheduling', () => {
  it('runs only dirty props and preserves reentrant mutations for the next flush', async () => {
    const idle = new Props({}, { value: 0 });
    const active = new Props({}, { value: 0 });
    const idleRun = vi.spyOn(idle, 'runTask');
    const activeRun = vi.spyOn(active, 'runTask');
    active.onChange(() => {
      if (active.getPropData('value') === 1) active.setPropData('value', 2);
    });
    active.setPropData('value', 1);
    await nextTick();
    await nextTick();
    expect(idleRun).not.toHaveBeenCalled();
    expect(activeRun).toHaveBeenCalledTimes(2);
    expect(active.getPropData('value')).toBe(2);
    idle.didPurge(); active.didPurge();
  });
});
