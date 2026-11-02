import { describe, it, expect } from 'vitest';
import ContentTypesRegistry from '../src/registries/content-types-registry';
import type { ContentTransformer } from '../src/types';

describe('ContentTransformer round-trip', () => {
  it('JSON transformer: transformIn → transformOut preserves data', () => {
    const reg = new ContentTypesRegistry();
    const transformer: ContentTransformer<string> = {
      format: 'json',
      contentType: 'generic',
      transformIn(external: string) { return JSON.parse(external); },
      transformOut(data: any) { return JSON.stringify(data); },
    };
    reg.registerTransformer(transformer);

    const original = { nodes: [{ id: '1', type: 'task' }], edges: [] };
    const serialized = JSON.stringify(original);
    const internal = reg.transform('json', serialized);
    const back = reg.transformOut('json', internal);
    expect(JSON.parse(back as string)).toEqual(original);
  });

  it('custom transformer with type conversion', () => {
    const reg = new ContentTypesRegistry();
    const csvTransformer: ContentTransformer<string> = {
      format: 'csv',
      contentType: 'generic',
      transformIn(csv: string) {
        const [header, ...rows] = csv.split('\n');
        const keys = header.split(',');
        return rows.map(row => {
          const vals = row.split(',');
          return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
        });
      },
      transformOut(data: any[]) {
        if (data.length === 0) return '';
        const keys = Object.keys(data[0]);
        return [keys.join(','), ...data.map(r => keys.map(k => r[k]).join(','))].join('\n');
      },
    };
    reg.registerTransformer(csvTransformer);

    const csv = 'name,age\nalice,30\nbob,25';
    const internal = reg.transform('csv', csv);
    expect(internal).toEqual([
      { name: 'alice', age: '30' },
      { name: 'bob', age: '25' },
    ]);
    const output = reg.transformOut('csv', internal);
    expect(output).toBe(csv);
  });

  it('multiple transformers coexist by format', () => {
    const reg = new ContentTypesRegistry();
    const t1: ContentTransformer = {
      format: 'fmt-a',
      contentType: 'x',
      transformIn: (d: any) => ({ from: 'a', data: d }),
      transformOut: (d: any) => d.data,
    };
    const t2: ContentTransformer = {
      format: 'fmt-b',
      contentType: 'x',
      transformIn: (d: any) => ({ from: 'b', data: d }),
      transformOut: (d: any) => d.data,
    };
    reg.registerTransformer(t1);
    reg.registerTransformer(t2);

    expect(reg.transform('fmt-a', 42)).toEqual({ from: 'a', data: 42 });
    expect(reg.transform('fmt-b', 42)).toEqual({ from: 'b', data: 42 });
  });
});
