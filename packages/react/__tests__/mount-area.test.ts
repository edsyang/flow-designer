import { describe, expect, it } from 'vitest';
import { Skeleton } from '@flow-designer/skeleton';
import { mountArea } from '../src/panels/mount-area';

describe('area resource ownership', () => {
  it('cleans contributions in reverse order and unregisters callbacks before a later mount', () => {
    const area = new Skeleton().canvas;
    const events: string[] = [];
    const unregister = area.hooks.didMount(() => { events.push('mount'); return () => { events.push('cleanup'); }; });
    const dispose = mountArea(area, document.createElement('div'));
    dispose(); dispose();
    expect(events).toEqual(['mount','cleanup']);
    unregister();
    mountArea(area, document.createElement('div'))();
    expect(events).toEqual(['mount','cleanup']);
  });
  it('rolls acquired resources back on partial mount failure', () => {
    const area = new Skeleton().canvas; const events: string[] = [];
    area.hooks.didMount(() => () => { events.push('first cleanup'); });
    area.hooks.didMount(() => () => { events.push('second cleanup'); });
    area.hooks.didMount(() => { throw new Error('mount failed'); });
    expect(() => mountArea(area, document.createElement('div'))).toThrow('mount failed');
    expect(events).toEqual(['second cleanup','first cleanup']);
  });
});
