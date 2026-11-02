import { describe, it, expect } from 'vitest';
import { autorun } from 'mobx';
import { Area } from '../src/area';

describe('Area', () => {
  it('starts with visible = true', () => {
    const area = new Area();
    expect(area.getVisible()).toBe(true);
  });

  it('setVisible changes visible state', () => {
    const area = new Area();
    area.setVisible(false);
    expect(area.getVisible()).toBe(false);
    area.setVisible(true);
    expect(area.getVisible()).toBe(true);
  });

  it('visible is MobX observable (autorun reacts)', () => {
    const area = new Area();
    const values: boolean[] = [];
    autorun(() => {
      values.push(area.getVisible());
    });
    area.setVisible(false);
    area.setVisible(true);
    expect(values).toEqual([true, false, true]);
  });

  it('add() appends items', () => {
    const area = new Area();
    area.add({ key: 'a', area: 'header', content: 'test' });
    area.add({ key: 'b', area: 'header', content: 'test2' });
    expect(area.getItems()).toHaveLength(2);
    expect(area.getItems()[0].key).toBe('a');
  });

  it('remove() removes item by key', () => {
    const area = new Area();
    area.add({ key: 'a', area: 'header', content: 'test' });
    area.add({ key: 'b', area: 'header', content: 'test2' });
    area.remove('a');
    expect(area.getItems()).toHaveLength(1);
    expect(area.getItems()[0].key).toBe('b');
  });

  it('remove() does nothing for non-existent key', () => {
    const area = new Area();
    area.add({ key: 'a', area: 'header', content: 'test' });
    area.remove('nonexistent');
    expect(area.getItems()).toHaveLength(1);
  });

  it('hooks.didMount registers callbacks', () => {
    const area = new Area();
    const calls: string[] = [];
    const cb1 = () => { calls.push('cb1'); };
    const cb2 = () => { calls.push('cb2'); };
    area.hooks.didMount(cb1);
    area.hooks.didMount(cb2);
    expect(area.getDidMountCallbacks()).toHaveLength(2);
    area.getDidMountCallbacks().forEach((cb) => cb(document.createElement('div')));
    expect(calls).toEqual(['cb1', 'cb2']);
  });

  it('getItems returns empty array initially', () => {
    const area = new Area();
    expect(area.getItems()).toEqual([]);
  });
});
