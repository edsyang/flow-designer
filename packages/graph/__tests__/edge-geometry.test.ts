import { describe, expect, it } from 'vitest';
import { normalizeOrthogonalVertices } from '../src/edge-geometry';

describe('normalizeOrthogonalVertices', () => {
  const source = { x: 250, y: 225 };
  const target = { x: 600, y: 385 };
  it('erases the closed stub loop reproduced by four consecutive segment drags', () => {
    const vertices = [
      { x: 270, y: 225 }, { x: 270, y: 252 }, { x: 292, y: 252 },
      { x: 292, y: 225 }, { x: 270, y: 225 }, { x: 270, y: 300 },
      { x: 570, y: 300 }, { x: 570, y: 385 },
    ];
    const original = structuredClone(vertices);
    const normalized = normalizeOrthogonalVertices(vertices, source, target, 'right', 'left');
    expect(normalized).toEqual([
      { x: 270, y: 225 }, { x: 270, y: 300 }, { x: 570, y: 300 }, { x: 570, y: 385 },
    ]);
    expect(vertices).toEqual(original);
    expect(normalizeOrthogonalVertices(normalized, source, target, 'right', 'left')).toEqual(normalized);
  });

  it('keeps valid manual bends and removes redundant collinear vertices', () => {
    const vertices = [{ x: 270, y: 225 }, { x: 270, y: 260 }, { x: 400, y: 260 }, { x: 570, y: 260 }, { x: 570, y: 385 }];
    const result = normalizeOrthogonalVertices(vertices, source, target, 'right', 'left');
    expect(result).toEqual([{ x: 270, y: 225 }, { x: 270, y: 260 }, { x: 570, y: 260 }, { x: 570, y: 385 }]);
    expect(normalizeOrthogonalVertices(result, source, target, 'right', 'left')).toEqual(result);
  });

  it('normalizes diagonal input to a stable orthogonal path', () => {
    const result = normalizeOrthogonalVertices([{ x: 400, y: 300 }], source, target, 'right', 'left');
    const points = [source, ...result, target];
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.x === points[i - 1]!.x || points[i]!.y === points[i - 1]!.y).toBe(true);
    }
    expect(normalizeOrthogonalVertices(result, source, target, 'right', 'left')).toEqual(result);
  });
});
