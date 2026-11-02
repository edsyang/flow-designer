import { describe, it, expect } from 'vitest';
import sequencify from '../src/plugins/sequencify';

function task(dep: string[] = []) {
  return { dep };
}

describe('sequencify', () => {
  it('returns correct order for simple dependency chain', () => {
    const tasks = { a: task(['b']), b: task(['c']), c: task() };
    const result = sequencify(tasks, ['a']);
    expect(result.sequence).toEqual(['c', 'b', 'a']);
    expect(result.missingTasks).toEqual([]);
  });

  it('handles independent tasks', () => {
    const tasks = { a: task(), b: task(), c: task() };
    const result = sequencify(tasks, ['a', 'b', 'c']);
    expect(result.sequence).toEqual(['a', 'b', 'c']);
  });

  it('reports missing tasks', () => {
    const tasks = { a: task(['missing']) };
    const result = sequencify(tasks, ['a']);
    expect(result.missingTasks).toContain('missing');
    expect(result.sequence).toEqual([]);
  });

  it('detects circular dependencies', () => {
    const tasks = { a: task(['b']), b: task(['a']) };
    const result = sequencify(tasks, ['a']);
    expect(result.recursiveDependencies.length).toBeGreaterThan(0);
    expect(result.sequence).toEqual([]);
  });
});
